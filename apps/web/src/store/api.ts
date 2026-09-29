import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type {
  Activity,
  Comment,
  Label,
  LabelAssignment,
  CreateTaskInput,
  PublicUser,
  Task,
  UpdateTaskInput,
} from "@auralis/shared";
import { API_ORIGIN } from "@/config";

/**
 * Identifies this browser tab to the server, so the realtime stream can tell
 * a client's own echo from someone else's change and skip re-applying work it
 * has already done optimistically.
 */
export const CLIENT_ID = crypto.randomUUID();

export interface BoardSummary {
  id: string;
  name: string;
  role: BoardRole;
}

export type BoardRole = "owner" | "editor" | "viewer";

export interface BoardMember {
  userId: string;
  name: string;
  color: string;
  role: BoardRole;
  /** Null for guest accounts, whose address is a generated placeholder. */
  email?: string | null;
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_ORIGIN ? API_ORIGIN + "/api" : "/api",
  credentials: "include",
  prepareHeaders: (headers) => {
    headers.set("X-Client-Id", CLIENT_ID);
    return headers;
  },
});

/**
 * Wraps the base query so a 401 triggers exactly one refresh attempt and then
 * replays the original request.
 *
 * Access tokens are short-lived by design, so an expiry mid-session is normal
 * rather than exceptional — the user should never see it. Concurrent 401s
 * share a single in-flight refresh instead of stampeding the endpoint.
 */
let refreshInFlight: Promise<boolean> | null = null;

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401 && !isAuthEndpoint(args)) {
    refreshInFlight ??= (async () => {
      const refresh = await rawBaseQuery(
        { url: "/auth/refresh", method: "POST" },
        api,
        extraOptions
      );
      return refresh.error === undefined;
    })();

    const refreshed = await refreshInFlight;
    refreshInFlight = null;

    if (refreshed) {
      result = await rawBaseQuery(args, api, extraOptions);
    }
  }

  return result;
};

/** Refreshing on a failed login would mask the real error. */
function isAuthEndpoint(args: string | FetchArgs): boolean {
  const url = typeof args === "string" ? args : args.url;
  return url.startsWith("/auth/");
}

export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Task", "Board", "Session", "Activity", "Dependency", "Comment", "Label"],
  endpoints: (builder) => ({
    getSession: builder.query<{ user: PublicUser; boards: BoardSummary[] }, void>({
      query: () => "/auth/me",
      providesTags: ["Session", "Board"],
    }),

    login: builder.mutation<{ user: PublicUser }, { email: string; password: string }>({
      query: (body) => ({ url: "/auth/login", method: "POST", body }),
      invalidatesTags: ["Session", "Board", "Task"],
    }),

    signup: builder.mutation<
      { user: PublicUser; boardId: string },
      { email: string; password: string; name: string }
    >({
      query: (body) => ({ url: "/auth/signup", method: "POST", body }),
      invalidatesTags: ["Session", "Board", "Task"],
    }),

    startGuestSession: builder.mutation<{ user: PublicUser; boardId: string }, void>({
      query: () => ({ url: "/auth/guest", method: "POST" }),
      invalidatesTags: ["Session", "Board", "Task"],
    }),

    logout: builder.mutation<void, void>({
      query: () => ({ url: "/auth/logout", method: "POST" }),
      invalidatesTags: ["Session", "Board", "Task"],
    }),

    getBoardMembers: builder.query<{ members: BoardMember[] }, string>({
      query: (boardId) => `/boards/${boardId}/members`,
      providesTags: ["Board"],
    }),

    createBoard: builder.mutation<{ board: BoardSummary }, { name: string }>({
      query: (body) => ({ url: "/boards", method: "POST", body }),
      invalidatesTags: ["Board"],
    }),

    renameBoard: builder.mutation<void, { boardId: string; name: string }>({
      query: ({ boardId, name }) => ({
        url: `/boards/${boardId}`,
        method: "PATCH",
        body: { name },
      }),
      invalidatesTags: ["Board"],
    }),

    deleteBoard: builder.mutation<void, string>({
      query: (boardId) => ({ url: `/boards/${boardId}`, method: "DELETE" }),
      invalidatesTags: ["Board"],
    }),

    inviteMember: builder.mutation<
      { member: BoardMember },
      { boardId: string; email: string; role: "editor" | "viewer" }
    >({
      query: ({ boardId, ...body }) => ({
        url: `/boards/${boardId}/members`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Board"],
    }),

    updateMemberRole: builder.mutation<
      void,
      { boardId: string; userId: string; role: "editor" | "viewer" }
    >({
      query: ({ boardId, userId, role }) => ({
        url: `/boards/${boardId}/members/${userId}`,
        method: "PATCH",
        body: { role },
      }),
      invalidatesTags: ["Board"],
    }),

    removeMember: builder.mutation<void, { boardId: string; userId: string }>({
      query: ({ boardId, userId }) => ({
        url: `/boards/${boardId}/members/${userId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Board"],
    }),

    getTasks: builder.query<Task[], string>({
      query: (boardId) => `/tasks?boardId=${boardId}`,
      transformResponse: (response: { tasks: Task[] }) => response.tasks,
      providesTags: (result) => [
        { type: "Task" as const, id: "LIST" },
        ...(result ?? []).map((task) => ({ type: "Task" as const, id: task.id })),
      ],
    }),

    createTask: builder.mutation<Task, CreateTaskInput & { boardId: string }>({
      query: (body) => ({ url: "/tasks", method: "POST", body }),
      transformResponse: (response: { task: Task }) => response.task,
      /**
       * The card appears the instant it is submitted, carrying the id the
       * client generated. When the server replies, that same id is patched in
       * place rather than replaced — so the card never flickers or jumps.
       */
      async onQueryStarted(input, { dispatch, queryFulfilled }) {
        const optimistic = buildOptimisticTask(input);
        const patch = dispatch(
          api.util.updateQueryData("getTasks", input.boardId, (draft) => {
            draft.push(optimistic);
          })
        );
        try {
          const { data } = await queryFulfilled;
          dispatch(
            api.util.updateQueryData("getTasks", input.boardId, (draft) => {
              const index = draft.findIndex((task) => task.id === optimistic.id);
              if (index >= 0) draft[index] = data;
              else draft.push(data);
            })
          );
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: [{ type: "Activity", id: "LIST" }],
    }),

    updateTask: builder.mutation<
      Task,
      { id: string; boardId: string; updates: UpdateTaskInput }
    >({
      query: ({ id, updates }) => ({ url: `/tasks/${id}`, method: "PATCH", body: updates }),
      transformResponse: (response: { task: Task }) => response.task,
      async onQueryStarted({ id, boardId, updates }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          api.util.updateQueryData("getTasks", boardId, (draft) => {
            const task = draft.find((candidate) => candidate.id === id);
            if (!task) return;
            Object.assign(task, updates);
            // Mirror the server's completion rule locally, so the completed
            // timestamp and any "done" styling appear without a round trip.
            if (updates.status === "completed" && !task.completedAt) {
              task.completedAt = new Date().toISOString();
            } else if (updates.status && updates.status !== "completed") {
              task.completedAt = null;
            }
            task.updatedAt = new Date().toISOString();
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (_result, _error, arg) => [{ type: "Activity", id: arg.id }],
    }),

    deleteTask: builder.mutation<void, { id: string; boardId: string }>({
      query: ({ id }) => ({ url: `/tasks/${id}`, method: "DELETE" }),
      async onQueryStarted({ id, boardId }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          api.util.updateQueryData("getTasks", boardId, (draft) => {
            const index = draft.findIndex((task) => task.id === id);
            if (index >= 0) draft.splice(index, 1);
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),

    bulkUpdateTasks: builder.mutation<
      Task[],
      { ids: string[]; boardId: string; updates: UpdateTaskInput }
    >({
      query: ({ ids, updates }) => ({
        url: "/tasks/bulk",
        method: "PATCH",
        body: { ids, updates },
      }),
      transformResponse: (response: { tasks: Task[] }) => response.tasks,
      async onQueryStarted({ ids, boardId, updates }, { dispatch, queryFulfilled }) {
        const selected = new Set(ids);
        const patch = dispatch(
          api.util.updateQueryData("getTasks", boardId, (draft) => {
            for (const task of draft) {
              if (!selected.has(task.id)) continue;
              Object.assign(task, updates);
              if (updates.status === "completed") {
                task.completedAt ??= new Date().toISOString();
              } else if (updates.status) {
                task.completedAt = null;
              }
            }
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),

    bulkCreateTasks: builder.mutation<Task[], { boardId: string; tasks: CreateTaskInput[] }>({
      query: (body) => ({ url: "/tasks/bulk-create", method: "POST", body }),
      transformResponse: (response: { tasks: Task[] }) => response.tasks,
      // No optimistic insert: an import can be hundreds of rows, and the
      // server assigns their positions. Invalidating refetches the board once.
      invalidatesTags: [{ type: "Task", id: "LIST" }],
    }),

    bulkDeleteTasks: builder.mutation<{ deleted: number }, { ids: string[]; boardId: string }>({
      query: ({ ids }) => ({ url: "/tasks/bulk-delete", method: "POST", body: { ids } }),
      async onQueryStarted({ ids, boardId }, { dispatch, queryFulfilled }) {
        const doomed = new Set(ids);
        const patch = dispatch(
          api.util.updateQueryData("getTasks", boardId, (draft) =>
            draft.filter((task) => !doomed.has(task.id))
          )
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),

    getTaskDependencies: builder.query<{ blockedBy: Task[]; blocking: Task[] }, string>({
      query: (taskId) => `/tasks/${taskId}/dependencies`,
      providesTags: (_r, _e, taskId) => [{ type: "Dependency", id: taskId }],
    }),

    addDependency: builder.mutation<void, { taskId: string; blockerId: string }>({
      query: ({ taskId, blockerId }) => ({
        url: `/tasks/${taskId}/dependencies`,
        method: "POST",
        body: { blockerId },
      }),
      invalidatesTags: (_r, _e, arg) => [
        { type: "Dependency", id: arg.taskId },
        { type: "Dependency", id: arg.blockerId },
      ],
    }),

    removeDependency: builder.mutation<void, { taskId: string; blockerId: string }>({
      query: ({ taskId, blockerId }) => ({
        url: `/tasks/${taskId}/dependencies/${blockerId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, arg) => [
        { type: "Dependency", id: arg.taskId },
        { type: "Dependency", id: arg.blockerId },
      ],
    }),

    getComments: builder.query<Comment[], string>({
      query: (taskId) => `/tasks/${taskId}/comments`,
      transformResponse: (response: { comments: Comment[] }) => response.comments,
      providesTags: (_r, _e, taskId) => [{ type: "Comment", id: taskId }],
    }),

    addComment: builder.mutation<{ comment: Comment }, { taskId: string; body: string }>({
      query: ({ taskId, body }) => ({
        url: `/tasks/${taskId}/comments`,
        method: "POST",
        body: { body },
      }),
      invalidatesTags: (_r, _e, arg) => [
        { type: "Comment", id: arg.taskId },
        { type: "Activity", id: arg.taskId },
      ],
    }),

    editComment: builder.mutation<
      { comment: Comment },
      { taskId: string; commentId: string; body: string }
    >({
      query: ({ taskId, commentId, body }) => ({
        url: `/tasks/${taskId}/comments/${commentId}`,
        method: "PATCH",
        body: { body },
      }),
      invalidatesTags: (_r, _e, arg) => [{ type: "Comment", id: arg.taskId }],
    }),

    deleteComment: builder.mutation<void, { taskId: string; commentId: string }>({
      query: ({ taskId, commentId }) => ({
        url: `/tasks/${taskId}/comments/${commentId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, arg) => [{ type: "Comment", id: arg.taskId }],
    }),

    getLabels: builder.query<{ labels: Label[]; assignments: LabelAssignment[] }, string>({
      query: (boardId) => `/boards/${boardId}/labels`,
      providesTags: (_r, _e, boardId) => [{ type: "Label", id: boardId }],
    }),

    createLabel: builder.mutation<
      { label: Label },
      { boardId: string; name: string; color: string }
    >({
      query: ({ boardId, ...body }) => ({
        url: `/boards/${boardId}/labels`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_r, _e, arg) => [{ type: "Label", id: arg.boardId }],
    }),

    updateLabel: builder.mutation<
      { label: Label },
      { boardId: string; labelId: string; name?: string; color?: string }
    >({
      query: ({ boardId, labelId, ...body }) => ({
        url: `/boards/${boardId}/labels/${labelId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_r, _e, arg) => [{ type: "Label", id: arg.boardId }],
    }),

    deleteLabel: builder.mutation<void, { boardId: string; labelId: string }>({
      query: ({ boardId, labelId }) => ({
        url: `/boards/${boardId}/labels/${labelId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, arg) => [{ type: "Label", id: arg.boardId }],
    }),

    /** Applied to the cache at once, so a toggled label shows before the server answers. */
    setTaskLabels: builder.mutation<
      void,
      { boardId: string; taskId: string; labelIds: string[] }
    >({
      query: ({ taskId, labelIds }) => ({
        url: `/tasks/${taskId}/labels`,
        method: "PUT",
        body: { labelIds },
      }),
      async onQueryStarted({ boardId, taskId, labelIds }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          api.util.updateQueryData("getLabels", boardId, (draft) => {
            draft.assignments = [
              ...draft.assignments.filter((entry) => entry.taskId !== taskId),
              ...labelIds.map((labelId) => ({ taskId, labelId })),
            ];
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      // Refetching afterwards settles a race: a label-list refetch already in
      // flight (after creating a label, say) could otherwise land last and
      // erase the optimistic assignment.
      invalidatesTags: (_r, _e, arg) => [
        { type: "Activity", id: arg.taskId },
        { type: "Label", id: arg.boardId },
      ],
    }),

    getTaskActivity: builder.query<Activity[], string>({
      query: (taskId) => `/tasks/${taskId}/activity`,
      transformResponse: (response: { activity: Activity[] }) => response.activity,
      providesTags: (_result, _error, taskId) => [{ type: "Activity", id: taskId }],
    }),
  }),
});

/** A believable stand-in for the server's row until the real one arrives. */
function buildOptimisticTask(input: CreateTaskInput & { boardId: string }): Task {
  const now = new Date().toISOString();
  const status = input.status ?? "todo";
  return {
    id: input.id ?? crypto.randomUUID(),
    boardId: input.boardId,
    title: input.title,
    description: input.description ?? "",
    status,
    priority: input.priority ?? "low",
    dueDate: input.dueDate ?? null,
    assigneeId: input.assigneeId ?? null,
    // Sorts last within its column, which is where the server will put it.
    position: input.position ?? "zzzz",
    parentId: input.parentId ?? null,
    recurrence: input.recurrence ?? null,
    createdAt: now,
    updatedAt: now,
    completedAt: status === "completed" ? now : null,
  };
}

export const {
  useGetSessionQuery,
  useLoginMutation,
  useSignupMutation,
  useStartGuestSessionMutation,
  useLogoutMutation,
  useGetBoardMembersQuery,
  useCreateBoardMutation,
  useRenameBoardMutation,
  useDeleteBoardMutation,
  useInviteMemberMutation,
  useUpdateMemberRoleMutation,
  useRemoveMemberMutation,
  useGetTasksQuery,
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
  useBulkUpdateTasksMutation,
  useBulkCreateTasksMutation,
  useBulkDeleteTasksMutation,
  useGetTaskDependenciesQuery,
  useAddDependencyMutation,
  useRemoveDependencyMutation,
  useGetTaskActivityQuery,
  useGetCommentsQuery,
  useAddCommentMutation,
  useEditCommentMutation,
  useDeleteCommentMutation,
  useGetLabelsQuery,
  useCreateLabelMutation,
  useUpdateLabelMutation,
  useDeleteLabelMutation,
  useSetTaskLabelsMutation,
} = api;

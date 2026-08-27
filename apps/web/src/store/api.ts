import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type {
  Activity,
  CreateTaskInput,
  PublicUser,
  Task,
  UpdateTaskInput,
} from "@auralis/shared";

/**
 * Identifies this browser tab to the server, so the realtime stream can tell
 * a client's own echo from someone else's change and skip re-applying work it
 * has already done optimistically.
 */
export const CLIENT_ID = crypto.randomUUID();

export interface BoardSummary {
  id: string;
  name: string;
  role: "owner" | "editor" | "viewer";
}

export interface BoardMember {
  userId: string;
  name: string;
  color: string;
  role: string;
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: "/api",
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
  tagTypes: ["Task", "Board", "Session", "Activity"],
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
  useGetTasksQuery,
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
  useBulkUpdateTasksMutation,
  useBulkDeleteTasksMutation,
  useGetTaskActivityQuery,
} = api;

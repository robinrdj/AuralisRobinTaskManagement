import { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import type { BoardSummary } from "./store/api";
import type { PublicUser } from "@auralis/shared";
import { useCreateBoardMutation, useGetTasksQuery } from "./store/api";
import { useAppDispatch, useAppSelector } from "./store";
import { requestCompose } from "./store/uiSlice";
import { AppShell } from "./components/AppShell";
import { ToastViewport } from "./components/ToastViewport";
import { CommandPalette } from "./components/CommandPalette";
import { Button, Spinner } from "./components/ui/primitives";

/**
 * Everything behind the sign-in wall.
 *
 * Split from `App` so that none of it — the shell, the board, the charts, the
 * command palette, the animation library — is in the bundle a signed-out
 * visitor downloads to read the landing page.
 */
const BoardPage = lazy(() =>
  import("./board/BoardPage").then((module) => ({ default: module.BoardPage }))
);
const AnalyticsPage = lazy(() =>
  import("./pages/AnalyticsPage").then((module) => ({ default: module.AnalyticsPage }))
);
const CalendarPage = lazy(() =>
  import("./schedule/CalendarPage").then((module) => ({ default: module.CalendarPage }))
);
const TimelinePage = lazy(() =>
  import("./schedule/TimelinePage").then((module) => ({ default: module.TimelinePage }))
);

export default function AuthenticatedApp({
  user,
  boards,
}: {
  user: PublicUser;
  boards: BoardSummary[];
}) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const activeBoardId = useAppSelector((state) => state.ui.activeBoardId);
  // A remembered board the user has since left or deleted falls back to the first.
  const board = boards.find((candidate) => candidate.id === activeBoardId) ?? boards[0];
  const boardId = board?.id;
  const readOnly = board?.role === "viewer";

  // Reads from the cache the board already filled, so the palette can search
  // tasks without issuing a request of its own.
  const { data: tasks = [] } = useGetTasksQuery(boardId ?? "", { skip: !boardId });

  if (!board || !boardId) {
    return <NoBoards />;
  }

  return (
    <AppShell user={user} boards={boards} activeBoard={board}>
      <Routes>
        <Route path="/" element={<Navigate to="/board" replace />} />
        <Route path="/signin" element={<Navigate to="/board" replace />} />
        <Route path="/signup" element={<Navigate to="/board" replace />} />
        <Route
          path="/board"
          element={
            <Suspense fallback={<RouteSpinner label="Loading board" />}>
              <BoardPage
                key={boardId}
                boardId={boardId}
                boardName={board.name}
                readOnly={readOnly}
              />
            </Suspense>
          }
        />
        <Route
          path="/analytics"
          element={
            <Suspense fallback={<RouteSpinner label="Loading analytics" />}>
              <AnalyticsPage boardId={boardId} />
            </Suspense>
          }
        />
        <Route
          path="/calendar"
          element={
            <Suspense fallback={<RouteSpinner label="Loading calendar" />}>
              <CalendarPage key={boardId} boardId={boardId} readOnly={readOnly} />
            </Suspense>
          }
        />
        <Route
          path="/timeline"
          element={
            <Suspense fallback={<RouteSpinner label="Loading timeline" />}>
              <TimelinePage key={boardId} boardId={boardId} readOnly={readOnly} />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/board" replace />} />
      </Routes>

      <CommandPalette
        tasks={tasks}
        boards={boards}
        activeBoardId={boardId}
        onNewTask={() => {
          // The board owns the composer, so creating a task from elsewhere
          // means going there first — one creation path, not two.
          navigate("/board");
          dispatch(requestCompose());
        }}
      />
      <ToastViewport />
    </AppShell>
  );
}

/** Reached only if every board was removed out from under the user. */
function NoBoards() {
  const [createBoard, { isLoading }] = useCreateBoardMutation();
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-[var(--surface-sunken)] p-6 text-center">
      <p className="text-sm text-[var(--text-secondary)]">You are not on any boards.</p>
      <Button
        variant="primary"
        disabled={isLoading}
        onClick={() => void createBoard({ name: "My board" })}
      >
        Create a board
      </Button>
    </div>
  );
}

function RouteSpinner({ label }: { label: string }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Spinner label={label} />
    </div>
  );
}

import { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import type { BoardSummary } from "./store/api";
import type { PublicUser } from "@auralis/shared";
import { useGetTasksQuery } from "./store/api";
import { useAppDispatch } from "./store";
import { requestCompose } from "./store/uiSlice";
import { AppShell } from "./components/AppShell";
import { ToastViewport } from "./components/ToastViewport";
import { CommandPalette } from "./components/CommandPalette";
import { Spinner } from "./components/ui/primitives";

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

export default function AuthenticatedApp({
  user,
  boards,
}: {
  user: PublicUser;
  boards: BoardSummary[];
}) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const board = boards[0];
  const boardId = board?.id;

  // Reads from the cache the board already filled, so the palette can search
  // tasks without issuing a request of its own.
  const { data: tasks = [] } = useGetTasksQuery(boardId ?? "", { skip: !boardId });

  if (!boardId) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[var(--surface-sunken)] p-6 text-center">
        <p className="text-sm text-[var(--text-secondary)]">
          Your account has no board yet. Reload the page to create one.
        </p>
      </div>
    );
  }

  return (
    <AppShell user={user} boards={boards}>
      <Routes>
        <Route path="/" element={<Navigate to="/board" replace />} />
        <Route path="/signin" element={<Navigate to="/board" replace />} />
        <Route path="/signup" element={<Navigate to="/board" replace />} />
        <Route
          path="/board"
          element={
            <Suspense fallback={<RouteSpinner label="Loading board" />}>
              <BoardPage key={boardId} boardId={boardId} boardName={board?.name ?? "Board"} />
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
        <Route path="*" element={<Navigate to="/board" replace />} />
      </Routes>

      <CommandPalette
        tasks={tasks}
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

function RouteSpinner({ label }: { label: string }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Spinner label={label} />
    </div>
  );
}

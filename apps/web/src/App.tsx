import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useGetSessionQuery } from "./store/api";
import { LandingPage } from "./pages/LandingPage";
import { AuthPage } from "./pages/AuthPage";
import { Spinner } from "./components/ui/primitives";
import { useTheme } from "./hooks/useTheme";

/**
 * The whole signed-in application, loaded only once there is a session.
 *
 * A visitor who lands on the marketing page downloads this file, the landing
 * page and the store — not the board, the charts, the drag-and-drop engine or
 * the animation library.
 */
const AuthenticatedApp = lazy(() => import("./AuthenticatedApp"));

export default function App() {
  // Mounted once at the root so the theme attribute is applied app-wide.
  useTheme();

  const { data: session, isLoading, isError } = useGetSessionQuery();

  if (isLoading) return <FullScreenSpinner label="Loading Task Manager" />;

  // A 401 here is the normal signed-out state, not an error worth showing.
  if (isError || !session) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signin" element={<AuthPage mode="signin" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <Suspense fallback={<FullScreenSpinner label="Loading your board" />}>
      <AuthenticatedApp user={session.user} boards={session.boards} />
    </Suspense>
  );
}

function FullScreenSpinner({ label }: { label: string }) {
  return (
    <div className="flex h-dvh items-center justify-center bg-[var(--surface-sunken)]">
      <Spinner label={label} />
    </div>
  );
}

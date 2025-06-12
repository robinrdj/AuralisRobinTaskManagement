import React, { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import AddTask from "./Pages/AddTask";
import TaskBoard from "./Pages/TaskBoard";
import { useSelector } from "react-redux";
import type { RootState } from "./store/store";
import UploadJson from "./Pages/UploadJson";
import { SnackbarProvider } from "notistack";
import ScrollToTop from "./ScrollToTop";
import { ClipLoader } from "react-spinners";
import "./App.css";

// Lazy loading  the Analytics component
const Analytics = lazy(() => import("./Pages/Analytics"));

const App: React.FC = () => {
  const theme = useSelector((state: RootState) => state.theme);

  return (
    <div className={`app-container ${theme}`}>
      <SnackbarProvider maxSnack={3} autoHideDuration={6000}>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<AddTask />} />
          <Route path="/taskboard" element={<TaskBoard />} />
          <Route
            path="/analytics"
            element={
              <Suspense
                fallback={
                  <div>
                    <ClipLoader size={14} color="#36d7b7" />
                    Loading Analytics...
                  </div>
                }
              >
                <Analytics />
              </Suspense>
            }
          />
          <Route path="/uploadJson" element={<UploadJson />} />
        </Routes>
      </SnackbarProvider>
    </div>
  );
};

export default App;

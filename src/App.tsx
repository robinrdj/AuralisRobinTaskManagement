import React, { Suspense, lazy } from "react";
import {Route, Routes } from "react-router-dom";
import AddTask from "./components/AddTask";
import TaskBoard from "./components/TaskBoard";
import { useSelector } from "react-redux";
import type { RootState } from "./store/store";
import UploadJson from "./components/UploadJson";
import { SnackbarProvider } from "notistack";
import ScrollToTop from "./ScrollToTop";
import "./App.css";

// Lazy loading  the Analytics component
const Analytics = lazy(() => import("./components/Analytics"));

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
              <Suspense fallback={<div>Loading Analytics...</div>}>
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

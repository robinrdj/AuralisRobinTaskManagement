import React from "react";
import { Route, Routes } from "react-router-dom";
import AddTask from "./components/AddTask";
import TaskBoard from "./components/TaskBoard";
import Analytics from "./components/Analytics";
import { useSelector } from "react-redux";
import type { RootState } from "./store/store";
import UploadJson from "./components/UploadJson";
import { SnackbarProvider } from "notistack";
import "./App.css";

const App: React.FC = () => {
  const theme = useSelector((state: RootState) => state.theme);

  return (
    <div className={`app-container ${theme}`}>
      <SnackbarProvider maxSnack={3} autoHideDuration={6000}>
        <Routes>
          <Route path="/" element={<AddTask />} />
          <Route path="/taskboard" element={<TaskBoard />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/uploadJson" element={<UploadJson />} />
        </Routes>
      </SnackbarProvider>
    </div>
  );
};

export default App;

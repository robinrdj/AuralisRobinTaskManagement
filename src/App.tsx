import React from "react";
import "./App.css";
import { Route, Routes } from "react-router-dom";
import AddTask from "./components/AddTask";
import TaskBoard from "./components/TaskBoard";
import { useSelector, useDispatch } from "react-redux";
import { toggleTheme } from "./store/themeSlice";
import type { RootState } from "./store/store.ts";

const App: React.FC = () => {
  const theme = useSelector((state: RootState) => state.theme);
  const dispatch = useDispatch();

  const appStyles = {
    backgroundColor: theme === "dark" ? "#000" : "#fff",
    color: theme === "dark" ? "#fff" : "#000",
    minHeight: "100vh",
    padding: "20px",
  };

  return (
    <div style={appStyles}>
      <button onClick={() => dispatch(toggleTheme())}>Toggle Dark Mode</button>
      <Routes>
        <Route
          path="/"
          element={
            <div>
              <AddTask />
              <hr />
              <TaskBoard />
              <hr />
            </div>
          }
        />
      </Routes>
    </div>
  );
};

export default App;

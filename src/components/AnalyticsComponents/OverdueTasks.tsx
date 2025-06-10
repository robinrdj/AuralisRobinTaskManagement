import React from "react";
import { useSelector } from "react-redux";
import { Task } from "../../store/taskSlice";

const OverdueTasks: React.FC = () => {
  const tasks = useSelector<{ tasks: Task[] }, Task[]>((state) => state.tasks);
  const theme = useSelector<{ theme: "light" | "dark" }, "light" | "dark">(
    (state) => state.theme
  );

  const now = new Date();
  const overdueTasks = tasks.filter((task) => {
    return (
      task.status !== "completed" &&
      task.due_date &&
      new Date(task.due_date) < now
    );
  });

  const isDark = theme === "dark";

  return (
    <div
      style={{
        padding: "1rem",
        color: isDark ? "#fff" : "#000",
      }}
    >
      <h3>Overdue Tasks</h3>
      <p>
        <strong>Count:</strong> {overdueTasks.length}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {overdueTasks.map((task) => (
          <div
            key={task.id}
            style={{
              padding: "10px",
              border: `1px solid ${isDark ? "#555" : "#ccc"}`,
              borderRadius: "6px",
              backgroundColor: isDark ? "#422626" : "#ffe5e5",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              color: isDark ? "#fff" : "#000",
            }}
          >
            <div>
              <strong>Title:</strong> {task.title}
            </div>
            <div>
              <strong>Priority:</strong> {task.priority}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OverdueTasks;

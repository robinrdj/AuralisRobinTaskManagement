import React from "react";
import { useSelector } from "react-redux";
import { Task } from "../../store/taskSlice";
import StaticTaskCard from "./StaticTaskCard";

const OverdueTasks: React.FC = () => {
  const tasks = useSelector<{ tasks: Task[] }, Task[]>((state) => state.tasks);
  const theme = useSelector<{ theme: "light" | "dark" }, "light" | "dark">(
    (state) => state.theme
  );

  const now = new Date();
  const overdueTasks = tasks.filter(
    (task) =>
      task.status !== "completed" &&
      task.due_date &&
      new Date(task.due_date) < now
  );

  return (
    <div style={{ padding: "1rem", color: theme === "dark" ? "#fff" : "#000" }}>
      <h3>Overdue Tasks</h3>
      <p>
        <strong>Count:</strong> {overdueTasks.length}
      </p>
      <div className="overdue-grid">

        {overdueTasks.map((task) => (
          <StaticTaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
};

export default OverdueTasks;

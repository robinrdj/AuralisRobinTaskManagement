import React from "react";
import { useSelector } from "react-redux";
import { Task } from "../../store/taskSlice";
import StaticTaskCard from "./StaticTaskCard";

/**
 * OverdueTasks component
 * Displays a list of overdue tasks (tasks not completed and past their due date).
 */
const OverdueTasks: React.FC = () => {
  // Get all tasks from Redux store
  const tasks = useSelector<{ tasks: Task[] }, Task[]>((state) => state.tasks);
  // Get current theme (light/dark) from Redux store
  const theme = useSelector<{ theme: "light" | "dark" }, "light" | "dark">(
    (state) => state.theme
  );

  // Helper to format a Date object to DD-MM-YYYY
  const formatToDDMMYYYY = (date: Date) => {
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  // Get today's date in DD-MM-YYYY format
  const today = formatToDDMMYYYY(new Date());

  // Filter tasks to find overdue ones (not completed and due date before today)
  // String comparison works since both are in dd-mm-yyyy format
  const overdueTasks = tasks.filter((task) => {
    if (!task.due_date || task.status === "completed") return false;
    return task.due_date < today;
  });

  // Render the overdue tasks section
  return (
    <div style={{ padding: "1rem", color: theme === "dark" ? "#fff" : "#000" }}>
      {/* Section title */}
      <h3>Overdue Tasks</h3>
      {/* Show count of overdue tasks */}
      <p>
        <strong>Count:</strong> {overdueTasks.length}
      </p>
      {/* Grid of overdue task cards or empty state message */}
      <div className="overdue-grid">
        {overdueTasks.length === 0 ? (
          <p>No overdue tasks found.</p>
        ) : (
          overdueTasks.map((task) => (
            <StaticTaskCard key={task.id} task={task} />
          ))
        )}
      </div>
    </div>
  );
};

export default OverdueTasks;

import React from "react";
import { useSelector } from "react-redux";
import { Task } from "../../store/taskSlice";
import StaticTaskCard from "./StaticTaskCard";

/**
 * OverdueTasks component
 * Displays a list of overdue tasks (tasks not completed and past their due date).
 */
const OverdueTasks: React.FC = () => {
  const tasks = useSelector<{ tasks: Task[] }, Task[]>((state) => state.tasks);
  const theme = useSelector<{ theme: "light" | "dark" }, "light" | "dark">(
    (state) => state.theme
  );

  // Helper to convert dd-mm-yyyy to Date object (no time component)
  const parseDDMMYYYY = (dateStr: string): Date | null => {
    const [dd, mm, yyyy] = dateStr.split("-");
    if (!dd || !mm || !yyyy) return null;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd)); 
  };

  // Helper to strip time from a Date
  const stripTime = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const todayStripped = stripTime(new Date());

  const overdueTasks = tasks.filter((task) => {
    if (!task.due_date || task.status === "completed") return false;

    const dueDateObj = parseDDMMYYYY(task.due_date);
    if (!dueDateObj) return false;

    // Compare dates with time stripped
    return stripTime(dueDateObj) < todayStripped;
  });

  return (
    <div style={{ padding: "1rem", color: theme === "dark" ? "#fff" : "#000" }}>
      <h3>Overdue Tasks</h3>
      <p>
        <strong>Count:</strong> {overdueTasks.length}
      </p>
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

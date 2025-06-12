import React from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { useSelector } from "react-redux";
import { Task } from "../../store/taskSlice";

// Register necessary chart.js components for the Line chart
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Number of days to show in the chart
const DAYS_TO_SHOW = 14;

// Helper to format a Date object to DD-MM-YYYY
const formatToDDMMYYYY = (date: Date): string => {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

// Helper to get an array of the last N dates (formatted as DD-MM-YYYY)
const getLastNDates = (n: number): string[] => {
  const dates: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(formatToDDMMYYYY(d));
  }
  return dates;
};

/**
 * TaskCompletionRate component
 * Displays a line chart showing the number of tasks completed per day for the last 14 days.
 */
const TaskCompletionRate: React.FC = () => {
  // Get all tasks from Redux store
  const tasks = useSelector<{ tasks: Task[] }, Task[]>((state) => state.tasks);
  // Get current theme (light/dark) from Redux store
  const theme = useSelector<{ theme: "light" | "dark" }, "light" | "dark">(
    (state) => state.theme
  );

  // Get the last 14 dates for the x-axis
  const lastDates = getLastNDates(DAYS_TO_SHOW);

  // Count the number of completed tasks for each date
  const completedCountByDate = lastDates.map((date) => {
    return tasks.filter(
      (task) =>
        task.status === "completed" &&
        task.completed_on &&
        formatToDDMMYYYY(new Date(task.completed_on)) === date
    ).length;
  });

  // Prepare data for the Line chart
  const data = {
    labels: lastDates,
    datasets: [
      {
        label: "Tasks Completed in a day",
        data: completedCountByDate,
        fill: false,
        borderColor: theme === "dark" ? "#4bc0c0" : "#36a2eb",
        tension: 0.3,
      },
    ],
  };

  // Chart options, including theme-based colors for axes and grid
  const options = {
    responsive: false,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // Hide legend for a cleaner look
      },
      title: {
        display: false, // Hide title (handled by parent)
        text: "Task Completion Rate",
        color: theme === "dark" ? "#fff" : "#000",
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        precision: 0,
        ticks: {
          stepSize: 1,
          color: theme === "dark" ? "#fff" : "#000",
        },
        grid: {
          color: theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
        },
      },
      x: {
        ticks: {
          color: theme === "dark" ? "#fff" : "#000",
        },
        grid: {
          color: theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
        },
      },
    },
  };

  // Render the Line chart centered in its container
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Line options={options} data={data} />
    </div>
  );
};

export default TaskCompletionRate;

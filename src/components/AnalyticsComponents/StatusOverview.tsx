import React from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import { useSelector } from "react-redux";
import { Task } from "../../store/taskSlice";

// Register necessary chart.js components for the Bar chart
ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

// Define the possible status labels for tasks
const statusLabels = ["todo", "inprogress", "review", "completed"];

/**
 * StatusOverview component
 * Displays a bar chart showing the count of tasks for each status.
 */
const StatusOverview: React.FC = () => {
  // Get all tasks from Redux store
  const tasks: Task[] = useSelector((state: any) => state.tasks);
  // Get current theme (light/dark) from Redux store
  const theme = useSelector<{ theme: "light" | "dark" }, "light" | "dark">(
    (state) => state.theme
  );

  // Count the number of tasks for each status
  const statusCounts = statusLabels.map(
    (status) => tasks.filter((task) => task.status === status).length
  );

  // Prepare data for the Bar chart
  const data = {
    labels: statusLabels.map((s) => s.toUpperCase()), // Display status labels in uppercase
    datasets: [
      {
        label: "Tasks Count",
        data: statusCounts,
        backgroundColor: ["#3498db", "#1E3A8A", "#9b59b6", "#27ae60"], // Colors for each status
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
        labels: {
          color: theme === "dark" ? "#fff" : "#000",
        },
      },
      tooltip: { enabled: true }, // Enable tooltips on hover
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
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

  // Render the Bar chart centered in its container
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
      <Bar data={data} options={options} />
    </div>
  );
};

export default StatusOverview;

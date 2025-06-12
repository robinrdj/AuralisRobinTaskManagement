import React from "react";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { useSelector } from "react-redux";
import { Task, Priority } from "../../store/taskSlice";

// Register necessary chart.js components for the Pie chart
ChartJS.register(ArcElement, Tooltip, Legend);

/**
 * PriorityDistribution component
 * Displays a pie chart showing the distribution of tasks by priority (low, medium, high).
 */
const PriorityDistribution: React.FC = () => {
  // Get all tasks from Redux store
  const tasks = useSelector<{ tasks: Task[] }, Task[]>((state) => state.tasks);
  // Get current theme (light/dark) from Redux store

  // Count the number of tasks for each priority
  const priorityCounts = tasks.reduce<Record<Priority, number>>(
    (acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1;
      return acc;
    },
    { low: 0, medium: 0, high: 0 }
  );

  // Prepare data for the Pie chart
  const data = {
    labels: ["Low", "Medium", "High"],
    datasets: [
      {
        label: "tasks",
        data: [priorityCounts.low, priorityCounts.medium, priorityCounts.high],
        backgroundColor: ["#ffeb3b", "#ff9800", "#f44336"], // Colors for each priority
        hoverOffset: 5,
      },
    ],
  };

  // Chart options (legend and title hidden for a clean look)
  const options = {
    responsive: false,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
    },
  };

  // Render the Pie chart centered in its container
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
      <Pie data={data} options={options} />
    </div>
  );
};

export default PriorityDistribution;

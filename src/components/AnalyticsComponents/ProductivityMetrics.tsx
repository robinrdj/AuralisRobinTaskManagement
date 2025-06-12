import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { useSelector } from "react-redux";
import { Task } from "../../store/taskSlice";

// Register chart.js components needed for the Bar chart
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Helper to format ISO date to DD-MM-YYYY (Indian format)
const formatToIndianDate = (isoDate: string): string => {
  const [year, month, day] = isoDate.split("-");
  return `${day}-${month}-${year}`;
};

// Helper to get the start of the week (Sunday) for a given date
const getWeekStart = (date: Date) => {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay()); // Sunday as start of the week
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
};

// Helper to get an array of the last N week start dates (ISO format)
const getLastNWeeks = (n: number): string[] => {
  const today = new Date();
  const weeks: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - d.getDay() - i * 7); // Go back week by week
    weeks.push(getWeekStart(d));
  }
  return weeks;
};

/**
 * ProductivityMetrics component
 * Displays a bar chart showing the number of tasks completed per week for the last 14 weeks.
 */
const ProductivityMetrics: React.FC = () => {
  // Get all tasks from Redux store
  const tasks = useSelector<{ tasks: Task[] }, Task[]>((state) => state.tasks);
  // Get current theme (light/dark) from Redux store
  const theme = useSelector<{ theme: "light" | "dark" }, "light" | "dark">(
    (state) => state.theme
  );

  // Filter only completed tasks
  const completedTasks = tasks.filter((task) => task.status === "completed");

  // Generate the last 14 week labels (ISO format)
  const weeksToShow = getLastNWeeks(14);

  // Count completed tasks per week
  const weeklyCounts: Record<string, number> = {};
  completedTasks.forEach((task) => {
    if (task.completed_on) {
      const week = getWeekStart(new Date(task.completed_on));
      weeklyCounts[week] = (weeklyCounts[week] || 0) + 1;
    }
  });

  // Prepare the data for the Bar chart
  const data = {
    labels: weeksToShow.map(formatToIndianDate), // Format week start dates for display
    datasets: [
      {
        label: "Tasks Completed in a week",
        data: weeksToShow.map((week) => weeklyCounts[week] || 0),
        backgroundColor: "#4caf50", // Green bars
      },
    ],
  };

  // Chart options, including theme-based colors for axes and grid
  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: false, // Hide legend for a cleaner look
      },
      title: {
        display: false, // Hide title (handled by parent)
        text: "Productivity Metrics - Tasks Completed per Week",
        color: theme === "dark" ? "#fff" : "#000",
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        precision: 0,
        ticks: {
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
      <Bar options={options} data={data} />
    </div>
  );
};

export default ProductivityMetrics;

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

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const statusLabels = ["todo", "inprogress", "review", "completed"];

const StatusOverview: React.FC = () => {
  const tasks: Task[] = useSelector((state: any) => state.tasks);
  const theme = useSelector<{ theme: "light" | "dark" }, "light" | "dark">(
    (state) => state.theme
  );

  const statusCounts = statusLabels.map(
    (status) => tasks.filter((task) => task.status === status).length
  );

  const data = {
    labels: statusLabels.map((s) => s.toUpperCase()),
    datasets: [
      {
        label: "Tasks Count",
        data: statusCounts,
        backgroundColor: ["#3498db", "#1E3A8A", "#9b59b6", "#27ae60"],
      },
    ],
  };

  // #0047AB
  // #0D47A1
  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
        labels: {
          color: theme === "dark" ? "#fff" : "#000",
        },
      },
      tooltip: { enabled: true },
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

  return (
    <div style={{ margin: "0 auto" }}>
      <h3 style={{ color: theme === "dark" ? "#fff" : "#000" }}>
        Status Overview
      </h3>
      <Bar data={data} options={options} />
    </div>
  );
};

export default StatusOverview;

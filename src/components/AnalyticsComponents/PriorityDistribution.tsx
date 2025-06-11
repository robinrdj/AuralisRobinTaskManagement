import React from "react";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { useSelector } from "react-redux";
import { Task, Priority } from "../../store/taskSlice";

ChartJS.register(ArcElement, Tooltip, Legend);

const PriorityDistribution: React.FC = () => {
  const tasks = useSelector<{ tasks: Task[] }, Task[]>((state) => state.tasks);
  const theme = useSelector<{ theme: "light" | "dark" }, "light" | "dark">(
    (state) => state.theme
  );

  const priorityCounts = tasks.reduce<Record<Priority, number>>(
    (acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1;
      return acc;
    },
    { low: 0, medium: 0, high: 0 }
  );

  const data = {
    labels: ["Low", "Medium", "High"],
    datasets: [
      {
        label: "Priority Distribution",
        data: [priorityCounts.low, priorityCounts.medium, priorityCounts.high],
        backgroundColor: ["#ffeb3b", "#ff9800", "#f44336"],
        hoverOffset: 20,
      },
    ],
  };

  const options = {
    responsive: false,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
        text: "Current Tasks by Priority",
        color: theme === "dark" ? "#fff" : "#000",
      },
    },
  };
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

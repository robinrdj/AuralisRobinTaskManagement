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

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const DAYS_TO_SHOW = 14;

const formatToDDMMYYYY = (date: Date): string => {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

const getLastNDates = (n: number): string[] => {
  const dates: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(formatToDDMMYYYY(d));
  }
  return dates;
};
const TaskCompletionRate: React.FC = () => {
  const tasks = useSelector<{ tasks: Task[] }, Task[]>((state) => state.tasks);
  const theme = useSelector<{ theme: "light" | "dark" }, "light" | "dark">(
    (state) => state.theme
  );

  const lastDates = getLastNDates(DAYS_TO_SHOW);

  const completedCountByDate = lastDates.map((date) => {
    return tasks.filter(
      (task) =>
        task.status === "completed" &&
        task.completed_on &&
        formatToDDMMYYYY(new Date(task.completed_on)) === date
    ).length;
  });

  const data = {
    labels: lastDates,
    datasets: [
      {
        label: "Tasks Completed",
        data: completedCountByDate,
        fill: false,
        borderColor: theme === "dark" ? "#4bc0c0" : "#36a2eb",
        tension: 0.3,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          color: theme === "dark" ? "#fff" : "#000",
        },
      },
      title: {
        display: false,
        text: "Task Completion Rate (Last 14 Days)",
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
  return (
    <div style={{ margin: "0 auto" }}>
      <h3 style={{ color: theme === "dark" ? "#fff" : "#000" }}>
        Task Completion Rate
      </h3>
      <Line options={options} data={data} />
      <p style={{ textAlign: "center" }}>(task completed in last 14 days)</p>
    </div>
  );
};

export default TaskCompletionRate;

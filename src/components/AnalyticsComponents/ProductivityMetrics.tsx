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

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);
const formatToIndianDate = (isoDate: string): string => {
  const [year, month, day] = isoDate.split("-");
  return `${day}-${month}-${year}`;
};

const getWeekStart = (date: Date) => {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay()); // Sunday as start of the week
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
};

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

const ProductivityMetrics: React.FC = () => {
  const tasks = useSelector<{ tasks: Task[] }, Task[]>((state) => state.tasks);
  const theme = useSelector<{ theme: "light" | "dark" }, "light" | "dark">(
    (state) => state.theme
  );

  const completedTasks = tasks.filter((task) => task.status === "completed");

  // Generate the last 14 week labels
  const weeksToShow = getLastNWeeks(14);

  // Count tasks per week
  const weeklyCounts: Record<string, number> = {};
  completedTasks.forEach((task) => {
    if (task.completed_on) {
      const week = getWeekStart(new Date(task.completed_on));
      weeklyCounts[week] = (weeklyCounts[week] || 0) + 1;
    }
  });

  // Final dataset based on fixed 14 weeks
  const data = {
    labels: weeksToShow.map(formatToIndianDate),
    datasets: [
      {
        label: "Tasks Completed",
        data: weeksToShow.map((week) => weeklyCounts[week] || 0),
        backgroundColor: "#4caf50",
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
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

  return (
    <div style={{ margin: "0 auto" }}>
      <h3 style={{ color: theme === "dark" ? "#fff" : "#000" }}>
        Productivity Metrics
      </h3>
      <Bar options={options} data={data} />
      <p style={{ textAlign: "center" }}>(task completed in last 14 weeks)</p>
    </div>
  );
};

export default ProductivityMetrics;

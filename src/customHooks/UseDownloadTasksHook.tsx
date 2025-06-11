import { useCallback } from "react";
import { Task } from "../store/taskSlice";

const useDownloadTasks = () => {
  const downloadJSON = useCallback((taskMap: Record<string, Task>) => {
    const visibleTasks = Object.values(taskMap);
    const json = JSON.stringify(visibleTasks, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "filtered_tasks.json";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const downloadCSV = useCallback((taskMap: Record<string, Task>) => {
    const visibleTasks = Object.values(taskMap);
    if (visibleTasks.length === 0) return;

    const headers = Object.keys(visibleTasks[0]) as (keyof Task)[];
    const csvRows = [
      headers.join(","),
      ...visibleTasks.map((task) =>
        headers
          .map(
            (field) => `"${(task[field] ?? "").toString().replace(/"/g, '""')}"`
          )
          .join(",")
      ),
    ];

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "filtered_tasks.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return { downloadJSON, downloadCSV };
};

export default useDownloadTasks;

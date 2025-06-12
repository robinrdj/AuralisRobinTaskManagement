import { useCallback } from "react";
import { Task } from "../store/taskSlice";

// Custom hook for downloading tasks as JSON or CSV files
const useDownloadTasks = () => {
  // Downloads the provided tasks as a JSON file.
    const downloadJSON = useCallback((taskMap: Record<string, Task>) => {
    const visibleTasks = Object.values(taskMap); // Get all tasks as an array
    const json = JSON.stringify(visibleTasks, null, 2); // Pretty-print JSON
    const blob = new Blob([json], { type: "application/json" }); // Create a Blob for download
    const url = URL.createObjectURL(blob); // Create a temporary URL for the Blob

    // Create a temporary anchor element to trigger download
    const a = document.createElement("a");
    a.href = url;
    a.download = "filtered_tasks.json";
    a.click();
    URL.revokeObjectURL(url); // Clean up the URL
  }, []);


  // Downloads the provided tasks as a CSV file.
  const downloadCSV = useCallback((taskMap: Record<string, Task>) => {
    const visibleTasks = Object.values(taskMap); // Get all tasks as an array
    if (visibleTasks.length === 0) return; // No tasks to download

    // Get CSV headers from the first task's keys
    const headers = Object.keys(visibleTasks[0]) as (keyof Task)[];
    // Build CSV rows: header row + data rows
    const csvRows = [
      headers.join(","), // Header row
      ...visibleTasks.map((task) =>
        headers
          .map(
            (field) => `"${(task[field] ?? "").toString().replace(/"/g, '""')}"`
          )
          .join(",")
      ),
    ];

    const csvContent = csvRows.join("\n"); // Join rows with newlines
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" }); // Create a Blob for download
    const url = URL.createObjectURL(blob); // Create a temporary URL for the Blob

    // Create a temporary anchor element to trigger download
    const a = document.createElement("a");
    a.href = url;
    a.download = "filtered_tasks.csv";
    a.click();
    URL.revokeObjectURL(url); // Clean up the URL
  }, []);

  // Expose download handlers for use in components
  return { downloadJSON, downloadCSV };
};

export default useDownloadTasks;

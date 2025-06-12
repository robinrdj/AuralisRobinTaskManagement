import { useSelector } from "react-redux";
import { Task } from "../store/taskSlice";
import * as XLSX from "xlsx";

/**
 * Custom hook to export various analytics and chart data to an Excel file.
 * Gathers data for daily/weekly completions, overdue tasks, status, and priority breakdowns.
 */
export const useExportToExcel = () => {
  // Get all tasks from Redux store
  const tasks = useSelector<{ tasks: Task[] }, Task[]>((state) => state.tasks);

  /**
   * Formats a date string to DD-MM-YYYY.
   * @param dateStr - ISO date string
   */
  const formatToDDMMYYYY = (dateStr: string) => {
    const date = new Date(dateStr);
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  /**
   * Downloads an Excel report with multiple sheets:
   * - Daily completions (last 14 days)
   * - Weekly completions (last 4 weeks)
   * - Overdue tasks
   * - Status breakdown
   * - Priority breakdown
   */
  const downloadExcelReport = () => {
    //Daily completions for the last 14 days
    const DAYS_TO_SHOW = 14;
    const lastNDates = Array.from({ length: DAYS_TO_SHOW }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (DAYS_TO_SHOW - 1 - i));
      return formatToDDMMYYYY(d.toISOString());
    });

    const completedPerDay = lastNDates.map((date) => ({
      Date: date,
      CompletedTasks: tasks.filter(
        (t) =>
          t.status === "completed" &&
          t.completed_on &&
          formatToDDMMYYYY(t.completed_on) === date
      ).length,
    }));

    //Weekly completions for the last 4 weeks
    const weeksToShow = 4;
    const completedPerWeek: { Week: string; CompletedTasks: number }[] = [];

    for (let i = 0; i < weeksToShow; i++) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7 * (weeksToShow - 1 - i));
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const count = tasks.filter((t) => {
        if (t.status !== "completed" || !t.completed_on) return false;
        const completedDate = new Date(t.completed_on);
        return completedDate >= weekStart && completedDate <= weekEnd;
      }).length;

      completedPerWeek.push({
        Week: `${formatToDDMMYYYY(weekStart.toISOString())} to ${formatToDDMMYYYY(
          weekEnd.toISOString()
        )}`,
        CompletedTasks: count,
      });
    }

    //Status breakdown (count of tasks per status)
    const statusMap: { [key: string]: number } = {};
    tasks.forEach((t) => {
      statusMap[t.status] = (statusMap[t.status] || 0) + 1;
    });
    const groupedByStatus = Object.entries(statusMap).map(
      ([status, count]) => ({
        Status: status,
        Count: count,
      })
    );

    //Priority breakdown (count of tasks per priority)
    const priorityMap: { [key: string]: number } = {};
    tasks.forEach((t) => {
      priorityMap[t.priority] = (priorityMap[t.priority] || 0) + 1;
    });
    const groupedByPriority = Object.entries(priorityMap).map(
      ([priority, count]) => ({
        Priority: priority,
        Count: count,
      })
    );

    //Create Excel workbook and append all sheets
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(completedPerDay),
      "Daily Completions"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(completedPerWeek),
      "Weekly Completions"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(groupedByStatus),
      "Status Breakdown"
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(groupedByPriority),
      "Priority Breakdown"
    );
    //Trigger download of the Excel file
    XLSX.writeFile(wb, "task_analytics.xlsx");
  };

  // Expose the download function to components
  return { downloadExcelReport };
};

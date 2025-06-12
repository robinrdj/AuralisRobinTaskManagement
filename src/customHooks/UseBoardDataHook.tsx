import { useMemo, useCallback } from "react";
import { Task, Status } from "../store/taskSlice";
import { indianToISODate } from "../utils/dateUtils";

// Define possible sort options for tasks
type SortOption = "none" | "due_date" | "priority" | "title" | "created_on";

// Filters interface for filtering tasks
interface Filters {
  showFilters: boolean;
  statusFilter: string;
  priorityFilter: string;
  assigneeFilter: string;
  dueStartDate: string;
  dueEndDate: string;
  createdStartDate: string;
  createdEndDate: string;
}

/**
 * Custom hook to process and organize board data (tasks) with sorting and filtering.
 * Returns columns for board view and a map of filtered tasks.
 */
export const useBoardData = (
  tasks: Task[],
  sortBy: SortOption,
  debouncedSearch: string,
  filters: Filters
) => {
  // Sorting functionality for tasks based on selected sort option
  const sortTasks = useCallback(
    (taskList: Task[]): Task[] => {
      switch (sortBy) {
        case "due_date":
          // Sort by due date (converted to ISO format)
          return [...taskList].sort((a, b) =>
            indianToISODate(a.due_date || "").localeCompare(
              indianToISODate(b.due_date || "")
            )
          );
        case "priority":
          // Sort by priority (high > medium > low)
          const priorityOrder = { high: 1, medium: 2, low: 3 };
          return [...taskList].sort(
            (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
          );
        case "title":
          // Sort alphabetically by title
          return [...taskList].sort((a, b) => a.title.localeCompare(b.title));
        case "created_on":
          // Sort by creation order (id)
          return [...taskList].sort((a, b) => a.id - b.id);
        default:
          // No sorting
          return taskList;
      }
    },
    [sortBy]
  );

  // Memoized computation for filtering and grouping tasks into board columns
  const { taskMap, columns } = useMemo(() => {
    const taskMap: Record<string, Task> = {};
    const columns: Record<Status, { name: string; taskIds: string[] }> = {
      todo: { name: "Todo", taskIds: [] },
      inprogress: { name: "In Progress", taskIds: [] },
      review: { name: "Review", taskIds: [] },
      completed: { name: "Completed", taskIds: [] },
    };

    // Grouped tasks by status
    const grouped: Record<Status, Task[]> = {
      todo: [],
      inprogress: [],
      review: [],
      completed: [],
    };

    // Filter tasks based on search, status, priority, assignee, and date ranges
    const filteredTasks = tasks.filter((task) => {
      // Search filter (title or description)
      const matchesSearch =
        task.title.toLowerCase().includes(debouncedSearch) ||
        task.description.toLowerCase().includes(debouncedSearch);

      // Status filter
      const matchesStatus = filters.statusFilter
        ? task.status === filters.statusFilter
        : true;

      // Priority filter
      const matchesPriority = filters.priorityFilter
        ? task.priority === filters.priorityFilter
        : true;

      // Assignee filter
      const matchesAssignee = filters.assigneeFilter
        ? task.assignee === filters.assigneeFilter
        : true;

      // Due date filter (range)
      const matchesDueDate = (() => {
        if (!filters.dueStartDate && !filters.dueEndDate) return true;
        const due = new Date(indianToISODate(task.due_date || "")).getTime();
        const start = filters.dueStartDate
          ? new Date(filters.dueStartDate).getTime()
          : -Infinity;
        const end = filters.dueEndDate
          ? new Date(filters.dueEndDate).getTime()
          : Infinity;
        return due >= start && due <= end;
      })();

      // Creation date filter (range)
      const matchesCreation = (() => {
        if (!filters.createdStartDate && !filters.createdEndDate) return true;

        const createdDateStr = task.created_on?.split("T")[0]; // "YYYY-MM-DD"
        const ddmmyyyy = createdDateStr?.split("-").reverse().join("-") || ""; // to "DD-MM-YYYY"
        const creation = new Date(indianToISODate(ddmmyyyy)).getTime();

        const start = filters.createdStartDate
          ? new Date(filters.createdStartDate).getTime()
          : -Infinity;
        const end = filters.createdEndDate
          ? new Date(filters.createdEndDate).getTime()
          : Infinity;

        return creation >= start && creation <= end;
      })();

      // Only include tasks that match all filters
      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesAssignee &&
        matchesDueDate &&
        matchesCreation
      );
    });

    // Place filtered tasks into their respective columns and map
    for (const task of filteredTasks) {
      taskMap[task.id.toString()] = task;
      grouped[task.status].push(task);
    }

    // Sort tasks in each column and store their IDs
    for (const [status, taskList] of Object.entries(grouped)) {
      columns[status as Status].taskIds = sortTasks(taskList).map((t) =>
        t.id.toString()
      );
    }

    return { taskMap, columns };
  }, [tasks, debouncedSearch, filters, sortTasks]);

  // Return columns for board and filtered task map
  return { columns, tasks: taskMap };
};

import { useMemo, useCallback } from "react";
import { Task, Status } from "../store/taskSlice";
import { indianToISODate } from "../utils/dateUtils";

type SortOption = "none" | "due_date" | "priority" | "title" | "created_on";

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

export const useBoardData = (
  tasks: Task[],
  sortBy: SortOption,
  debouncedSearch: string,
  filters: Filters
) => {
  const sortTasks = useCallback(
    (taskList: Task[]): Task[] => {
      switch (sortBy) {
        case "due_date":
          return [...taskList].sort((a, b) =>
            indianToISODate(a.due_date || "").localeCompare(
              indianToISODate(b.due_date || "")
            )
          );
        case "priority":
          const priorityOrder = { high: 1, medium: 2, low: 3 };
          return [...taskList].sort(
            (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
          );
        case "title":
          return [...taskList].sort((a, b) => a.title.localeCompare(b.title));
        case "created_on":
          return [...taskList].sort((a, b) => a.id - b.id);
        default:
          return taskList;
      }
    },
    [sortBy]
  );

  const { taskMap, columns } = useMemo(() => {
    const taskMap: Record<string, Task> = {};
    const columns: Record<Status, { name: string; taskIds: string[] }> = {
      todo: { name: "Todo", taskIds: [] },
      inprogress: { name: "In Progress", taskIds: [] },
      review: { name: "Review", taskIds: [] },
      completed: { name: "Completed", taskIds: [] },
    };

    const grouped: Record<Status, Task[]> = {
      todo: [],
      inprogress: [],
      review: [],
      completed: [],
    };

    const filteredTasks = tasks.filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(debouncedSearch) ||
        task.description.toLowerCase().includes(debouncedSearch);

      const matchesStatus = filters.statusFilter
        ? task.status === filters.statusFilter
        : true;

      const matchesPriority = filters.priorityFilter
        ? task.priority === filters.priorityFilter
        : true;

      const matchesAssignee = filters.assigneeFilter
        ? task.assignee === filters.assigneeFilter
        : true;

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

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesAssignee &&
        matchesDueDate &&
        matchesCreation
      );
    });

    for (const task of filteredTasks) {
      taskMap[task.id.toString()] = task;
      grouped[task.status].push(task);
    }

    for (const [status, taskList] of Object.entries(grouped)) {
      columns[status as Status].taskIds = sortTasks(taskList).map((t) =>
        t.id.toString()
      );
    }

    return { taskMap, columns };
  }, [tasks, debouncedSearch, filters, sortTasks]);

  return { columns, tasks: taskMap };
};

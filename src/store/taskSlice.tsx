import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { formatToIndianDate } from "../utils/dateUtils";

// Define possible values for priority and status
export type Priority = "low" | "medium" | "high";
export type Status = "todo" | "inprogress" | "review" | "completed";

// Task interface
export interface Task {
  id: number;
  title: string;
  description: string;
  due_date: string | null;
  status: Status;
  assignee: string;
  priority: Priority;
  created_on: string;
  completed_on?: string;
}

// Load tasks from localStorage (if any)
const rawTasks: Task[] = JSON.parse(localStorage.getItem("tasks") || "[]");

// Ensure all loaded tasks have a created_on field
const initialState: Task[] = rawTasks.map((task) => ({
  ...task,
  created_on: task.created_on || new Date(task.id).toISOString(),
}));

// Create the task slice with reducers for CRUD operations
const taskSlice = createSlice({
  name: "tasks",
  initialState,
  reducers: {
    // Add a new task
    addTask: (
      state,
      action: PayloadAction<Omit<Task, "id" | "created_on">>
    ) => {
      const formattedDueDate = action.payload.due_date
        ? formatToIndianDate(action.payload.due_date)
        : null;

      const newTask: Task = {
        ...action.payload,
        due_date: formattedDueDate,
        id: Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`), // Unique ID
        created_on: new Date().toISOString(),
        status: action.payload.status || "todo",
        assignee: action.payload.assignee || "",
        priority: action.payload.priority || "low",
      };

      state.push(newTask);
      localStorage.setItem("tasks", JSON.stringify(state)); // Persist to localStorage
    },

    // Delete a task by ID
    deleteTask: (state, action: PayloadAction<number>) => {
      const index = state.findIndex((task) => task.id === action.payload);
      if (index !== -1) {
        state.splice(index, 1);
        localStorage.setItem("tasks", JSON.stringify(state));
      }
    },

    // Update a task by ID with partial updates
    updateTask: (
      state,
      action: PayloadAction<Partial<Task> & { id: number }>
    ) => {
      const { id, ...updates } = action.payload;
      const index = state.findIndex((task) => task.id === id);
      if (index !== -1) {
        const prev = state[index];
        const nextStatus = updates.status;

        // If marking as completed, set completed_on date
        if (nextStatus === "completed" && prev.status !== "completed") {
          updates.completed_on = new Date().toISOString();
        }

        state[index] = { ...prev, ...updates };
        localStorage.setItem("tasks", JSON.stringify(state));
      }
    },
    
    // Delete multiple tasks by an array of IDs
    deleteMultipleTasks: (state, action: PayloadAction<number[]>) => {
      const idsToDelete = new Set(action.payload);
      for (let i = state.length - 1; i >= 0; i--) {
        if (idsToDelete.has(state[i].id)) {
          state.splice(i, 1);
        }
      }
      localStorage.setItem("tasks", JSON.stringify(state));
    },

    // Update multiple tasks by an array of IDs and updates
    updateMultipleTasks: (
      state,
      action: PayloadAction<{ ids: number[]; updates: Partial<Task> }>
    ) => {
      const { ids, updates } = action.payload;
      const idSet = new Set(ids);

      state.forEach((task) => {
        if (idSet.has(task.id)) {
          Object.assign(task, updates);
        }
      });

      localStorage.setItem("tasks", JSON.stringify(state));
    },
  },
});

// Export action creators for use in components
export const {
  addTask,
  deleteTask,
  updateTask,
  deleteMultipleTasks,
  updateMultipleTasks,
} = taskSlice.actions;

// Export the reducer to be used in the store
export default taskSlice.reducer;

// Selector to get all tasks from the Redux state
export const getAllTasks = (state: { tasks: Task[] }) => state.tasks;

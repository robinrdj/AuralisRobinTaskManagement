import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type Priority = "low" | "medium" | "high";
export type Status = "todo" | "inprogress" | "review" | "completed";

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

const rawTasks: Task[] = JSON.parse(localStorage.getItem("tasks") || "[]");

const initialState: Task[] = rawTasks.map((task) => ({
  ...task,
  created_on: task.created_on || new Date(task.id).toISOString(),
}));

const taskSlice = createSlice({
  name: "tasks",
  initialState,
  reducers: {
    addTask: (
      state,
      action: PayloadAction<Omit<Task, "id" | "created_on">>
    ) => {
      const newTask: Task = {
        ...action.payload,
        id: Date.now(),
        created_on: new Date().toISOString(),
        status: action.payload.status || "todo",
        assignee: action.payload.assignee || "",
        priority: action.payload.priority || "low",
      };
      state.push(newTask);
      localStorage.setItem("tasks", JSON.stringify(state));
    },

    deleteTask: (state, action: PayloadAction<number>) => {
      const index = state.findIndex((task) => task.id === action.payload);
      if (index !== -1) {
        state.splice(index, 1);
        localStorage.setItem("tasks", JSON.stringify(state));
      }
    },

    updateTask: (
      state,
      action: PayloadAction<Partial<Task> & { id: number }>
    ) => {
      const { id, ...updates } = action.payload;
      const index = state.findIndex((task) => task.id === id);
      if (index !== -1) {
        const prev = state[index];
        const nextStatus = updates.status;

        if (nextStatus === "completed" && prev.status !== "completed") {
          updates.completed_on = new Date().toISOString();
        }

        state[index] = { ...prev, ...updates };
        localStorage.setItem("tasks", JSON.stringify(state));
      }
    },

    deleteMultipleTasks: (state, action: PayloadAction<number[]>) => {
      const idsToDelete = new Set(action.payload);
      const newState = state.filter((task) => !idsToDelete.has(task.id));
      localStorage.setItem("tasks", JSON.stringify(newState));
      return newState;
    },

    updateMultipleTasks: (state, action) => {
      const { ids, updates } = action.payload;
      const newState = state.map((task) =>
        ids.includes(task.id) ? { ...task, ...updates } : task
      );
      localStorage.setItem("tasks", JSON.stringify(newState));
      return newState;
    },
  },
});

export const {
  addTask,
  deleteTask,
  updateTask,
  deleteMultipleTasks,
  updateMultipleTasks,
} = taskSlice.actions;

export default taskSlice.reducer;

export const getAllTasks = (state: { tasks: Task[] }) => state.tasks;

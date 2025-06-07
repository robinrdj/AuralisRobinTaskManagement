import { createSlice, PayloadAction } from "@reduxjs/toolkit";

type Priority = "low" | "medium" | "high";
type Status = "todo" | "inprogress" | "review" | "completed";

interface Task {
  id: number;
  title: string;
  description: string;
  due_date: string | null;
  status: Status;
  assignee: string;
  priority: Priority;
}

const initialState: Task[] = JSON.parse(localStorage.getItem("tasks") || "[]");

const taskSlice = createSlice({
  name: "tasks",
  initialState,
  reducers: {
    addTask: (state, action: PayloadAction<Omit<Task, "id">>) => {
      const newTask: Task = {
        ...action.payload,
        id: Date.now(),
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
        state[index] = { ...state[index], ...updates };
        localStorage.setItem("tasks", JSON.stringify(state));
      }
    },
  },
});

export const { addTask, deleteTask, updateTask } = taskSlice.actions;

export const getAllTasks = (state: { tasks: Task[] }) => state.tasks;

export default taskSlice.reducer;

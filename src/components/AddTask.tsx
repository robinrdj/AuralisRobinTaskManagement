import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { addTask } from "../store/taskSlice";
import type { AppDispatch } from "../store/store";

type Priority = "low" | "medium" | "high";
type Status = "todo" | "inprogress" | "review" | "completed";

interface TaskForm {
  title: string;
  description: string;
  due_date: string;
  status: Status;
  assignee: string;
  priority: Priority;
}

const initialFormState: TaskForm = {
  title: "",
  description: "",
  due_date: "",
  status: "todo",
  assignee: "",
  priority: "low",
};

const AddTaskComponent: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [formData, setFormData] = useState<TaskForm>(initialFormState);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert("Title is required.");
      return;
    }
    dispatch(
      addTask({
        ...formData,
        due_date: formData.due_date || null,
      })
    );
    setFormData(initialFormState);
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "grid", gap: "10px", maxWidth: "400px" }}
    >
      <input
        type="text"
        name="title"
        placeholder="Title"
        value={formData.title}
        onChange={handleChange}
        required
      />

      <textarea
        name="description"
        placeholder="Description"
        value={formData.description}
        onChange={handleChange}
      />

      <input
        type="date"
        name="due_date"
        value={formData.due_date}
        onChange={handleChange}
      />

      <select name="status" value={formData.status} onChange={handleChange}>
        <option value="todo">To Do</option>
        <option value="inprogress">In Progress</option>
        <option value="review">Review</option>
        <option value="completed">Completed</option>
      </select>

      <input
        type="text"
        name="assignee"
        placeholder="Assignee"
        value={formData.assignee}
        onChange={handleChange}
      />

      <select name="priority" value={formData.priority} onChange={handleChange}>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>

      <button type="submit">Add Task</button>
    </form>
  );
};

export default AddTaskComponent;

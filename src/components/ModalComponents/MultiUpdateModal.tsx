import React, { useState } from "react";
import { formatToIndianDate, indianToISODate } from "../../utils/dateUtils";

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
interface MultiUpdateModalProps {
  onClose: () => void;
  onSubmit: (updates: Partial<Task>) => void;
}
interface TaskForm {
  title: string;
  description: string;
  due_date: string;
  status: string;
  assignee: string;
  priority: string;
}
const initialFormState: TaskForm = {
  title: "",
  description: "",
  due_date: "",
  status: "",
  assignee: "",
  priority: "",
};

const MultiUpdateModal: React.FC<MultiUpdateModalProps> = ({
  onClose,
  onSubmit,
}) => {
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

    const updates: Partial<Task> = {};

    if (formData.title.trim()) {
      updates.title = formData.title.trim();
    }

    if (formData.description.trim()) {
      updates.description = formData.description.trim();
    }

    updates.due_date = formData.due_date.trim()
      ? formatToIndianDate(formData.due_date.trim())
      : null;

    const validStatuses: Status[] = [
      "todo",
      "inprogress",
      "review",
      "completed",
    ];
    if (validStatuses.includes(formData.status as Status)) {
      updates.status = formData.status as Status;
    }

    if (formData.assignee.trim()) {
      updates.assignee = formData.assignee.trim();
    }

    const validPriorities: Priority[] = ["low", "medium", "high"];
    if (validPriorities.includes(formData.priority as Priority)) {
      updates.priority = formData.priority as Priority;
    }

    onSubmit(updates);
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.4)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 999,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          backgroundColor: "#fff",
          padding: "2rem",
          borderRadius: "8px",
          display: "grid",
          gap: "10px",
          width: "100%",
          maxWidth: "400px",
        }}
      >
        <h2>Update Selected Tasks</h2>

        <input
          type="text"
          name="title"
          placeholder="Title"
          value={formData.title}
          onChange={handleChange}
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
          value={
            /^\d{2}-\d{2}-\d{4}$/.test(formData.due_date)
              ? indianToISODate(formData.due_date)
              : formData.due_date
          }
          onChange={handleChange}
        />

        <input
          type="text"
          name="assignee"
          placeholder="Assignee"
          value={formData.assignee}
          onChange={handleChange}
        />

        <select name="status" value={formData.status} onChange={handleChange}>
          <option value="">-- Status --</option>
          <option value="todo">To Do</option>
          <option value="inprogress">In Progress</option>
          <option value="review">Review</option>
          <option value="completed">Completed</option>
        </select>

        <select
          name="priority"
          value={formData.priority}
          onChange={handleChange}
        >
          <option value="">-- Priority --</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "1rem",
            marginTop: "1rem",
          }}
        >
          <button type="submit">Apply Updates</button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default MultiUpdateModal;

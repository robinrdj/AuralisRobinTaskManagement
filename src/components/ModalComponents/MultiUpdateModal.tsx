import React, { useState } from "react";
import { formatToIndianDate, indianToISODate } from "../../utils/dateUtils";
import "./MultiUpdateModal.css";

// Define possible values for priority and status
export type Priority = "low" | "medium" | "high";
export type Status = "todo" | "inprogress" | "review" | "completed";

// Task interface for updates
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

// Props for the MultiUpdateModal component
interface MultiUpdateModalProps {
  onClose: () => void; // Handler to close the modal
  onSubmit: (updates: Partial<Task>) => void; // Handler to submit updates
}

// Form state interface for the modal
interface TaskForm {
  title: string;
  description: string;
  due_date: string;
  status: string;
  assignee: string;
  priority: string;
}

// Initial state for the form fields
const initialFormState: TaskForm = {
  title: "",
  description: "",
  due_date: "",
  status: "",
  assignee: "",
  priority: "",
};

/**
 * MultiUpdateModal component.
 * Modal dialog for updating multiple selected tasks at once.
 */
const MultiUpdateModal: React.FC<MultiUpdateModalProps> = ({
  onClose,
  onSubmit,
}) => {
  // Local state for form data
  const [formData, setFormData] = useState<TaskForm>(initialFormState);

  /**
   * Handles changes to form fields.
   * Updates the corresponding field in formData state.
   */
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

  /**
   * Handles form submission.
   * Builds an updates object with only filled fields and calls onSubmit.
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const updates: Partial<Task> = {};

    // Only include fields that are filled in the updates object
    if (formData.title.trim()) updates.title = formData.title.trim();
    if (formData.description.trim())
      updates.description = formData.description.trim();

    updates.due_date = formData.due_date.trim()
      ? formatToIndianDate(formData.due_date.trim())
      : null;

    // Validate and include status if valid
    const validStatuses: Status[] = [
      "todo",
      "inprogress",
      "review",
      "completed",
    ];
    if (validStatuses.includes(formData.status as Status)) {
      updates.status = formData.status as Status;
    }

    // Include assignee if filled
    if (formData.assignee.trim()) updates.assignee = formData.assignee.trim();

    // Validate and include priority if valid
    const validPriorities: Priority[] = ["low", "medium", "high"];
    if (validPriorities.includes(formData.priority as Priority)) {
      updates.priority = formData.priority as Priority;
    }

    // Call the parent handler with updates and close the modal
    onSubmit(updates);
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="multi-update-modal-title"
    >
      <form className="multi-update-form" onSubmit={handleSubmit}>
        <h2 id="multi-update-modal-title">Update Selected Tasks</h2>

        {/* Title input */}
        <label htmlFor="multi-title">Title</label>
        <input
          id="multi-title"
          type="text"
          name="title"
          placeholder="Title"
          value={formData.title}
          onChange={handleChange}
        />

        {/* Description textarea */}
        <label htmlFor="multi-description">Description</label>
        <textarea
          id="multi-description"
          name="description"
          placeholder="Description"
          value={formData.description}
          onChange={handleChange}
        />

        {/* Due date input */}
        <label htmlFor="multi-due-date">Due Date</label>
        <input
          id="multi-due-date"
          type="date"
          name="due_date"
          value={
            /^\d{2}-\d{2}-\d{4}$/.test(formData.due_date)
              ? indianToISODate(formData.due_date)
              : formData.due_date
          }
          onChange={handleChange}
        />

        {/* Assignee input */}
        <label htmlFor="multi-assignee">Assignee</label>
        <input
          id="multi-assignee"
          type="text"
          name="assignee"
          placeholder="Assignee"
          value={formData.assignee}
          onChange={handleChange}
        />

        {/* Status select */}
        <label htmlFor="multi-status">Status</label>
        <select
          id="multi-status"
          name="status"
          value={formData.status}
          onChange={handleChange}
        >
          <option value="">-- Status --</option>
          <option value="todo">To Do</option>
          <option value="inprogress">In Progress</option>
          <option value="review">Review</option>
          <option value="completed">Completed</option>
        </select>

        {/* Priority select */}
        <label htmlFor="multi-priority">Priority</label>
        <select
          id="multi-priority"
          name="priority"
          value={formData.priority}
          onChange={handleChange}
        >
          <option value="">-- Priority --</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>

        {/* Action buttons */}
        <div className="button-group">
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

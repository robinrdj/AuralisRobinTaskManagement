import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { addTask } from "../store/taskSlice";
import type { AppDispatch } from "../store/store";
import { Container, Row, Col } from "react-grid-system";
import { useSnackbar } from "notistack";
import { motion } from "framer-motion";

import "./AddTask.css";

// Define possible values for priority and status
type Priority = "low" | "medium" | "high";
type Status = "todo" | "inprogress" | "review" | "completed";

// Interface for the task form state
interface TaskForm {
  title: string;
  description: string;
  due_date: string;
  status: Status;
  assignee: string;
  priority: Priority;
}

// Initial state for the form
const initialFormState: TaskForm = {
  title: "",
  description: "",
  due_date: "",
  status: "todo",
  assignee: "",
  priority: "low",
};

const AddTaskComponent: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar(); // Snackbar for notifications
  const dispatch = useDispatch<AppDispatch>(); // Redux dispatch
  const [formData, setFormData] = useState<TaskForm>(initialFormState); // Form state

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
   * Validates input, dispatches addTask, resets form, and shows notifications.
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      enqueueSnackbar("Title is required.", { variant: "warning" });
      return;
    }
    try {
      dispatch(
        addTask({
          ...formData,
          due_date: formData.due_date || null,
        })
      );
      setFormData(initialFormState);
      enqueueSnackbar("Task added successfully!", { variant: "success" });
    } catch (error: any) {
      enqueueSnackbar(
        error?.message || "Something went wrong while adding the task.",
        { variant: "error" }
      );
    }
  };

  // Render the add task form UI
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Container style={{ maxWidth: 600, height: "100vh" }}>
        <h2 className="form-title" id="add-task-title">
          ADD TASK
        </h2>
        <form
          onSubmit={handleSubmit}
          aria-labelledby="add-task-title"
        >
          <Row gutterWidth={16}>
            <Col xs={12}>
              <label className="form-label" htmlFor="title">
                Title
              </label>
              <input
                id="title"
                type="text"
                name="title"
                placeholder="Title"
                value={formData.title}
                onChange={handleChange}
                required
                className="form-input"
                autoComplete="off"
                aria-required="true"
                aria-label="Task title"
              />
            </Col>

            <Col xs={12}>
              <label className="form-label" htmlFor="description">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                placeholder="Description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                className="form-input"
                aria-label="Task description"
              />
            </Col>

            <Col xs={12} md={6}>
              <label className="form-label" htmlFor="assignee">
                Assignee
              </label>
              <input
                id="assignee"
                type="text"
                name="assignee"
                placeholder="Assignee"
                value={formData.assignee}
                onChange={handleChange}
                className="form-input"
                autoComplete="off"
                aria-label="Task assignee"
              />
            </Col>

            <Col xs={12} md={6}>
              <label className="form-label" htmlFor="due_date">
                Due Date
              </label>
              <input
                id="due_date"
                type="date"
                name="due_date"
                value={formData.due_date}
                onChange={handleChange}
                className="form-input"
                min={new Date().toLocaleDateString("en-CA")}
                aria-label="Task due date"
              />
            </Col>

            <Col xs={12} md={6}>
              <label className="form-label" htmlFor="status">
                Status
              </label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="form-input"
                aria-label="Task status"
              >
                <option value="todo">To Do</option>
                <option value="inprogress">In Progress</option>
                <option value="review">Review</option>
                <option value="completed">Completed</option>
              </select>
            </Col>

            <Col xs={12} md={6}>
              <label className="form-label" htmlFor="priority">
                Priority
              </label>
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="form-input"
                aria-label="Task priority"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </Col>

            <Col xs={12}>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                type="submit"
                className="medium-button submit-button"
                aria-label="Add Task"
              >
                Add Task
              </motion.button>
            </Col>
          </Row>
        </form>
      </Container>
    </motion.div>
  );
};

export default AddTaskComponent;

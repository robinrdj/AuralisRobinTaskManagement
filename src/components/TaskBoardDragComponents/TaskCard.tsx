import React, { useState, useEffect } from "react";
import { Draggable } from "@hello-pangea/dnd";
import { useSelector, useDispatch } from "react-redux";
import { deleteTask, updateTask } from "../../store/taskSlice";
import type { RootState } from "../../store/store";
import { useSnackbar, closeSnackbar } from "notistack";
import { formatToIndianDate, indianToISODate } from "../../utils/dateUtils";
import { FaEdit, FaTrash } from "react-icons/fa";
import { motion } from "framer-motion";
import "./TaskCard.css";

// Icon components for edit and delete actions
const EditIcon = FaEdit as unknown as React.FC;
const TrashIcon = FaTrash as unknown as React.FC;

// Task priority and status types
type Priority = "low" | "medium" | "high";
type Status = "todo" | "inprogress" | "review" | "completed";

// Props for the TaskCard component
interface TaskCardProps {
  task: Task;
  index: number;
}

// Task interface
interface Task {
  id: number;
  title: string;
  description: string;
  due_date: string | null;
  status: Status;
  assignee: string;
  priority: Priority;
}

// Color mapping for status and priority
const statusColorMap: Record<Status, string> = {
  todo: "#42a5f5", // blue
  inprogress: "#0D47A1", // dark blue
  review: "#ab47bc", // purple
  completed: "#66bb6a", // green
};

const priorityColorMap: Record<Priority, string> = {
  low: "#fdd835", // yellow
  medium: "#fb8c00", // orange
  high: "#e53935", // red
};

/**
 * TaskCard component.
 * Represents a draggable task card with edit and delete functionality.
 * Now includes accessibility improvements.
 */
const TaskCard: React.FC<TaskCardProps> = ({ task, index }) => {
  const dispatch = useDispatch();
  const [isEditing, setIsEditing] = useState(false); // Edit mode state
  const [editedTask, setEditedTask] = useState({ ...task }); // Local state for editing
  const theme = useSelector((state: RootState) => state.theme); // Theme from Redux
  const { enqueueSnackbar } = useSnackbar();

  /**
   * Handles deleting a task with undo option.
   * Shows a snackbar with undo action and deletes after timeout.
   */
  const handleDelete = () => {
    let timeoutId: NodeJS.Timeout;

    // Undo action for snackbar
    const action = (snackbarId: string | number) => (
      <button
        style={{
          background: "none",
          border: "none",
          color: "#00e676",
          fontWeight: "bold",
          cursor: "pointer",
          marginLeft: "10px",
        }}
        onClick={() => {
          clearTimeout(timeoutId);
          closeSnackbar(snackbarId);
          enqueueSnackbar("Delete undone", { variant: "success" });
        }}
        aria-label="Undo delete"
      >
        Undo
      </button>
    );

    // Schedule task deletion after 5 seconds
    timeoutId = setTimeout(() => {
      dispatch(deleteTask(task.id));
    }, 5000);

    enqueueSnackbar("Task will be deleted", {
      variant: "warning",
      action,
      autoHideDuration: 5000,
    });
  };

  /**
   * Handles saving the edited task.
   * Dispatches update and exits edit mode.
   */
  const handleSave = () => {
    dispatch(updateTask({ ...editedTask, id: task.id }));
    setIsEditing(false);
  };

  // Set card class based on theme
  const cardClass = `task-card ${theme === "dark" ? "dark" : "light"}`;

  // Reset editedTask state when the task prop changes
  useEffect(() => {
    setEditedTask({ ...task });
  }, [task]);

  return (
    <Draggable draggableId={task.id.toString()} index={index}>
      {(provided) => (
        <div
          className={cardClass}
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={provided.draggableProps.style}
          role="listitem"
          aria-label={`Task: ${task.title}`}
        >
          {/* Edit mode UI */}
          {isEditing ? (
            <div className="edit-section">
              <label
                htmlFor={`edit-title-${task.id}`}
                className="visually-hidden"
              >
                Edit title
              </label>
              <input
                id={`edit-title-${task.id}`}
                type="text"
                value={editedTask.title}
                onChange={(e) =>
                  setEditedTask({ ...editedTask, title: e.target.value })
                }
                placeholder="Title"
                aria-label="Edit title"
              />
              <label
                htmlFor={`edit-description-${task.id}`}
                className="visually-hidden"
              >
                Edit description
              </label>
              <textarea
                id={`edit-description-${task.id}`}
                value={editedTask.description}
                onChange={(e) =>
                  setEditedTask({
                    ...editedTask,
                    description: e.target.value,
                  })
                }
                placeholder="Description"
                aria-label="Edit description"
              />
              <label
                htmlFor={`edit-due-date-${task.id}`}
                className="visually-hidden"
              >
                Edit due date
              </label>
              <input
                id={`edit-due-date-${task.id}`}
                type="date"
                value={
                  editedTask.due_date
                    ? indianToISODate(editedTask.due_date)
                    : ""
                }
                onChange={(e) =>
                  setEditedTask({
                    ...editedTask,
                    due_date: formatToIndianDate(e.target.value),
                  })
                }
                aria-label="Edit due date"
              />
              <label
                htmlFor={`edit-assignee-${task.id}`}
                className="visually-hidden"
              >
                Edit assignee
              </label>
              <input
                id={`edit-assignee-${task.id}`}
                type="text"
                value={editedTask.assignee}
                onChange={(e) =>
                  setEditedTask({ ...editedTask, assignee: e.target.value })
                }
                placeholder="Assignee"
                aria-label="Edit assignee"
              />
              <label
                htmlFor={`edit-priority-${task.id}`}
                className="visually-hidden"
              >
                Edit priority
              </label>
              <select
                id={`edit-priority-${task.id}`}
                value={editedTask.priority}
                onChange={(e) =>
                  setEditedTask({
                    ...editedTask,
                    priority: e.target.value as Priority,
                  })
                }
                aria-label="Edit priority"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <div className="button-group">
                <motion.button
                  onClick={handleSave}
                  aria-label="Save task"
                  whileTap={{ scale: 0.98 }}
                  className="card-save-button"
                >
                  💾 Save
                </motion.button>
                <motion.button
                className="card-cancel-button"
                  onClick={() => setIsEditing(false)}
                  aria-label="Cancel editing"
                  whileTap={{ scale: 0.98 }}
                >
                  Cancel
                </motion.button>
              </div>
            </div>
          ) : (
            // Display mode UI
            <div className="display-section">
              <div
                className="title-box"
                style={{ backgroundColor: statusColorMap[task.status] }}
              >
                <h3>{task.title}</h3>
              </div>
              <p>
                <strong>description:</strong> {task.description}
              </p>
              <p>
                <strong>due-date:</strong> {task.due_date || "None"}
              </p>
              <p>
                <strong>Priority:</strong>{" "}
                <span
                  style={{
                    color: priorityColorMap[task.priority],
                    fontWeight: "700",
                  }}
                >
                  {task.priority || "Not set"}
                </span>
              </p>
              <p>
                <strong>Assignee:</strong> {task.assignee || "Unassigned"}
              </p>
              <div className="button-group">
                <motion.button
                  className="card-edit-button"
                  onClick={() => setIsEditing(true)}
                  aria-label="Edit task"
                  whileTap={{ scale: 0.98 }}
                >
                  <EditIcon /> edit
                </motion.button>
                <motion.button
                  className="card-delete-button "
                  onClick={handleDelete}
                  aria-label="Delete task"
                  whileTap={{ scale: 0.98 }}
                >
                  <TrashIcon /> delete
                </motion.button>
              </div>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
};

export default React.memo(TaskCard);

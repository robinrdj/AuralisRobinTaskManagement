import React, { useState, useEffect } from "react";
import { Draggable } from "@hello-pangea/dnd";
import { useSelector, useDispatch } from "react-redux";
import { deleteTask, updateTask } from "../../store/taskSlice";
import type { RootState } from "../../store/store";
import { useSnackbar, closeSnackbar } from "notistack";
import { formatToIndianDate, indianToISODate } from "../../utils/dateUtils";
import { FaEdit, FaTrash } from "react-icons/fa";
import "./TaskCard.css";

const EditIcon = FaEdit as unknown as React.FC;
const TrashIcon = FaTrash as unknown as React.FC;

type Priority = "low" | "medium" | "high";
type Status = "todo" | "inprogress" | "review" | "completed";

interface TaskCardProps {
  task: Task;
  index: number;
}

interface Task {
  id: number;
  title: string;
  description: string;
  due_date: string | null;
  status: Status;
  assignee: string;
  priority: Priority;
}

const statusColorMap: Record<Status, string> = {
  todo: "#42a5f5", // yellow-orange
  inprogress: "#0D47A1", // blue
  review: "#ab47bc", // purple
  completed: "#66bb6a", // green
};

const priorityColorMap: Record<Priority, string> = {
  low: "#fdd835", // yellow
  medium: "#fb8c00", // orange
  high: "#e53935", // red
};

const TaskCard: React.FC<TaskCardProps> = ({ task, index }) => {
  const dispatch = useDispatch();
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState({ ...task });
  const theme = useSelector((state: RootState) => state.theme);
  const { enqueueSnackbar } = useSnackbar();
  // handling functions
  const handleDelete = () => {
    // const deletedTask = { ...task };

    let timeoutId: NodeJS.Timeout;

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
      >
        Undo
      </button>
    );

    timeoutId = setTimeout(() => {
      dispatch(deleteTask(task.id));
    }, 5000);

    enqueueSnackbar("Task will be deleted", {
      variant: "warning",
      action,
      autoHideDuration: 5000,
    });
  };
  const handleSave = () => {
    dispatch(updateTask({ ...editedTask, id: task.id }));
    setIsEditing(false);
  };

  const cardClass = `task-card ${theme === "dark" ? "dark" : "light"}`;

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
        >
          {isEditing ? (
            <div className="edit-section">
              <input
                type="text"
                value={editedTask.title}
                onChange={(e) =>
                  setEditedTask({ ...editedTask, title: e.target.value })
                }
                placeholder="Title"
              />
              <textarea
                value={editedTask.description}
                onChange={(e) =>
                  setEditedTask({
                    ...editedTask,
                    description: e.target.value,
                  })
                }
                placeholder="Description"
              />
              <input
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
              />

              <input
                type="text"
                value={editedTask.assignee}
                onChange={(e) =>
                  setEditedTask({ ...editedTask, assignee: e.target.value })
                }
                placeholder="Assignee"
              />
              <select
                value={editedTask.priority}
                onChange={(e) =>
                  setEditedTask({
                    ...editedTask,
                    priority: e.target.value as Priority,
                  })
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <div className="button-group">
                <button onClick={handleSave}>💾 Save</button>
                <button onClick={() => setIsEditing(false)}>Cancel</button>
              </div>
            </div>
          ) : (
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
                <button
                  className="action-btn update"
                  onClick={() => setIsEditing(true)}
                >
                  <EditIcon /> edit
                </button>
                <button className="action-btn delete" onClick={handleDelete}>
                  <TrashIcon /> delete
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
};

export default TaskCard;

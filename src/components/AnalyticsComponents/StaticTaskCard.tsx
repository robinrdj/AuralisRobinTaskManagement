import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { deleteTask, updateTask } from "../../store/taskSlice";
import { FaEdit, FaTrash } from "react-icons/fa";
import { RootState } from "../../store/store";
import { useState, useEffect } from "react";
import { formatToIndianDate, indianToISODate } from "../../utils/dateUtils";
import "../TaskBoardDragComponents/TaskCard.css";

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

interface Props {
  task: Task;
}

const statusColorMap: Record<Status, string> = {
  todo: "#42a5f5",
  inprogress: "#0D47A1",
  review: "#ab47bc",
  completed: "#66bb6a",
};

const priorityColorMap: Record<Priority, string> = {
  low: "#fdd835",
  medium: "#fb8c00",
  high: "#e53935",
};

const EditIcon = FaEdit as unknown as React.FC;
const TrashIcon = FaTrash as unknown as React.FC;

const StaticTaskCard: React.FC<Props> = ({ task }) => {
  const dispatch = useDispatch();
  const theme = useSelector((state: RootState) => state.theme);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState({ ...task });

  useEffect(() => {
    setEditedTask({ ...task });
  }, [task]);

  const handleDelete = () => dispatch(deleteTask(task.id));
  const handleSave = () => {
    dispatch(updateTask({ ...editedTask }));
    setIsEditing(false);
  };

  const cardClass = `task-card ${theme === "dark" ? "dark" : "light"}`;

  return (
    <div className={cardClass}>
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
              setEditedTask({ ...editedTask, description: e.target.value })
            }
            placeholder="Description"
          />
          <input
            type="date"
            value={
              editedTask.due_date ? indianToISODate(editedTask.due_date) : ""
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
            <strong>Description:</strong> {task.description}
          </p>
          <p>
            <strong>Due Date:</strong> {task.due_date || "None"}
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
          {/* <div className="button-group">
            <button className="action-btn update" onClick={() => setIsEditing(true)}>
              <EditIcon /> edit
            </button>
            <button className="action-btn delete" onClick={handleDelete}>
              <TrashIcon /> delete
            </button>
          </div> */}
        </div>
      )}
    </div>
  );
};

export default StaticTaskCard;

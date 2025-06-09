import React, { useState } from "react";
import { Draggable } from "@hello-pangea/dnd";
import { useSelector, useDispatch } from "react-redux";
import { deleteTask, updateTask } from "../../store/taskSlice";
import type { RootState } from "../../store/store.ts";

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

const CARD_HEIGHT = "220px";

const TaskCard: React.FC<TaskCardProps> = ({ task, index }) => {
  const dispatch = useDispatch();
  const [isEditing, setIsEditing] = useState(false);
  const [editedTask, setEditedTask] = useState({ ...task });

  const handleDelete = () => {
    dispatch(deleteTask(task.id));
  };

  const handleSave = () => {
    dispatch(updateTask({ ...editedTask, id: task.id }));
    setIsEditing(false);
  };
  const theme = useSelector((state: RootState) => state.theme);

  const styles: { [key: string]: React.CSSProperties } = {
    overlay: {
      position: "fixed",
      inset: 0,
      backgroundColor: "rgba(0,0,0,0.4)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 999,
    },
    modal: {
      backgroundColor: "#fff",
      padding: "2rem",
      borderRadius: "8px",
      display: "grid",
      gap: "10px",
      width: "100%",
      maxWidth: "400px",
    },
  };

  return (
    <Draggable draggableId={task.id.toString()} index={index}>
      {(provided) => (
        <div
          className="task-card"
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={{
            height: CARD_HEIGHT,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "12px",
            marginBottom: "8px",
            background: "#f5f5f5",
            backgroundColor: theme === "dark" ? "#000" : "#fff",
            borderRadius: "4px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
            overflow: "hidden",
            ...provided.draggableProps.style,
            width: "100%",
            maxWidth: "250px",
          }}
        >
          {isEditing ? (
            <div
              style={{
                overflow: "hidden",
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
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
                style={{ resize: "none", height: "60px", overflowY: "auto" }}
              />
              <input
                type="date"
                value={editedTask.due_date || ""}
                onChange={(e) =>
                  setEditedTask({ ...editedTask, due_date: e.target.value })
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
              <div style={{ marginTop: "6px", display: "flex", gap: "8px" }}>
                <button onClick={handleSave}>💾 Save</button>
                <button onClick={() => setIsEditing(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ overflow: "hidden", flex: 1 }}>
              <h4 style={{ margin: "0 0 4px 0", wordBreak: "break-word" }}>
                {task.title}
              </h4>
              <p
                style={{
                  margin: "0 0 4px 0",
                  maxHeight: "60px",
                  overflowY: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {task.description}
              </p>
              <p style={{ margin: 0, fontSize: "0.9em" }}>
                <strong>Due:</strong> {task.due_date || "None"}
              </p>
              {/* <p style={{ margin: 0 }}>
                <strong>Status:</strong> {task.status}
              </p> */}
              <p style={{ margin: 0 }}>
                <strong>Priority:</strong> {task.priority}
              </p>
              <p style={{ margin: 0 }}>
                <strong>Assignee:</strong> {task.assignee}
              </p>
              <div style={{ marginTop: "6px", display: "flex", gap: "8px" }}>
                <button onClick={() => setIsEditing(true)}>Edit</button>
                <button onClick={handleDelete}>Delete</button>
              </div>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
};

export default TaskCard;

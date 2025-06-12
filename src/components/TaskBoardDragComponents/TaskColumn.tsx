import React from "react";
import { Droppable } from "@hello-pangea/dnd";
import TaskCard from "./TaskCard";
import "./TaskColumn.css";

// Task priority and status types
type Priority = "low" | "medium" | "high";
type Status = "todo" | "inprogress" | "review" | "completed";

// Column interface for board columns
interface Column {
  name: string;
  taskIds: string[];
}

// Props for the TaskColumn component
interface TaskColumnProps {
  selectionMode: boolean;
  columnId: string;
  column: Column;
  tasks: Task[];
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
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

/**
 * TaskColumn component.
 * Represents a single column in the Kanban board, containing draggable task cards.
 * Supports multi-select and single-select of tasks.
 */
const TaskColumn: React.FC<TaskColumnProps> = ({
  columnId,
  column,
  tasks,
  selectedIds,
  setSelectedIds,
}) => {
  /**
   * Helper to toggle selection of a task card.
   * - Ctrl/Cmd + click toggles selection for that task.
   * - Regular click selects only that task (or unselects if already the only selected).
   */
  const toggleSelection = (taskId: string, event: React.MouseEvent) => {
    event.stopPropagation();

    setSelectedIds((prevSelected) => {
      const newSelected = new Set(prevSelected);

      if (event.ctrlKey || event.metaKey) {
        // Ctrl/Cmd + click toggles selection on that task only
        if (newSelected.has(taskId)) {
          newSelected.delete(taskId);
        } else {
          newSelected.add(taskId);
        }
      } else {
        // Without Ctrl key, select only this task (clear others)
        if (newSelected.has(taskId) && newSelected.size === 1) {
          // If only this task is selected, unselect it (toggle off)
          newSelected.clear();
        } else {
          newSelected.clear();
          newSelected.add(taskId);
        }
      }

      return newSelected;
    });
  };

  return (
    <div className="task-column-container">
      {/* Column title */}
      <h3>{column.name}</h3>
      <Droppable droppableId={columnId}>
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            style={{
              flex: 1,
              minHeight: "0",
              padding: "8px",
              backgroundColor: "#e8e8e8",
              borderRadius: "6px",
              overflowY: "auto",
            }}
          >
            {/* Render each task as a selectable and draggable card */}
            {tasks.map((task, index) => {
              const taskId = task.id.toString();
              const isSelected = selectedIds.has(taskId);

              return (
                <div
                  key={taskId}
                  onClick={(e) => toggleSelection(taskId, e)}
                  className="task-card-wrapper"
                  style={{
                    backgroundColor: isSelected ? "#d0ebff" : "transparent",
                    userSelect: "none",
                  }}
                >
                  <TaskCard task={task} index={index} />
                </div>
              );
            })}
            {/* Placeholder for drag-and-drop */}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};

export default TaskColumn;
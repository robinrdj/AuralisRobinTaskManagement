import React from "react";
import { Droppable } from "@hello-pangea/dnd";
import TaskCard from "./TaskCard";

type Priority = "low" | "medium" | "high";
type Status = "todo" | "inprogress" | "review" | "completed";

interface Column {
  name: string;
  taskIds: string[];
}

interface TaskColumnProps {
  selectionMode: boolean;
  columnId: string;
  column: Column;
  tasks: Task[];
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
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

const TaskColumn: React.FC<TaskColumnProps> = ({
  columnId,
  column,
  tasks,
  selectedIds,
  setSelectedIds,
  selectionMode,

}) => {
  // Helper to toggle task selection
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
    <div
      style={{
        minWidth: "240px",
        maxWidth: "260px",
        width: "100%",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
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
            {tasks.map((task, index) => {
              const taskId = task.id.toString();
              const isSelected = selectedIds.has(taskId);

              return (
                <div
                  key={taskId}
                  onClick={(e) => toggleSelection(taskId, e)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    backgroundColor: isSelected ? "#d0ebff" : "transparent",
                    borderRadius: "4px",
                    marginBottom: "4px",
                    padding: "4px",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  {/* <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      // stop event bubbling, handle selection via toggleSelection
                      e.stopPropagation();
                      toggleSelection(taskId, e as unknown as React.MouseEvent);
                    }}
                    style={{ marginRight: "8px" }}
                  /> */}
                  <TaskCard task={task} index={index} />
                </div>
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};

export default TaskColumn;

import React from "react";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { useSelector, useDispatch } from "react-redux";
import type { AppDispatch } from "../store/store";
import TaskColumn from "../components/TaskBoardDragComponents/TaskColumn";
import MultiUpdateModal from "../components/ModalComponents/MultiUpdateModal";
import SearchSortBar from "../components/TaskBoardControlComponents/SearchSortBar";
import FilterBar from "../components/TaskBoardControlComponents/FilterBar";
import SelectionControls from "../components/TaskBoardControlComponents/SelectionControls";
import { getAllTasks, updateTask, Task } from "../store/taskSlice";
import EmptyStateMessage from "../components/MessageComponents/EmptyStateMessage";
import useTaskSelection from "../customHooks/UseTaskSelectionHook";
import { useFilters } from "../customHooks/UseFiltersHook";
import { useBoardData } from "../customHooks/UseBoardDataHook";
import useDownloadTasks from "../customHooks/UseDownloadTasksHook";
import "./TaskBoard.css";

/**
 * TaskBoard page component.
 * Displays the Kanban board with drag-and-drop, filtering, selection, and bulk actions.
 */
const TaskBoard: React.FC = () => {
  // Get all tasks from Redux store
  const tasks = useSelector(getAllTasks);
  const dispatch = useDispatch<AppDispatch>();

  // Filter and sort state/hooks
  const {
    sortBy,
    setSortBy,
    searchText,
    setSearchText,
    filters,
    setFilters,
    debouncedSearch,
  } = useFilters();

  // Board data (columns and filtered task map)
  const boardData = useBoardData(tasks, sortBy, debouncedSearch, filters);

  // Selection and bulk action hooks
  const {
    selectionMode,
    selectedIds,
    handleMultiDelete,
    handleMultiUpdate,
    showUpdateModal,
    setShowUpdateModal,
    setSelectionMode,
    setSelectedIds,
  } = useTaskSelection(dispatch);

  // Download handlers for exporting tasks
  const { downloadJSON, downloadCSV } = useDownloadTasks();

  /**
   * Handles drag-and-drop events for moving tasks between columns.
   * Updates the task's status if moved to a new column.
   */
  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination || source.droppableId === destination.droppableId) return;

    const draggedTask = boardData.tasks[draggableId];
    if (!draggedTask) return;

    // Update task status when moved between columns
    dispatch(
      updateTask({
        id: draggedTask.id,
        status: destination.droppableId as Task["status"],
      })
    );
  };

  return (
    <div>
      {/* Search and sort bar */}
      <SearchSortBar
        searchText={searchText}
        setSearchText={setSearchText}
        sortBy={sortBy}
        setSortBy={setSortBy}
      />

      {/* Filter bar for advanced filtering */}
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        assignees={Array.from(new Set(tasks.map((t) => t.assignee)))}
      />

      {/* Controls for selection, bulk actions, and downloads */}
      <div className="controls-wrapper">
        <SelectionControls
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onDelete={handleMultiDelete}
          onUpdate={() => setShowUpdateModal(true)}
          onCancel={() => {
            setSelectionMode(false);
            setSelectedIds(new Set());
          }}
          activateSelection={() => setSelectionMode(true)}
        />
        <div className="download-buttons">
          <button
            onClick={() => downloadJSON(boardData.tasks)}
            className="download-json"
          >
            ⬇️ Download JSON
          </button>
          <button
            onClick={() => downloadCSV(boardData.tasks)}
            className="download-csv"
          >
            📄 Download CSV
          </button>
        </div>
      </div>

      {/* Show empty state if no tasks, otherwise render the board */}
      {Object.keys(boardData.tasks).length === 0 ? (
        <EmptyStateMessage />
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div style={{ display: "flex", gap: "16px", overflowX: "auto" }}>
            <div className="task-columns-wrapper">
              {Object.entries(boardData.columns).map(([columnId, column]) => {
                const columnTasks = column.taskIds.map(
                  (id) => boardData.tasks[id]
                );
                return (
                  <TaskColumn
                    key={columnId}
                    columnId={columnId}
                    column={column}
                    tasks={columnTasks}
                    selectedIds={selectedIds}
                    setSelectedIds={setSelectedIds}
                    selectionMode={selectionMode}
                  />
                );
              })}
            </div>
          </div>
        </DragDropContext>
      )}

      {/* Modal for bulk updating selected tasks */}
      {showUpdateModal && (
        <MultiUpdateModal
          onClose={() => setShowUpdateModal(false)}
          onSubmit={handleMultiUpdate}
        />
      )}
    </div>
  );
};

export default TaskBoard;

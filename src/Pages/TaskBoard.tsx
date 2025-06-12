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
import { motion } from "framer-motion";
import "./TaskBoard.css";

/**
 * TaskBoard page component.
 * Displays the Kanban board with drag-and-drop, filtering, selection, and bulk actions.
 * Now includes accessibility improvements.
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
    <main
      role="main"
      aria-label="Task Board"
      className="taskboard-main"
    >
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
      <div className="controls-wrapper" role="region" aria-label="Bulk Actions and Downloads">
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
        <div className="download-buttons" role="region" aria-label="Download Task Data">
          <motion.button
            onClick={() => downloadJSON(boardData.tasks)}
            className="medium-button download-json"
            aria-label="Download tasks as JSON"
            whileTap={{ scale: 0.97 }}
          >
            ⬇️ Download JSON
          </motion.button>
          <motion.button
            onClick={() => downloadCSV(boardData.tasks)}
            className="medium-button download-csv"
            aria-label="Download tasks as CSV"
            whileTap={{ scale: 0.97 }}
          >
            📄 Download CSV
          </motion.button>
        </div>
      </div>

      {/* Show empty state if no tasks, otherwise render the board */}
      {Object.keys(boardData.tasks).length === 0 ? (
        <EmptyStateMessage />
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div
            style={{ display: "flex", gap: "16px", overflowX: "auto" }}
            role="region"
            aria-label="Task Columns"
          >
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
    </main>
  );
};

export default TaskBoard;

import React from "react";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { useSelector, useDispatch } from "react-redux";
import type { AppDispatch } from "../store/store";
import TaskColumn from "./TaskBoardDragComponents/TaskColumn";
import MultiUpdateModal from "./ModalComponents/MultiUpdateModal";
import SearchSortBar from "./TaskControlComponents/SearchSortBar";
import FilterBar from "./TaskControlComponents/FilterBar";
import SelectionControls from "./TaskControlComponents/SelectionControls";
import { getAllTasks, updateTask, Task } from "../store/taskSlice";
import EmptyStateMessage from "./MessageComponents/EmptyStateMessage";
import useTaskSelection from "../customHooks/UseTaskSelectionHook";
import { useFilters } from "../customHooks/UseFiltersHook";
import { useBoardData } from "../customHooks/UseBoardDataHook";
import useDownloadTasks from "../customHooks/UseDownloadTasksHook";
import "./TaskBoard.css";

const TaskBoard: React.FC = () => {
  const tasks = useSelector(getAllTasks);
  const dispatch = useDispatch<AppDispatch>();

  // setting the value
  const {
    sortBy,
    setSortBy,
    searchText,
    setSearchText,
    filters,
    setFilters,
    debouncedSearch,
  } = useFilters();

  // using the function logic
  const boardData = useBoardData(tasks, sortBy, debouncedSearch, filters);
  const {
    selectionMode,
    selectedIds,
    toggleSelect,
    handleMultiDelete,
    handleMultiUpdate,
    showUpdateModal,
    setShowUpdateModal,
    setSelectionMode,
    setSelectedIds,
  } = useTaskSelection(dispatch);
  const { downloadJSON, downloadCSV } = useDownloadTasks();

  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination || source.droppableId === destination.droppableId) return;

    const draggedTask = boardData.tasks[draggableId];
    if (!draggedTask) return;

    // task status should change upon moving between columns
    dispatch(
      updateTask({
        id: draggedTask.id,
        status: destination.droppableId as Task["status"],
      })
    );
  };

  return (
    <div>
      <SearchSortBar
        searchText={searchText}
        setSearchText={setSearchText}
        sortBy={sortBy}
        setSortBy={setSortBy}
      />
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        assignees={Array.from(new Set(tasks.map((t) => t.assignee)))}
      />

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

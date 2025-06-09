import React from "react";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { useSelector, useDispatch } from "react-redux";
import type { AppDispatch } from "../store/store.tsx";
import TaskColumn from "./TaskBoardDragComponents/TaskColumn";
import MultiUpdateModal from "./ModalComponents/MultiUpdateModal";
import SearchSortBar from "./TaskControlComponents/SearchSortBar";
import FilterBar from "./TaskControlComponents/FilterBar";
import SelectionControls from "./TaskControlComponents/SelectionControls";
import { getAllTasks, updateTask, Task } from "../store/taskSlice";

import useTaskSelection from "../hooks/UseTaskSelection";
import { useFilters } from "../hooks/UseFiltersHook";
import { useBoardData } from "../hooks/UseBoardDataHook";

const TaskBoard: React.FC = () => {
  const tasks = useSelector(getAllTasks);
  const dispatch = useDispatch<AppDispatch>();

  const {
    sortBy,
    setSortBy,
    searchText,
    setSearchText,
    filters,
    setFilters,
    debouncedSearch,
  } = useFilters();

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

  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination || source.droppableId === destination.droppableId) return;

    const draggedTask = boardData.tasks[draggableId];
    if (!draggedTask) return;

    dispatch(
      updateTask({
        id: draggedTask.id,
        status: destination.droppableId as Task["status"],
      })
    );
  };

  return (
    <div style={{ padding: "1rem" }}>
      <button
        onClick={() => {
          if (filters.showFilters) {
            setFilters({
              showFilters: false,
              statusFilter: "",
              priorityFilter: "",
              assigneeFilter: "",
              dueStartDate: "",
              dueEndDate: "",
              createdStartDate: "",
              createdEndDate: "",
            });
          } else {
            setFilters((prev) => ({ ...prev, showFilters: true }));
          }
        }}
        style={{ marginBottom: "1rem", padding: "0.5rem 1rem" }}
      >
        {filters.showFilters ? "Hide Filters" : "FilterOn"}
      </button>

      <SearchSortBar
        searchText={searchText}
        setSearchText={setSearchText}
        sortBy={sortBy}
        setSortBy={setSortBy}
      />

      {filters.showFilters && (
        <FilterBar
          filters={filters}
          setFilters={setFilters}
          assignees={Array.from(new Set(tasks.map((t) => t.assignee)))}
        />
      )}

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

      <DragDropContext onDragEnd={onDragEnd}>
        <div style={{ display: "flex", gap: "16px", overflowX: "auto" }}>
          {Object.entries(boardData.columns).map(([columnId, column]) => {
            const columnTasks = column.taskIds.map((id) => boardData.tasks[id]);
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
      </DragDropContext>

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

import { useState } from "react";
import {
  Task,
  deleteMultipleTasks,
  updateMultipleTasks,
} from "../store/taskSlice";
import { AppDispatch } from "../store/store";

const useTaskSelectionHook = (dispatch: AppDispatch) => {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const toggleSelect = (taskId: string, ctrlKey: boolean) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (ctrlKey) {
        newSet.has(taskId) ? newSet.delete(taskId) : newSet.add(taskId);
      } else {
        if (newSet.size === 1 && newSet.has(taskId)) {
          newSet.clear();
        } else {
          newSet.clear();
          newSet.add(taskId);
        }
      }
      return newSet;
    });
  };

  // handling functions
  const handleMultiDelete = () => {
    dispatch(
      deleteMultipleTasks(Array.from(selectedIds).map((id) => Number(id)))
    );
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const handleMultiUpdate = (fields: Partial<Task>) => {
    dispatch(
      updateMultipleTasks({
        ids: Array.from(selectedIds).map((id) => Number(id)),
        updates: fields,
      })
    );
    setSelectedIds(new Set());
    setSelectionMode(false);
    setShowUpdateModal(false);
  };

  return {
    selectionMode,
    setSelectionMode,
    selectedIds,
    setSelectedIds,
    toggleSelect,
    handleMultiDelete,
    handleMultiUpdate,
    showUpdateModal,
    setShowUpdateModal,
  };
};

export default useTaskSelectionHook;

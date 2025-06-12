import { useState, useCallback } from "react";
import {
  Task,
  deleteMultipleTasks,
  updateMultipleTasks,
} from "../store/taskSlice";
import { useSnackbar } from "notistack";
import { AppDispatch } from "../store/store";

// Custom hook for managing task selection, multi-delete, and multi-update logic
const useTaskSelectionHook = (dispatch: AppDispatch) => {
  // State to track if selection mode is active
  const [selectionMode, setSelectionMode] = useState(false);
  // State to store selected task IDs as a Set for efficient add/remove
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // State to control visibility of the update modal
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  // Snackbar utilities for notifications
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  /**
   * Toggles selection of a task.
   * If ctrlKey is pressed, toggles the task in the selection set.
   * Otherwise, selects only the clicked task (single selection).
   */
  const toggleSelect = useCallback((taskId: string, ctrlKey: boolean) => {
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
  }, []);

  /**
   * Handles deletion of multiple selected tasks.
   * Shows a snackbar with undo option for 5 seconds before dispatching delete.
   */
  const handleMultiDelete = useCallback(() => {
    const idsToDelete = Array.from(selectedIds).map((id) => Number(id));

    let timeoutId: NodeJS.Timeout;

    enqueueSnackbar(`${idsToDelete.length} tasks will be deleted`, {
      variant: "warning",
      autoHideDuration: 5000,
      action: (snackbarId) => (
        <button
          onClick={() => {
            clearTimeout(timeoutId);
            closeSnackbar(snackbarId);
            enqueueSnackbar("Deletion cancelled", { variant: "success" });
          }}
          style={{
            background: "none",
            border: "none",
            color: "#00e676",
            fontWeight: "bold",
            cursor: "pointer",
            marginLeft: "10px",
          }}
        >
          Undo
        </button>
      ),
    });
    
    // Wait 5 seconds for undo before deleting tasks
    timeoutId = setTimeout(() => {
      dispatch(deleteMultipleTasks(idsToDelete));
      enqueueSnackbar("Tasks deleted", { variant: "info" });
    }, 5000);

    setSelectedIds(new Set());
    setSelectionMode(false);
  }, [dispatch, selectedIds, enqueueSnackbar, closeSnackbar]);

  /**
   * Handles updating multiple selected tasks with given fields.
   * Dispatches update, then resets selection and closes modal.
   */
  const handleMultiUpdate = useCallback(
    (fields: Partial<Task>) => {
      dispatch(
        updateMultipleTasks({
          ids: Array.from(selectedIds).map((id) => Number(id)),
          updates: fields,
        })
      );
      setSelectedIds(new Set());
      setSelectionMode(false);
      setShowUpdateModal(false);
    },
    [dispatch, selectedIds]
  );

  // Expose state and handlers for use in components
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

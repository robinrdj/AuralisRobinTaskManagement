import { useState, useCallback } from "react";
import {
  Task,
  deleteMultipleTasks,
  updateMultipleTasks,
} from "../store/taskSlice";
import { useSnackbar} from "notistack";
import { AppDispatch } from "../store/store";

const useTaskSelectionHook = (dispatch: AppDispatch) => {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showUpdateModal, setShowUpdateModal] = useState(false);
const { enqueueSnackbar, closeSnackbar } = useSnackbar();

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

  timeoutId = setTimeout(() => {
    dispatch(deleteMultipleTasks(idsToDelete));
    enqueueSnackbar("Tasks deleted", { variant: "info" });
  }, 5000);

  setSelectedIds(new Set());
  setSelectionMode(false);
}, [dispatch, selectedIds, enqueueSnackbar, closeSnackbar]);

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

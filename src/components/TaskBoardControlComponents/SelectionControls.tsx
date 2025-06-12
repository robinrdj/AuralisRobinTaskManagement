import React from "react";
import { motion } from "framer-motion";
import { FaEdit, FaTrash } from "react-icons/fa";
import "./SelectionControls.css";


// Icon components for edit and delete actions
const EditIcon = FaEdit as unknown as React.FC;
const TrashIcon = FaTrash as unknown as React.FC;

// Props interface for selection controls
interface Props {
  selectionMode: boolean; // Whether multi-select mode is active
  selectedIds: Set<string>; // Set of selected task IDs
  onDelete: () => void; // Handler for deleting selected tasks
  onUpdate: () => void; // Handler for updating selected tasks
  onCancel: () => void; // Handler to cancel selection mode
  activateSelection: () => void; // Handler to activate selection mode
}

/**
 * SelectionControls component.
 * Provides UI for enabling/disabling multi-select mode and performing bulk actions.
 * Now includes accessibility improvements.
 */
const SelectionControls: React.FC<Props> = ({
  selectionMode,
  selectedIds,
  onDelete,
  onUpdate,
  onCancel,
  activateSelection,
}) => {
  return (
    <div
      className="selection-controls-container"
      role="region"
      aria-label="Task Selection Controls"
    >
      {/* Header with toggle button and selection count */}
      <div className="selection-header">
        <motion.button
          className={`medium-button ${selectionMode ? "disable-multi-button" : "enable-multi-button"}`}
          onClick={selectionMode ? onCancel : activateSelection}
          aria-pressed={selectionMode}
          aria-label={
            selectionMode ? "Disable Multi-Select" : "Enable Multi-Select"
          }
          whileTap={{ scale: 0.97 }}
        >
          {selectionMode ? "Disable Multi-Select" : "Enable Multi-Select"}
        </motion.button>
        {selectionMode && (
          <span className="selection-count" aria-live="polite">
            Selected: {selectedIds.size} (Ctrl+mouse left click to select)
          </span>
        )}
      </div>

      {/* Action buttons for update and delete, shown only in selection mode */}
      {selectionMode && (
        <div className="selection-actions">
          <motion.button
            whileTap={{ scale: 0.97 }}
            className="medium-button update-button"
            onClick={onUpdate}
            aria-label="Update Selected Tasks"
          >
           <EditIcon />  Update Selected
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            className="medium-button delete-button"
            onClick={onDelete}
            aria-label="Delete Selected Tasks"
          >
           <TrashIcon />  Delete Selected
          </motion.button>
        </div>
      )}
    </div>
  );
};

export default SelectionControls;

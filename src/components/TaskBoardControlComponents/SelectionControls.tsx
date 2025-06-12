import React from "react";
import "./SelectionControls.css";

// Props interface for selection controls
interface Props {
  selectionMode: boolean;           // Whether multi-select mode is active
  selectedIds: Set<string>;         // Set of selected task IDs
  onDelete: () => void;             // Handler for deleting selected tasks
  onUpdate: () => void;             // Handler for updating selected tasks
  onCancel: () => void;             // Handler to cancel selection mode
  activateSelection: () => void;    // Handler to activate selection mode
}

/**
 * SelectionControls component.
 * Provides UI for enabling/disabling multi-select mode and performing bulk actions.
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
    <div className="selection-controls-container">
      {/* Header with toggle button and selection count */}
      <div className="selection-header">
        <button
          className={`toggle-btn ${selectionMode ? "disable" : "enable"}`}
          onClick={selectionMode ? onCancel : activateSelection}
        >
          {selectionMode ? "Disable Multi-Select" : "Enable Multi-Select"}
        </button>
        {selectionMode && (
          <span className="selection-count">
            Selected: {selectedIds.size} (Ctrl+mouse left click to select)
          </span>
        )}
      </div>

      {/* Action buttons for update and delete, shown only in selection mode */}
      {selectionMode && (
        <div className="selection-actions">
          <button className="action-btn update" onClick={onUpdate}>
            Update Selected
          </button>
          <button className="action-btn delete" onClick={onDelete}>
            Delete Selected
          </button>
        </div>
      )}
    </div>
  );
};

export default SelectionControls;

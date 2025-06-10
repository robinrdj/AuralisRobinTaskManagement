import React from "react";
import "./SelectionControls.css";

interface Props {
  selectionMode: boolean;
  selectedIds: Set<string>;
  onDelete: () => void;
  onUpdate: () => void;
  onCancel: () => void;
  activateSelection: () => void;
}

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

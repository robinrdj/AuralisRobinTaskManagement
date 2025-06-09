import React from "react";

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
  if (!selectionMode) {
    return (
      <button
        onClick={activateSelection}
        style={{
          marginBottom: "1rem",
          padding: "0.5rem 1rem",
          backgroundColor: "#007bff",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer"
        }}
      >
        Enable Multi-Select Mode
      </button>
    );
  }

  return (
    <div
      className="selection-controls"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        marginBottom: "1rem",
      }}
    >
      <span style={{ fontWeight: "bold" }}>
        Selected: {selectedIds.size}
      </span>
      <button onClick={onUpdate} style={{ backgroundColor: "#ffc107", padding: "0.5rem" }}>
        Update Selected
      </button>
      <button onClick={onDelete} style={{ backgroundColor: "#dc3545", color: "white", padding: "0.5rem" }}>
        Delete Selected
      </button>
      <button onClick={onCancel} style={{ backgroundColor: "#6c757d", color: "white", padding: "0.5rem" }}>
        Cancel
      </button>
    </div>
  );
};

export default SelectionControls;

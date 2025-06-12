import React from "react";
import { motion } from "framer-motion";
import "./FilterBar.css";

// Interface for filter state
interface Filters {
  showFilters: boolean;
  statusFilter: string;
  priorityFilter: string;
  assigneeFilter: string;
  dueStartDate: string;
  dueEndDate: string;
  createdStartDate: string;
  createdEndDate: string;
}

// Props for the FilterBar component
interface Props {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  assignees: string[];
}

/**
 * FilterBar component for advanced task filtering.
 * Allows filtering by status, priority, assignee, and date ranges.
 */
const FilterBar: React.FC<Props> = ({ filters, setFilters, assignees }) => {
  // Helper to update a specific filter field
  const update = (key: keyof Filters, value: string) =>
    setFilters({ ...filters, [key]: value });

  // Toggles filter visibility and resets filters if disabling
  const toggleFilters = () => {
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
  };

  return (
    <div className="filter-container">
      <div className="filter-bar">
        {/* Button to show/hide filters */}
        <div className="filter-group">
          <motion.button
            onClick={toggleFilters}
            whileTap={{ scale: 0.97 }}
            className={`medium-button ${
              filters.showFilters ? "disable-multi-button" : "enable-multi-button"
            }`}
          >
            {filters.showFilters ? "Disable Filters" : "Show Filters"}
          </motion.button>
        </div>

        {/* Render filter controls if filters are enabled */}
        {filters.showFilters && (
          <>
            {/* Status filter */}
            <div className="filter-group">
              <label>Status</label>
              <select
                value={filters.statusFilter}
                onChange={(e) => update("statusFilter", e.target.value)}
              >
                <option value="">All</option>
                <option value="todo">Todo</option>
                <option value="inprogress">In Progress</option>
                <option value="review">Review</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {/* Priority filter */}
            <div className="filter-group">
              <label>Priority</label>
              <select
                value={filters.priorityFilter}
                onChange={(e) => update("priorityFilter", e.target.value)}
              >
                <option value="">All</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* Assignee filter */}
            <div className="filter-group">
              <label>Assignee</label>
              <input
                type="text"
                value={filters.assigneeFilter}
                onChange={(e) => update("assigneeFilter", e.target.value)}
              />
            </div>

            {/* Due date start filter */}
            <div className="filter-group">
              <label>Due Start</label>
              <input
                type="date"
                value={filters.dueStartDate}
                onChange={(e) => update("dueStartDate", e.target.value)}
              />
            </div>

            {/* Due date end filter */}
            <div className="filter-group">
              <label>Due End</label>
              <input
                type="date"
                value={filters.dueEndDate}
                onChange={(e) => update("dueEndDate", e.target.value)}
              />
            </div>

            {/* Created date start filter */}
            <div className="filter-group">
              <label>Created Start</label>
              <input
                type="date"
                value={filters.createdStartDate}
                onChange={(e) => update("createdStartDate", e.target.value)}
              />
            </div>

            {/* Created date end filter */}
            <div className="filter-group">
              <label>Created End</label>
              <input
                type="date"
                value={filters.createdEndDate}
                onChange={(e) => update("createdEndDate", e.target.value)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FilterBar;

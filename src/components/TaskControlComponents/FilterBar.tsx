import React from "react";
import "./FilterBar.css";

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

interface Props {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  assignees: string[];
}

const FilterBar: React.FC<Props> = ({ filters, setFilters, assignees }) => {
  const update = (key: keyof Filters, value: string) =>
    setFilters({ ...filters, [key]: value });

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
        <div className="filter-group">
          <button
            onClick={toggleFilters}
            className={`toggle-btn ${
              filters.showFilters ? "disable" : "enable"
            }`}
          >
            {filters.showFilters ? "Disable Filters" : "Show Filters"}
          </button>
        </div>

        {filters.showFilters && (
          <>
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

            <div className="filter-group">
              <label>Assignee</label>
              <input
                type="text"
                value={filters.assigneeFilter}
                onChange={(e) => update("assigneeFilter", e.target.value)}
              />
            </div>

            <div className="filter-group">
              <label>Due Start</label>
              <input
                type="date"
                value={filters.dueStartDate}
                onChange={(e) => update("dueStartDate", e.target.value)}
              />
            </div>

            <div className="filter-group">
              <label>Due End</label>
              <input
                type="date"
                value={filters.dueEndDate}
                onChange={(e) => update("dueEndDate", e.target.value)}
              />
            </div>

            <div className="filter-group">
              <label>Created Start</label>
              <input
                type="date"
                value={filters.createdStartDate}
                onChange={(e) => update("createdStartDate", e.target.value)}
              />
            </div>

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

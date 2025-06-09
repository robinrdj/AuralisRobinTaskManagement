import React from "react";

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


const FilterBar: React.FC<Props> = ({ filters, setFilters }) => {
  const update = (key: keyof Filters, value: string) =>
    setFilters({ ...filters, [key]: value });

  return (
    <div
      className="filter-bar"
      style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}
    >
      <select
        value={filters.statusFilter}
        onChange={(e) => update("statusFilter", e.target.value)}
      >
        <option value="">All Statuses</option>
        <option value="todo">Todo</option>
        <option value="inprogress">In Progress</option>
        <option value="review">Review</option>
        <option value="completed">Completed</option>
      </select>

      <select
        value={filters.priorityFilter}
        onChange={(e) => update("priorityFilter", e.target.value)}
      >
        <option value="">All Priorities</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>

      <input
        type="text"
        placeholder="Assignee"
        value={filters.assigneeFilter}
        onChange={(e) => update("assigneeFilter", e.target.value)}
      />

      {/* Due Date Range */}
      <div>
        <label>Due Start</label>
        <input
          type="date"
          value={filters.dueStartDate}
          onChange={(e) => update("dueStartDate", e.target.value)}
        />
      </div>
      <div>
        <label>Due End</label>
        <input
          type="date"
          value={filters.dueEndDate}
          onChange={(e) => update("dueEndDate", e.target.value)}
        />
      </div>

      {/* Creation Date Range */}
      <div>
        <label>Created Start</label>
        <input
          type="date"
          value={filters.createdStartDate}
          onChange={(e) => update("createdStartDate", e.target.value)}
        />
      </div>
      <div>
        <label>Created End</label>
        <input
          type="date"
          value={filters.createdEndDate}
          onChange={(e) => update("createdEndDate", e.target.value)}
        />
      </div>
    </div>
  );
};

export default FilterBar;

import React from "react";
import "./SearchSortBar.css";

// Define possible sort options
type SortOption = "none" | "due_date" | "priority" | "title" | "created_on";

// Props for the SearchSortBar component
interface Props {
  sortBy: SortOption;
  setSortBy: (value: SortOption) => void;
  searchText: string;
  setSearchText: (value: string) => void;
}

/**
 * SearchSortBar component.
 * Provides a search input and a sort dropdown for tasks.
 * Now includes accessibility improvements.
 */
const SearchSortBar: React.FC<Props> = ({
  sortBy,
  setSortBy,
  searchText,
  setSearchText,
}) => {
  return (
    <div
      className="search-sort-bar"
      role="region"
      aria-label="Task Search and Sort"
    >
      {/* Search input for filtering tasks by text */}
      <label htmlFor="task-search-input" className="visually-hidden">
        Search tasks
      </label>
      <input
        id="task-search-input"
        type="text"
        placeholder="Search tasks..."
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        className="search-input"
        aria-label="Search tasks"
      />
      {/* Dropdown for selecting sort option */}
      <label htmlFor="task-sort-select" className="visually-hidden">
        Sort tasks
      </label>
      <select
        id="task-sort-select"
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value as SortOption)}
        className="sort-select"
        aria-label="Sort tasks"
      >
        <option value="none">Sort by</option>
        <option value="title">Title</option>
        <option value="priority">Priority</option>
        <option value="due_date">Due Date</option>
        <option value="created_on">Creation Date</option>
      </select>
    </div>
  );
};

export default SearchSortBar;

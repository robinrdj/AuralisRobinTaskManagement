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
 */
const SearchSortBar: React.FC<Props> = ({
  sortBy,
  setSortBy,
  searchText,
  setSearchText,
}) => {
  return (
    <div className="search-sort-bar">
      {/* Search input for filtering tasks by text */}
      <input
        type="text"
        placeholder="Search tasks..."
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        className="search-input"
      />
      {/* Dropdown for selecting sort option */}
      <select
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value as SortOption)}
        className="sort-select"
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

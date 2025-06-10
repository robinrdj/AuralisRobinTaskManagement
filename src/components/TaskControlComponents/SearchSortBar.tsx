import React from "react";
import "./SearchSortBar.css";

type SortOption = "none" | "due_date" | "priority" | "title" | "created_on";

interface Props {
  sortBy: SortOption;
  setSortBy: (value: SortOption) => void;
  searchText: string;
  setSearchText: (value: string) => void;
}

const SearchSortBar: React.FC<Props> = ({
  sortBy,
  setSortBy,
  searchText,
  setSearchText,
}) => {
  return (
    <div className="search-sort-bar">
      <input
        type="text"
        placeholder="Search tasks..."
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        className="search-input"
      />
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

import { useState, useEffect } from "react";

// Define possible sort options for tasks
type SortOption = "none" | "due_date" | "priority" | "title" | "created_on";

// Custom hook for managing filter and sort state for tasks
export const useFilters = () => {
  // State for current sort option
  const [sortBy, setSortBy] = useState<SortOption>("none");
  // State for search input text
  const [searchText, setSearchText] = useState("");
  // State for debounced search text (to reduce filtering frequency)
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // State for various filter options (status, priority, assignee, date ranges)
  const [filters, setFilters] = useState({
    showFilters: false,
    statusFilter: "",
    priorityFilter: "",
    assigneeFilter: "",
    dueStartDate: "",
    dueEndDate: "",
    createdStartDate: "",
    createdEndDate: "",
  });

  // Debounce search input to avoid filtering on every keystroke (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText.toLowerCase());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Expose state and setters for use in components
  return {
    sortBy,
    setSortBy,
    searchText,
    setSearchText,
    debouncedSearch,
    filters,
    setFilters,
  };
};

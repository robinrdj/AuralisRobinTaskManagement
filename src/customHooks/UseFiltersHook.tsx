import { useState, useEffect } from "react";

type SortOption = "none" | "due_date" | "priority" | "title" | "created_on";

export const useFilters = () => {
  const [sortBy, setSortBy] = useState<SortOption>("none");
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

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
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText.toLowerCase());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

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

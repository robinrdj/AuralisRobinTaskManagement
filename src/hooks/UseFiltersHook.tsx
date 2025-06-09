import React from "react";

type SortOption = "none" | "due_date" | "priority" | "title" | "created_on";

export const useFilters = () => {
  const [sortBy, setSortBy] = React.useState<SortOption>("none");
  const [searchText, setSearchText] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");

  const [filters, setFilters] = React.useState({
    showFilters: true,
    statusFilter: "",
    priorityFilter: "",
    assigneeFilter: "",
    dueStartDate: "",
    dueEndDate: "",
    createdStartDate: "",
    createdEndDate: "",
  });

  React.useEffect(() => {
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

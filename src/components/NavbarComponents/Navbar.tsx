import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toggleTheme } from "../../store/themeSlice";
import { RootState } from "../../store/store";
import type { AppDispatch } from "../../store/store";
import Brightness4Icon from "@mui/icons-material/Brightness4";
import "./Navbar.css";

/**
 * Navbar component for navigation and theme toggling.
 * Includes responsive menu, active link highlighting, and dark mode support.
 */
const Navbar: React.FC = () => {
  // State to control mobile menu open/close
  const [menuOpen, setMenuOpen] = useState(false);

  // Get current theme from Redux store
  const theme = useSelector((state: RootState) => state.theme);

  // Redux dispatch for theme toggling
  const dispatch = useDispatch<AppDispatch>();

  // React Router location for active link highlighting
  const location = useLocation();

  // Toggle mobile menu open/close
  const toggleMenu = () => setMenuOpen((open) => !open);

  // Set CSS variable for theme-dependent hover color (for legacy CSS)
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--navbar-toggle-hover",
      theme === "dark" ? "#444" : "#ddd"
    );
  }, [theme]);

  return (
    <nav
      className="navbar"
      role="navigation"
      aria-label="Main Navigation"
      style={{
        backgroundColor: theme === "dark" ? "#222" : "#f5f5f5",
        color: theme === "dark" ? "#fff" : "#000",
      }}
    >
      {/* Brand link */}
      <Link to="/" className="nav-brand" onClick={() => setMenuOpen(false)}>
        Task Manager
      </Link>

      {/* Hamburger menu button for mobile */}
      <button
        className="menu-button"
        onClick={toggleMenu}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
      >
        &#9776;
      </button>

      {/* Navigation links and theme toggle */}
      <div
        className={`nav-links${menuOpen ? " open" : ""}`}
        onClick={() => setMenuOpen(false)}
        style={{
          backgroundColor: theme === "dark" ? "#222" : "#f5f5f5",
        }}
      >
        {/* Navigation links with active highlighting */}
        <Link
          to="/"
          className={`nav-link ${location.pathname === "/" ? "active" : ""}`}
        >
          Add Task
        </Link>
        <Link
          to="/taskboard"
          className={`nav-link ${
            location.pathname === "/taskboard" ? "active" : ""
          }`}
        >
          Taskboard
        </Link>
        <Link
          to="/analytics"
          className={`nav-link ${
            location.pathname === "/analytics" ? "active" : ""
          }`}
        >
          Analytics
        </Link>
        <Link
          to="/uploadJson"
          className={`nav-link ${
            location.pathname === "/uploadJson" ? "active" : ""
          }`}
        >
          UploadJson
        </Link>

        {/* Dark Mode Toggle Button */}
        <button
          className="theme-toggle-button"
          onClick={() => {
            dispatch(toggleTheme());
            setMenuOpen(false);
          }}
          aria-label="Toggle dark mode"
          title="Toggle dark mode"
        >
          <Brightness4Icon />
          {theme === "dark" ? "LightMode" : "DarkMode"}
        </button>
      </div>
    </nav>
  );
};

export default Navbar;

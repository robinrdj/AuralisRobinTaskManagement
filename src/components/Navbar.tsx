import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toggleTheme } from "../store/themeSlice";
import { RootState } from "../store/store";
import type { AppDispatch } from "../store/store";
import Brightness4Icon from "@mui/icons-material/Brightness4"; // moon/sun toggle icon

const Navbar: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const theme = useSelector((state: RootState) => state.theme);
  const dispatch = useDispatch<AppDispatch>();
  const location = useLocation();
  const toggleMenu = () => setMenuOpen((open) => !open);

  return (
    <>
      <style>{`
        .navbar {
          background-color: ${theme === "dark" ? "#222" : "#f5f5f5"};
          color: ${theme === "dark" ? "#fff" : "#000"};
          padding: 10px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 1500;
          user-select: none;
          box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }
        .nav-brand {
          font-weight: 700;
          font-size: 1.3rem;
          text-decoration: none;
          color: inherit;
        }
        .nav-links {
          display: flex;
          gap: 1rem;
        }
        .nav-link {
          text-decoration: none;
          color: inherit;
          padding: 6px 8px;
          border-bottom: 2px solid transparent;
          transition: border-color 0.3s;
          cursor: pointer;
        }
        .nav-link.active {
          border-bottom-color: ${theme === "dark" ? "#fff" : "#000"};
        }
        .menu-button {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
          color: inherit;
          font-size: 1.5rem;
          user-select: none;
        }
        @media (max-width: 768px) {
          .nav-links {
            position: fixed;
            top: 56px;
            right: 0;
            background-color: ${theme === "dark" ? "#222" : "#f5f5f5"};
            height: calc(100vh - 56px);
            width: 200px;
            flex-direction: column;
            padding: 1rem;
            transform: translateX(${menuOpen ? "0" : "100%"});
            transition: transform 0.3s ease-in-out;
            box-shadow: -2px 0 5px rgba(0,0,0,0.2);
            z-index: 2000;
          }
          .menu-button {
            display: block;
          }
        }
        .theme-toggle-button {
          background: transparent;
          border: none;
          cursor: pointer;
          color: inherit;
          display: flex;
          align-items: center;
          padding: 6px 8px;
          border-radius: 4px;
          transition: background-color 0.2s;
        }
        .theme-toggle-button:hover {
          background-color: ${theme === "dark" ? "#444" : "#ddd"};
        }
      `}</style>

      <nav className="navbar" role="navigation" aria-label="Main Navigation">
        <Link to="/" className="nav-brand" onClick={() => setMenuOpen(false)}>
          Task Manager
        </Link>
        <button
          className="menu-button"
          onClick={toggleMenu}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          &#9776;
        </button>

        <div className="nav-links" onClick={() => setMenuOpen(false)}>
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
    </>
  );
};

export default Navbar;

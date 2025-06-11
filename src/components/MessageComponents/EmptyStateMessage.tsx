import React from "react";
import "./EmptyStateMessage.css";
import { Link } from "react-router-dom";

<Link to="/add-task">Go to Add Task</Link>;

const EmptyStateMessage: React.FC = () => {
  return (
    <div className="empty-state-message-container">
      <img
        src="/smilyImg.jpg"
        alt="Smiley face"
        className="empty-state-image"
      />
      <div className="empty-state-text">
        <p>
          <strong>Currently, there are no tasks to show.</strong>
          <br />
          Add tasks to see here. You could add tasks by going here.
          <Link to="/">Create Task</Link>
        </p>
      </div>
    </div>
  );
};

export default EmptyStateMessage;

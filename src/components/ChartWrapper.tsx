import React from "react";
import "./ChartWrapper.css";

interface ChartWrapperProps {
  children: React.ReactNode;
  title?: string;
}

const ChartWrapper: React.FC<ChartWrapperProps> = ({ children, title }) => {
  return (
    <div className="chart-wrapper">
      {title && <h3 className="chart-title">{title}</h3>}
      <div className="chart-content">{children}</div>
    </div>
  );
};

export default ChartWrapper;

import React from "react";
import { motion } from "framer-motion";
import "./ChartWrapper.css";

interface ChartWrapperProps {
  children: React.ReactNode;
  title?: string;
}

const ChartWrapper: React.FC<ChartWrapperProps> = ({ children, title }) => {
  return (
    <motion.div
      className="chart-wrapper"
      whileHover={{ scale: 1.02, boxShadow: "0px 4px 15px rgba(0,0,0,0.1)" }}
      transition={{ type: "spring", stiffness: 200 }}
      role="region"
      aria-label={title ? `Chart: ${title}` : "Chart"}
      tabIndex={0}
    >
      {title && <h3 className="chart-title" id="chart-title">{title}</h3>}
      <div className="chart-content">{children}</div>
    </motion.div>
  );
};

export default ChartWrapper;

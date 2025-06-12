import React from "react";
import { motion } from "framer-motion";
import TaskCompletionRate from "../components/AnalyticsComponents/TaskCompletionRate";
import PriorityDistribution from "../components/AnalyticsComponents/PriorityDistribution";
import StatusOverview from "../components/AnalyticsComponents/StatusOverview";
import OverdueTasks from "../components/AnalyticsComponents/OverdueTasks";
import ProductivityMetrics from "../components/AnalyticsComponents/ProductivityMetrics";
import ChartWrapper from "../components/WrapperComponents/ChartWrapper";
import { Download } from "lucide-react";
import { useExportToExcel } from "../customHooks/UseExportToExcelHook";
import { useSelector } from "react-redux";
import "./Analytics.css";

// Animation variants for the container and items (for staggered entrance)
const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.2, // Stagger animation for child charts
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 }, // Start faded and shifted down
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" }, // Animate in
  },
};

/**
 * Analytics page component.
 * Displays various analytics charts and metrics for tasks.
 * Now includes accessibility improvements.
 */
const Analytics: React.FC = () => {
  const { downloadExcelReport } = useExportToExcel();
  const theme = useSelector<{ theme: "light" | "dark" }, "light" | "dark">(
    (state) => state.theme
  );

  return (
    <div
      className="analytics-container"
      role="main"
      aria-label="Analytics Dashboard"
    >
      {/* Download button */}
      <div className="download-wrapper">
        <button
          onClick={downloadExcelReport}
          className={`download-button ${theme === "dark" ? "dark" : "light"}`}
          aria-label="Download Excel Report"
        >
          <Download size={16} />
        </button>
      </div>

      {/* Main grid of analytics charts with staggered animation */}
      <motion.div
        className="chart-grid"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        role="region"
        aria-label="Task Analytics Charts"
      >
        {/* Status Overview Chart */}
        <motion.div variants={itemVariants}>
          <ChartWrapper title="Status Overview">
            <StatusOverview />
          </ChartWrapper>
        </motion.div>

        {/* Priority Distribution Chart */}
        <motion.div variants={itemVariants}>
          <ChartWrapper title="Priority Distribution">
            <PriorityDistribution />
          </ChartWrapper>
        </motion.div>

        {/* Productivity Metrics Chart */}
        <motion.div variants={itemVariants}>
          <ChartWrapper title="Productivity Metrics">
            <ProductivityMetrics />
          </ChartWrapper>
        </motion.div>

        {/* Task Completion Rate Chart */}
        <motion.div variants={itemVariants}>
          <ChartWrapper title="Task Completion Rate">
            <TaskCompletionRate />
          </ChartWrapper>
        </motion.div>
      </motion.div>

      {/* Overdue Tasks section with its own animation */}
      <motion.div
        className="overdue-container"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
        role="region"
        aria-label="Overdue Tasks"
      >
        <OverdueTasks />
      </motion.div>
    </div>
  );
};

export default Analytics;

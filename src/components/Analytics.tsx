import React from "react";
import { motion } from "framer-motion";
import TaskCompletionRate from "./AnalyticsComponents/TaskCompletionRate";
import PriorityDistribution from "./AnalyticsComponents/PriorityDistribution";
import StatusOverview from "./AnalyticsComponents/StatusOverview";
import OverdueTasks from "./AnalyticsComponents/OverdueTasks";
import ProductivityMetrics from "./AnalyticsComponents/ProductivityMetrics";
import ChartWrapper from "./ChartWrapper";
import "./Analytics.css";

// Animation Variants
const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

const Analytics: React.FC = () => {
  return (
    <div className="analytics-container" >
      <motion.div
        className="chart-grid"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <motion.div variants={itemVariants}>
          <ChartWrapper title="Status Overview">
            <StatusOverview />
          </ChartWrapper>
        </motion.div>
        <motion.div variants={itemVariants}>
          <ChartWrapper title="Priority Distribution">
            <PriorityDistribution />
          </ChartWrapper>
        </motion.div>
        <motion.div variants={itemVariants}>
          <ChartWrapper title="Productivity Metrics">
            <ProductivityMetrics />
          </ChartWrapper>
        </motion.div>
        <motion.div variants={itemVariants}>
          <ChartWrapper title="Task Completion Rate">
            <TaskCompletionRate />
          </ChartWrapper>
        </motion.div>
      </motion.div>

      <motion.div
        className="overdue-container"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        viewport={{ once: true }}
      >
        <OverdueTasks />
      </motion.div>
    </div>
  );
};

export default Analytics;

import React from "react";
import TaskCompletionRate from "./AnalyticsComponents/TaskCompletionRate";
import PriorityDistribution from "./AnalyticsComponents/PriorityDistribution";
import StatusOverview from "./AnalyticsComponents/StatusOverview";
import OverdueTasks from "./AnalyticsComponents/OverdueTasks";
import ProductivityMetrics from "./AnalyticsComponents/ProductivityMetrics";
import ChartWrapper from "./ChartWrapper";
import "./Analytics.css";

const Analytics: React.FC = () => {
  return (
    <div className="analytics-container">
      <div className="chart-grid">
        <ChartWrapper title="Status Overview">
          <StatusOverview />
        </ChartWrapper>
        <ChartWrapper title="Priority Distribution">
          <PriorityDistribution />
        </ChartWrapper>
        <ChartWrapper title="Productivity Metrics">
          <ProductivityMetrics />
        </ChartWrapper>
        <ChartWrapper title="Task Completion Rate">
          <TaskCompletionRate />
        </ChartWrapper>
      </div>
      <div className="overdue-container">
        <OverdueTasks />
      </div>
    </div>
  );
};

export default Analytics;

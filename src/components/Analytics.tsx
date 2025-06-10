import React from "react";
import { Container, Row, Col } from "react-grid-system";
import TaskCompletionRate from "./AnalyticsComponents/TaskCompletionRate";
import PriorityDistribution from "./AnalyticsComponents/PriorityDistribution";
import StatusOverview from "./AnalyticsComponents/StatusOverview";
import OverdueTasks from "./AnalyticsComponents/OverdueTasks";
import ProductivityMetrics from "./AnalyticsComponents/ProductivityMetrics";

const Analytics: React.FC = () => {
  return (
    <Container>
      <Row gutterWidth={100}>
        <Col xs={12} md={6}>
          <div
            style={{
              height: "340px",
              width: "100%",
              padding: "0.5rem",
              boxSizing: "border-box",
            }}
          >
            <StatusOverview />
          </div>
        </Col>
        <Col xs={12} md={6}>
          <div
            style={{
              height: "340px",
              width: "100%",
              padding: "0.5rem",
              boxSizing: "border-box",
            }}
          >
            <PriorityDistribution />
          </div>
        </Col>
      </Row>
      <Row gutterWidth={100}>
        <Col xs={12} md={6}>
          <div
            style={{
              height: "340px",
              width: "100%",
              padding: "0.5rem",
              boxSizing: "border-box",
              marginTop: "50px",
            }}
          >
            <ProductivityMetrics />
          </div>
        </Col>
        <Col xs={12} md={6}>
          <div
            style={{
              height: "340px",
              width: "100%",
              padding: "0.5rem",
              boxSizing: "border-box",
              marginTop: "50px",
            }}
          >
            <TaskCompletionRate />
          </div>
        </Col>
      </Row>
      <Row>
        <Col xs={12}>
          <div
            style={{
              height: "350px",
              width: "100%",
              padding: "0.5rem",
              boxSizing: "border-box",
              marginTop: "100px",
            }}
          >
            <OverdueTasks />
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default Analytics;

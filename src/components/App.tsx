import React from "react";
import { Route, Routes } from "react-router-dom";

const App: React.FC = () => {
  return (
    <div>
      <Routes>
        <Route path="/" element={<div>hi</div>} />
      </Routes>
    </div>
  );
};

export default App;

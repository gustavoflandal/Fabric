import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { TestCountingPage } from '@/pages/TestCountingPage';

export const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/test-counting" element={<TestCountingPage />} />
      </Routes>
    </Router>
  );
};

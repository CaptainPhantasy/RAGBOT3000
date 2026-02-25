import React from 'react';
import { DualModeInterface } from './components/DualModeInterface';
import './index.css';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <DualModeInterface />
    </div>
  );
};

export default App;
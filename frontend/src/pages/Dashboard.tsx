import React from 'react';
import { useAppSelector } from '../hooks/redux';
import ProjectList from '../components/ProjectList';

const Dashboard: React.FC = () => {
  const { user } = useAppSelector((state) => state.auth);

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Welcome back, {user?.username}!</h1>
        <p>Ready to build something amazing?</p>
      </div>

      <ProjectList />
    </div>
  );
};

export default Dashboard;
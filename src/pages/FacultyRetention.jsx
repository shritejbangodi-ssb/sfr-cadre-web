import React from 'react';
import Header from '../components/Header';
import './Students.css';

const FacultyRetention = () => {
  return (
    <div className="page-view">
      <Header 
        title="Faculty Retention" 
        subtitle="Monitor and analyze faculty retention rates" 
      />
      <div className="table-container glass-panel p-6" style={{ padding: '2rem' }}>
        <p className="text-muted">Faculty Retention content will go here.</p>
      </div>
    </div>
  );
};

export default FacultyRetention;

import React from 'react';
import Header from '../components/Header';
import './Students.css'; // Reuse existing styles

const FacultyQualification = () => {
  return (
    <div className="page-view">
      <Header 
        title="Faculty Qualification" 
        subtitle="Track and manage faculty qualifications and degrees" 
      />
      <div className="table-container glass-panel p-6" style={{ padding: '2rem' }}>
        <p className="text-muted">Faculty Qualification content will go here.</p>
      </div>
    </div>
  );
};

export default FacultyQualification;

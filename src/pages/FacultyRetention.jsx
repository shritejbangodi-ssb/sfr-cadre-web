import React from 'react';
import Header from '../components/Header';

const FacultyRetention = () => {
  return (
    <div className="page-view">
      <Header
        title="Faculty Retention"
        subtitle="Manage and view faculty retention data"
      />
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', marginTop: '1.5rem' }}>
        <p className="text-muted">Faculty Retention tracking coming soon...</p>
      </div>
    </div>
  );
};

export default FacultyRetention;

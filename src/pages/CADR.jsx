import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import Header from '../components/Header';
import './Students.css';

const CADR = () => {
  const [cadrData, setCadrData] = useState([]);

  useEffect(() => {
    let unsubFaculty;

    // Listen to Students (for strength) and Faculty (for ranks)
    const unsubStudents = onSnapshot(collection(db, 'students'), (studentSnap) => {
      const studentDocs = studentSnap.docs.map(doc => doc.data());

      unsubFaculty = onSnapshot(collection(db, 'faculty_members'), (facSnap) => {
        const facultyDocs = facSnap.docs.map(f => f.data());

        const depts = {};

        // Group Students
        studentDocs.forEach(s => {
          const dept = s.department ? s.department.toUpperCase() : 'UNKNOWN';
          if (!depts[dept]) depts[dept] = { department: dept, students: 0, profs: 0, assocProfs: 0, asstProfs: 0 };
          depts[dept].students += parseInt(s.noOfStudents) || 1;
        });

        // Group Faculty
        facultyDocs.forEach(f => {
          // Only count currently active faculty for the current cadre breakdown
          if (f.Leaving_Year && String(f.Leaving_Year).trim() !== '' && String(f.Leaving_Year).toLowerCase() !== 'still working') return;

          const dept = f.Department ? f.Department.toUpperCase() : 'UNKNOWN';
          if (!depts[dept]) depts[dept] = { department: dept, students: 0, profs: 0, assocProfs: 0, asstProfs: 0 };

          const designation = (f.Designation || '').toLowerCase();
          const isAsst = designation.includes('assistant') || designation.includes('asst');
          const isAssoc = designation.includes('associate') || designation.includes('assoc');
          const temp = designation
            .replace(/(assistant|asst)\s*prof(essor)?/g, '')
            .replace(/(associate|assoc)\s*prof(essor)?/g, '');
          const isProf = temp.includes('professor') || temp.includes('prof');

          if (isAsst) depts[dept].asstProfs++;
          if (isAssoc) depts[dept].assocProfs++;
          if (isProf) depts[dept].profs++;
        });

        const processed = Object.values(depts);

        processed.sort((a, b) => a.department.localeCompare(b.department));
        setCadrData(processed);
      });
    });

    return () => {
      unsubStudents();
      if (unsubFaculty) unsubFaculty();
    };
  }, []);

  return (
    <div className="page-view">
      <Header 
        title="Cadre Ratio (CADR) Analysis" 
        subtitle="Department-wise Cadre Compliance Tracking (1:2:6)" 
      />

      <div className="table-container glass-panel">
        <h3 style={{ padding: '1rem 1rem 0 1rem', color: 'var(--color-primary)' }}>Cadre Ratio Breakdown</h3>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Professors</th>
                <th>Associate Profs</th>
                <th>Assistant Profs</th>
              </tr>
            </thead>
            <tbody>
              {cadrData.length > 0 ? (
                cadrData.map((row, idx) => (
                  <tr key={idx}>
                    <td><span className={`badge-dept badge-${(row.department || 'cse').toLowerCase()}`}>{row.department}</span></td>
                    <td className="font-semibold">{row.profs}</td>
                    <td className="font-semibold">{row.assocProfs}</td>
                    <td className="font-semibold">{row.asstProfs}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="empty-state">No department data available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default CADR;

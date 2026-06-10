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
          if (designation.includes('assistant')) {
            depts[dept].asstProfs++;
          } else if (designation.includes('associate')) {
            depts[dept].assocProfs++;
          } else if (designation.includes('professor') || designation.includes('prof')) {
            depts[dept].profs++;
          }
        });

        // Compute Cadre Status
        const processed = Object.values(depts).map(d => {
          let status = 'N/A';
          if (d.department === 'PG') {
            if ((d.profs + d.assocProfs + d.asstProfs) >= 2) {
              status = 'Satisfied';
            } else {
              status = 'Not Satisfied';
            }
          } else if (d.students >= 135) {
            if (d.profs >= 1 && d.assocProfs >= 2 && d.asstProfs >= 6) {
              status = 'Satisfied';
            } else {
              status = 'Not Satisfied';
            }
          } else if (d.students > 0) {
            // For smaller departments, fallback or mark as N/A
            // But we will be strict: if user wants Satisfied/Not Satisfied, we can say Not Satisfied if they don't meet the ratio.
            // Let's just use N/A if it's less than 135 since the requirement doesn't apply exactly.
            status = 'N/A (Under 135)';
          }

          return {
            ...d,
            status
          };
        });

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
                <th>Status</th>
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
                    <td>
                      {row.status === 'Satisfied' ? (
                        <span style={{ color: 'var(--color-success)', fontWeight: 600, backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '4px 8px', borderRadius: '4px' }}>Satisfied</span>
                      ) : row.status === 'Not Satisfied' ? (
                        <span style={{ color: 'var(--color-danger)', fontWeight: 600, backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '4px 8px', borderRadius: '4px' }}>Not Satisfied</span>
                      ) : (
                        <span className="text-muted font-semibold">{row.status}</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="empty-state">No department data available.</td>
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

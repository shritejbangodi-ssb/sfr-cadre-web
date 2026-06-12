import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Calculator } from 'lucide-react';
import { calculateNBA_SFR } from '../utils/sfrCalculator';
import Header from '../components/Header';
import './Students.css';

const SFR = () => {
  const [sfrData, setSfrData] = useState([]);
  const [targetYears, setTargetYears] = useState([]);
  const [overallStats, setOverallStats] = useState({
    totalStudents: 0,
    totalFaculty: 0,
    overallSFR: '0.00'
  });

  useEffect(() => {
    let unsubFaculty;
    
    // Listen to Students
    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      const studentDocs = snap.docs.map(doc => doc.data());
      
      // Listen to Faculty
      unsubFaculty = onSnapshot(collection(db, 'faculty_members'), (facSnap) => {
        const facultyDocs = facSnap.docs.map(f => f.data());
        
        const calculatedDepts = calculateNBA_SFR(studentDocs, facultyDocs);
        const processedDepts = Object.values(calculatedDepts).filter(d => d.department !== 'UNKNOWN');

        let totalStudents = 0;
        let totalFaculty = 0;
        let sumAverages = 0;
        let validDepts = 0;

        const currentTargetYears = processedDepts.length > 0 ? processedDepts[0].targetYears : [];

        const tableData = processedDepts.map(d => {
          totalStudents += d.totalStudents3Years;
          totalFaculty += d.maxFacultySeen;
          if (d.averageSFR > 0) {
            sumAverages += d.averageSFR;
            validDepts++;
          }
          return {
            department: d.department,
            students: d.totalStudents3Years,
            faculty: d.maxFacultySeen,
            currentSfr: d.averageSFR,
            yearlyData: d.yearlyData
          };
        });

        setTargetYears(currentTargetYears);
        setSfrData(tableData);

        const overallAvgSfr = validDepts > 0 ? (sumAverages / validDepts).toFixed(2) : '0.00';

        setOverallStats({
          totalStudents,
          totalFaculty,
          overallSFR: overallAvgSfr === '0.00' ? 'N/A' : overallAvgSfr
        });
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
        title="SFR Analysis" 
        subtitle="Student-Faculty Ratio detailed live breakdown" 
      />

      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '1rem' }}>
        <h3 style={{ marginBottom: '1rem', color: 'var(--color-primary)' }}>College Overall SFR</h3>
        <div className="d-flex align-center gap-4">
          <div className="stat-value" style={{ fontSize: '3rem', color: 'var(--text-main)', lineHeight: 1 }}>
            {overallStats.overallSFR}:1
          </div>
          <div style={{ padding: '0.5rem 1rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-success)', borderRadius: 'var(--radius-md)' }}>
            <strong>Target: 15:1</strong>
          </div>
        </div>
        <p className="subtitle" style={{ marginTop: '0.5rem' }}>Total Students (3 Yrs): {overallStats.totalStudents} | Total Faculty (Max): {overallStats.totalFaculty}</p>
      </div>

      <div className="table-container glass-panel">
        <h3 style={{ padding: '1rem 1rem 0 1rem' }}>Department Breakdown</h3>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Department</th>
                {targetYears.map(year => (
                  <th key={year}>{year} SFR</th>
                ))}
                <th>Average SFR</th>
              </tr>
            </thead>
            <tbody>
              {sfrData.length > 0 ? (
                sfrData.map((row, idx) => (
                  <tr key={idx}>
                    <td className="font-semibold">{row.department}</td>
                    {targetYears.map(year => (
                      <td key={year}>
                        {row.yearlyData && row.yearlyData[year] 
                          ? row.yearlyData[year].sfr.toFixed(2) 
                          : '-'}
                      </td>
                    ))}
                    <td className="font-semibold">{row.currentSfr.toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={targetYears.length + 2} className="empty-state">No data available. Add students and faculty!</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SFR;

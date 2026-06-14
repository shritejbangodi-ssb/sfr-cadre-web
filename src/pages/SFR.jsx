import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Calculator } from 'lucide-react';
import { calculateNBA_SFR, formatAcademicYear, getAcademicYearsInRange } from '../utils/sfrCalculator';
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

  const defaultStartYear = 2023;
  const defaultEndStart = 2025;
  const startYear = localStorage.getItem('globalStartYear') || formatAcademicYear(defaultStartYear, true);
  const endYear = localStorage.getItem('globalEndYear') || formatAcademicYear(defaultEndStart, true);

  useEffect(() => {
    let unsubFaculty;

    const fetchSheetTotals = async () => {
      try {
        const url = "https://docs.google.com/spreadsheets/d/1E2VYOBneOPv7hBpnv2X1hCLkdbC67mhurx2tLQq9Ja0/export?format=csv&gid=7131963";
        const response = await fetch(url);
        const text = await response.text();
        const lines = text.trim().split('\n').map(line => line.split(','));
        if (lines.length > 2) {
          const headerRow = lines.find(line => line.includes('Department'));
          const byDept = {};

          if (headerRow) {
            lines.forEach(row => {
               const deptName = row[1] ? row[1].toUpperCase().trim() : '';
               if (deptName && deptName !== 'DEPARTMENT' && !deptName.includes('ALL DEPARTMENT')) {
                  byDept[deptName] = {};
                  headerRow.forEach((h, idx) => {
                     const yearStr = (h || '').trim();
                     if (yearStr && yearStr.match(/\d{4}-\d{2}/)) {
                       byDept[deptName][yearStr] = parseInt(row[idx], 10) || 0;
                     }
                  });
               }
            });
          }
          return byDept;
        }
      } catch (err) {
        console.error("Error fetching Google Sheet for SFR:", err);
      }
      return null;
    };

    const fetchStudentSheetTotals = async () => {
      try {
        const url = "https://docs.google.com/spreadsheets/d/1wAo9LA1LIc_SSwSMhNrB2DYWjBtoanmKqFhTbqPehPA/export?format=csv&gid=1323997071";
        const response = await fetch(url);
        const text = await response.text();
        const lines = text.trim().split('\n').map(line => line.split(','));
        
        if (lines.length > 1) {
          const headerRow = lines[0];
          const byDept = {};

          if (headerRow) {
            lines.forEach(row => {
               const rawDept = row[0] ? row[0].toUpperCase().trim() : '';
               if (rawDept && !rawDept.includes('TOTAL') && !rawDept.includes('YEAR') && !rawDept.startsWith('DS=') && !rawDept.startsWith('AS=') && !rawDept.startsWith('S=')) {
                  let deptName = rawDept;
                  if (deptName.includes('-')) {
                      deptName = deptName.split('-')[1].trim();
                  }
                  
                  if (deptName === 'CYBERSECURITY') deptName = 'CSCY';
                  if (deptName === 'CS&DESIGN' || deptName === 'CS & DESIGN') deptName = 'CSD';

                  if (!byDept[deptName]) byDept[deptName] = {};
                  headerRow.forEach((h, idx) => {
                     const match = (h || '').match(/(\d{4}-\d{2})/);
                     if (match) {
                       const yearKey = match[1];
                       const val = parseInt(row[idx], 10) || 0;
                       byDept[deptName][yearKey] = (byDept[deptName][yearKey] || 0) + val;
                     }
                  });
               }
            });
          }
          return byDept;
        }
      } catch (err) {
        console.error("Error fetching Student Google Sheet for SFR:", err);
      }
      return null;
    };
    
    // Listen to Students
    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      const studentDocs = snap.docs.map(doc => doc.data());
      
      const fetchFacultyAndBuildStats = async () => {
        const sheetFacultyCounts = await fetchSheetTotals();
        const sheetStudentCounts = await fetchStudentSheetTotals();

        // Listen to Faculty
        unsubFaculty = onSnapshot(collection(db, 'faculty_members'), (facSnap) => {
          const facultyDocs = facSnap.docs.map(f => f.data());
          
          const years = getAcademicYearsInRange(startYear, endYear);
          const calculatedDepts = calculateNBA_SFR(studentDocs, facultyDocs, years, sheetFacultyCounts, sheetStudentCounts);
          let processedDepts = Object.values(calculatedDepts).filter(d => d.department !== 'UNKNOWN');

          // Filter out legacy unmapped names
          processedDepts = processedDepts.filter(d => 
            d.department !== 'CS & DESIGN' && 
            d.department !== 'CYBERSECURITY'
          );

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
              points: d.points,
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
      };
      
      fetchFacultyAndBuildStats();
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
                <th>SFR Marks (Out of 30)</th>
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
                    <td className="font-semibold" style={{ color: row.points >= 26 ? 'var(--color-success)' : row.points > 0 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                      {row.points}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={targetYears.length + 3} className="empty-state">No data available. Add students and faculty!</td>
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

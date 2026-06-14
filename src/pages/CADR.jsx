import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import { formatAcademicYear, getAcademicYearsInRange } from '../utils/sfrCalculator';
import './Students.css';

const CADR = () => {
  const [cadrData, setCadrData] = useState([]);
  const [targetYears, setTargetYears] = useState([]);

  const defaultStartYear = 2023;
  const defaultEndStart = 2025;
  const startYear = localStorage.getItem('globalStartYear') || formatAcademicYear(defaultStartYear, true);
  const endYear = localStorage.getItem('globalEndYear') || formatAcademicYear(defaultEndStart, true);

  useEffect(() => {
    const fetchCadrData = async () => {
      try {
        const url = "https://docs.google.com/spreadsheets/d/1E2VYOBneOPv7hBpnv2X1hCLkdbC67mhurx2tLQq9Ja0/export?format=csv&gid=1020790699";
        const response = await fetch(url);
        const text = await response.text();
        const lines = text.trim().split('\n').map(line => line.split(','));

        const years = getAcademicYearsInRange(startYear, endYear);
        const sheetYears = years.map(y => {
          const match = y.match(/(\d{4})-(\d{4})/);
          if (match) return `${match[1]}-${match[2].slice(-2)}`;
          return y;
        });

        const deptsData = {};
        let currentDept = '';

        for (let i = 1; i < lines.length; i++) {
          const row = lines[i];
          if (row[0] && row[0].trim() !== '') {
            currentDept = row[0].trim();
            if (!deptsData[currentDept]) {
              deptsData[currentDept] = [];
            }
          }
          
          const yearStr = row[1] ? row[1].trim() : '';
          if (yearStr && sheetYears.includes(yearStr)) {
             let RF1 = parseFloat(row[2]) || 0;
             let AF1 = parseFloat(row[3]) || 0;
             let RF2 = parseFloat(row[4]) || 0;
             let AF2 = parseFloat(row[5]) || 0;
             let RF3 = parseFloat(row[6]) || 0;
             let AF3 = parseFloat(row[7]) || 0;

             let cadreMarks = 0;
             if (AF1 === 0 && AF2 === 0) {
               cadreMarks = 0;
             } else {
               let term1 = RF1 > 0 ? (AF1 / RF1) : 0;
               let term2 = RF2 > 0 ? (AF2 / RF2) * 0.6 : 0;
               let term3 = RF3 > 0 ? (AF3 / RF3) * 0.4 : 0;
               let rawMarks = (term1 + term2 + term3) * 12.5;
               cadreMarks = Math.min(rawMarks, 25);
             }

             if (currentDept) {
               deptsData[currentDept].push({
                 year: yearStr,
                 RF1, AF1,
                 RF2, AF2,
                 RF3, AF3,
                 cadreMarks: cadreMarks.toFixed(2)
               });
             }
          }
        }
        
        const finalData = Object.keys(deptsData).map(dept => {
           const yearlyData = deptsData[dept];
           const sumMarks = yearlyData.reduce((sum, item) => sum + parseFloat(item.cadreMarks), 0);
           const avgMarks = yearlyData.length > 0 ? (sumMarks / yearlyData.length).toFixed(2) : '0.00';
           return {
             department: dept,
             yearlyData,
             avgMarks
           };
        }).filter(d => d.yearlyData.length > 0);

        finalData.sort((a, b) => a.department.localeCompare(b.department));
        setTargetYears(sheetYears);
        setCadrData(finalData);

      } catch (err) {
        console.error("Error fetching CADR Sheet Data:", err);
      }
    };
    
    fetchCadrData();
  }, [startYear, endYear]);

  return (
    <div className="page-view">
      <Header 
        title="Cadre Ratio (CADR) Analysis" 
        subtitle="Department-wise Cadre Compliance Tracking (1:2:6)" 
      />

      <div className="table-container glass-panel" style={{ marginTop: '2rem' }}>
        <h3 style={{ padding: '1rem 1rem 0 1rem', color: 'var(--color-primary)' }}>Faculty Cadre Proportion Marks</h3>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Academic Year</th>
                <th>Professors (AF/RF)</th>
                <th>Associate Profs (AF/RF)</th>
                <th>Assistant Profs (AF/RF)</th>
                <th>Cadre Marks (Out of 25)</th>
              </tr>
            </thead>
            <tbody>
              {cadrData.length > 0 ? (
                cadrData.map((deptBlock, idx) => (
                  <React.Fragment key={idx}>
                    {deptBlock.yearlyData.map((yearData, yIdx) => (
                       <tr key={`${idx}-${yIdx}`}>
                         {yIdx === 0 && (
                           <td rowSpan={deptBlock.yearlyData.length + 1} style={{ verticalAlign: 'middle' }}>
                             <span className={`badge-dept badge-${(deptBlock.department || 'cse').toLowerCase()}`}>{deptBlock.department}</span>
                           </td>
                         )}
                         <td className="font-semibold">{yearData.year}</td>
                         <td>{yearData.AF1} / {yearData.RF1 > 0 ? yearData.RF1.toFixed(1) : '0.0'}</td>
                         <td>{yearData.AF2} / {yearData.RF2 > 0 ? yearData.RF2.toFixed(1) : '0.0'}</td>
                         <td>{yearData.AF3} / {yearData.RF3 > 0 ? yearData.RF3.toFixed(1) : '0.0'}</td>
                         <td className="font-semibold" style={{ color: yearData.cadreMarks >= 20 ? 'var(--color-success)' : yearData.cadreMarks > 0 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                           {yearData.cadreMarks}
                         </td>
                       </tr>
                    ))}
                    <tr key={`${idx}-avg`} style={{ backgroundColor: 'rgba(0,0,0,0.02)' }}>
                      <td colSpan="4" style={{ textAlign: 'right', fontWeight: 'bold' }}>Average Cadre Marks (3 Years):</td>
                      <td className="font-semibold" style={{ color: deptBlock.avgMarks >= 20 ? 'var(--color-success)' : deptBlock.avgMarks > 0 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                        {deptBlock.avgMarks}
                      </td>
                    </tr>
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="empty-state">Loading cadre data from Google Sheet...</td>
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

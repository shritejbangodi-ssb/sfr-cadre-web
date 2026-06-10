import React, { useState, useEffect } from 'react';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { calculateNBA_SFR, getYearNumber } from '../utils/sfrCalculator';
import Header from '../components/Header';

const Reports = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingCadre, setIsGeneratingCadre] = useState(false);
  const [deptData, setDeptData] = useState([]); // Array of { department, students, faculty, sfr, cadreMarks, cadreDetails }
  const [targetYears, setTargetYears] = useState([]);

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    try {
      const studentSnap = await getDocs(collection(db, 'students'));
      const studentList = studentSnap.docs.map(d => d.data());

      const facultySnap = await getDocs(collection(db, 'faculty_members'));
      const facultyList = facultySnap.docs.map(d => d.data());

      const calculatedDepts = calculateNBA_SFR(studentList, facultyList);

      // Get the target academic years dynamically
      const allYears = [...new Set(studentList.map(s => s.academicYear).filter(Boolean))];
      allYears.sort((a, b) => getYearNumber(b) - getYearNumber(a));
      const computedTargetYears = allYears.slice(0, 3);
      setTargetYears(computedTargetYears);

      const processedDepts = Object.values(calculatedDepts)
        .sort((a, b) => a.department.localeCompare(b.department))
        .map(d => ({
          department: d.department,
          students: d.totalStudents3Years,
          faculty: d.maxFacultySeen,
          sfr: d.averageSFR > 0 ? d.averageSFR.toFixed(2) : 'N/A',
          points: d.points,
          cadreMarks: d.cadreMarks,
          cadreDetails: d.cadreDetails,
          yearlyData: d.yearlyData
        }));
        
      setDeptData(processedDepts);

    } catch (err) {
      console.error("Error fetching report data", err);
    }
  };

  const getPointsForSFR = (sfrVal) => {
    const sfr = parseFloat(sfrVal);
    if (isNaN(sfr) || sfr <= 0) return 0;
    if (sfr <= 15) return 30;
    if (sfr <= 17) return 26;
    if (sfr <= 19) return 22;
    if (sfr <= 21) return 18;
    if (sfr <= 23) return 14;
    if (sfr <= 25) return 10;
    return 0;
  };


  // Export functionality
  const exportSFR_PDF = () => {
    setIsGenerating(true);
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Department SFR Report', 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

    const tableColumn = ["Department", "Total Students", "Total Faculty", "Calculated SFR", "Points (Out of 30)"];
    const tableRows = [];

    deptData.forEach(d => {
      tableRows.push([d.department, d.students, d.faculty, d.sfr, d.points]);
    });

    autoTable(doc, {
      startY: 35,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] }
    });

    doc.save(`SFR_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    setIsGenerating(false);
  };

  const exportSFR_Excel = () => {
    const formattedData = deptData.map(d => ({
      "Department": d.department,
      "Total Students": d.students,
      "Total Faculty": d.faculty,
      "Calculated SFR": d.sfr,
      "Points (Out of 30)": d.points
    }));
    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SFR Data");
    XLSX.writeFile(wb, "Department_SFR_Report.xlsx");
  };

  const exportCadre_PDF = () => {
    setIsGeneratingCadre(true);
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Faculty Cadre Proportion Report', 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

    const tableColumn = ["Department", "Available (AF1:AF2:AF3)", "Required (RF1:RF2:RF3)", "Cadre Marks (Out of 25)"];
    const tableRows = [];

    deptData.forEach(d => {
      const avail = `${d.cadreDetails.AF1}:${d.cadreDetails.AF2}:${d.cadreDetails.AF3}`;
      const req = `${d.cadreDetails.RF1.toFixed(1)}:${d.cadreDetails.RF2.toFixed(1)}:${d.cadreDetails.RF3.toFixed(1)}`;
      tableRows.push([d.department, avail, req, d.cadreMarks]);
    });

    autoTable(doc, {
      startY: 35,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] }
    });

    doc.save(`Cadre_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    setIsGeneratingCadre(false);
  };

  const exportCadre_Excel = () => {
    const formattedData = deptData.map(d => ({
      "Department": d.department,
      "Available Profs (AF1)": d.cadreDetails.AF1,
      "Available Assoc (AF2)": d.cadreDetails.AF2,
      "Available Asst (AF3)": d.cadreDetails.AF3,
      "Required Profs (RF1)": parseFloat(d.cadreDetails.RF1.toFixed(2)),
      "Required Assoc (RF2)": parseFloat(d.cadreDetails.RF2.toFixed(2)),
      "Required Asst (RF3)": parseFloat(d.cadreDetails.RF3.toFixed(2)),
      "Cadre Marks (Out of 25)": parseFloat(d.cadreMarks)
    }));
    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cadre Data");
    XLSX.writeFile(wb, "Faculty_Cadre_Proportion_Report.xlsx");
  };

  return (
    <div className="page-view">
      <Header 
        title="Reports Generator" 
        subtitle="Export live academic analytics into formatted documents" 
      />

      <div className="stats-grid">
        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', textAlign: 'center' }}>
          <FileText size={48} className="text-primary" />
          <h3>Department SFR Report</h3>
          <p className="text-muted">Dynamic breakdown of real-time student-faculty ratio across all registered departments.</p>
          <div className="d-flex gap-2" style={{ marginTop: 'auto' }}>
            <button className="btn btn-secondary" onClick={exportSFR_Excel}><FileSpreadsheet size={16} /> Excel</button>
            <button className="btn btn-primary" onClick={exportSFR_PDF} disabled={isGenerating}><Download size={16} /> PDF</button>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', textAlign: 'center' }}>
          <FileText size={48} className="text-secondary" />
          <h3>Faculty Cadre Proportion</h3>
          <p className="text-muted">Calculates AICTE section 5.3 cadre marks (Out of 25) using the 1:2:6 formula requirements.</p>
          <div className="d-flex gap-2" style={{ marginTop: 'auto' }}>
            <button className="btn btn-secondary" onClick={exportCadre_Excel}><FileSpreadsheet size={16} /> Excel</button>
            <button className="btn btn-primary" onClick={exportCadre_PDF} disabled={isGeneratingCadre}><Download size={16} /> PDF</button>
          </div>
        </div>
      </div>

      <div className="table-container glass-panel" style={{ marginTop: '2rem' }}>
        <h3 style={{ padding: '1rem 1rem 0 1rem' }}>Live Report Preview</h3>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Total Students</th>
                <th>Total Faculty</th>
                <th>Calculated SFR</th>
                <th>Points (Out of 30)</th>
              </tr>
            </thead>
            <tbody>
              {deptData.length > 0 ? (
                deptData.map((d, idx) => (
                  <tr key={idx}>
                    <td><span className={`badge-dept badge-${(d.department || 'cse').toLowerCase()}`}>{d.department}</span></td>
                    <td>{d.students}</td>
                    <td>{d.faculty}</td>
                    <td className="font-semibold">{d.sfr}</td>
                    <td className="font-semibold" style={{ color: d.points >= 28 ? 'var(--color-success)' : d.points > 0 ? 'var(--color-warning)' : 'var(--color-danger)' }}>{d.points}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="empty-state">Loading data from database...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {targetYears.map((yearStr, yearIdx) => {
        const label = yearIdx === 0 ? 'CAY' : yearIdx === 1 ? 'CAYM1' : `CAYM${yearIdx}`;
        return (
          <div key={yearStr} className="table-container glass-panel" style={{ marginTop: '2rem' }}>
            <h3 style={{ padding: '1rem 1rem 0 1rem' }}>Academic Year {yearStr} ({label}) Report</h3>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Total Students</th>
                    <th>Total Faculty</th>
                    <th>Calculated SFR</th>
                    <th>Points (Out of 30)</th>
                  </tr>
                </thead>
                <tbody>
                  {deptData.length > 0 ? (
                    deptData.map((d, idx) => {
                      const yearInfo = d.yearlyData?.[yearStr] || { students: 0, faculty: 0, sfr: 0 };
                      const points = getPointsForSFR(yearInfo.sfr);
                      const displaySFR = yearInfo.sfr > 0 ? yearInfo.sfr.toFixed(2) : 'N/A';
                      return (
                        <tr key={idx}>
                          <td><span className={`badge-dept badge-${(d.department || 'cse').toLowerCase()}`}>{d.department}</span></td>
                          <td>{yearInfo.students}</td>
                          <td>{yearInfo.faculty}</td>
                          <td className="font-semibold">{displaySFR}</td>
                          <td className="font-semibold" style={{ color: points >= 28 ? 'var(--color-success)' : points > 0 ? 'var(--color-warning)' : 'var(--color-danger)' }}>{points}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="5" className="empty-state">Loading data from database...</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <div className="table-container glass-panel" style={{ marginTop: '2rem' }}>
        <h3 style={{ padding: '1rem 1rem 0 1rem' }}>Faculty Cadre Proportion Report (Out of 25)</h3>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Total Students</th>
                <th>Available (1:2:6)</th>
                <th>Required (1:2:6)</th>
                <th>Cadre Marks (25)</th>
              </tr>
            </thead>
            <tbody>
              {deptData.length > 0 ? (
                deptData.map((d, idx) => (
                  <tr key={idx}>
                    <td><span className={`badge-dept badge-${(d.department || 'cse').toLowerCase()}`}>{d.department}</span></td>
                    <td>{d.students}</td>
                    <td className="text-muted">
                      {d.cadreDetails.AF1} : {d.cadreDetails.AF2} : {d.cadreDetails.AF3}
                    </td>
                    <td className="text-muted">
                      {d.cadreDetails.RF1.toFixed(1)} : {d.cadreDetails.RF2.toFixed(1)} : {d.cadreDetails.RF3.toFixed(1)}
                    </td>
                    <td className="font-semibold" style={{ color: d.cadreMarks >= 20 ? 'var(--color-success)' : d.cadreMarks > 0 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                      {d.cadreMarks}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="empty-state">Loading data from database...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;

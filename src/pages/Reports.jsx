import React, { useState, useEffect } from 'react';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { calculateNBA_SFR, getYearNumber, formatAcademicYear, getAcademicYearsInRange } from '../utils/sfrCalculator';
import Header from '../components/Header';

const Reports = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingCadre, setIsGeneratingCadre] = useState(false);
  const [deptData, setDeptData] = useState([]); // Array of { department, students, faculty, sfr, cadreMarks, cadreDetails }
  const [targetYears, setTargetYears] = useState([]);

  const defaultStartYear = 2023;
  const defaultEndStart = 2025;
  const startYear = localStorage.getItem('globalStartYear') || formatAcademicYear(defaultStartYear, true);
  const endYear = localStorage.getItem('globalEndYear') || formatAcademicYear(defaultEndStart, true);

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    try {
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
          console.error("Error fetching Google Sheet for Reports:", err);
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
          console.error("Error fetching Student Google Sheet for Reports:", err);
        }
        return null;
      };

      const studentSnap = await getDocs(collection(db, 'students'));
      const studentList = studentSnap.docs.map(d => d.data());

      const facultySnap = await getDocs(collection(db, 'faculty_members'));
      const facultyList = facultySnap.docs.map(d => d.data());

      const sheetFacultyCounts = await fetchSheetTotals();
      const sheetStudentCounts = await fetchStudentSheetTotals();

      const years = getAcademicYearsInRange(startYear, endYear);
      const calculatedDepts = calculateNBA_SFR(studentList, facultyList, years, sheetFacultyCounts, sheetStudentCounts);

      let processedDepts = Object.values(calculatedDepts).filter(d => d.department !== 'UNKNOWN');

      // Filter out legacy unmapped names
      processedDepts = processedDepts.filter(d => 
        d.department !== 'CS & DESIGN' && 
        d.department !== 'CYBERSECURITY'
      );

      const computedTargetYears = processedDepts.length > 0 ? processedDepts[0].targetYears : [];
      setTargetYears(computedTargetYears);

      const finalDepts = processedDepts
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

      setDeptData(finalDepts);

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

      {/* Live table previews have been removed as per request */}
    </div>
  );
};

export default Reports;

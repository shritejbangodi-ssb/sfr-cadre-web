import React, { useState, useEffect } from 'react';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { calculateNBA_SFR, formatAcademicYear, getAcademicYearsInRange } from '../utils/sfrCalculator';
import Header from '../components/Header';

const Reports = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingCadre, setIsGeneratingCadre] = useState(false);
  
  const [sfrData, setSfrData] = useState([]);
  const [targetYears, setTargetYears] = useState([]);
  
  const [cadrData, setCadrData] = useState([]);
  const [cadrTargetYears, setCadrTargetYears] = useState([]);

  const defaultStartYear = 2023;
  const defaultEndStart = 2025;
  const startYear = localStorage.getItem('globalStartYear') || formatAcademicYear(defaultStartYear, true);
  const endYear = localStorage.getItem('globalEndYear') || formatAcademicYear(defaultEndStart, true);

  // Fetch SFR Data exactly as in SFR.jsx
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
      } catch (err) {}
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
      } catch (err) {}
      return null;
    };
    
    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      const studentDocs = snap.docs.map(doc => doc.data());
      
      const fetchFacultyAndBuildStats = async () => {
        const sheetFacultyCounts = await fetchSheetTotals();
        const sheetStudentCounts = await fetchStudentSheetTotals();

        unsubFaculty = onSnapshot(collection(db, 'faculty_members'), (facSnap) => {
          const facultyDocs = facSnap.docs.map(f => f.data());
          const years = getAcademicYearsInRange(startYear, endYear);
          const calculatedDepts = calculateNBA_SFR(studentDocs, facultyDocs, years, sheetFacultyCounts, sheetStudentCounts);
          let processedDepts = Object.values(calculatedDepts).filter(d => d.department !== 'UNKNOWN');

          processedDepts = processedDepts.filter(d => 
            d.department !== 'CS & DESIGN' && 
            d.department !== 'CYBERSECURITY'
          );

          const currentTargetYears = processedDepts.length > 0 ? processedDepts[0].targetYears : [];

          const tableData = processedDepts.map(d => {
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
        });
      };
      
      fetchFacultyAndBuildStats();
    });

    return () => {
      unsubStudents();
      if (unsubFaculty) unsubFaculty();
    };
  }, [startYear, endYear]);

  // Fetch CADR Data exactly as in CADR.jsx
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
            if (!deptsData[currentDept]) deptsData[currentDept] = [];
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
        setCadrTargetYears(sheetYears);
        setCadrData(finalData);

      } catch (err) {
        console.error("Error fetching CADR Sheet Data:", err);
      }
    };
    
    fetchCadrData();
  }, [startYear, endYear]);

  // Export functionality
  const exportSFR_PDF = () => {
    setIsGenerating(true);
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Department SFR Report', 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

    const tableColumn = ["Department", ...targetYears.map(y => `${y} SFR`), "Average SFR", "SFR Marks (Out of 30)"];
    const tableRows = [];

    sfrData.forEach(d => {
      const row = [d.department];
      targetYears.forEach(year => {
         row.push(d.yearlyData && d.yearlyData[year] ? d.yearlyData[year].sfr.toFixed(2) : '-');
      });
      row.push(d.currentSfr.toFixed(2));
      row.push(d.points);
      tableRows.push(row);
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
    const formattedData = sfrData.map(d => {
      const row = { "Department": d.department };
      targetYears.forEach(year => {
        row[`${year} SFR`] = d.yearlyData && d.yearlyData[year] ? parseFloat(d.yearlyData[year].sfr.toFixed(2)) : null;
      });
      row["Average SFR"] = parseFloat(d.currentSfr.toFixed(2));
      row["SFR Marks (Out of 30)"] = d.points;
      return row;
    });
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

    const tableColumn = ["Department", "Available (Prof:Assoc:Asst)", "Required (Prof:Assoc:Asst)", "Cadre Marks (Out of 25)"];
    const tableRows = [];

    cadrData.forEach(d => {
      const latestData = d.yearlyData[d.yearlyData.length - 1];
      if (latestData) {
        const avail = `${latestData.AF1}:${latestData.AF2}:${latestData.AF3}`;
        const req = `${latestData.RF1 > 0 ? latestData.RF1.toFixed(1) : '0.0'}:${latestData.RF2 > 0 ? latestData.RF2.toFixed(1) : '0.0'}:${latestData.RF3 > 0 ? latestData.RF3.toFixed(1) : '0.0'}`;
        tableRows.push([d.department, avail, req, latestData.cadreMarks]);
      }
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
    const formattedData = [];
    cadrData.forEach(d => {
      const latestData = d.yearlyData[d.yearlyData.length - 1];
      if (latestData) {
         formattedData.push({
           "Department": d.department,
           "Available (Prof:Assoc:Asst)": `${latestData.AF1}:${latestData.AF2}:${latestData.AF3}`,
           "Required (Prof:Assoc:Asst)": `${latestData.RF1 > 0 ? latestData.RF1.toFixed(1) : '0.0'}:${latestData.RF2 > 0 ? latestData.RF2.toFixed(1) : '0.0'}:${latestData.RF3 > 0 ? latestData.RF3.toFixed(1) : '0.0'}`,
           "Cadre Marks (Out of 25)": parseFloat(latestData.cadreMarks)
         });
      }
    });
    
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
            <button className="btn btn-secondary" onClick={exportSFR_Excel} disabled={sfrData.length === 0}><FileSpreadsheet size={16} /> Excel</button>
            <button className="btn btn-primary" onClick={exportSFR_PDF} disabled={isGenerating || sfrData.length === 0}><Download size={16} /> PDF</button>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', textAlign: 'center' }}>
          <FileText size={48} className="text-secondary" />
          <h3>Faculty Cadre Proportion</h3>
          <p className="text-muted">Calculates AICTE section 5.3 cadre marks (Out of 25) using the 1:2:6 formula requirements.</p>
          <div className="d-flex gap-2" style={{ marginTop: 'auto' }}>
            <button className="btn btn-secondary" onClick={exportCadre_Excel} disabled={cadrData.length === 0}><FileSpreadsheet size={16} /> Excel</button>
            <button className="btn btn-primary" onClick={exportCadre_PDF} disabled={isGeneratingCadre || cadrData.length === 0}><Download size={16} /> PDF</button>
          </div>
        </div>
      </div>

      {/* Live table previews have been removed as per request */}
    </div>
  );
};

export default Reports;

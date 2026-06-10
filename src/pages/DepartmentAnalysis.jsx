import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { calculateNBA_SFR } from '../utils/sfrCalculator';
import Header from '../components/Header';
import './Students.css';

const getDepartmentFromCourse = (courseCode) => {
  if (!courseCode) return 'UNKNOWN';
  const code = courseCode.toUpperCase();
  if (code.startsWith('CS')) return 'CSE';
  if (code.startsWith('EC')) return 'ECE';
  if (code.startsWith('ME')) return 'MECH';
  if (code.startsWith('CV') || code.startsWith('CE')) return 'CIVIL';
  if (code.startsWith('IT')) return 'IT';
  return 'UNKNOWN';
};

const DepartmentAnalysis = () => {
  const [deptData, setDeptData] = useState([]);

  useEffect(() => {
    let unsubFaculty;
    let unsubMarks;
    
    // Listen to Students
    const unsubStudents = onSnapshot(collection(db, 'students'), (studentSnap) => {
      const studentDocs = studentSnap.docs.map(doc => doc.data());
      
      // Listen to Faculty
      unsubFaculty = onSnapshot(collection(db, 'faculty_members'), (facSnap) => {
        const facultyDocs = facSnap.docs.map(f => f.data());
        
        // Listen to Marks
        unsubMarks = onSnapshot(collection(db, 'marks'), (markSnap) => {
          const marksList = markSnap.docs.map(d => d.data());
          
          const calculatedDepts = calculateNBA_SFR(studentDocs, facultyDocs);
          
          const marksByDept = {};
          marksList.forEach(m => {
            const dept = getDepartmentFromCourse(m.courseCode);
            if (!marksByDept[dept]) marksByDept[dept] = { totalMarks: 0, passedMarks: 0 };
            
            marksByDept[dept].totalMarks++;
            const totalMarks = (m.internal || 0) + (m.assignment || 0) + (m.lab || 0) + ((m.final || 0) * 0.5);
            if (totalMarks >= 40) marksByDept[dept].passedMarks++;
          });
          
          const processed = Object.values(calculatedDepts).filter(d => d.department !== 'UNKNOWN').map(d => {
            const sfr = d.averageSFR > 0 ? d.averageSFR.toFixed(2) : 'N/A';
            
            const deptMarks = marksByDept[d.department] || { totalMarks: 0, passedMarks: 0 };
            let cadr = deptMarks.totalMarks > 0 ? ((deptMarks.passedMarks / deptMarks.totalMarks) * 100).toFixed(1) + '%' : 'N/A';
            
            // Cadre Compliance
            if (d.department === 'PG') {
              const totalFaculty = d.cadreDetails.AF1 + d.cadreDetails.AF2 + d.cadreDetails.AF3;
              if (totalFaculty >= 2) {
                cadr = 'Satisfied';
              } else {
                cadr = 'Not Satisfied';
              }
            } else if (d.totalStudents3Years >= 135) { // Assuming compliance is based on the aggregated students
              const reqProfs = d.cadreDetails.RF1;
              const reqAssoc = d.cadreDetails.RF2;
              const reqAsst = d.cadreDetails.RF3;
              
              const hasProfs = d.cadreDetails.AF1 >= Math.floor(reqProfs) && d.cadreDetails.AF1 >= 1;
              const hasAssoc = d.cadreDetails.AF2 >= Math.floor(reqAssoc) && d.cadreDetails.AF2 >= 2;
              const hasAsst = d.cadreDetails.AF3 >= Math.floor(reqAsst) && d.cadreDetails.AF3 >= 6;

              if (hasProfs && hasAssoc && hasAsst) {
                cadr = 'Satisfied';
              } else {
                cadr = 'Not Satisfied';
              }
            }

            return {
              department: d.department,
              totalProfs: d.maxFacultySeen,
              sfrRatio: sfr,
              cadrRatio: cadr
            };
          });
          
          processed.sort((a, b) => a.department.localeCompare(b.department));
          setDeptData(processed);
        });
      });
    });

    return () => {
      unsubStudents();
      if (unsubFaculty) unsubFaculty();
      if (unsubMarks) unsubMarks();
    };
  }, []);

  return (
    <div className="page-view">
      <Header 
        title="Department Analysis" 
        subtitle="Comprehensive overview of department metrics" 
      />

      <div className="table-container glass-panel">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Total No of Prof</th>
                <th>SFR Ratio</th>
                <th>CADR Ratio</th>
              </tr>
            </thead>
            <tbody>
              {deptData.length > 0 ? (
                deptData.map((dept, idx) => (
                  <tr key={idx}>
                    <td>
                      <span className={`badge-dept badge-${(dept.department || 'cse').toLowerCase()}`}>
                        {dept.department}
                      </span>
                    </td>
                    <td className="font-semibold">{dept.totalProfs}</td>
                    <td className="font-semibold">
                      {dept.sfrRatio}
                    </td>
                    <td className="font-semibold" style={{ color: dept.cadrRatio === 'Satisfied' ? 'var(--color-success)' : (dept.cadrRatio === 'Not Satisfied' ? 'var(--color-danger)' : (dept.cadrRatio !== 'N/A' ? 'var(--color-success)' : 'inherit')) }}>
                      {dept.cadrRatio}
                    </td>
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

export default DepartmentAnalysis;

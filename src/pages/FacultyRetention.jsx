import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Search, Plus, Trash2, Edit2, X, RefreshCw, Calculator, HelpCircle, FileSpreadsheet, ArrowRight, UserCheck, AlertCircle, Info, Filter } from 'lucide-react';
import Header from '../components/Header';
import * as XLSX from 'xlsx';
import { parseExperience, calculateFacultyRetentionForYear } from '../utils/sfrCalculator';
import './Students.css';

const RETENTION_SYNC_FIELDS = [
  'Faculty_Name',
  'Department',
  'Experience',
];

const normalizeRetentionRecord = (record) => ({
  Faculty_Name: (record.Faculty_Name || '').trim(),
  Department: (record.Department || 'Unknown').trim().toUpperCase(),
  Experience: String(record.Experience || '').trim(),
});

const getRetentionSyncKey = (record) => {
  const normalized = normalizeRetentionRecord(record);
  return `${normalized.Faculty_Name.toLowerCase()}|${normalized.Department}`;
};

const recordsEqual = (existing, incoming) => {
  const left = normalizeRetentionRecord(existing);
  const right = normalizeRetentionRecord(incoming);
  return RETENTION_SYNC_FIELDS.every((field) => left[field] === right[field]);
};

const commitWriteOperations = async (operations) => {
  const BATCH_SIZE = 500;
  for (let i = 0; i < operations.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    operations.slice(i, i + BATCH_SIZE).forEach((operation) => operation(batch));
    await batch.commit();
  }
};

const DEPARTMENTS = ['CSE', 'ISE', 'CYBERSECURITY', 'CS & DESIGN', 'CSDS', 'CSBS', 'AIML', 'IOT'];

const FacultyRetention = () => {
  const [retentionList, setRetentionList] = useState([]);
  const [studentList, setStudentList] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedDept, setSelectedDept] = useState('CSE');

  // Search & Filter state for records tab
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('All');
  
  // Syncing / Loading states
  const [isSyncing, setIsSyncing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  // Form State
  const [formData, setFormData] = useState({
    Faculty_Name: '',
    Department: 'CSE',
    Experience: ''
  });

  const fileInputRef = useRef(null);

  // Subscriptions to database
  useEffect(() => {
    // 1. Subscribe to faculty retention records
    const unsubscribeRetention = onSnapshot(collection(db, 'faculty_retention'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRetentionList(data);
    }, (error) => {
      console.error("Firestore Error (retention):", error);
    });

    // 2. Subscribe to student counts (for RF calculation)
    const unsubscribeStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data());
      setStudentList(data);
    }, (error) => {
      console.error("Firestore Error (students):", error);
    });

    return () => {
      unsubscribeRetention();
      unsubscribeStudents();
    };
  }, []);

  // Determine sorted academic years from student records
  const targetYears = useMemo(() => {
    const years = [...new Set(studentList.map(s => s.academicYear).filter(Boolean))];
    const getYearNum = (str) => {
      const match = String(str).match(/\d{4}/);
      return match ? parseInt(match[0], 10) : 0;
    };
    years.sort((a, b) => getYearNum(b) - getYearNum(a));
    return years.slice(0, 3).length > 0 ? years.slice(0, 3) : ['2025-2026', '2024-2025', '2023-2024'];
  }, [studentList]);

  // Helper: Sum student count for a department and academic year
  const getStudentCount = (dept, year) => {
    return studentList
      .filter(s => 
        (s.department || '').trim().toUpperCase() === dept.trim().toUpperCase() &&
        s.academicYear === year
      )
      .reduce((sum, s) => sum + (parseInt(s.noOfStudents) || 0) + (parseInt(s.noOfLateralEntry) || 0), 0);
  };

  // Compile calculations for all departments
  const departmentCalculations = useMemo(() => {
    const results = {};
    DEPARTMENTS.forEach(dept => {
      const deptFaculty = retentionList.filter(f => (f.Department || '').trim().toUpperCase() === dept.toUpperCase());
      const yearlyScores = targetYears.map((year, idx) => {
        const studentCount = getStudentCount(dept, year);
        const RF = studentCount > 0 ? studentCount / 20 : 0;
        
        // Year offset: CAY (index 0) = offset 0; CAYM1 (index 1) = offset 1; CAYM2 (index 2) = offset 2
        const calculation = calculateFacultyRetentionForYear(deptFaculty, idx, RF);
        return {
          year,
          label: idx === 0 ? 'CAY' : idx === 1 ? 'CAYM1' : `CAYM${idx}`,
          studentCount,
          ...calculation
        };
      });

      const validYears = yearlyScores.filter(y => y.RF > 0 || y.AF > 0);
      const averagePoints = validYears.length > 0
        ? parseFloat((validYears.reduce((sum, y) => sum + y.points, 0) / validYears.length).toFixed(2))
        : 0;

      results[dept] = {
        department: dept,
        yearlyScores,
        averagePoints
      };
    });
    return results;
  }, [retentionList, studentList, targetYears]);

  // Overall statistics
  const overallStats = useMemo(() => {
    let totalScoreSum = 0;
    let validDepts = 0;

    DEPARTMENTS.forEach(dept => {
      const score = departmentCalculations[dept]?.averagePoints || 0;
      totalScoreSum += score;
      validDepts++;
    });

    const averageFRScore = validDepts > 0 ? (totalScoreSum / validDepts).toFixed(2) : '0.00';

    // CAY brackets distribution (offset = 0)
    let bracketA = 0;
    let bracketB = 0;
    let bracketC = 0;
    let bracketD = 0;
    let bracketE = 0;

    retentionList.forEach(f => {
      const exp = parseExperience(f.Experience);
      if (exp < 0) return;
      if (exp < 1.0) bracketA++;
      else if (exp < 2.0) bracketB++;
      else if (exp < 3.0) bracketC++;
      else if (exp < 4.0) bracketD++;
      else bracketE++;
    });

    return {
      averageFRScore,
      totalFaculty: retentionList.length,
      brackets: { bracketA, bracketB, bracketC, bracketD, bracketE }
    };
  }, [departmentCalculations, retentionList]);

  // Handlers for manual records CRUD
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const openModal = (faculty = null) => {
    if (faculty) {
      setIsEditing(true);
      setCurrentId(faculty.id);
      setFormData({
        Faculty_Name: faculty.Faculty_Name || '',
        Department: faculty.Department || 'CSE',
        Experience: faculty.Experience || ''
      });
    } else {
      setIsEditing(false);
      setCurrentId(null);
      setFormData({
        Faculty_Name: '',
        Department: 'CSE',
        Experience: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const normalized = normalizeRetentionRecord(formData);
      if (isEditing) {
        await updateDoc(doc(db, 'faculty_retention', currentId), normalized);
      } else {
        await addDoc(collection(db, 'faculty_retention'), normalized);
      }
      closeModal();
    } catch (error) {
      console.error("Error saving retention record:", error);
      alert("Error saving retention record: " + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this faculty retention record?")) {
      try {
        await deleteDoc(doc(db, 'faculty_retention', id));
      } catch (error) {
        console.error("Error deleting retention record:", error);
      }
    }
  };

  const handleDeleteSelected = async () => {
    if (window.confirm(`Are you sure you want to delete the ${selectedIds.length} selected retention records?`)) {
      try {
        for (const id of selectedIds) {
          await deleteDoc(doc(db, 'faculty_retention', id));
        }
        setSelectedIds([]);
      } catch (error) {
        console.error("Error deleting selected records:", error);
        alert("Error deleting records: " + error.message);
      }
    }
  };

  // Google Sheet Synchronizer
  const parseCSV = (text) => {
    const lines = [];
    let row = [""];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];
      if (c === '"') {
        if (inQuotes && next === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        row.push("");
      } else if ((c === '\r' || c === '\n') && !inQuotes) {
        if (c === '\r' && next === '\n') {
          i++;
        }
        lines.push(row);
        row = [""];
      } else {
        row[row.length - 1] += c;
      }
    }
    if (row.length > 1 || row[0] !== "") {
      lines.push(row);
    }
    return lines;
  };

  const parseRetentionSheetRows = (rows) => {
    const sheetData = [];
    let currentDept = '';

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const sNo = row[0] ? row[0].trim() : '';
      const facultyName = row[1] ? row[1].trim() : '';
      const expStr = row[2] ? row[2].trim() : '';

      // Check if it's a department heading
      if (sNo && !facultyName && !expStr) {
        let deptVal = sNo.toUpperCase();
        if (deptVal === 'CSD') deptVal = 'CS & DESIGN';
        if (deptVal === 'CSCY') deptVal = 'CYBERSECURITY';
        if (deptVal === 'PGCC') deptVal = 'PG';
        currentDept = deptVal;
        continue;
      }

      if (facultyName && facultyName.toLowerCase() !== 'name of the faculty') {
        sheetData.push(normalizeRetentionRecord({
          Faculty_Name: facultyName,
          Department: currentDept || 'Unknown',
          Experience: expStr
        }));
      }
    }
    return sheetData;
  };

  const handleSyncData = async () => {
    if (!window.confirm("Sync faculty retention experience data from Google Sheet? Existing records will be updated or removed to match.")) {
      return;
    }

    setIsSyncing(true);
    try {
      const sheetUrl = "https://docs.google.com/spreadsheets/d/1E2VYOBneOPv7hBpnv2X1hCLkdbC67mhurx2tLQq9Ja0/export?format=csv&gid=1421546102";
      const response = await fetch(sheetUrl);
      if (!response.ok) throw new Error("Failed to fetch Google Sheet data.");
      const csvText = await response.text();

      const rows = parseCSV(csvText);
      if (rows.length < 2) {
        alert("The Google Sheet is empty or in an invalid format.");
        return;
      }

      const sheetData = parseRetentionSheetRows(rows);
      const sheetByKey = new Map();
      sheetData.forEach((record) => {
        sheetByKey.set(getRetentionSyncKey(record), record);
      });

      const existingSnap = await getDocs(collection(db, 'faculty_retention'));
      const existingByKey = new Map();
      existingSnap.docs.forEach((docSnap) => {
        const data = { id: docSnap.id, ...docSnap.data() };
        const key = getRetentionSyncKey(data);
        if (!existingByKey.has(key)) {
          existingByKey.set(key, data);
        }
      });

      const operations = [];
      let addedCount = 0;
      let updatedCount = 0;
      let deletedCount = 0;
      let unchangedCount = 0;

      sheetByKey.forEach((sheetRecord, key) => {
        const existing = existingByKey.get(key);
        if (!existing) {
          const newDocRef = doc(collection(db, 'faculty_retention'));
          operations.push((batch) => batch.set(newDocRef, sheetRecord));
          addedCount++;
          return;
        }

        if (recordsEqual(existing, sheetRecord)) {
          unchangedCount++;
          return;
        }

        operations.push((batch) => batch.update(doc(db, 'faculty_retention', existing.id), sheetRecord));
        updatedCount++;
      });

      existingByKey.forEach((existing, key) => {
        if (!sheetByKey.has(key)) {
          operations.push((batch) => batch.delete(doc(db, 'faculty_retention', existing.id)));
          deletedCount++;
        }
      });

      if (operations.length > 0) {
        await commitWriteOperations(operations);
      }

      alert(
        `Sync Complete!\nAdded: ${addedCount}\nUpdated: ${updatedCount}\nRemoved: ${deletedCount}\nUnchanged: ${unchangedCount}`
      );
    } catch (error) {
      console.error("Error syncing Google Sheet data:", error);
      alert("Error syncing Google Sheet data: " + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Bulk Excel import from Local files
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        let addedCount = 0;
        const batchOps = [];
        for (const row of data) {
          if (row.Faculty_Name || row['Name of the Faculty']) {
            const facultyName = row.Faculty_Name || row['Name of the Faculty'] || '';
            const dept = row.Department || row.department || 'CSE';
            const exp = row.Experience || row.experience || row['Experience in years in current institute'] || '0';
            
            const normalized = normalizeRetentionRecord({
              Faculty_Name: facultyName,
              Department: dept,
              Experience: exp
            });

            const newDocRef = doc(collection(db, 'faculty_retention'));
            batchOps.push((batch) => batch.set(newDocRef, normalized));
            addedCount++;
          }
        }
        if (batchOps.length > 0) {
          await commitWriteOperations(batchOps);
        }
        alert(`Successfully imported ${addedCount} faculty retention records.`);
      } catch (error) {
        console.error("Error parsing Excel file:", error);
        alert("Error parsing Excel. Make sure it contains columns Faculty_Name, Department, and Experience.");
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Data processing for the Manage Records list
  const processedRecords = useMemo(() => {
    let list = [...retentionList];

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(f =>
        (f.Faculty_Name || '').toLowerCase().includes(q) ||
        (f.Department || '').toLowerCase().includes(q) ||
        String(f.Experience).toLowerCase().includes(q)
      );
    }

    if (filterDepartment !== 'All') {
      list = list.filter(f => (f.Department || '').trim().toUpperCase() === filterDepartment.toUpperCase());
    }

    return list.sort((a, b) => (a.Faculty_Name || '').localeCompare(b.Faculty_Name || ''));
  }, [retentionList, searchTerm, filterDepartment]);

  const toggleSelectAll = () => {
    if (selectedIds.length === processedRecords.length && processedRecords.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(processedRecords.map(f => f.id));
    }
  };

  const toggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  return (
    <div className="page-view">
      <Header
        title={
          <div className="d-flex align-center">
            Faculty Retention (5.5)
            <span style={{
              fontSize: '0.75rem',
              verticalAlign: 'middle',
              marginLeft: '0.75rem',
              padding: '0.2rem 0.6rem',
              borderRadius: '999px',
              backgroundColor: 'rgba(37, 99, 235, 0.15)',
              color: 'var(--color-primary)',
              border: '1px solid rgba(37, 99, 235, 0.3)',
              fontWeight: '600'
            }}>
              10 Marks Max
            </span>
          </div>
        }
        subtitle="Formula: FR = (((A*0)+(B*1)+(C*2)+(D*3)+(E*4))/RF)*2.50 (Capped at 10.0)"
        actions={
          <div className="d-flex gap-2">
            <button 
              className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('dashboard')}
            >
              Dashboard
            </button>
            <button 
              className={`btn ${activeTab === 'calculator' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('calculator')}
            >
              Formula Calculator
            </button>
            <button 
              className={`btn ${activeTab === 'records' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('records')}
            >
              Manage Experience Records
            </button>
          </div>
        }
      />

      {/* DASHBOARD OVERVIEW TAB */}
      {activeTab === 'dashboard' && (
        <>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.1) 0%, rgba(37, 99, 235, 0.02) 100%)', borderLeft: '4px solid var(--color-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="input-label" style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>College Average FR Points</span>
                <Calculator size={24} style={{ color: 'var(--color-primary)' }} />
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0.5rem 0', color: 'var(--text-main)' }}>
                {overallStats.averageFRScore} / 10.0
              </div>
              <p className="subtitle" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Average score of all engineering departments</p>
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.02) 100%)', borderLeft: '4px solid var(--color-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="input-label" style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Active Faculty</span>
                <UserCheck size={24} style={{ color: 'var(--color-secondary)' }} />
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0.5rem 0', color: 'var(--text-main)' }}>
                {overallStats.totalFaculty}
              </div>
              <p className="subtitle" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>With experience details in current institute</p>
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.02) 100%)', borderLeft: '4px solid var(--color-warning)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="input-label" style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Retention Bracket E</span>
                <Info size={24} style={{ color: 'var(--color-warning)' }} />
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: '0.5rem 0', color: 'var(--text-main)' }}>
                {overallStats.brackets.bracketE}
              </div>
              <p className="subtitle" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Faculty members with &gt;= 4 years experience</p>
            </div>
          </div>

          {/* Visual Brackets Distribution */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)', fontSize: '1.1rem' }}>Faculty Experience Distribution (Current Academic Year)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                { label: 'A (< 1 year)', count: overallStats.brackets.bracketA, color: 'var(--color-danger)' },
                { label: 'B (1 - 2 years)', count: overallStats.brackets.bracketB, color: 'var(--color-warning)' },
                { label: 'C (2 - 3 years)', count: overallStats.brackets.bracketC, color: 'var(--color-info)' },
                { label: 'D (3 - 4 years)', count: overallStats.brackets.bracketD, color: 'var(--color-primary)' },
                { label: 'E (>= 4 years)', count: overallStats.brackets.bracketE, color: 'var(--color-secondary)' }
              ].map((bracket, index) => {
                const percentage = overallStats.totalFaculty > 0 ? (bracket.count / overallStats.totalFaculty) * 100 : 0;
                return (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ width: '140px', fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-muted)' }}>{bracket.label}</span>
                    <div style={{ flex: 1, height: '12px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${percentage}%`, height: '100%', backgroundColor: bracket.color, borderRadius: '999px', transition: 'width 0.5s ease-in-out' }} />
                    </div>
                    <span style={{ width: '50px', fontSize: '0.875rem', fontWeight: 'bold', textAlign: 'right', color: 'var(--text-main)' }}>{bracket.count}</span>
                    <span style={{ width: '50px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{percentage.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Department Marks Summary Table */}
          <div className="table-container glass-panel">
            <h3 style={{ padding: '0.5rem 0 0 0', color: 'var(--text-main)', fontSize: '1.1rem' }}>Department-wise Points Summary</h3>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Department</th>
                    {targetYears.map(year => (
                      <th key={year} style={{ textAlign: 'center' }}>{year} Score</th>
                    ))}
                    <th style={{ textAlign: 'right' }}>Average Score</th>
                  </tr>
                </thead>
                <tbody>
                  {DEPARTMENTS.map((dept) => {
                    const calc = departmentCalculations[dept];
                    return (
                      <tr 
                        key={dept} 
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          setSelectedDept(dept);
                          setActiveTab('calculator');
                        }}
                        title="Click to view detailed calculations"
                      >
                        <td><span className={`badge-dept badge-${(dept || 'cse').toLowerCase().replace(/\s+&/g, '')}`}>{dept}</span></td>
                        {calc?.yearlyScores.map((scoreObj, idx) => (
                          <td key={idx} style={{ textAlign: 'center' }} className="font-semibold">
                            {scoreObj.points.toFixed(2)}
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                              (RF: {scoreObj.RF.toFixed(1)} / AF: {scoreObj.AF})
                            </div>
                          </td>
                        ))}
                        <td style={{ textAlign: 'right' }} className="font-semibold text-primary">
                          <span style={{ color: 'var(--color-primary)', fontSize: '1.05rem' }}>{calc?.averagePoints.toFixed(2)}</span> / 10
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* DETAILED FORMULA CALCULATOR TAB */}
      {activeTab === 'calculator' && (
        <>
          {/* Department Selector */}
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="d-flex align-center gap-3">
              <label className="font-semibold" style={{ color: 'var(--text-main)' }}>Select Department for Review:</label>
              <select
                className="search-input"
                style={{ width: 'auto', padding: '0.5rem 2rem 0.5rem 1rem' }}
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
              >
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', gap: '1.5rem' }}>
              <div>Total Faculty: <strong>{retentionList.filter(f => (f.Department || '').trim().toUpperCase() === selectedDept.toUpperCase()).length}</strong></div>
              <div>Required Faculty (CAY): <strong>{(getStudentCount(selectedDept, targetYears[0]) / 20).toFixed(1)}</strong></div>
            </div>
          </div>

          {/* Detailed Year Cards (Math Explanations) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {departmentCalculations[selectedDept]?.yearlyScores.map((yearScore, idx) => {
              const { label, year, studentCount, RF, AF, A, B, C, D, E, points } = yearScore;
              return (
                <div key={idx} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>{label} ({year})</span>
                    <span className="font-semibold" style={{ fontSize: '1.2rem', color: 'var(--color-secondary)' }}>{points.toFixed(2)} Points</span>
                  </div>

                  {/* Variables Breakdown */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.9rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="text-muted">Student Count (S):</span>
                      <span className="font-semibold">{studentCount}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="text-muted">Required Faculty (RF = S/20):</span>
                      <span className="font-semibold">{RF.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="text-muted">Available Tracked (AF):</span>
                      <span className="font-semibold">{AF}</span>
                    </div>
                  </div>

                  {/* Offset brackets */}
                  <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.5rem', textAlign: 'center' }}>
                      Experience Distribution (Offset: -{idx} Yrs)
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>A (&lt;1)</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{A}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>B (1-2)</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{B}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>C (2-3)</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{C}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>D (3-4)</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{D}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>E (&gt;=4)</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{E}</div>
                      </div>
                    </div>
                  </div>

                  {/* Formula substitution */}
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 'auto' }}>
                    <div className="font-semibold" style={{ color: 'var(--text-main)', marginBottom: '0.2rem' }}>Formula Step-by-Step:</div>
                    <code style={{ display: 'block', padding: '0.5rem', backgroundColor: 'rgba(0, 0, 0, 0.1)', borderRadius: 'var(--radius-sm)', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                      Score = ((A*0 + B*1 + C*2 + D*3 + E*4) / RF) * 2.50<br />
                      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= (({A}*0 + {B}*1 + {C}*2 + {D}*3 + {E}*4) / {RF.toFixed(2) || '0.00'}) * 2.50<br />
                      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= ({B * 1 + C * 2 + D * 3 + E * 4} / {RF.toFixed(2) || '0.00'}) * 2.50<br />
                      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= {RF > 0 ? (((B * 1 + C * 2 + D * 3 + E * 4) / RF) * 2.50).toFixed(2) : '0.00'} (Capped at 10)
                    </code>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Department Faculty List */}
          <div className="table-container glass-panel">
            <h3 style={{ padding: '0.5rem 0 0 0', color: 'var(--text-main)', fontSize: '1.1rem' }}>Faculty Experience Details for {selectedDept}</h3>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Faculty Name</th>
                    <th>Current Experience (Years)</th>
                    <th>CAY ({targetYears[0]})</th>
                    <th>CAYM1 ({targetYears[1]})</th>
                    <th>CAYM2 ({targetYears[2]})</th>
                  </tr>
                </thead>
                <tbody>
                  {retentionList
                    .filter(f => (f.Department || '').trim().toUpperCase() === selectedDept.toUpperCase())
                    .sort((a, b) => (a.Faculty_Name || '').localeCompare(b.Faculty_Name || ''))
                    .map((fac, idx) => {
                      const exp = parseExperience(fac.Experience);
                      
                      const cayExp = exp;
                      const caym1Exp = exp - 1;
                      const caym2Exp = exp - 2;

                      const renderExpBracket = (val) => {
                        if (val < 0) return <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>- (Not Joined)</span>;
                        if (val < 1.0) return <span style={{ color: 'var(--color-danger)' }}>A ({val.toFixed(2)} Yrs)</span>;
                        if (val < 2.0) return <span style={{ color: 'var(--color-warning)' }}>B ({val.toFixed(2)} Yrs)</span>;
                        if (val < 3.0) return <span style={{ color: 'var(--color-info)' }}>C ({val.toFixed(2)} Yrs)</span>;
                        if (val < 4.0) return <span style={{ color: 'var(--color-primary)' }}>D ({val.toFixed(2)} Yrs)</span>;
                        return <span style={{ color: 'var(--color-secondary)', fontWeight: 'bold' }}>E ({val.toFixed(2)} Yrs)</span>;
                      };

                      return (
                        <tr key={idx}>
                          <td className="font-semibold">{fac.Faculty_Name}</td>
                          <td className="font-semibold" style={{ color: 'var(--color-primary)' }}>{fac.Experience}</td>
                          <td>{renderExpBracket(cayExp)}</td>
                          <td>{renderExpBracket(caym1Exp)}</td>
                          <td>{renderExpBracket(caym2Exp)}</td>
                        </tr>
                      );
                    })}
                  {retentionList.filter(f => (f.Department || '').trim().toUpperCase() === selectedDept.toUpperCase()).length === 0 && (
                    <tr>
                      <td colSpan="5" className="empty-state">No faculty experience records found for {selectedDept}. Go to 'Manage Experience Records' to add or sync them!</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* MANAGE EXPERIENCE RECORDS TAB */}
      {activeTab === 'records' && (
        <div className="table-container glass-panel">
          <div className="table-toolbar" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
            <div className="d-flex gap-2" style={{ flex: 1 }}>
              <div className="search-bar">
                <Search size={18} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search by faculty name or department..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
              <div className="search-bar" style={{ width: 'auto' }}>
                <Filter size={18} className="search-icon" style={{ left: '0.8rem' }} />
                <select
                  className="search-input"
                  style={{ width: 'auto', padding: '0.75rem 2rem 0.75rem 2.5rem' }}
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                >
                  <option value="All">All Departments</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>

            <div className="d-flex gap-2">
              {selectedIds.length > 0 && (
                <button className="btn" style={{ backgroundColor: 'var(--color-danger)', color: 'white' }} onClick={handleDeleteSelected}>
                  <Trash2 size={18} /> Delete Selected ({selectedIds.length})
                </button>
              )}
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                style={{ display: 'none' }}
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              <button className="btn btn-secondary" onClick={triggerFileInput}>
                <FileSpreadsheet size={18} /> Excel Bulk Import
              </button>
              <button className="btn btn-secondary" onClick={handleSyncData} disabled={isSyncing}>
                <RefreshCw size={18} className={isSyncing ? "spin-animation" : ""} /> {isSyncing ? "Syncing..." : "Sync Sheet"}
              </button>
              <button className="btn btn-primary" onClick={() => openModal()}>
                <Plus size={18} /> Add Record
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.length === processedRecords.length && processedRecords.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>Faculty Name</th>
                  <th>Department</th>
                  <th>Experience Value</th>
                  <th>Parsed Value (Years)</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {processedRecords.length > 0 ? (
                  processedRecords.map((fac) => (
                    <tr key={fac.id} className={selectedIds.includes(fac.id) ? 'selected-row' : ''}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(fac.id)}
                          onChange={() => toggleSelect(fac.id)}
                        />
                      </td>
                      <td className="font-semibold">{fac.Faculty_Name}</td>
                      <td>
                        <span className={`badge-dept badge-${(fac.Department || 'cse').toLowerCase().replace(/\s+&/g, '')}`}>
                          {fac.Department}
                        </span>
                      </td>
                      <td className="font-semibold" style={{ color: 'var(--color-primary)' }}>{fac.Experience}</td>
                      <td>{parseExperience(fac.Experience).toFixed(2)} Yrs</td>
                      <td className="actions-cell">
                        <button className="icon-btn edit-btn" onClick={() => openModal(fac)} title="Edit"><Edit2 size={16} /></button>
                        <button className="icon-btn delete-btn" onClick={() => handleDelete(fac.id)} title="Delete"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="empty-state">No experience records found. Sync from Google Sheet or add them manually.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* OVERLAY ADD / EDIT MODAL */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>{isEditing ? 'Edit Experience Record' : 'Add Experience Record'}</h2>
              <button className="icon-btn" onClick={closeModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="input-group">
                <label className="input-label">Faculty Name</label>
                <input required type="text" name="Faculty_Name" className="input-field" value={formData.Faculty_Name} onChange={handleInputChange} />
              </div>
              <div className="input-group">
                <label className="input-label">Department</label>
                <select name="Department" className="input-field" value={formData.Department} onChange={handleInputChange}>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Experience</label>
                <input required type="text" name="Experience" placeholder="e.g. 1.1 (1yr 1mo) or 10M (10mo) or 4 (4yrs)" className="input-field" value={formData.Experience} onChange={handleInputChange} />
              </div>

              <div className="modal-footer d-flex justify-between" style={{ marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">{isEditing ? 'Update' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacultyRetention;

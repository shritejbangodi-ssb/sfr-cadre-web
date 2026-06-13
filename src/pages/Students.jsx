import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, X, RefreshCw } from 'lucide-react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import Header from '../components/Header';
import './Students.css';

const Students = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [students, setStudents] = useState([]);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [formData, setFormData] = useState({
    noOfStudents: '',
    noOfLateralEntry: '',
    department: 'CSE',
    academicYear: '2025-2026',
    year: '2nd',
    program: 'B.Tech'
  });

  // Google Sheets UI state
  const [selectedCell, setSelectedCell] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // New Google Sheet Data State
  const [sheetData, setSheetData] = useState([]);
  const [sheetHeaders, setSheetHeaders] = useState([]);
  const [sheetTotal, setSheetTotal] = useState([]);

  // Fetch from Firebase and Google Sheet
  useEffect(() => {
    const fetchSheetData = async () => {
      try {
        const url = "https://docs.google.com/spreadsheets/d/1wAo9LA1LIc_SSwSMhNrB2DYWjBtoanmKqFhTbqPehPA/export?format=csv&gid=1323997071";
        const response = await fetch(url);
        const text = await response.text();
        const lines = text.trim().split('\n').map(line => line.split(','));
        
        if (lines.length > 1) {
          setSheetHeaders(lines[0]);
          
          const dataRows = [];
          for (let i = 1; i < lines.length; i++) {
             if (lines[i][0] && lines[i][0].toLowerCase().includes('total students')) {
               setSheetTotal(lines[i]);
               break; 
             }
             if (lines[i][0] && (lines[i][0].startsWith('DS=') || lines[i][0].startsWith('AS='))) {
                continue;
             }
             if (lines[i][0] && lines[i][0].trim() !== '') {
               dataRows.push(lines[i]);
             }
          }
          setSheetData(dataRows);
        }
      } catch (err) {
        console.error("Error fetching Google Sheet:", err);
      }
    };

    fetchSheetData();

    const unsubscribe = onSnapshot(collection(db, 'students'), (snapshot) => {
      const studentData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setStudents(studentData);
    }, (error) => {
      console.error("Firestore Error:", error);
      alert("Database Error: Please check your Firebase Security Rules.");
    });

    return () => unsubscribe();
  }, []);

  // Global click handler to deselect
  useEffect(() => {
    const handleGlobalClick = (e) => {
      // If click is outside any editable cell, deselect
      if (!e.target.closest('.google-sheet-cell') && !editingCell) {
        setSelectedCell(null);
      }
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [editingCell]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const openModal = (student = null) => {
    if (student) {
      setIsEditing(true);
      setCurrentId(student.id);
      setFormData({
        noOfStudents: student.noOfStudents || student.name || '',
        noOfLateralEntry: student.noOfLateralEntry || '',
        department: student.department || 'CSE',
        academicYear: student.academicYear || '2025-2026',
        year: student.year || student.semester || '2nd',
        program: student.program || 'B.Tech'
      });
    } else {
      setIsEditing(false);
      setCurrentId(null);
      setFormData({ noOfStudents: '', noOfLateralEntry: '', department: 'CSE', academicYear: '2025-2026', year: '2nd', program: 'B.Tech' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Cap lateral entry to 10% of total students
    const baseStudents = parseInt(formData.noOfStudents) || 0;
    let lateralEntry = parseInt(formData.noOfLateralEntry) || 0;
    
    const maxLateral = Math.floor(baseStudents * 0.10);
    if (lateralEntry > maxLateral) {
      lateralEntry = maxLateral;
    }

    const finalData = {
      ...formData,
      noOfStudents: baseStudents.toString(),
      noOfLateralEntry: lateralEntry.toString()
    };

    try {
      if (isEditing) {
        await updateDoc(doc(db, 'students', currentId), finalData);
      } else {
        await addDoc(collection(db, 'students'), finalData);
      }
      closeModal();
    } catch (error) {
      console.error("Error saving student:", error);
      alert("Failed to save student: " + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this student?")) {
      try {
        await deleteDoc(doc(db, 'students', id));
      } catch (error) {
        console.error("Error deleting student:", error);
      }
    }
  };

  const handleSyncFromSheet = async () => {
    if (!window.confirm("This will replace all current student data with the data from your Google Sheet. Are you sure?")) return;
    
    setIsSyncing(true);
    try {
      const response = await fetch('https://docs.google.com/spreadsheets/d/1wAo9LA1LIc_SSwSMhNrB2DYWjBtoanmKqFhTbqPehPA/gviz/tq?tqx=out:csv');
      if (!response.ok) throw new Error("Failed to fetch Google Sheet");
      const csvText = await response.text();
      
      const lines = csvText.trim().split('\n').map(line => 
        line.split(',').map(field => field.replace(/^"|"$/g, ''))
      );
      
      if (lines.length < 3) throw new Error("Invalid sheet format");
      
      const headers = lines[0];
      const years = [
        headers[2].match(/\d{4}-\d{4}/)?.[0] || '2025-2026',
        headers[4].match(/\d{4}-\d{4}/)?.[0] || '2024-2025',
        headers[6].match(/\d{4}-\d{4}/)?.[0] || '2023-2024'
      ];

      // Delete old records
      const snapshot = await getDocs(collection(db, 'students'));
      await Promise.all(snapshot.docs.map(d => deleteDoc(d.ref)));

      // Add new records
      const promises = [];
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i];
        if (row.length < 8 || !row[0]) continue;
        
        let dept = row[0].toUpperCase();
        if (dept === 'CS & DESIGN') dept = 'CS & DESIGN';
        
        const studyYear = row[1];
        const cleanStudyYear = studyYear.replace(/ Year/i, '').trim();
        
        for (let j = 0; j < 3; j++) {
          const sanctionIntake = row[2 + j*2];
          const lateralEntry = row[2 + j*2 + 1];
          
          if (!sanctionIntake || sanctionIntake === '0' || sanctionIntake === '-') continue;
          
          promises.push(addDoc(collection(db, 'students'), {
            department: dept,
            academicYear: years[j],
            year: cleanStudyYear,
            noOfStudents: sanctionIntake,
            noOfLateralEntry: lateralEntry || '0',
            program: dept === 'PG' ? 'M.Tech' : 'B.Tech'
          }));
        }
      }
      
      await Promise.all(promises);
      alert("Successfully synced with Google Sheet!");
    } catch (error) {
      console.error("Sync error:", error);
      alert("Failed to sync: " + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCellBlurOrEnter = async (e) => {
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== 'Escape') {
      return;
    }
    
    if (e.key === 'Escape') {
      setEditingCell(null);
      return;
    }

    const currentEditing = editingCell;
    setEditingCell(null);

    if (!currentEditing) return;

    const { type, value, originalValue } = currentEditing;
    const processedValue = value.trim();

    if (processedValue === String(originalValue || '').trim()) {
       return;
    }

    try {
      if (type === 'data') {
        const { recordId, field } = currentEditing;
        const record = students.find(s => s.id === recordId);
        if (!record) return;

        let updates = { [field]: processedValue };

        if (field === 'studentCount') {
           updates = {
             noOfStudents: (parseInt(processedValue, 10) || 0).toString(),
             noOfLateralEntry: '0'
           };
        } else if (field === 'noOfLateralEntry') {
           const baseStudents = parseInt(record.noOfStudents, 10) || 0;
           let lateralEntry = parseInt(processedValue, 10) || 0;
           const maxLateral = Math.floor(baseStudents * 0.10);
           if (lateralEntry > maxLateral) {
             lateralEntry = maxLateral;
             alert(`Lateral entry capped at 10% of Sanction Intake (${maxLateral})`);
           }
           updates.noOfLateralEntry = lateralEntry.toString();
        } else if (field === 'noOfStudents') {
           const baseStudents = parseInt(processedValue, 10) || 0;
           let lateralEntry = parseInt(record.noOfLateralEntry, 10) || 0;
           const maxLateral = Math.floor(baseStudents * 0.10);
           if (lateralEntry > maxLateral) {
             updates.noOfLateralEntry = maxLateral.toString();
             alert(`Lateral entry automatically adjusted to new 10% limit (${maxLateral})`);
           }
           updates.noOfStudents = baseStudents.toString();
        }

        await updateDoc(doc(db, 'students', recordId), updates);
      } else if (type === 'newData') {
        const { dept, acYear, studyYear, field } = currentEditing;
        if (processedValue !== '') {
          let noOfStudentsStr = (field === 'noOfStudents' || field === 'studentCount') ? processedValue : '0';
          let noOfLateralEntryStr = field === 'noOfLateralEntry' ? processedValue : '0';
          
          const baseStudents = parseInt(noOfStudentsStr, 10) || 0;
          let lateralEntry = parseInt(noOfLateralEntryStr, 10) || 0;
          const maxLateral = Math.floor(baseStudents * 0.10);
          
          if (lateralEntry > maxLateral) {
             lateralEntry = maxLateral;
             if (field === 'noOfLateralEntry') {
               alert(`Lateral entry capped at 10% of Sanction Intake (${maxLateral}). Please set Sanction Intake first.`);
             }
          }

          const newData = {
            department: dept,
            academicYear: acYear,
            year: studyYear,
            noOfStudents: baseStudents.toString(),
            noOfLateralEntry: lateralEntry.toString(),
            program: 'B.Tech'
          };
          await addDoc(collection(db, 'students'), newData);
        }
      } else if (type === 'header') {
        const { dept, oldYear } = currentEditing;
        if (processedValue !== '') {
          const recordsToUpdate = students.filter(s => 
            (s.department || 'UNKNOWN') === dept && 
            s.academicYear === oldYear
          );
          for (const record of recordsToUpdate) {
            await updateDoc(doc(db, 'students', record.id), { academicYear: processedValue });
          }
        }
      }
    } catch (err) {
      console.error("Error updating cell:", err);
      alert("Failed to update: " + err.message);
    }
  };

  const renderEditableCell = (cellId, type, params, currentValue, displayValue, extraContent = null) => {
    const isSelected = selectedCell === cellId;
    const isEditing = editingCell && editingCell.id === cellId;
    
    let content;
    if (isEditing) {
      content = (
        <input 
          autoFocus
          type="text"
          value={editingCell.value}
          onChange={(e) => setEditingCell(prev => ({ ...prev, value: e.target.value }))}
          onBlur={handleCellBlurOrEnter}
          onKeyDown={handleCellBlurOrEnter}
          style={{ 
            width: '100%', height: '100%', boxSizing: 'border-box', 
            textAlign: 'center', background: 'var(--bg-surface)', 
            color: 'var(--text-main)', border: 'none', outline: 'none',
            fontFamily: 'inherit', fontSize: 'inherit', padding: '0',
            fontWeight: 'inherit'
          }}
        />
      );
    } else {
      content = (
        <div 
          style={{ width: '100%', height: '100%', minHeight: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
        >
          {displayValue}
          {extraContent}
        </div>
      );
    }

    return (
      <div 
        className={`google-sheet-cell ${isSelected ? 'selected' : ''}`}
        onClick={() => {
           if (!isEditing) setSelectedCell(cellId);
        }}
        onDoubleClick={() => {
           setEditingCell({ id: cellId, type, ...params, originalValue: currentValue, value: currentValue || '' });
        }}
        onFocus={() => {
           if (!isEditing) setSelectedCell(cellId);
        }}
        style={{ 
            width: '100%', height: '100%', cursor: 'cell', position: 'relative',
            boxShadow: isSelected && !isEditing ? 'inset 0 0 0 2px #1a73e8' : 'none',
            outline: 'none',
            padding: '4px',
            boxSizing: 'border-box'
        }}
        tabIndex={0}
        onKeyDown={(e) => {
          if (isSelected && !isEditing) {
            if (e.key === 'Enter') {
              e.preventDefault();
              setEditingCell({ id: cellId, type, ...params, originalValue: currentValue, value: currentValue || '' });
            } else if (e.key === 'Backspace' || e.key === 'Delete') {
              e.preventDefault();
              setEditingCell({ id: cellId, type, ...params, originalValue: currentValue, value: '' });
            } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
              e.preventDefault();
              setEditingCell({ id: cellId, type, ...params, originalValue: currentValue, value: e.key });
            }
          }
        }}
      >
        {content}
      </div>
    );
  };

  const filteredStudents = students.filter(student => 
    (student.department || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (student.academicYear || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (student.year || student.semester || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getYearNumber = (str) => {
    const match = String(str).match(/\d{4}/);
    return match ? parseInt(match[0], 10) : 0;
  };
  
  const allAcademicYears = [...new Set(filteredStudents.map(s => s.academicYear))].sort((a, b) => getYearNumber(b) - getYearNumber(a));
  const departments = [...new Set(filteredStudents.map(s => s.department || 'UNKNOWN'))].sort();

  const getStudentData = (dept, acYear, studyYear) => {
    const matches = filteredStudents.filter(s => 
      (s.department || 'UNKNOWN') === dept && 
      s.academicYear === acYear && 
      (s.year || s.semester) === studyYear
    );
    if (matches.length === 0) return null;
    
    const totalStudents = matches.reduce((sum, s) => sum + (parseInt(s.noOfStudents) || 0), 0);
    const totalLateral = matches.reduce((sum, s) => sum + (parseInt(s.noOfLateralEntry) || 0), 0);
    
    return {
      id: matches[0].id,
      noOfStudents: totalStudents,
      noOfLateralEntry: totalLateral,
      originalRecord: matches[0]
    };
  };

  return (
    <div className="page-view">
      <Header 
        title="Students Management" 
        subtitle="View and manage enrolled students" 
        actions={
          <div className="d-flex gap-3">
            <button className="btn btn-secondary" onClick={handleSyncFromSheet} disabled={isSyncing} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <RefreshCw size={18} className={isSyncing ? "spin-animation" : ""} /> {isSyncing ? 'Syncing...' : 'Sync from Google Sheet'}
            </button>
            <button className="btn btn-primary" onClick={() => openModal()}>
              <Plus size={18} /> Add No of Students
            </button>
          </div>
        }
      />

      <div className="table-container glass-panel" style={{ marginBottom: '2rem' }}>
        <h3 style={{ padding: '1rem 1rem 0 1rem', color: 'var(--text-main)' }}>Student Counts (From Google Sheet)</h3>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                {sheetHeaders.map((header, idx) => (
                  <th key={idx}>{header || 'Department'}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheetData.length > 0 ? (
                <>
                  {sheetData.map((row, rowIdx) => (
                    <tr key={rowIdx}>
                      {row.map((cell, cellIdx) => {
                        let displayCell = cell;
                        if (cellIdx === 0 && cell) {
                          const deptParts = cell.split('-');
                          const rawDeptName = deptParts.length > 1 ? deptParts[1] : cell;
                          displayCell = <span className={`badge-dept badge-${rawDeptName.toLowerCase()}`}>{cell}</span>;
                        }
                        return (
                          <td key={cellIdx} className={cellIdx > 0 ? "font-semibold" : ""}>
                            {displayCell}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {sheetTotal && sheetTotal.length > 0 && (
                    <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', fontWeight: 'bold' }}>
                      {sheetTotal.map((cell, cellIdx) => (
                        <td key={cellIdx} className="font-semibold" style={{ color: cellIdx > 0 ? 'var(--color-primary)' : 'inherit' }}>
                          {cellIdx === 0 ? 'Total' : cell}
                        </td>
                      ))}
                    </tr>
                  )}
                </>
              ) : (
                <tr>
                  <td colSpan={sheetHeaders.length || 6} className="empty-state">Loading sheet data...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="table-container glass-panel">
        <div className="table-toolbar" style={{ marginBottom: '1.5rem' }}>
          <div className="search-bar">
            <Search size={18} className="search-icon text-muted" />
            <input 
              type="text" 
              placeholder="Search by department or year..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        <div className="table-responsive">
          {departments.length === 0 ? (
            <div className="empty-state">No student records found. Add some!</div>
          ) : (
            departments.map(dept => (
              <div key={dept} style={{ marginBottom: '3rem', overflowX: 'auto' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)', textAlign: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', fontWeight: '600' }}>
                  {dept}
                </h3>
                <table className="data-table" style={{ border: '1px solid var(--border-color)', width: '100%', borderCollapse: 'collapse', userSelect: 'none' }}>
                  <thead>
                    <tr>
                      <th rowSpan="2" style={{ border: '1px solid var(--border-color)', textAlign: 'center', verticalAlign: 'middle', backgroundColor: 'rgba(255,255,255,0.02)' }}>Year of Study</th>
                      <th colSpan={allAcademicYears.length} style={{ border: '1px solid var(--border-color)', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.02)', padding: '12px', fontSize: '1rem', textTransform: 'uppercase' }}>
                        STUDENTS COUNT ACADEMIC YEAR
                      </th>
                    </tr>
                    <tr>
                      {allAcademicYears.map((rawYear, idx) => {
                         const cleanY = rawYear ? rawYear.replace(/^CAYm?\d?\s*\/?\s*\(?/gi, '').replace(/\)$/, '').trim() : '';
                         const label = idx === 0 ? 'CAY' : (idx === 1 ? 'CAYm1' : `CAYm${idx}`);
                         return (
                            <th key={rawYear} style={{ border: '1px solid var(--border-color)', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.02)', padding: 0 }}>
                              {renderEditableCell(`header-${dept}-${rawYear}`, 'header', { dept, oldYear: rawYear }, cleanY, (
                                <div style={{ fontWeight: 'bold', lineHeight: '1.4', padding: '8px 0' }}>
                                  <div style={{ color: 'var(--text-main)', marginBottom: '2px', fontSize: '0.85rem' }}>{label}</div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 'normal' }}>({cleanY})</div>
                                </div>
                              ))}
                            </th>
                         )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                     {(dept === 'PG' ? ['1st', '2nd'] : ['2nd', '3rd', '4th']).map(studyYear => (
                       <tr key={studyYear}>
                         <td style={{ border: '1px solid var(--border-color)', fontWeight: 'bold', textAlign: 'center' }}>{studyYear} Year</td>
                         {allAcademicYears.map(year => {
                           const data = getStudentData(dept, year, studyYear);
                           return (
                             <td key={year + studyYear} style={{ border: '1px solid var(--border-color)', textAlign: 'center', padding: '0' }}>
                               {data ? (
                                 renderEditableCell(`data-${data.id}-studentCount`, 'data', { recordId: data.id, field: 'studentCount' }, data.noOfStudents + data.noOfLateralEntry, data.noOfStudents + data.noOfLateralEntry)
                               ) : (
                                 renderEditableCell(`newdata-${dept}-${year}-${studyYear}-studentCount`, 'newData', { dept, acYear: year, studyYear, field: 'studentCount' }, '', '-')
                               )}
                             </td>
                           );
                         })}
                       </tr>
                    ))}
                    <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', fontWeight: 'bold' }}>
                      <td style={{ border: '1px solid var(--border-color)', textAlign: 'center' }}>Sub-Total</td>
                      {allAcademicYears.map(year => {
                        const yearsArray = dept === 'PG' ? ['1st', '2nd'] : ['2nd', '3rd', '4th'];
                        const totalS = yearsArray.reduce((sum, y) => sum + (getStudentData(dept, year, y)?.noOfStudents || 0), 0);
                        const totalL = yearsArray.reduce((sum, y) => sum + (getStudentData(dept, year, y)?.noOfLateralEntry || 0), 0);
                        return (
                          <td key={year + 'subtotal'} style={{ border: '1px solid var(--border-color)', textAlign: 'center' }}>
                            {(totalS + totalL) || '-'}
                          </td>
                        );
                      })}
                    </tr>
                    <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', fontWeight: 'bold' }}>
                      <td style={{ border: '1px solid var(--border-color)', textAlign: 'center' }}>Total</td>
                      {allAcademicYears.map(year => {
                        const yearsArray = dept === 'PG' ? ['1st', '2nd'] : ['2nd', '3rd', '4th'];
                        const totalS = yearsArray.reduce((sum, y) => sum + (getStudentData(dept, year, y)?.noOfStudents || 0), 0);
                        const totalL = yearsArray.reduce((sum, y) => sum + (getStudentData(dept, year, y)?.noOfLateralEntry || 0), 0);
                        return (
                          <td key={year + 'total'} style={{ border: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--color-primary)' }}>
                            {(totalS + totalL) || '-'}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h2>{isEditing ? 'Edit Students' : 'Add No of Students'}</h2>
              <button className="icon-btn" onClick={closeModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="d-flex gap-4">
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">No of Students</label>
                  <input required type="number" min="1" name="noOfStudents" className="input-field" value={formData.noOfStudents} onChange={handleInputChange} />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">No of Lateral Entry</label>
                  <input type="number" min="0" name="noOfLateralEntry" className="input-field" value={formData.noOfLateralEntry} onChange={handleInputChange} placeholder="0" />
                </div>
              </div>
              <div className="d-flex gap-4">
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Department</label>
                  <select name="department" className="input-field" value={formData.department} onChange={handleInputChange}>
                    <option value="CSE">CSE</option>
                    <option value="ISE">ISE</option>
                    <option value="CYBERSECURITY">CYBERSECURITY</option>
                    <option value="CS & DESIGN">CS & DESIGN</option>
                    <option value="CSDS">CSDS</option>
                    <option value="CSBS">CSBS</option>
                    <option value="AIML">AIML</option>
                    <option value="PG">PG</option>
                  </select>
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Academic Year</label>
                  <input required type="text" name="academicYear" placeholder="e.g. 2025-2026" className="input-field" value={formData.academicYear} onChange={handleInputChange} />
                </div>
              </div>
              <div className="d-flex gap-4">
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Year</label>
                  <select name="year" className="input-field" value={formData.year} onChange={handleInputChange}>
                    {['1st', '2nd', '3rd', '4th'].map(yr => <option key={yr} value={yr}>{yr}</option>)}
                  </select>
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Program</label>
                  <input required type="text" name="program" className="input-field" value={formData.program} onChange={handleInputChange} />
                </div>
              </div>
              <div className="modal-footer d-flex justify-between" style={{ marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">{isEditing ? 'Update' : 'Save'} Student</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Students;

import React, { useState, useEffect } from 'react';
import { Search, Upload, Save, CheckCircle2 } from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import './Students.css';

const Marks = () => {
  const [selectedCourse, setSelectedCourse] = useState('CS301');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [students, setStudents] = useState([]);
  const [marksData, setMarksData] = useState({}); // Mapping studentId -> marks
  const [courses, setCourses] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch Students & Courses
  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      setStudents(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubCourses = onSnapshot(collection(db, 'courses'), (snapshot) => {
      setCourses(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      if(snapshot.docs.length > 0) {
        setSelectedCourse(snapshot.docs[0].data().courseCode);
      }
    });

    return () => {
      unsubStudents();
      unsubCourses();
    };
  }, []);

  // Fetch Marks for Selected Course
  useEffect(() => {
    if (!selectedCourse) return;
    const fetchMarks = async () => {
      const marksSnapshot = await getDocs(collection(db, 'marks'));
      const courseMarksMap = {};
      marksSnapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.courseCode === selectedCourse) {
          courseMarksMap[data.studentId] = data;
        }
      });
      setMarksData(courseMarksMap);
    };
    fetchMarks();
  }, [selectedCourse]);

  const handleMarkChange = (studentId, field, value) => {
    let numValue = value === '' ? '' : Number(value);
    
    if (numValue !== '') {
      // Enforce absolute maximums
      if (field === 'internal' && numValue > 30) numValue = 30;
      if (field === 'assignment' && numValue > 20) numValue = 20;
      if (field === 'lab' && numValue > 25) numValue = 25;
      if (field === 'final' && numValue > 100) numValue = 100;
      
      // Prevent negative marks
      if (numValue < 0) numValue = 0;
    }

    setMarksData(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: numValue
      }
    }));
    setSaveSuccess(false);
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const promises = Object.entries(marksData).map(([studentId, marks]) => {
        const docId = `${studentId}_${selectedCourse}`;
        return setDoc(doc(db, 'marks', docId), {
          studentId,
          courseCode: selectedCourse,
          internal: Number(marks.internal) || 0,
          assignment: Number(marks.assignment) || 0,
          lab: Number(marks.lab) || 0,
          final: Number(marks.final) || 0,
          updatedAt: new Date()
        });
      });
      await Promise.all(promises);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving marks: ", error);
      alert("Failed to save marks to database.");
    } finally {
      setIsSaving(false);
    }
  };

  const calculateTotal = (studentId) => {
    const m = marksData[studentId] || { internal:0, assignment:0, lab:0, final:0 };
    return (Number(m.internal) || 0) + (Number(m.assignment) || 0) + (Number(m.lab) || 0) + ((Number(m.final) || 0) * 0.5); 
  };

  const isPassed = (studentId) => {
    return calculateTotal(studentId) >= 40 ? 'Pass' : 'Fail';
  };

  return (
    <div className="page-view">
      <div className="page-header d-flex justify-between align-center">
        <div>
          <h1>Marks Upload System</h1>
          <p className="subtitle">Enter or upload student marks for your assigned courses</p>
        </div>
        <div className="d-flex gap-2 align-center">
          {saveSuccess && <span className="text-success d-flex align-center gap-1 font-semibold" style={{marginRight: '1rem'}}><CheckCircle2 size={18}/> Saved securely!</span>}
          <button className="btn btn-primary" onClick={handleSaveAll} disabled={isSaving}>
            <Save size={18} /> {isSaving ? 'Saving...' : 'Save All Marks'}
          </button>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
        <div className="d-flex gap-4">
          <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="input-label">Select Course</label>
            <select 
              className="input-field" 
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
            >
              {courses.map(c => (
                <option key={c.id} value={c.courseCode}>{c.courseCode} - {c.name}</option>
              ))}
            </select>
          </div>
          <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="input-label">Search Student</label>
            <div className="search-bar" style={{ maxWidth: '100%' }}>
              <Search size={18} className="search-icon text-muted" />
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="table-container glass-panel">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student ID</th>
                <th>Name</th>
                <th style={{width: '120px'}}>Internal (30)</th>
                <th style={{width: '120px'}}>Assignment (20)</th>
                <th style={{width: '120px'}}>Lab (25)</th>
                <th style={{width: '120px'}}>Final (100)</th>
                <th>Total (100)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {students.filter(s => (s.name || '').toLowerCase().includes(searchTerm.toLowerCase())).map((student) => {
                const m = marksData[student.studentId] || { internal:'', assignment:'', lab:'', final:'' };
                return (
                  <tr key={student.id}>
                    <td><span className="badge-id">{student.studentId}</span></td>
                    <td className="font-semibold">{student.name}</td>
                    <td>
                      <input type="number" className="input-field" style={{padding: '0.4rem', marginBottom: 0}} max="30" value={m.internal} onChange={(e) => handleMarkChange(student.studentId, 'internal', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" className="input-field" style={{padding: '0.4rem', marginBottom: 0}} max="20" value={m.assignment} onChange={(e) => handleMarkChange(student.studentId, 'assignment', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" className="input-field" style={{padding: '0.4rem', marginBottom: 0}} max="25" value={m.lab} onChange={(e) => handleMarkChange(student.studentId, 'lab', e.target.value)} />
                    </td>
                    <td>
                      <input type="number" className="input-field" style={{padding: '0.4rem', marginBottom: 0}} max="100" value={m.final} onChange={(e) => handleMarkChange(student.studentId, 'final', e.target.value)} />
                    </td>
                    <td className="font-semibold">{calculateTotal(student.studentId)}</td>
                    <td>
                      <span style={{ 
                        color: isPassed(student.studentId) === 'Pass' ? 'var(--color-success)' : 'var(--color-danger)',
                        fontWeight: 600,
                        backgroundColor: isPassed(student.studentId) === 'Pass' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        padding: '4px 8px',
                        borderRadius: '4px'
                      }}>
                        {isPassed(student.studentId)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Marks;

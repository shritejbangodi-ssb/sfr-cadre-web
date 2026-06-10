import React, { useState, useEffect } from 'react';
import { Search, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import Header from '../components/Header';
import './Students.css';

const Faculty = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [facultyList, setFacultyList] = useState([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'faculty_members'), (snapshot) => {
      const facultyMembers = snapshot.docs.map(doc => doc.data());
      
      const depts = {};
      
      facultyMembers.forEach(f => {
        const dept = f.Department ? f.Department.toUpperCase() : 'UNKNOWN';
        if (!depts[dept]) depts[dept] = { department: dept, profs: 0, assocProfs: 0, asstProfs: 0 };
        
        const designation = (f.Designation || '').toLowerCase();
        if (designation.includes('assistant')) {
          depts[dept].asstProfs++;
        } else if (designation.includes('associate')) {
          depts[dept].assocProfs++;
        } else if (designation.includes('professor') || designation.includes('prof')) {
          depts[dept].profs++;
        }
      });

      const data = Object.values(depts);
      data.sort((a, b) => a.department.localeCompare(b.department));
      setFacultyList(data);
    }, (error) => {
      console.error("Firestore Error:", error);
    });
    return () => unsubscribe();
  }, []);

  const filteredFaculty = facultyList.filter(f => 
    (f.department || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="page-view">
      <Header 
        title="Faculty Aggregation" 
        subtitle="Automatically calculated from individual records" 
        actions={
          <button className="btn btn-primary" onClick={() => navigate('/faculty-details')}>
            <Users size={18} /> Manage Faculty Details
          </button>
        }
      />

      <div className="table-container glass-panel">
        <div className="table-toolbar">
          <div className="search-bar">
            <Search size={18} className="search-icon text-muted" />
            <input 
              type="text" 
              placeholder="Search by department..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Professors</th>
                <th>Associate Profs</th>
                <th>Assistant Profs</th>
                <th>Total Profs</th>
              </tr>
            </thead>
            <tbody>
              {filteredFaculty.length > 0 ? (
                filteredFaculty.map((faculty, idx) => (
                  <tr 
                    key={idx} 
                    onDoubleClick={() => navigate(`/faculty-details?dept=${encodeURIComponent(faculty.department)}`)}
                    style={{ cursor: 'pointer' }}
                    title={`Double click to view ${faculty.department} faculty`}
                  >
                    <td><span className={`badge-dept badge-${(faculty.department || 'cse').toLowerCase()}`}>{faculty.department || 'N/A'}</span></td>
                    <td className="font-semibold">{faculty.profs}</td>
                    <td className="font-semibold">{faculty.assocProfs}</td>
                    <td className="font-semibold">{faculty.asstProfs}</td>
                    <td className="font-semibold" style={{ color: 'var(--color-primary)' }}>
                      {faculty.profs + faculty.assocProfs + faculty.asstProfs}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="empty-state">No faculty members found. Add individuals in Faculty Details.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Faculty;

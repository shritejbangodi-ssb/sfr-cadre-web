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
  const [sheetData, setSheetData] = useState([]);
  const [sheetHeaders, setSheetHeaders] = useState([]);
  const [sheetTotal, setSheetTotal] = useState([]);

  useEffect(() => {
    const fetchSheetData = async () => {
      try {
        const url = "https://docs.google.com/spreadsheets/d/1E2VYOBneOPv7hBpnv2X1hCLkdbC67mhurx2tLQq9Ja0/export?format=csv&gid=7131963";
        const response = await fetch(url);
        const text = await response.text();
        const lines = text.trim().split('\n').map(line => line.split(','));

        if (lines.length > 1) {
          // Exclude the first column which is empty or SNo
          setSheetHeaders(lines[0].slice(1));

          const dataRows = [];
          for (let i = 1; i < lines.length - 1; i++) {
            dataRows.push(lines[i].slice(1));
          }
          setSheetData(dataRows);
          setSheetTotal(lines[lines.length - 1].slice(1));
        }
      } catch (err) {
        console.error("Error fetching Google Sheet:", err);
      }
    };

    fetchSheetData();

    const unsubscribe = onSnapshot(collection(db, 'faculty_members'), (snapshot) => {
      const facultyMembers = snapshot.docs.map(doc => doc.data());

      const depts = {};

      facultyMembers.forEach(f => {
        const dept = f.Department ? f.Department.toUpperCase() : 'UNKNOWN';
        if (!depts[dept]) depts[dept] = { department: dept, profs: 0, assocProfs: 0, asstProfs: 0 };

        const designation = (f.Designation || '').toLowerCase();
        const isAsst = designation.includes('assistant') || designation.includes('asst');
        const isAssoc = designation.includes('associate') || designation.includes('assoc');
        const temp = designation
          .replace(/(assistant|asst)\s*prof(essor)?/g, '')
          .replace(/(associate|assoc)\s*prof(essor)?/g, '');
        const isProf = temp.includes('professor') || temp.includes('prof');

        if (isAsst) depts[dept].asstProfs++;
        if (isAssoc) depts[dept].assocProfs++;
        if (isProf) depts[dept].profs++;
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

      <div className="table-container glass-panel" style={{ marginTop: '2rem' }}>
        <h3 style={{ padding: '1rem 1rem 0 1rem', color: 'var(--text-main)' }}>Faculty Count</h3>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                {sheetHeaders.map((header, idx) => (
                  <th key={idx}>{header || 'S.No'}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheetData.length > 0 ? (
                <>
                  {sheetData.map((row, rowIdx) => (
                    <tr key={rowIdx}>
                      {row.map((cell, cellIdx) => (
                        <td key={cellIdx} className={cellIdx > 0 ? "font-semibold" : ""}>
                          {cellIdx === 0 && cell ? (
                            <span className={`badge-dept badge-${(cell || '').toLowerCase()}`}>{cell}</span>
                          ) : (
                            cell
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', fontWeight: 'bold' }}>
                    {sheetTotal.map((cell, cellIdx) => (
                      <td key={cellIdx} className="font-semibold" style={{ color: cellIdx > 0 ? 'var(--color-primary)' : 'inherit' }}>
                        {cellIdx === 0 ? 'Total' : cell}
                      </td>
                    ))}
                  </tr>
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
    </div>
  );
};

export default Faculty;

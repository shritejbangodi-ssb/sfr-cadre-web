import React, { useState, useEffect } from 'react';
import { Search, Users, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import Header from '../components/Header';
import './Students.css';

const Faculty = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState('2025-26');
  const [rawFaculty, setRawFaculty] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [sheetData, setSheetData] = useState([]);
  const [sheetHeaders, setSheetHeaders] = useState([]);
  const [sheetTotal, setSheetTotal] = useState([]);

  const [selectedYearSheetData, setSelectedYearSheetData] = useState(null);
  const [isFetchingYearSheet, setIsFetchingYearSheet] = useState(false);

  const parseCSV = (text) => {
    const result = [];
    let currentRow = [];
    let currentCell = '';
    let insideQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];
      
      if (char === '"' && insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        currentRow.push(currentCell);
        currentCell = '';
      } else if ((char === '\n' || char === '\r') && !insideQuotes) {
        if (char === '\r' && nextChar === '\n') i++;
        currentRow.push(currentCell);
        result.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    if (currentCell !== '' || currentRow.length > 0) {
      currentRow.push(currentCell);
      result.push(currentRow);
    }
    return result;
  };

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
      setRawFaculty(snapshot.docs.map(doc => doc.data()));
    }, (error) => {
      console.error("Firestore Error:", error);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const depts = {};
    const startYear = selectedYear === 'All Years' ? 0 : parseInt(selectedYear.substring(0, 4), 10);

    rawFaculty.forEach(f => {
      if (startYear > 0) {
        const joinYear = parseInt(f.Joining_Year);
        const leaveYear = parseInt(f.Leaving_Year);
        if (isNaN(joinYear) || joinYear > startYear) return;
        if (!isNaN(leaveYear) && leaveYear < startYear) return;
      }

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
  }, [rawFaculty, selectedYear]);

  useEffect(() => {
    const fetchYearSheetData = async () => {
      if (!selectedYear) {
        setSelectedYearSheetData(null);
        return;
      }
      setIsFetchingYearSheet(true);
      try {
        const url = `https://docs.google.com/spreadsheets/d/1ZfMANlW5_VprTdR0NX1ROxm3_j0RwjdvRmgA_ZAAoqc/gviz/tq?tqx=out:csv&sheet=${selectedYear}`;
        const response = await fetch(url);
        const text = await response.text();
        const lines = parseCSV(text);
        
        if (lines.length > 1) {
          const deptsData = {};
          let currentDept = 'AIML';

          for (let i = 1; i < lines.length; i++) {
            const row = lines[i];
            if (!row[0] || row[0].trim() === '') continue;
            
            const isDeptHeading = row[0] && (!row[1] || row[1].trim() === '') && (!row[2] || row[2].trim() === '') && (!row[3] || row[3].trim() === '');
            
            if (isDeptHeading) {
              currentDept = row[0].trim();
              if (!deptsData[currentDept]) deptsData[currentDept] = [];
            } else {
              if (!deptsData[currentDept]) deptsData[currentDept] = [];
              deptsData[currentDept].push({
                name: row[0].trim(),
                degree: (row[1] || '').trim() || '-',
                designation: (row[2] || '').trim() || '-',
                joinDate: (row[3] || '').trim() || '-'
              });
            }
          }
          setSelectedYearSheetData(deptsData);
        } else {
          setSelectedYearSheetData({});
        }
      } catch (err) {
        console.error("Error fetching year sheet:", err);
        setSelectedYearSheetData(null);
      } finally {
        setIsFetchingYearSheet(false);
      }
    };
    fetchYearSheetData();
  }, [selectedYear]);

  const filteredFaculty = facultyList.filter(f =>
    (f.department || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="page-view">
      <Header
        title="Faculty Aggregation"
        subtitle="Automatically calculated from individual records"
        actions={
          <div className="d-flex gap-3" style={{ alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-surface)', padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Year:</span>
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(e.target.value)}
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: 'var(--text-main)',
                  outline: 'none',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                <option value="2026-27">2026-27</option>
                <option value="2025-26">2025-26</option>
                <option value="2024-25">2024-25</option>
                <option value="2023-24">2023-24</option>
                <option value="2022-23">2022-23</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              <RefreshCw size={18} /> Sync Data
            </button>
          </div>
        }
      />

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

      {selectedYear && (
        <div className="table-container glass-panel" style={{ marginTop: '2rem' }}>
          <h3 style={{ padding: '1rem 1rem 0 1rem', color: 'var(--text-main)', textAlign: 'center', marginBottom: '1rem' }}>Faculty Details ({selectedYear})</h3>
          
          {isFetchingYearSheet ? (
             <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading {selectedYear} data from Google Sheet...</div>
          ) : selectedYearSheetData && Object.keys(selectedYearSheetData).length > 0 ? (
             <div style={{ padding: '1rem' }}>
               {Object.entries(selectedYearSheetData).map(([dept, members]) => (
                 <div key={dept} style={{ marginBottom: '3rem', overflowX: 'auto' }}>
                   <h4 style={{ marginBottom: '1rem', color: 'var(--text-main)', textAlign: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>
                     {dept}
                   </h4>
                   <table className="data-table" style={{ border: '1px solid var(--border-color)', width: '100%', borderCollapse: 'collapse' }}>
                     <thead>
                       <tr>
                         <th style={{ border: '1px solid var(--border-color)', textAlign: 'left', backgroundColor: 'rgba(255,255,255,0.02)', padding: '12px' }}>Name of the Faculty</th>
                         <th style={{ border: '1px solid var(--border-color)', textAlign: 'left', backgroundColor: 'rgba(255,255,255,0.02)', padding: '12px' }}>Highest degree</th>
                         <th style={{ border: '1px solid var(--border-color)', textAlign: 'left', backgroundColor: 'rgba(255,255,255,0.02)', padding: '12px' }}>Present Designation</th>
                         <th style={{ border: '1px solid var(--border-color)', textAlign: 'left', backgroundColor: 'rgba(255,255,255,0.02)', padding: '12px' }}>Date of Joining</th>
                       </tr>
                     </thead>
                     <tbody>
                       {members.length > 0 ? members.map((m, idx) => (
                         <tr key={idx}>
                           <td style={{ border: '1px solid var(--border-color)', padding: '12px', fontWeight: '600' }}>{m.name}</td>
                           <td style={{ border: '1px solid var(--border-color)', padding: '12px' }}>{m.degree}</td>
                           <td style={{ border: '1px solid var(--border-color)', padding: '12px', whiteSpace: 'pre-line' }}>{m.designation}</td>
                           <td style={{ border: '1px solid var(--border-color)', padding: '12px' }}>{m.joinDate}</td>
                         </tr>
                       )) : (
                         <tr>
                           <td colSpan="4" style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>No faculty members listed.</td>
                         </tr>
                       )}
                     </tbody>
                   </table>
                 </div>
               ))}
             </div>
          ) : (
             <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No detailed data available for {selectedYear}.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default Faculty;

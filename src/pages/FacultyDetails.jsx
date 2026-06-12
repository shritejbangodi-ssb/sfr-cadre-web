import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Upload, Trash2, Edit2, X, ChevronUp, ChevronDown, Filter, RefreshCw } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import * as XLSX from 'xlsx';
import Header from '../components/Header';
import './Students.css';

const FACULTY_SYNC_FIELDS = [
  'Faculty_Name',
  'Department',
  'Designation',
  'Joining_Year',
  'Leaving_Year',
  'Highest_Degree',
];

const normalizeFacultyRecord = (record) => ({
  Faculty_Name: (record.Faculty_Name || '').trim(),
  Department: (record.Department || 'Unknown').trim().toUpperCase(),
  Designation: (record.Designation || '').trim(),
  Joining_Year: String(record.Joining_Year || '').trim(),
  Leaving_Year: String(record.Leaving_Year || '').trim(),
  Highest_Degree: (record.Highest_Degree || '').trim(),
});

const getFacultySyncKey = (record) => {
  const normalized = normalizeFacultyRecord(record);
  return `${normalized.Faculty_Name.toLowerCase()}|${normalized.Department}`;
};

const facultyRecordsEqual = (existing, incoming) => {
  const left = normalizeFacultyRecord(existing);
  const right = normalizeFacultyRecord(incoming);
  return FACULTY_SYNC_FIELDS.every((field) => left[field] === right[field]);
};

const DEPARTMENT_ALIASES = {
  CSCY: 'CYBERSECURITY',
  CSD: 'CS & DESIGN',
  PGCC: 'PG',
};

const KNOWN_DEPARTMENTS = new Set([
  'CSE', 'ISE', 'CSDS', 'CSBS', 'AIML', 'IOT', 'CYBERSECURITY', 'CS & DESIGN', 'PG',
]);

const isNumericOnly = (value) => /^\d+$/.test(String(value || '').trim());

const looksLikeName = (value) => {
  const text = String(value || '').trim();
  if (!text || text.length < 2) return false;
  if (isNumericOnly(text)) return false;
  if (/^(yes|no|na|n\/a)$/i.test(text)) return false;
  if (/^date of /i.test(text)) return false;
  return /[A-Za-z]/.test(text);
};

const normalizeDepartment = (deptVal) => {
  const upper = deptVal.trim().toUpperCase();
  if (DEPARTMENT_ALIASES[upper]) return DEPARTMENT_ALIASES[upper];
  if (upper === 'PG' || upper.startsWith('PG')) return 'PG';
  return upper;
};

const isDepartmentHeader = (deptVal) => {
  const text = deptVal.trim();
  if (!text || isNumericOnly(text)) return false;

  const upper = text.toUpperCase();
  if (KNOWN_DEPARTMENTS.has(upper) || DEPARTMENT_ALIASES[upper]) return true;
  if (upper === 'PG' || upper.startsWith('PG')) return true;

  return /^[A-Z0-9&\s]{2,20}$/.test(upper) && !looksLikeName(text);
};

const extractYear = (dateStr) => {
  if (!dateStr) return '';
  const text = String(dateStr).trim();
  const match = text.match(/(\d{4})\s*$/) || text.match(/(\d{2})\s*$/);
  if (match) {
    return match[1].length === 2
      ? (parseInt(match[1], 10) > 50 ? '19' + match[1] : '20' + match[1])
      : match[1];
  }
  return text.length <= 4 && /^\d+$/.test(text) ? text : '';
};

const parseFacultySheetRows = (rows) => {
  const sheetData = [];
  let currentDept = '';

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const deptVal = row[0] ? row[0].trim() : '';
    if (deptVal && isDepartmentHeader(deptVal)) {
      currentDept = normalizeDepartment(deptVal);
    }

    const facultyName = row[2] ? row[2].trim().replace(/\s+/g, ' ') : '';
    if (!looksLikeName(facultyName)) continue;

    const dateOfJoining = row[3]?.trim() || '';
    const designatedDate = row[4]?.trim() || '';
    const dateOfLeaving = row[5]?.trim() || '';

    let designation = 'Assistant Professor';
    if (designatedDate && !designatedDate.toLowerCase().includes('na') && designatedDate.trim() !== '') {
      designation = 'Professor';
    }

    let leavingYear = '';
    if (dateOfLeaving && !dateOfLeaving.toLowerCase().includes('na')) {
      leavingYear = extractYear(dateOfLeaving) || (dateOfLeaving.length < 15 ? dateOfLeaving : '');
    }

    sheetData.push(normalizeFacultyRecord({
      Faculty_Name: facultyName,
      Department: currentDept || 'Unknown',
      Designation: designation,
      Joining_Year: extractYear(dateOfJoining),
      Leaving_Year: leavingYear,
      Highest_Degree: '',
    }));
  }

  return sheetData;
};

const commitWriteOperations = async (operations) => {
  const BATCH_SIZE = 500;
  for (let i = 0; i < operations.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    operations.slice(i, i + BATCH_SIZE).forEach((operation) => operation(batch));
    await batch.commit();
  }
};

const FacultyDetails = () => {
  const location = useLocation();

  const [searchTerm, setSearchTerm] = useState('');
  const [facultyMembers, setFacultyMembers] = useState([]);
  const [filterDepartment, setFilterDepartment] = useState('All');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const dept = params.get('dept');
    if (dept) {
      setFilterDepartment(dept.toUpperCase());
    }
  }, [location.search]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  const [formData, setFormData] = useState({
    Faculty_Name: '',
    Department: 'CSE',
    Designation: '',
    Joining_Year: '',
    Leaving_Year: '',
    Highest_Degree: ''
  });

  const fileInputRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'faculty_members'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFacultyMembers(data);
    }, (error) => {
      console.error("Firestore Error:", error);
    });
    return () => unsubscribe();
  }, []);

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
        Designation: faculty.Designation === 'Professor / Associate Professor' ? 'Professor' : (faculty.Designation || ''),
        Joining_Year: faculty.Joining_Year || '',
        Leaving_Year: faculty.Leaving_Year || '',
        Highest_Degree: faculty.Highest_Degree || ''
      });
    } else {
      setIsEditing(false);
      setCurrentId(null);
      setFormData({
        Faculty_Name: '',
        Department: 'CSE',
        Designation: '',
        Joining_Year: '',
        Leaving_Year: '',
        Highest_Degree: ''
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await updateDoc(doc(db, 'faculty_members', currentId), formData);
      } else {
        await addDoc(collection(db, 'faculty_members'), formData);
      }
      closeModal();
    } catch (error) {
      console.error("Error saving faculty member:", error);
      alert("Error saving faculty member: " + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this faculty member?")) {
      try {
        await deleteDoc(doc(db, 'faculty_members', id));
      } catch (error) {
        console.error("Error deleting faculty member:", error);
      }
    }
  };

  const handleDeleteSelected = async () => {
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} selected faculty member(s)?`)) {
      try {
        for (const id of selectedIds) {
          await deleteDoc(doc(db, 'faculty_members', id));
        }
        setSelectedIds([]);
      } catch (error) {
        console.error("Error deleting faculty members:", error);
        alert("Error deleting faculty members: " + error.message);
      }
    }
  };


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
        for (const row of data) {
          if (row.Faculty_Name) {
            await addDoc(collection(db, 'faculty_members'), {
              Faculty_Name: row.Faculty_Name || '',
              Department: row.Department || '',
              Designation: row.Designation || '',
              Joining_Year: row.Joining_Year || '',
              Leaving_Year: row.Leaving_Year || '',
              Highest_Degree: row.Highest_Degree || ''
            });
            addedCount++;
          }
        }
        alert(`Successfully imported ${addedCount} faculty members.`);
      } catch (error) {
        console.error("Error parsing Excel file:", error);
        alert("Error parsing Excel file. Please ensure it matches the required format.");
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

  const handleSyncData = async () => {
    if (!window.confirm("Sync faculty data from the Google Sheet? Only new, updated, or removed records will be changed.")) {
      return;
    }

    setIsSyncing(true);
    try {
      const sheetUrl = "https://docs.google.com/spreadsheets/d/1E2VYOBneOPv7hBpnv2X1hCLkdbC67mhurx2tLQq9Ja0/export?format=csv&gid=775665137";
      const response = await fetch(sheetUrl);
      if (!response.ok) throw new Error("Failed to fetch Google Sheet data.");
      const csvText = await response.text();

      const rows = parseCSV(csvText);
      if (rows.length < 2) {
        alert("The Google Sheet is empty or in an invalid format.");
        return;
      }

      const sheetData = parseFacultySheetRows(rows);
      const sheetByKey = new Map();
      sheetData.forEach((record) => {
        sheetByKey.set(getFacultySyncKey(record), record);
      });

      const existingSnap = await getDocs(collection(db, 'faculty_members'));
      const existingByKey = new Map();
      existingSnap.docs.forEach((docSnap) => {
        const data = { id: docSnap.id, ...docSnap.data() };
        const key = getFacultySyncKey(data);
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
          const newDocRef = doc(collection(db, 'faculty_members'));
          operations.push((batch) => batch.set(newDocRef, sheetRecord));
          addedCount++;
          return;
        }

        if (facultyRecordsEqual(existing, sheetRecord)) {
          unchangedCount++;
          return;
        }

        operations.push((batch) => batch.update(doc(db, 'faculty_members', existing.id), sheetRecord));
        updatedCount++;
      });

      existingByKey.forEach((existing, key) => {
        if (!sheetByKey.has(key)) {
          operations.push((batch) => batch.delete(doc(db, 'faculty_members', existing.id)));
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

  const processedFaculty = React.useMemo(() => {
    let sortableItems = [...facultyMembers];

    if (searchTerm) {
      sortableItems = sortableItems.filter(f =>
        (f.Faculty_Name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (f.Department || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (f.Designation || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterDepartment !== 'All') {
      sortableItems = sortableItems.filter(f =>
        (f.Department || '').trim().toUpperCase() === filterDepartment.trim().toUpperCase()
      );
    }

    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        let aValue = a[sortConfig.key] || '';
        let bValue = b[sortConfig.key] || '';

        if (sortConfig.key === 'Joining_Year' || sortConfig.key === 'Leaving_Year') {
          aValue = parseInt(aValue) || 0;
          bValue = parseInt(bValue) || 0;
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return sortableItems;
  }, [facultyMembers, searchTerm, filterDepartment, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (columnName) => {
    if (sortConfig.key !== columnName) {
      return <ChevronUp size={14} className="text-muted" style={{ opacity: 0.3, marginLeft: '4px' }} />;
    }
    return sortConfig.direction === 'asc'
      ? <ChevronUp size={14} style={{ marginLeft: '4px' }} />
      : <ChevronDown size={14} style={{ marginLeft: '4px' }} />;
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === processedFaculty.length && processedFaculty.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(processedFaculty.map(f => f.id));
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
            Faculty Details
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
              {facultyMembers.length} Total
            </span>
          </div>
        }
        subtitle="Manage individual faculty information"
        actions={
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
              <Upload size={18} /> Add Bulk Excel
            </button>
            <button className="btn btn-secondary" onClick={handleSyncData} disabled={isSyncing}>
              <RefreshCw size={18} className={isSyncing ? "spin-animation" : ""} /> {isSyncing ? "Syncing..." : "Sync Data"}
            </button>
            <button className="btn btn-primary" onClick={() => openModal()}>
              <Plus size={18} /> Add Faculty
            </button>
          </div>
        }
      />

      <div className="table-container glass-panel">
        <div className="table-toolbar">
          <div className="search-bar">
            <Search size={18} className="search-icon text-muted" />
            <input
              type="text"
              placeholder="Search by name, dept, designation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="search-bar" style={{ marginLeft: '1rem', width: 'auto' }}>
            <Filter size={18} className="search-icon text-muted" />
            <select
              className="search-input"
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
            >
              <option value="All">All Departments</option>
              <option value="CSE">CSE</option>
              <option value="ISE">ISE</option>
              <option value="CYBERSECURITY">CYBERSECURITY</option>
              <option value="CS & DESIGN">CS & DESIGN</option>
              <option value="CSDS">CSDS</option>
              <option value="CSBS">CSBS</option>
              <option value="AIML">AIML</option>
              <option value="IOT">IoT</option>
              <option value="PG">PG</option>
            </select>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.length === processedFaculty.length && processedFaculty.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th onClick={() => requestSort('Faculty_Name')} style={{ cursor: 'pointer' }} className="user-select-none">
                  <div className="d-flex align-center">Name {getSortIcon('Faculty_Name')}</div>
                </th>
                <th onClick={() => requestSort('Department')} style={{ cursor: 'pointer' }} className="user-select-none">
                  <div className="d-flex align-center">Department {getSortIcon('Department')}</div>
                </th>
                <th onClick={() => requestSort('Designation')} style={{ cursor: 'pointer' }} className="user-select-none">
                  <div className="d-flex align-center">Designation {getSortIcon('Designation')}</div>
                </th>
                <th onClick={() => requestSort('Joining_Year')} style={{ cursor: 'pointer' }} className="user-select-none">
                  <div className="d-flex align-center">Joining Year {getSortIcon('Joining_Year')}</div>
                </th>
                <th onClick={() => requestSort('Leaving_Year')} style={{ cursor: 'pointer' }} className="user-select-none">
                  <div className="d-flex align-center">Leaving Year {getSortIcon('Leaving_Year')}</div>
                </th>
                <th onClick={() => requestSort('Highest_Degree')} style={{ cursor: 'pointer' }} className="user-select-none">
                  <div className="d-flex align-center">Highest Degree {getSortIcon('Highest_Degree')}</div>
                </th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {processedFaculty.length > 0 ? (
                processedFaculty.map((faculty) => (
                  <tr key={faculty.id} className={selectedIds.includes(faculty.id) ? 'selected-row' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(faculty.id)}
                        onChange={() => toggleSelect(faculty.id)}
                      />
                    </td>
                    <td className="font-semibold">{faculty.Faculty_Name}</td>
                    <td><span className={`badge-dept badge-${(faculty.Department || 'cse').toLowerCase()}`}>{faculty.Department || 'N/A'}</span></td>
                    <td>{faculty.Designation === 'Professor / Associate Professor' ? 'Professor' : (faculty.Designation || '-')}</td>
                    <td>{faculty.Joining_Year || '-'}</td>
                    <td>{faculty.Leaving_Year || '-'}</td>
                    <td>{faculty.Highest_Degree || '-'}</td>
                    <td className="actions-cell">
                      <button className="icon-btn edit-btn" onClick={() => openModal(faculty)} title="Edit"><Edit2 size={16} /></button>
                      <button className="icon-btn delete-btn" onClick={() => handleDelete(faculty.id)} title="Delete"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="empty-state">No faculty details found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>{isEditing ? 'Edit Faculty' : 'Add Faculty'}</h2>
              <button className="icon-btn" onClick={closeModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="d-flex gap-4">
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Faculty Name</label>
                  <input required type="text" name="Faculty_Name" className="input-field" value={formData.Faculty_Name} onChange={handleInputChange} />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Department</label>
                  <select name="Department" className="input-field" value={formData.Department} onChange={handleInputChange}>
                    <option value="CSE">CSE</option>
                    <option value="ISE">ISE</option>
                    <option value="CYBERSECURITY">CYBERSECURITY</option>
                    <option value="CS & DESIGN">CS & DESIGN</option>
                    <option value="CSDS">CSDS</option>
                    <option value="CSBS">CSBS</option>
                    <option value="AIML">AIML</option>
                    <option value="IOT">IoT</option>
                    <option value="PG">PG</option>
                  </select>
                </div>
              </div>
              <div className="d-flex gap-4">
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Designation</label>
                  <input type="text" name="Designation" className="input-field" value={formData.Designation} onChange={handleInputChange} />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Highest Degree</label>
                  <input type="text" name="Highest_Degree" className="input-field" value={formData.Highest_Degree} onChange={handleInputChange} />
                </div>
              </div>
              <div className="d-flex gap-4">
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Joining Year</label>
                  <input required type="number" name="Joining_Year" className="input-field" value={formData.Joining_Year} onChange={handleInputChange} />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label className="input-label">Leaving Year</label>
                  <input type="number" name="Leaving_Year" className="input-field" value={formData.Leaving_Year} onChange={handleInputChange} placeholder="Leave empty if current" />
                </div>
              </div>

              <div className="modal-footer d-flex justify-between" style={{ marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">{isEditing ? 'Update' : 'Save'} Faculty</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacultyDetails;

import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, Users, X } from 'lucide-react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import './Students.css';

const Courses = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [courses, setCourses] = useState([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [formData, setFormData] = useState({
    courseCode: '',
    name: '',
    credits: 3,
    department: 'CSE',
    assignedFaculty: ''
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'courses'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCourses(data);
    }, (error) => {
      console.error("Firestore Error:", error);
    });
    return () => unsubscribe();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const openModal = (course = null) => {
    if (course) {
      setIsEditing(true);
      setCurrentId(course.id);
      setFormData({
        courseCode: course.courseCode,
        name: course.name,
        credits: course.credits,
        department: course.department,
        assignedFaculty: course.assignedFaculty
      });
    } else {
      setIsEditing(false);
      setCurrentId(null);
      setFormData({ courseCode: '', name: '', credits: 3, department: 'CSE', assignedFaculty: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await updateDoc(doc(db, 'courses', currentId), {
          ...formData,
          credits: Number(formData.credits)
        });
      } else {
        await addDoc(collection(db, 'courses'), {
          ...formData,
          credits: Number(formData.credits)
        });
      }
      closeModal();
    } catch (error) {
      console.error("Error saving course:", error);
      alert("Failed to save course.");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this course permanently?")) {
      await deleteDoc(doc(db, 'courses', id));
    }
  };

  const filteredCourses = courses.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.courseCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="page-view">
      <div className="page-header d-flex justify-between align-center">
        <div>
          <h1>Courses Management</h1>
          <p className="subtitle">Manage courses and faculty assignments</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <Plus size={18} /> Add Course
        </button>
      </div>

      <div className="table-container glass-panel">
        <div className="table-toolbar">
          <div className="search-bar">
            <Search size={18} className="search-icon text-muted" />
            <input 
              type="text" 
              placeholder="Search by course name, code or department..." 
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
                <th>Course Code</th>
                <th>Course Name</th>
                <th>Credits</th>
                <th>Department</th>
                <th>Assigned Faculty</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCourses.length > 0 ? (
                filteredCourses.map((course) => (
                  <tr key={course.id}>
                    <td><span className="badge-id">{course.courseCode}</span></td>
                    <td className="font-semibold">{course.name}</td>
                    <td>{course.credits}</td>
                    <td><span className={`badge-dept badge-${course.department.toLowerCase()}`}>{course.department}</span></td>
                    <td>
                      <div className="d-flex align-center gap-2">
                        <Users size={14} className="text-muted" />
                        <span>{course.assignedFaculty || 'Unassigned'}</span>
                      </div>
                    </td>
                    <td className="actions-cell">
                      <button className="icon-btn edit-btn" onClick={() => openModal(course)} title="Edit"><Edit2 size={16} /></button>
                      <button className="icon-btn delete-btn" onClick={() => handleDelete(course.id)} title="Delete"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="empty-state">No courses found. Add a course to get started.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h2>{isEditing ? 'Edit Course' : 'Add New Course'}</h2>
              <button className="icon-btn" onClick={closeModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="input-group">
                <label className="input-label">Course Code</label>
                <input required type="text" name="courseCode" className="input-field" value={formData.courseCode} onChange={handleInputChange} placeholder="e.g. CS301" />
              </div>
              <div className="input-group">
                <label className="input-label">Course Name</label>
                <input required type="text" name="name" className="input-field" value={formData.name} onChange={handleInputChange} />
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
                  <label className="input-label">Credits</label>
                  <input required type="number" min="1" max="6" name="credits" className="input-field" value={formData.credits} onChange={handleInputChange} />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Assigned Faculty (Name)</label>
                <input type="text" name="assignedFaculty" className="input-field" value={formData.assignedFaculty} onChange={handleInputChange} placeholder="Dr. John Doe" />
              </div>
              
              <div className="modal-footer d-flex justify-between" style={{ marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">{isEditing ? 'Update' : 'Save'} Course</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Courses;

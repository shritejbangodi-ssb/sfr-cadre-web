import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  UserSquare2, 
  Calculator, 
  BarChart4, 
  Building2,
  FileText, 
  LogOut 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Sidebar.css';

const Sidebar = () => {
  const { userRole, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error(err);
    }
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} />, roles: ['admin', 'faculty'] },
    { name: 'Students', path: '/students', icon: <Users size={20} />, roles: ['admin', 'faculty'] },
    { name: 'Faculty', path: '/faculty', icon: <UserSquare2 size={20} />, roles: ['admin', 'faculty'] },
    { name: 'Faculty Qualification', path: '/faculty-qualification', icon: <FileText size={20} />, roles: ['admin', 'faculty'] },
    { name: 'Faculty Retention', path: '/faculty-retention', icon: <Users size={20} />, roles: ['admin', 'faculty'] },
    { name: 'SFR Analysis', path: '/sfr', icon: <Calculator size={20} />, roles: ['admin', 'faculty'] },
    { name: 'CADR Analysis', path: '/cadr', icon: <BarChart4 size={20} />, roles: ['admin', 'faculty'] },
    { name: 'Department Analysis', path: '/department-analysis', icon: <Building2 size={20} />, roles: ['admin', 'faculty'] },
    { name: 'Reports', path: '/reports', icon: <FileText size={20} />, roles: ['admin', 'faculty'] },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h2 className="brand-text">SFR Analysis</h2>
        <span className="brand-badge">PRO</span>
      </div>
      
      <nav className="sidebar-nav">
        {navItems.filter(item => !item.roles || item.roles.includes(userRole)).map((item) => (
          <NavLink 
            key={item.name} 
            to={item.path} 
            className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}
          >
            {item.icon}
            <span>{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="nav-item logout-btn" onClick={handleLogout}>
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;

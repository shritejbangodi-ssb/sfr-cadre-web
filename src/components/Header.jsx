import React from 'react';
import './Header.css';

const Header = ({ title, subtitle, actions }) => {
  return (
    <header className="page-header-container">
      <div className="header-left-section">
        <h1 className="header-title">{title}</h1>
        {subtitle && <p className="header-subtitle">{subtitle}</p>}
      </div>
      
      <div className="header-right-section">
        {actions && <div className="header-actions">{actions}</div>}
      </div>
    </header>
  );
};

export default Header;

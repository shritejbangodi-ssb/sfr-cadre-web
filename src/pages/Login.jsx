import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "./Login.css";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const { login, currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      navigate('/dashboard', { replace: true });
    }
  }, [currentUser, navigate]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    
    try {
      await login(email, password);
    } catch (err) {
      console.error(err);
      setError("Authentication failed: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page-wrapper">
      <div className="login-card-container">
        {/* Left side - Institutional Analytics Branding & Mock Widgets */}
        <div className="login-left-panel">
          {/* Dot grids overlaying the background */}
          <div className="dot-grid dot-grid-top-left"></div>
          <div className="dot-grid dot-grid-bottom-left"></div>
          <div className="dot-grid dot-grid-mid-right"></div>
          <div className="dot-grid dot-grid-bottom-right"></div>
          
          <div className="map-overlay-content">
            {/* Circular DSCE Logo Container */}
            <div className="brand-logo-container">
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/d/dd/DSCE_Logo.jpg" 
                alt="DSCE Logo" 
                className="brand-logo-img" 
              />
            </div>
            
            {/* Arrow Badge */}
            <div className="logo-arrow-badge">
              <ArrowRight size={20} />
            </div>
            
            <h2 className="login-brand-title">Institutional Analytics</h2>
            <p className="login-brand-subtitle">
              Access your comprehensive faculty analytics, institutional reporting, and compliance metrics.
            </p>
            
            {/* High-Fidelity Mock Dashboard Overlays */}
            <div className="analytics-mock-container">
              {/* Central Mock Dashboard Card */}
              <div className="mock-dashboard-card">
                <div className="mock-card-header">
                  <span className="header-dot"></span>
                  <span className="header-dot"></span>
                  <span className="header-dot"></span>
                </div>
                
                {/* Embedded Inline SVG Line Chart */}
                <svg className="mock-line-chart" viewBox="0 0 220 50">
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2"/>
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  {/* Grid lines */}
                  <line x1="0" y1="10" x2="220" y2="10" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="0" y1="30" x2="220" y2="30" stroke="#f1f5f9" strokeWidth="1" />
                  {/* Area fill */}
                  <path d="M 0 35 Q 35 15 70 28 T 140 12 T 210 20 L 220 20 L 220 50 L 0 50 Z" fill="url(#chartGradient)" />
                  {/* Line path */}
                  <path d="M 0 35 Q 35 15 70 28 T 140 12 T 210 20 L 220 20" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
                  {/* Interactive dot */}
                  <circle cx="140" cy="12" r="3" fill="#2563eb" />
                </svg>
                
                <div className="mock-bottom-charts">
                  {/* Compact bar chart */}
                  <div className="mock-bar-chart">
                    <div className="mock-bar" style={{ height: "45%" }}></div>
                    <div className="mock-bar" style={{ height: "65%" }}></div>
                    <div className="mock-bar" style={{ height: "85%" }}></div>
                    <div className="mock-bar" style={{ height: "55%" }}></div>
                    <div className="mock-bar" style={{ height: "95%" }}></div>
                    <div className="mock-bar" style={{ height: "70%" }}></div>
                  </div>
                  
                  {/* Donut chart */}
                  <svg className="mock-donut-chart" viewBox="0 0 36 36">
                    <path
                      className="donut-ring"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#f1f5f9"
                      strokeWidth="3.5"
                    />
                    <path
                      className="donut-segment"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="3.5"
                      strokeDasharray="75, 25"
                      strokeDashoffset="25"
                    />
                  </svg>
                </div>
              </div>
              
              {/* Overlapping Badge: Faculty 128 */}
              <div className="mock-badge-card mock-badge-faculty">
                <div className="badge-icon-wrapper">
                  <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                </div>
                <div className="badge-info">
                  <span className="badge-label">Faculty</span>
                  <span className="badge-value">128</span>
                </div>
              </div>
              
              {/* Overlapping Badge: SFR Compliance 92% */}
              <div className="mock-badge-card mock-badge-sfr">
                <div className="badge-icon-wrapper sfr">
                  <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                </div>
                <div className="badge-info">
                  <span className="badge-label">SFR Compliance</span>
                  <span className="badge-value">92%</span>
                </div>
              </div>
              
              {/* Overlapping Badge: Reports 36 */}
              <div className="mock-badge-card mock-badge-reports">
                <div className="badge-icon-wrapper reports">
                  <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                  </svg>
                </div>
                <div className="badge-info">
                  <span className="badge-label">Reports</span>
                  <span className="badge-value">36</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Right side - Sign In Form */}
        <div className="login-right-panel">
          <h1 className="form-welcome-title">Welcome back</h1>
          <p className="form-welcome-subtitle">Sign in to your account</p>
          
          {error && (
            <div className="login-error-alert">
              {error}
            </div>
          )}


          
          <form onSubmit={handleLoginSubmit}>
            <div className="form-input-group">
              <label htmlFor="email" className="form-input-label">
                Email <span>*</span>
              </label>
              <div className="form-input-wrapper">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                  className="form-input-control"
                />
                <div className="input-icon-btn">
                  <span className="email-brand-badge">e</span>
                </div>
              </div>
            </div>
            
            <div className="form-input-group">
              <label htmlFor="password" className="form-input-label">
                Password <span>*</span>
              </label>
              <div className="form-input-wrapper">
                <input
                  id="password"
                  type={isPasswordVisible ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="form-input-control"
                />
                <button
                  type="button"
                  className="input-icon-btn"
                  onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                >
                  {isPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            
            <button
              type="submit"
              disabled={isLoading}
              className="btn-submit-primary"
            >
              <span>{isLoading ? "Signing in..." : "Sign in"}</span>
              <ArrowRight size={16} />
            </button>
            
            <a href="#" className="forgot-password-link">
              Forgot password?
            </a>
            
            <p className="signup-link-text">
              New Faculty Member? <Link to="/signup">Sign up here</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;

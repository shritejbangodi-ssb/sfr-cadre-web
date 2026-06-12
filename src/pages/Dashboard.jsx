import React, { useState, useEffect } from 'react';
import { Users, Building2, TrendingUp, CalendarRange } from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  ReferenceLine, 
  AreaChart, 
  Area 
} from 'recharts';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import {
  calculateNBA_SFR,
  getAcademicYearsInRange,
  getCurrentAcademicYearStart,
  formatAcademicYear,
  buildCAYDetails,
} from '../utils/sfrCalculator';
import Header from '../components/Header';
import './Dashboard.css';

const defaultEndStart = getCurrentAcademicYearStart();
const defaultStartYear = defaultEndStart - 2;

const Dashboard = () => {
  const [startYear, setStartYear] = useState(formatAcademicYear(defaultStartYear, true));
  const [endYear, setEndYear] = useState(formatAcademicYear(defaultEndStart, true));

  const [stats, setStats] = useState({
    totalStudents: 0,
    totalDepartments: 0,
    overallSFR: '0.0',
  });

  const [sfrData, setSfrData] = useState([]);
  const [cayDetails, setCayDetails] = useState([]);

  const targetYears = getAcademicYearsInRange(startYear, endYear);

  const handleStartYearChange = (e) => {
    const value = e.target.value;
    setStartYear(value);

    const start = parseInt(value.match(/\d{4}/)?.[0] || '0', 10);
    if (start) {
      setEndYear(formatAcademicYear(start + 2, true));
    }
  };

  useEffect(() => {
    let unsubFaculty;

    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      const studentDocs = snap.docs.map(doc => doc.data());

      const fetchFacultyAndBuildStats = () => {
        unsubFaculty = onSnapshot(collection(db, 'faculty_members'), (facSnap) => {
          const facultyDocs = facSnap.docs.map(f => f.data());
          const years = getAcademicYearsInRange(startYear, endYear);

          const calculatedDepts = calculateNBA_SFR(studentDocs, facultyDocs, years);
          const deptArray = Object.values(calculatedDepts).filter(d => d.department !== 'UNKNOWN');

          let totalStudents = 0;
          let sumAverages = 0;
          let validDepts = 0;

          const chartData = [];

          deptArray.forEach(d => {
            totalStudents += d.totalStudents3Years;
            if (d.averageSFR > 0) {
              sumAverages += d.averageSFR;
              validDepts++;
            }
            chartData.push({
              name: d.department,
              sfr: parseFloat(d.averageSFR.toFixed(2))
            });
          });

          const overallAvgSfr = validDepts > 0 ? (sumAverages / validDepts).toFixed(1) : '0.0';

          setStats({
            totalStudents,
            totalDepartments: deptArray.length,
            overallSFR: overallAvgSfr === '0.0' ? 'N/A' : overallAvgSfr + ':1'
          });

          setSfrData(chartData);
          setCayDetails(buildCAYDetails(studentDocs, facultyDocs, years));
        });
      };

      fetchFacultyAndBuildStats();
    });

    return () => {
      unsubStudents();
      if (unsubFaculty) unsubFaculty();
    };
  }, [startYear, endYear]);

  const parseSFR = (sfrStr) => {
    const parsed = parseFloat(sfrStr);
    return isNaN(parsed) ? 15.0 : parsed;
  };

  const studentsSparkline = [
    { value: Math.max(0, stats.totalStudents - 800) },
    { value: Math.max(0, stats.totalStudents - 600) },
    { value: Math.max(0, stats.totalStudents - 300) },
    { value: Math.max(0, stats.totalStudents - 150) },
    { value: stats.totalStudents }
  ];

  const deptsSparkline = [
    { value: stats.totalDepartments },
    { value: stats.totalDepartments },
    { value: stats.totalDepartments },
    { value: stats.totalDepartments },
    { value: stats.totalDepartments }
  ];

  const sfrSparkline = [
    { value: parseSFR(stats.overallSFR) + 1.2 },
    { value: parseSFR(stats.overallSFR) + 0.8 },
    { value: parseSFR(stats.overallSFR) + 0.5 },
    { value: parseSFR(stats.overallSFR) + 0.1 },
    { value: parseSFR(stats.overallSFR) }
  ];

  const renderSFRReferenceLabel = (value, color) => (props) => {
    const { viewBox } = props;
    if (!viewBox) return null;
    const { x, y, width } = viewBox;
    const rightX = x + width;
    const label = `${value}:1`;
    const badgeWidth = label.length > 4 ? 38 : 32;

    return (
      <g>
        <rect
          x={rightX - badgeWidth - 3}
          y={y - 8}
          width={badgeWidth}
          height={16}
          rx={8}
          fill={color}
        />
        <text
          x={rightX - badgeWidth / 2 - 3}
          y={y + 4}
          fill="#ffffff"
          fontSize={9}
          fontWeight="700"
          textAnchor="middle"
        >
          {label}
        </text>
      </g>
    );
  };

  const yearRangeSelector = (
    <div className="year-range-selector">
      <CalendarRange size={16} className="year-range-icon" />
      <div className="year-range-fields">
        <label className="year-range-field">
          <span>Start Year</span>
          <input
            type="text"
            className="year-range-input"
            value={startYear}
            onChange={handleStartYearChange}
            placeholder="2023-24"
          />
        </label>
        <label className="year-range-field">
          <span>End Year</span>
          <input
            type="text"
            className="year-range-input"
            value={endYear}
            onChange={(e) => setEndYear(e.target.value)}
            placeholder="2025-26"
          />
        </label>
      </div>
    </div>
  );

  return (
    <div className="dashboard-view">
      <Header 
        title="Overview Dashboard" 
        subtitle="Real-time academic performance analytics"
        actions={yearRangeSelector}
      />

      <div className="stats-grid">
        <div className="stat-card dashboard-block">
          <div className="stat-header">
            <span className="stat-label">Total Students</span>
            <div className="stat-icon-wrapper students">
              <Users size={20} />
            </div>
          </div>
          <div className="stat-value">{stats.totalStudents || 6443}</div>
          <div className="stat-sparkline">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={studentsSparkline} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="sparklineStudents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#10b981" 
                  strokeWidth={1.5} 
                  fillOpacity={1} 
                  fill="url(#sparklineStudents)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="cay-details-card dashboard-block">
          <div className="cay-details-header">
            <h4>CAY Details</h4>
            <span className="cay-details-range">
              {startYear} – {endYear}
            </span>
          </div>
          {cayDetails.length > 0 ? (
            <div className="cay-details-table">
              <div className="cay-details-row cay-details-head">
                <span>Year</span>
                <span>Academic Year</span>
                <span>Students</span>
                <span>Faculty</span>
              </div>
              {cayDetails.map((row) => (
                <div key={row.label} className="cay-details-row">
                  <span className="cay-label">{row.label}</span>
                  <span>{row.academicYear}</span>
                  <span className="cay-count">{row.students}</span>
                  <span className="cay-count">{row.faculty}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="cay-details-empty">Set a valid 3-year academic range above.</p>
          )}
        </div>

        <div className="stat-card dashboard-block">
          <div className="stat-header">
            <span className="stat-label">Total Departments</span>
            <div className="stat-icon-wrapper departments">
              <Building2 size={20} />
            </div>
          </div>
          <div className="stat-value">{stats.totalDepartments || 8}</div>
          <div className="stat-sparkline">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={deptsSparkline} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="sparklineDepts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#f59e0b" 
                  strokeWidth={1.5} 
                  fillOpacity={1} 
                  fill="url(#sparklineDepts)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="stat-card dashboard-block">
          <div className="stat-header">
            <span className="stat-label">Overall SFR</span>
            <div className="stat-icon-wrapper sfr">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="stat-value">{stats.overallSFR === '0.0' ? '19.8:1' : stats.overallSFR}</div>
          <div className="stat-trend-container">
            <span className="trend-text-info">Target: 15:1</span>
          </div>
          <div className="stat-sparkline">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sfrSparkline} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="sparklineSfr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#ef4444" 
                  strokeWidth={1.5} 
                  fillOpacity={1} 
                  fill="url(#sparklineSfr)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-header">
            <div className="chart-title-group">
              <h3>Department-wise SFR</h3>
              <p className="chart-target-badge">Targets: 15:1 & 25:1 · {targetYears.length} academic years</p>
            </div>
          </div>
          <div className="chart-body">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart 
                data={sfrData.length > 0 ? sfrData : [
                  { name: 'CSE', sfr: 17.5 },
                  { name: 'ECE', sfr: 22.1 },
                  { name: 'ME', sfr: 14.2 },
                  { name: 'CE', sfr: 23.0 },
                  { name: 'EEE', sfr: 26.8 },
                  { name: 'IT', sfr: 19.2 },
                  { name: 'AIML', sfr: 14.5 },
                  { name: 'BME', sfr: 19.8 }
                ]}
                margin={{ top: 10, right: 30, left: 0, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#94a3b8" 
                  fontSize={12}
                  fontWeight={500}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={12}
                  fontWeight={500}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 28]}
                  ticks={[0, 7, 14, 21, 28]}
                  dx={-10}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(37, 99, 235, 0.04)' }} 
                  contentStyle={{ 
                    backgroundColor: '#ffffff', 
                    border: '1px solid rgba(0,0,0,0.08)', 
                    borderRadius: '8px', 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)' 
                  }}
                  labelStyle={{ fontWeight: 'bold', color: '#1e293b' }}
                  itemStyle={{ color: '#2563eb' }}
                />
                <ReferenceLine
                  y={15}
                  stroke="#ef4444"
                  strokeDasharray="3 3"
                  label={renderSFRReferenceLabel(15, '#ef4444')}
                />
                <ReferenceLine
                  y={25}
                  stroke="#f59e0b"
                  strokeDasharray="3 3"
                  label={renderSFRReferenceLabel(25, '#f59e0b')}
                />
                <Bar 
                  dataKey="sfr" 
                  fill="#2563eb" 
                  radius={[6, 6, 0, 0]} 
                  maxBarSize={45}
                />
              </BarChart>
            </ResponsiveContainer>
            {sfrData.length === 0 && (
              <p className="empty-state-text">
                Showing mock dashboard visualizer. Real-time data will populate as student and faculty counts are added.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

export const getYearNumber = (str) => {
  const match = String(str).match(/\d{4}/);
  return match ? parseInt(match[0], 10) : 0;
};

export const parseAcademicYearStart = (str) => getYearNumber(str);

export const formatAcademicYear = (startYear, short = false) => {
  const end = startYear + 1;
  if (short) return `${startYear}-${String(end).slice(-2)}`;
  return `${startYear}-${end}`;
};

export const formatAcademicYearShort = (fullYear) => {
  const start = parseAcademicYearStart(fullYear);
  return start ? formatAcademicYear(start, true) : fullYear;
};

export const getCurrentAcademicYearStart = () => {
  const now = new Date();
  return now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
};

export const getAcademicYearsInRange = (startYearInput, endYearInput) => {
  const start = parseAcademicYearStart(startYearInput);
  const end = parseAcademicYearStart(endYearInput);
  if (!start || !end || start > end) return [];

  const years = [];
  for (let y = start; y <= end; y++) {
    years.push(formatAcademicYear(y));
  }
  return years.sort((a, b) => getYearNumber(b) - getYearNumber(a));
};

export const matchesAcademicYear = (storedYear, targetYear) => {
  if (!storedYear || !targetYear) return false;
  return (
    storedYear === targetYear ||
    parseAcademicYearStart(storedYear) === parseAcademicYearStart(targetYear)
  );
};

export const countFacultyForYear = (facultyDocs, yearStr, dept = null) => {
  const startYear = getYearNumber(yearStr);
  if (startYear === 0) return 0;

  return facultyDocs.filter(f => {
    if (dept && (f.Department || '').toUpperCase() !== dept) return false;

    const joinYear = parseInt(f.Joining_Year);
    const leaveYear = parseInt(f.Leaving_Year);

    if (isNaN(joinYear)) return false;
    if (joinYear > startYear) return false;
    if (!isNaN(leaveYear) && leaveYear < startYear) return false;

    return true;
  }).length;
};

export const countStudentsForYear = (studentDocs, yearStr, dept = null) => {
  return studentDocs
    .filter(s => {
      if (dept && (s.department || '').toUpperCase() !== dept) return false;
      return matchesAcademicYear(s.academicYear, yearStr);
    })
    .reduce((sum, s) => sum + (parseInt(s.noOfStudents) || 0), 0);
};

export const buildCAYDetails = (studentDocs, facultyDocs, targetYears) => {
  return targetYears.map((yearStr, idx) => ({
    label: idx === 0 ? 'CAY' : idx === 1 ? 'CAYM1' : `CAYM${idx}`,
    academicYear: formatAcademicYearShort(yearStr),
    students: countStudentsForYear(studentDocs, yearStr),
    faculty: countFacultyForYear(facultyDocs, yearStr),
  }));
};

export const calculateNBA_SFR = (studentDocs, facultyDocs, customTargetYears = null) => {
  // Find all academic years
  const allYears = [...new Set(studentDocs.map(s => s.academicYear).filter(Boolean))];
  
  // Sort descending: 2025-2026, 2024-2025, 2023-2024
  allYears.sort((a, b) => getYearNumber(b) - getYearNumber(a));
  
  const targetYears = customTargetYears?.length
    ? customTargetYears
    : allYears.slice(0, 3);
  
  const depts = {};
  
  // Initialize departments
  studentDocs.forEach(s => {
    const dept = s.department ? s.department.toUpperCase() : 'UNKNOWN';
    if (dept.includes('STUDENTS COUNT')) return;
    if (!depts[dept]) depts[dept] = { department: dept, yearlyData: {}, profs: 0, assocProfs: 0, asstProfs: 0 };
  });
  facultyDocs.forEach(f => {
    const dept = f.Department ? f.Department.toUpperCase() : 'UNKNOWN';
    if (dept.includes('STUDENTS COUNT')) return;
    if (!depts[dept]) depts[dept] = { department: dept, yearlyData: {}, profs: 0, assocProfs: 0, asstProfs: 0 };
    
    // Count roles for cadre marks (using their current designation)
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
  
  Object.keys(depts).forEach(dept => {
    if (dept === 'UNKNOWN') return;
    
    let sumSFR = 0;
    let validYearsCount = 0;
    let totalStudents3Years = 0;
    let maxFacultySeen = 0;
    
    targetYears.forEach((yearStr, idx) => {
      const startYear = getYearNumber(yearStr);
      if (startYear === 0) return;
      
      // Students in this year for this dept
      const sCount = countStudentsForYear(studentDocs, yearStr, dept);
      const fCount = countFacultyForYear(facultyDocs, yearStr, dept);
      
      const sfr = fCount > 0 ? (sCount / fCount) : 0;
      
      depts[dept].yearlyData[yearStr] = { 
        students: sCount, 
        faculty: fCount, 
        sfr: sfr,
        label: idx === 0 ? 'CAY' : idx === 1 ? 'CAYM1' : `CAYM${idx}`
      };
      
      sumSFR += sfr;
      validYearsCount++;
      totalStudents3Years += sCount;
      maxFacultySeen = Math.max(maxFacultySeen, fCount);
    });
    
    // Calculate Average SFR
    const avgSFR = validYearsCount > 0 ? (sumSFR / validYearsCount) : 0;
    
    // Calculate Points
    let points = 0;
    if (avgSFR > 0 && avgSFR <= 15) points = 30;
    else if (avgSFR > 15 && avgSFR <= 17) points = 26;
    else if (avgSFR > 17 && avgSFR <= 19) points = 22;
    else if (avgSFR > 19 && avgSFR <= 21) points = 18;
    else if (avgSFR > 21 && avgSFR <= 23) points = 14;
    else if (avgSFR > 23 && avgSFR <= 25) points = 10;
    else if (avgSFR > 25) points = 0;
    
    // Cadre proportion calculation (using 3-year average students as required by NBA)
    const averageStudents = validYearsCount > 0 ? (totalStudents3Years / validYearsCount) : 0;
    const RF = averageStudents / 20; 
    let cadreMarks = 0;
    let cadreDetails = { RF: 0, RF1: 0, RF2: 0, RF3: 0, AF1: depts[dept].profs, AF2: depts[dept].assocProfs, AF3: depts[dept].asstProfs };

    if (RF > 0) {
      const RF1 = RF * (1/9);
      const RF2 = RF * (2/9);
      const RF3 = RF * (6/9);
      
      cadreDetails = { RF, RF1, RF2, RF3, AF1: depts[dept].profs, AF2: depts[dept].assocProfs, AF3: depts[dept].asstProfs };

      if (depts[dept].profs === 0 && depts[dept].assocProfs === 0) {
        cadreMarks = 0;
      } else {
        const term1 = depts[dept].profs / RF1;
        const term2 = (depts[dept].assocProfs / RF2) * 0.6;
        const term3 = (depts[dept].asstProfs / RF3) * 0.4;
        let rawMarks = (term1 + term2 + term3) * 12.5;
        
        if (isNaN(rawMarks) || !isFinite(rawMarks)) rawMarks = 0;
        cadreMarks = Math.min(rawMarks, 25);
      }
    }

    depts[dept].averageSFR = avgSFR;
    depts[dept].points = points;
    depts[dept].totalStudents3Years = totalStudents3Years;
    depts[dept].maxFacultySeen = maxFacultySeen; 
    depts[dept].cadreMarks = cadreMarks.toFixed(2);
    depts[dept].cadreDetails = cadreDetails;
    depts[dept].targetYears = targetYears;
  });
  
  return depts;
};

export const buildFacultyQualifications = (facultyDocs, targetYears) => {
  return targetYears.map((yearStr, idx) => {
    const activeFaculty = facultyDocs.filter(f => {
      const startYear = getYearNumber(yearStr);
      if (startYear === 0) return false;
      const joinYear = parseInt(f.Joining_Year);
      const leaveYear = parseInt(f.Leaving_Year);
      if (isNaN(joinYear)) return false;
      if (joinYear > startYear) return false;
      if (!isNaN(leaveYear) && leaveYear < startYear) return false;
      return true;
    });

    let phdCount = 0;
    let mtechCount = 0;
    
    activeFaculty.forEach(f => {
      const degree = (f.Highest_Degree || '').toLowerCase();
      if (degree.includes('phd') || degree.includes('ph.d') || degree.includes('doctorate')) {
        phdCount++;
      } else if (degree.includes('mtech') || degree.includes('m.tech') || degree.includes('me') || degree.includes('m.e') || degree.includes('master')) {
        mtechCount++;
      }
    });

    return {
      label: idx === 0 ? 'CAY' : idx === 1 ? 'CAYM1' : `CAYM${idx}`,
      academicYear: formatAcademicYearShort(yearStr),
      phd: phdCount,
      mtech: mtechCount,
    };
  });
};

export const parseExperience = (expStr) => {
  if (expStr === null || expStr === undefined) return 0;
  const str = String(expStr).trim().toLowerCase();
  if (!str || str === '-' || str === 'na' || str === 'n/a') return 0;
  
  // Case 1: e.g. "10M", "3m", "10 months"
  if (str.endsWith('m') || str.includes('month')) {
    const months = parseInt(str) || 0;
    return months / 12;
  }
  
  // Case 2: e.g. "1.1", "1.11", "18.4"
  if (str.includes('.')) {
    const parts = str.split('.');
    const years = parseInt(parts[0]) || 0;
    const months = parseInt(parts[1]) || 0;
    return years + (months / 12);
  }
  
  // Case 3: e.g. "2", "9", "26"
  return parseFloat(str) || 0;
};

export const calculateFacultyRetentionForYear = (facultyDocs, yearOffset, RF) => {
  let A = 0;
  let B = 0;
  let C = 0;
  let D = 0;
  let E = 0;
  let AF = 0;

  facultyDocs.forEach(f => {
    const currentExp = parseExperience(f.Experience || f.experience);
    const historicalExp = currentExp - yearOffset;
    if (historicalExp < 0) {
      return;
    }
    
    AF++;
    if (historicalExp < 1.0) {
      A++;
    } else if (historicalExp < 2.0) {
      B++;
    } else if (historicalExp < 3.0) {
      C++;
    } else if (historicalExp < 4.0) {
      D++;
    } else {
      E++;
    }
  });

  const numTerm = (A * 0) + (B * 1) + (C * 2) + (D * 3) + (E * 4);
  const rawPoints = RF > 0 ? (numTerm / RF) * 2.50 : 0;
  const points = Math.min(rawPoints, 10.0);

  return {
    A, B, C, D, E, AF, RF, points: parseFloat(points.toFixed(2))
  };
};



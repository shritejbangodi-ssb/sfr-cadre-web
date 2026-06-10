export const getYearNumber = (str) => {
  const match = String(str).match(/\d{4}/);
  return match ? parseInt(match[0], 10) : 0;
};

export const calculateNBA_SFR = (studentDocs, facultyDocs) => {
  // Find all academic years
  const allYears = [...new Set(studentDocs.map(s => s.academicYear).filter(Boolean))];
  
  // Sort descending: 2025-2026, 2024-2025, 2023-2024
  allYears.sort((a, b) => getYearNumber(b) - getYearNumber(a));
  
  // We only care about the latest 3 years for NBA format
  const targetYears = allYears.slice(0, 3);
  
  const depts = {};
  
  // Initialize departments
  studentDocs.forEach(s => {
    const dept = s.department ? s.department.toUpperCase() : 'UNKNOWN';
    if (!depts[dept]) depts[dept] = { department: dept, yearlyData: {}, profs: 0, assocProfs: 0, asstProfs: 0 };
  });
  facultyDocs.forEach(f => {
    const dept = f.Department ? f.Department.toUpperCase() : 'UNKNOWN';
    if (!depts[dept]) depts[dept] = { department: dept, yearlyData: {}, profs: 0, assocProfs: 0, asstProfs: 0 };
    
    // Count roles for cadre marks (using their current designation)
    const designation = (f.Designation || '').toLowerCase();
    if (designation.includes('assistant')) depts[dept].asstProfs++;
    else if (designation.includes('associate')) depts[dept].assocProfs++;
    else if (designation.includes('professor') || designation.includes('prof')) depts[dept].profs++;
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
      const sCount = studentDocs
        .filter(s => (s.department || '').toUpperCase() === dept && s.academicYear === yearStr)
        .reduce((sum, s) => sum + (parseInt(s.noOfStudents) || 0), 0);
        
      // Faculty active in this year for this dept
      const fCount = facultyDocs.filter(f => {
        if ((f.Department || '').toUpperCase() !== dept) return false;
        
        const joinYear = parseInt(f.Joining_Year);
        const leaveYear = parseInt(f.Leaving_Year);
        
        // **Compulsory rule**: If no valid joining year, they do not count.
        if (isNaN(joinYear)) return false; 
        
        // Did they join after this academic year started?
        if (joinYear > startYear) return false; 
        
        // Did they leave before this academic year started?
        if (!isNaN(leaveYear) && leaveYear < startYear) return false; 
        
        return true;
      }).length;
      
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

const dotenvPath = require('fs').existsSync('.env.production') ? '.env.production' : '.env';
require('dotenv').config({ path: dotenvPath });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mobilise_payroll_v3');
  console.log('Connected');

  // Clear all
  for (const key in mongoose.connection.collections) await mongoose.connection.collections[key].deleteMany({});
  console.log('Cleared');

  const User = require('../src/models/User');
  const Entity = require('../src/models/Entity');
  const Employee = require('../src/models/Employee');
  const { StatutoryConfig, Holiday, Loan } = require('../src/models/Models');
  const Role = require('../src/models/Role');
  const Permission = require('../src/models/Permission');
  const AuditLog = require('../src/models/AuditLogV2');
  const { SalaryHead, SalaryTemplate, EmployeeSalary, MinimumWage, GeoState, GeoCity } = require('../src/models/SalaryModels');

  // ===== ENTITIES =====
  const mallEntity = await Entity.create({
    code: 'MALL', name: 'Mobilise App Lab Limited', legalName: 'Mobilise App Lab Limited',
    type: 'PRIVATE_LIMITED',
    address: { line1: 'Plot No. 62/B, HSIIDC', line2: 'Sector 31', city: 'Faridabad', state: 'Haryana', pincode: '121006' },
    phone: '+91-9599194330',
    bankDetails: { bankName: 'HDFC Bank', accountName: 'Mobilise App Lab Limited', branchName: 'Faridabad Sector 31 Branch', ifscCode: 'HDFC0001234' },
    signatories: [{ name: 'Director', designation: 'Director', isPrimary: true }],
  });

  const mieEntity = await Entity.create({
    code: 'MIE', name: 'Mobilise IE', legalName: 'Mobilise IE',
    type: 'IE_UNIT',
    address: { line1: 'Plot No. 62/B, HSIIDC', line2: 'Sector 31', city: 'Faridabad', state: 'Haryana', pincode: '121006' },
    phone: '+91-9599194330',
    bankDetails: { bankName: 'HDFC Bank', accountName: 'Mobilise IE', branchName: 'Faridabad Sector 31 Branch', ifscCode: 'HDFC0001235' },
    signatories: [{ name: 'Director', designation: 'Director', isPrimary: true }],
  });
  console.log('Created 2 entities: MALL, MIE');

  const bothEntities = [mallEntity._id, mieEntity._id];

  // ===== USERS =====
  // Super Admin + Admin roles
  await User.create([
    { username: 'admin', email: 'admin@mobiliseapps.com', password: 'Admin@1234', firstName: 'Ashish', lastName: 'Admin', role: 'SUPER_ADMIN', entities: bothEntities, activeEntity: mallEntity._id },
    { username: 'hr', email: 'hr@mobiliseapps.com', password: 'Hr@12345', firstName: 'HR', lastName: 'Admin', role: 'HR', entities: bothEntities, activeEntity: mallEntity._id },
    { username: 'finance', email: 'finance@mobiliseapps.com', password: 'Finance@1234', firstName: 'Finance', lastName: 'Head', role: 'FINANCE', entities: bothEntities, activeEntity: mallEntity._id },
  ]);

  // Load employee data for user creation
  const empDataForUsers = JSON.parse(fs.readFileSync(path.join(__dirname, 'employee_data.json'), 'utf-8'));
  let empUserCount = 0;
  const managerCode = 'MLP093'; // Akash Kumar as manager

  for (const e of empDataForUsers) {
    if (!e.code || e.code.trim() === '') continue;
    const nameParts = e.name.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');
    const role = e.code === managerCode ? 'MANAGER' : 'EMPLOYEE';
    const username = e.code.toLowerCase();
    try {
      await User.create({
        username,
        email: `${username}@mobiliseapps.com`,
        password: 'Emp@1234',
        firstName,
        lastName,
        role,
        entities: [mallEntity._id],
        activeEntity: mallEntity._id,
        empCode: e.code,
        isActive: true,
      });
      empUserCount++;
    } catch (err) {
      // Skip duplicates silently
    }
  }
  console.log(`Created ${empUserCount} employee user accounts`);
  console.log(`Manager: ${managerCode} (mlp093 / Emp@1234)`);

  // ===== STATUTORY =====
  await StatutoryConfig.insertMany([
    { type: 'PF', name: 'EPF Configuration', employeeRate: 12, employerRate: 12, wageCeiling: 15000, subRates: { epfEmployer: 3.67, epsEmployer: 8.33, edliEmployer: 0.5, adminCharges: 0.5, epsCeiling: 15000 }, effectiveFrom: new Date('2024-04-01'), isActive: true },
    { type: 'ESI', name: 'ESI Configuration', employeeRate: 0.75, employerRate: 3.25, wageCeiling: 21000, effectiveFrom: new Date('2024-04-01'), isActive: true },
    { type: 'PT', name: 'Professional Tax - Haryana', state: 'HARYANA', slabs: [{ minAmount: 0, maxAmount: 15000, rate: 0 }, { minAmount: 15001, maxAmount: 20000, rate: 150 }, { minAmount: 20001, maxAmount: 99999999, rate: 200 }], effectiveFrom: new Date('2024-04-01'), isActive: true },
    { type: 'LWF', name: 'LWF Haryana', fixedEmployeeAmount: 25, fixedEmployerAmount: 75, applicableMonths: [6, 12], effectiveFrom: new Date('2024-04-01'), isActive: true },
    { type: 'TAX_NEW', name: 'New Tax Regime', standardDeduction: 75000, rebateLimit: 700000, rebateAmount: 25000, cessRate: 4, slabs: [{ minAmount: 0, maxAmount: 300000, rate: 0 }, { minAmount: 300001, maxAmount: 700000, rate: 5 }, { minAmount: 700001, maxAmount: 1000000, rate: 10 }, { minAmount: 1000001, maxAmount: 1200000, rate: 15 }, { minAmount: 1200001, maxAmount: 1500000, rate: 20 }, { minAmount: 1500001, maxAmount: 99999999, rate: 30 }], effectiveFrom: new Date('2025-04-01'), isActive: true },
  ]);
  console.log('Created statutory configs');

  // ===== EMPLOYEES =====
  const empData = JSON.parse(fs.readFileSync(path.join(__dirname, 'employee_data.json'), 'utf-8'));
  const employees = empData.map((e, i) => {
    const nameParts = e.name.trim().split(/\s+/);
    const isIntern = e.type === 'INTERN';
    return {
      empCode: e.code || `TEMP${String(i + 1).padStart(3, '0')}`,
      entity: mallEntity._id, entityCode: 'MALL',
      firstName: nameParts[0], lastName: nameParts.slice(1).join(' '),
      email: e.code ? `${e.code.toLowerCase()}@mobiliseapps.com` : '',
      department: isIntern ? 'Intern' : 'Engineering',
      designation: e.designation || (isIntern ? 'Intern' : 'Engineer'),
      grade: e.grade || '', role: e.role || '',
      employmentType: isIntern ? 'Intern' : 'Permanent',
      basicSalary: e.basic, hra: e.hra, conveyanceAndOthers: e.cov, totalMonthlySalary: e.total,
      pfApplicable: e.pf_applicable, esiApplicable: e.esi_applicable, tdsAmount: e.tds || 0,
      paymentMode: e.payment_mode === 'NEFT' ? 'NEFT' : 'TR',
      workLocation: 'Faridabad', status: 'Active',
      dateOfJoining: new Date(2023, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
    };
  });
  await Employee.insertMany(employees);
  console.log(`Created ${employees.length} employees (MALL entity)`);

  // Loans
  const loanEmps = empData.filter(e => e.loan_total > 0);
  for (const e of loanEmps) {
    const tenure = e.loan_total > 100000 ? 24 : 12;
    const schedule = [];
    for (let m = 1; m <= tenure; m++) {
      const mm = ((1 + m) % 12) + 1, yy = 2026 + Math.floor((1 + m) / 12);
      schedule.push({ month: mm, year: yy, emiAmount: e.loan_this_month, status: m <= 2 ? 'DEDUCTED' : 'PENDING' });
    }
    await Loan.create({ loanId: `LN-${e.code}`, empCode: e.code, employeeName: e.name, entity: mallEntity._id, loanType: e.loan_total > 100000 ? 'PERSONAL_LOAN' : 'SALARY_ADVANCE', amount: e.loan_total, tenure, emiAmount: e.loan_this_month, outstandingBalance: e.loan_balance, totalPaid: e.loan_total - e.loan_balance, status: 'ACTIVE', schedule });
  }
  console.log(`Created ${loanEmps.length} active loans`);

  // Holidays
  const hols = [['2026-01-26', 'Republic Day'], ['2026-03-10', 'Holi'], ['2026-04-14', 'Ambedkar Jayanti'], ['2026-05-01', 'May Day'], ['2026-08-15', 'Independence Day'], ['2026-10-02', 'Gandhi Jayanti'], ['2026-10-21', 'Dussehra'], ['2026-11-10', 'Diwali'], ['2026-12-25', 'Christmas']];
  for (const [d, n] of hols) await Holiday.create({ date: new Date(d), name: n, type: 'NATIONAL', year: 2026, entity: mallEntity._id });
  console.log(`Created ${hols.length} holidays`);

  // Master Data
  const MasterData = require('../src/models/MasterData');
  const masters = [
    // Departments
    ...'Engineering,Product,Design,QA,DevOps,HR,Finance,Admin,Operations,Intern'.split(',').map((n, i) => ({ category: 'DEPARTMENT', code: n.toUpperCase(), name: n, sortOrder: i })),
    // Grades
    ...['A1:Junior Engineer', 'A2:Engineer', 'A3:Senior Engineer', 'B1:Assistant Manager', 'B2:Manager', 'B3:Senior Manager', 'C1:AVP', 'C2:VP', 'C3:Director'].map((g, i) => { const [code, name] = g.split(':'); return { category: 'GRADE', code, name, sortOrder: i, metadata: { level: i + 1 } }; }),
    // Employment Types
    ...['Permanent:Regular full-time', 'Contract:Fixed-term contract', 'Intern:Internship/Training', 'Consultant:External consultant'].map((t, i) => { const [code, desc] = t.split(':'); return { category: 'EMPLOYMENT_TYPE', code: code.toUpperCase(), name: code, description: desc, sortOrder: i }; }),
    // Leave Types
    ...['CL:Casual Leave:12:true:false', 'SL:Sick Leave:7:true:false', 'EL:Earned Leave:15:true:true', 'CO:Comp Off:0:true:false', 'LWP:Leave Without Pay:0:false:false', 'ML:Maternity Leave:182:true:false', 'PL:Paternity Leave:5:true:false'].map((l, i) => {
      const [code, name, maxDays, paid, carryForward] = l.split(':');
      return { category: 'LEAVE_TYPE', code, name, sortOrder: i, metadata: { maxDaysPerYear: parseInt(maxDays), isPaid: paid === 'true', carryForward: carryForward === 'true' } };
    }),
    // Loan Types
    ...['SALARY_ADVANCE:Salary Advance:Up to 2x monthly salary', 'PERSONAL_LOAN:Personal Loan:For personal needs', 'EMERGENCY_LOAN:Emergency Loan:Medical or urgent needs', 'FESTIVAL_ADVANCE:Festival Advance:Festival season advance'].map((l, i) => { const [code, name, desc] = l.split(':'); return { category: 'LOAN_TYPE', code, name, description: desc, sortOrder: i }; }),
    // Payment Modes
    ...['TR:HDFC Transfer (A2A)', 'NEFT:NEFT Transfer', 'RTGS:RTGS Transfer', 'CHEQUE:Cheque Payment'].map((p, i) => { const [code, name] = p.split(':'); return { category: 'PAYMENT_MODE', code, name, sortOrder: i }; }),
    // Locations
    ...['FARIDABAD:Faridabad Office', 'REMOTE:Work From Home', 'CLIENT:Client Location'].map((l, i) => { const [code, name] = l.split(':'); return { category: 'LOCATION', code, name, sortOrder: i }; }),
    // Document Types
    ...['AADHAAR:Aadhaar Card', 'PAN:PAN Card', 'PASSPORT:Passport', 'VOTER_ID:Voter ID', 'DL:Driving License', 'BANK_PROOF:Bank Account Proof', 'ADDRESS_PROOF:Address Proof', 'EDUCATION:Education Certificate', 'EXPERIENCE:Experience Letter', 'OFFER_LETTER:Offer Letter', 'RELIEVING:Relieving Letter'].map((d, i) => { const [code, name] = d.split(':'); return { category: 'DOCUMENT_TYPE', code, name, sortOrder: i }; }),
    // Designations
    ...'Junior Engineer,Engineer,Senior Engineer,Lead Engineer,Assistant Manager,Manager,Senior Manager,AVP,Vice President,Director'.split(',').map((n, i) => ({ category: 'DESIGNATION', code: n.toUpperCase().replace(/ /g, '_'), name: n, sortOrder: i })),
    // Holiday Types
    ...['NATIONAL:National Holiday', 'STATE:State Holiday', 'COMPANY:Company Holiday', 'RESTRICTED:Restricted Holiday'].map((h, i) => { const [code, name] = h.split(':'); return { category: 'HOLIDAY_TYPE', code, name, sortOrder: i }; }),
    // Shifts
    ...['GENERAL:General Shift (9:30-18:30)', 'MORNING:Morning Shift (6:00-14:00)', 'EVENING:Evening Shift (14:00-22:00)', 'NIGHT:Night Shift (22:00-06:00)'].map((s, i) => { const [code, name] = s.split(':'); return { category: 'SHIFT', code, name, sortOrder: i }; }),
  ];
  await MasterData.insertMany(masters);
  console.log(`Created ${masters.length} master data records across ${[...new Set(masters.map(m => m.category))].length} categories`);

  // ===== PHASE 0: ROLES =====
  await Role.insertMany([
    { code: 'SUPER_ADMIN', name: 'Super Administrator', description: 'Full system access', level: 100, isSystem: true, color: '#DC2626' },
    { code: 'HR', name: 'HR Manager', description: 'Payroll maker, employee management', level: 80, isSystem: true, color: '#1A6FB5' },
    { code: 'FINANCE', name: 'Finance Manager', description: 'Payroll approver, statutory', level: 80, isSystem: true, color: '#059669' },
    { code: 'MANAGER', name: 'Team Manager', description: 'Team approvals', level: 50, isSystem: true, color: '#D97706' },
    { code: 'EMPLOYEE', name: 'Employee', description: 'Self-service portal', level: 10, isSystem: true, color: '#64748B' },
  ]);
  console.log('Created 5 system roles');

  // Permissions
  const MODULES = ['employees','payroll','loans','attendance','leaves','compoff','bank','reports','statutory','config','masters','users','audit','salary_structure'];
  const pd = [];
  for (const m of MODULES) {
    pd.push({ roleCode:'HR', module:m, create:['employees','attendance','leaves','compoff','masters','salary_structure','payroll','bank'].includes(m), read:true, update:['employees','attendance','leaves','compoff','masters','salary_structure','config','loans'].includes(m), delete:['employees','attendance','compoff','masters'].includes(m), approve:['leaves','compoff'].includes(m), export:['payroll','bank','reports'].includes(m), viewSalary:['employees','payroll','reports','salary_structure'].includes(m), viewPII:['employees'].includes(m) });
    pd.push({ roleCode:'FINANCE', module:m, create:['statutory','config'].includes(m), read:['employees','payroll','loans','bank','reports','statutory','config','audit'].includes(m), update:['statutory','config'].includes(m), delete:false, approve:['payroll','loans','bank'].includes(m), export:['payroll','bank','reports'].includes(m), viewSalary:['employees','payroll','reports','loans'].includes(m), viewPII:['employees'].includes(m) });
    pd.push({ roleCode:'MANAGER', module:m, create:['attendance','leaves','compoff'].includes(m), read:['employees','attendance','leaves','compoff','loans'].includes(m), update:false, delete:false, approve:['attendance','leaves','compoff','loans'].includes(m), export:false, viewSalary:false, viewPII:false });
    pd.push({ roleCode:'EMPLOYEE', module:m, create:['leaves','compoff','loans'].includes(m), read:['employees','attendance','leaves','compoff','loans','payroll','reports'].includes(m), update:false, delete:false, approve:false, export:false, viewSalary:['employees','payroll'].includes(m), viewPII:['employees'].includes(m) });
  }
  await Permission.insertMany(pd);
  console.log(`Created ${pd.length} permission records`);

  // ===== SALARY HEADS =====
  const heads = await SalaryHead.insertMany([
    { code:'BASIC', name:'Basic Salary', type:'EARNING', isTaxable:true, isPFApplicable:true, isESIApplicable:true, isPartOfGross:true, calculationType:'FIXED', sortOrder:1 },
    { code:'HRA', name:'House Rent Allowance', type:'EARNING', isTaxable:true, isPFApplicable:false, isESIApplicable:true, isPartOfGross:true, calculationType:'PERCENTAGE', percentageOf:'BASIC', defaultPercentage:40, sortOrder:2 },
    { code:'CONV', name:'Conveyance & Others', type:'EARNING', isTaxable:true, isPFApplicable:false, isESIApplicable:true, isPartOfGross:true, calculationType:'FIXED', sortOrder:3 },
    { code:'SPECIAL', name:'Special Allowance', type:'EARNING', isTaxable:true, isPFApplicable:false, isESIApplicable:true, isPartOfGross:true, calculationType:'FIXED', sortOrder:4 },
    { code:'MEDICAL', name:'Medical Allowance', type:'EARNING', isTaxable:true, isPFApplicable:false, isESIApplicable:false, isPartOfGross:true, calculationType:'FIXED', sortOrder:5 },
    { code:'LTA', name:'Leave Travel Allowance', type:'EARNING', isTaxable:false, isPFApplicable:false, isESIApplicable:false, isPartOfGross:false, calculationType:'FIXED', sortOrder:6 },
  ]);
  console.log(`Created ${heads.length} salary heads`);

  // Salary Template
  const [basicH,hraH,convH] = [heads.find(h=>h.code==='BASIC'), heads.find(h=>h.code==='HRA'), heads.find(h=>h.code==='CONV')];
  const tmpl = await SalaryTemplate.create({
    name:'Mobilise Standard', code:'MOBILISE_STD', entity:mallEntity._id,
    description:'Basic + HRA + Conveyance & Others',
    heads:[
      { headId:basicH._id, headCode:'BASIC', headName:'Basic Salary', headType:'EARNING', isRequired:true, sortOrder:1 },
      { headId:hraH._id, headCode:'HRA', headName:'House Rent Allowance', headType:'EARNING', defaultPercentage:40, sortOrder:2 },
      { headId:convH._id, headCode:'CONV', headName:'Conveyance & Others', headType:'EARNING', sortOrder:3 },
    ],
    isDefault:true
  });
  console.log('Created MOBILISE_STD template');

  // Geo States
  const stArr=[['AN','Andaman & Nicobar',true],['AP','Andhra Pradesh',false],['AR','Arunachal Pradesh',false],['AS','Assam',false],['BR','Bihar',false],['CH','Chandigarh',true],['CG','Chhattisgarh',false],['DL','Delhi',true],['GA','Goa',false],['GJ','Gujarat',false],['HR','Haryana',false],['HP','Himachal Pradesh',false],['JK','Jammu & Kashmir',true],['JH','Jharkhand',false],['KA','Karnataka',false],['KL','Kerala',false],['LA','Ladakh',true],['MP','Madhya Pradesh',false],['MH','Maharashtra',false],['MN','Manipur',false],['ML','Meghalaya',false],['MZ','Mizoram',false],['NL','Nagaland',false],['OD','Odisha',false],['PB','Punjab',false],['PY','Puducherry',true],['RJ','Rajasthan',false],['SK','Sikkim',false],['TN','Tamil Nadu',false],['TS','Telangana',false],['TR','Tripura',false],['UP','Uttar Pradesh',false],['UK','Uttarakhand',false],['WB','West Bengal',false]];
  await GeoState.insertMany(stArr.map(([code,name,isUT])=>({code,name,country:'IN',isUT,isActive:true,ptApplicable:['KA','MH','WB','AP','TS','GJ','MP','OD','CG','JH','AS'].includes(code),lwfApplicable:['HR','DL','MH','KA','GJ','WB','CG'].includes(code)})));
  console.log(`Created ${stArr.length} states`);

  // Cities
  const cArr=[['Faridabad','HR','A',true],['Gurugram','HR','A',true],['Delhi','DL','A',true],['Noida','UP','A',true],['Mumbai','MH','A',true],['Pune','MH','A',true],['Bangalore','KA','A',true],['Hyderabad','TS','A',true],['Chennai','TN','A',true],['Kolkata','WB','A',true],['Ahmedabad','GJ','A',true],['Jaipur','RJ','A',true],['Lucknow','UP','B',false],['Chandigarh','CH','A',true],['Indore','MP','B',false]];
  await GeoCity.insertMany(cArr.map(([name,stateCode,zone,isMetro])=>({name,stateCode,stateName:stArr.find(s=>s[0]===stateCode)?.[1]||'',zone,isMetro,isActive:true})));
  console.log(`Created ${cArr.length} cities`);

  // Minimum Wages
  await MinimumWage.insertMany([
    { stateCode:'HR',stateName:'Haryana',category:'UNSKILLED',zone:'A',minimumMonthly:10348,basicComponent:7488,vdaComponent:2860,effectiveFrom:new Date('2024-07-01'),isActive:true },
    { stateCode:'HR',stateName:'Haryana',category:'SEMI_SKILLED',zone:'A',minimumMonthly:11348,basicComponent:8248,vdaComponent:3100,effectiveFrom:new Date('2024-07-01'),isActive:true },
    { stateCode:'HR',stateName:'Haryana',category:'SKILLED',zone:'A',minimumMonthly:12498,basicComponent:9048,vdaComponent:3450,effectiveFrom:new Date('2024-07-01'),isActive:true },
    { stateCode:'HR',stateName:'Haryana',category:'HIGHLY_SKILLED',zone:'A',minimumMonthly:13698,basicComponent:9948,vdaComponent:3750,effectiveFrom:new Date('2024-07-01'),isActive:true },
    { stateCode:'DL',stateName:'Delhi',category:'UNSKILLED',zone:'A',minimumMonthly:17494,basicComponent:17494,vdaComponent:0,effectiveFrom:new Date('2024-10-01'),isActive:true },
    { stateCode:'DL',stateName:'Delhi',category:'SKILLED',zone:'A',minimumMonthly:19279,basicComponent:19279,vdaComponent:0,effectiveFrom:new Date('2024-10-01'),isActive:true },
  ]);
  console.log('Created minimum wages for Haryana + Delhi');

  // Employee Salary Migration
  const allEmps = await Employee.find({ entity: mallEntity._id });
  let mig = 0;
  for (const emp of allEmps) {
    if (!emp.empCode) continue;
    const comps = [
      { headId:basicH._id, headCode:'BASIC', headName:'Basic Salary', headType:'EARNING', amount:emp.basicSalary||0, isTaxable:true, isPFApplicable:true, isESIApplicable:true, isPartOfGross:true },
      { headId:hraH._id, headCode:'HRA', headName:'House Rent Allowance', headType:'EARNING', amount:emp.hra||0, isTaxable:true, isPFApplicable:false, isESIApplicable:true, isPartOfGross:true },
      { headId:convH._id, headCode:'CONV', headName:'Conveyance & Others', headType:'EARNING', amount:emp.conveyanceAndOthers||0, isTaxable:true, isPFApplicable:false, isESIApplicable:true, isPartOfGross:true },
    ];
    const tot = comps.reduce((s,c) => s + c.amount, 0);
    await EmployeeSalary.create({ empCode:emp.empCode, entity:mallEntity._id, templateId:tmpl._id, templateCode:'MOBILISE_STD', components:comps, totalMonthly:tot, totalAnnual:tot*12, pfWage:emp.basicSalary||0, esiWage:tot, grossSalary:tot, effectiveFrom:emp.dateOfJoining||new Date('2024-01-01'), isActive:true });
    mig++;
  }
  console.log(`Migrated ${mig} employees to dynamic salary structure`);

  await AuditLog.create({ module:'system', action:'SEED', actionDetail:'Database seeded', userName:'System', userRole:'SYSTEM' });

  console.log('\n\u2705 v4 Seed complete!\n');
  console.log('Admin: admin / Admin@1234 | HR: hr / Hr@12345 | Finance: finance / Finance@1234');
  console.log('Manager: mlp093 / Emp@1234 | Employees: <empcode> / Emp@1234');

  await mongoose.disconnect();
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });

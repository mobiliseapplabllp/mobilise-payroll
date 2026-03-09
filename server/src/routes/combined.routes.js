const express = require('express');
const Entity = require('../models/Entity');
const Employee = require('../models/Employee');
const { Attendance, MonthlySummary, PayrollRun, PayrollDetail, StatutoryConfig, CompOff, Holiday, LeaveBalance, AuditLog, BankFile, Loan } = require('../models/Models');
const { authenticate, authorize, entityScope, auditLog } = require('../middleware/auth');
const multer = require('multer');
const Papa = require('papaparse');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const upload = multer({ dest: 'uploads/temp/' });

// ============================================================
// ENTITY ROUTES
// ============================================================
const entityRouter = express.Router();
entityRouter.get('/', authenticate, async (req, res, next) => {
  try { res.json(await Entity.find({ isActive: true })); } catch (err) { next(err); }
});
entityRouter.get('/:id', authenticate, async (req, res, next) => {
  try { res.json(await Entity.findById(req.params.id)); } catch (err) { next(err); }
});
entityRouter.post('/', authenticate, authorize('HR', 'FINANCE'), async (req, res, next) => {
  try { res.status(201).json(await Entity.create(req.body)); } catch (err) { next(err); }
});
entityRouter.put('/:id', authenticate, authorize('HR', 'FINANCE'), async (req, res, next) => {
  try { res.json(await Entity.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (err) { next(err); }
});

// ============================================================
// ATTENDANCE ROUTES
// ============================================================
const attendanceRouter = express.Router();

attendanceRouter.get('/summary/:year/:month', authenticate, entityScope, async (req, res, next) => {
  try { res.json(await MonthlySummary.find({ ...req.entityFilter, year: parseInt(req.params.year), month: parseInt(req.params.month) })); }
  catch (err) { next(err); }
});

attendanceRouter.post('/entry', authenticate, authorize('HR', 'MANAGER'), entityScope, async (req, res, next) => {
  try {
    const { empCode, date, status } = req.body;
    let paidDayValue = 1;
    if (['A', 'LWP'].includes(status)) paidDayValue = 0;
    else if (status === 'HD') paidDayValue = 0.5;
    const rec = await Attendance.findOneAndUpdate(
      { empCode, date: new Date(date) },
      { ...req.body, entity: req.entityId, date: new Date(date), paidDayValue, source: 'MANUAL' },
      { upsert: true, new: true }
    );
    res.json(rec);
  } catch (err) { next(err); }
});

attendanceRouter.post('/upload', authenticate, authorize('HR'), entityScope, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const content = fs.readFileSync(req.file.path, 'utf-8');
    const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
    const results = { success: 0, failed: 0, errors: [] };
    for (const row of parsed.data) {
      try {
        const empCode = (row['Employee Code'] || row.empCode || '').trim();
        const dateStr = row['Date'] || row.date || '';
        const status = (row['Status'] || 'P').trim().toUpperCase();
        if (!empCode || !dateStr) continue;
        let date = dateStr.includes('/') ? new Date(dateStr.split('/').reverse().join('-')) : new Date(dateStr);
        if (isNaN(date)) { results.failed++; continue; }
        let pdv = 1; if (['A', 'LWP'].includes(status)) pdv = 0; else if (status === 'HD') pdv = 0.5;
        await Attendance.findOneAndUpdate({ empCode, date }, { empCode, date, status, entity: req.entityId, paidDayValue: pdv, source: 'UPLOAD' }, { upsert: true });
        results.success++;
      } catch (err) { results.failed++; }
    }
    fs.unlinkSync(req.file.path);
    res.json(results);
  } catch (err) { next(err); }
});

attendanceRouter.post('/process/:year/:month', authenticate, authorize('HR'), entityScope, async (req, res, next) => {
  try {
    const year = parseInt(req.params.year), month = parseInt(req.params.month);
    const totalDays = new Date(year, month, 0).getDate();
    const start = new Date(year, month - 1, 1), end = new Date(year, month, 0, 23, 59, 59);
    const employees = await Employee.find({ entity: req.entityId, status: { $in: ['Active', 'OnNotice'] } });
    const holidays = await Holiday.find({ date: { $gte: start, $lte: end } });
    const hSet = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));
    const results = { processed: 0, errors: [] };
    for (const emp of employees) {
      try {
        const daily = await Attendance.find({ empCode: emp.empCode, date: { $gte: start, $lte: end } });
        const map = {}; daily.forEach(d => { map[d.date.toISOString().split('T')[0]] = d; });
        let s = { presentDays: 0, absentDays: 0, halfDays: 0, weekOffs: 0, holidays: 0, paidLeaves: 0, unpaidLeaves: 0, wfhDays: 0, overtimeHours: 0, lateCount: 0 };
        for (let d = 1; d <= totalDays; d++) {
          const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const dn = new Date(year, month - 1, d).toLocaleDateString('en', { weekday: 'long' });
          const r = map[ds];
          if (r) { switch(r.status) { case 'P': s.presentDays++; break; case 'A': s.absentDays++; break; case 'HD': s.halfDays++; break; case 'WO': s.weekOffs++; break; case 'HO': s.holidays++; break; case 'L': s.paidLeaves++; break; case 'WFH': s.wfhDays++; break; case 'LWP': s.unpaidLeaves++; break; default: s.presentDays++; } s.overtimeHours += r.overtimeHours || 0; }
          else { if (dn === 'Sunday') s.weekOffs++; else if (hSet.has(ds)) s.holidays++; else s.presentDays++; }
        }
        const paidDays = s.presentDays + s.paidLeaves + s.weekOffs + s.holidays + s.wfhDays + (s.halfDays * 0.5);
        await MonthlySummary.findOneAndUpdate({ empCode: emp.empCode, month, year }, { empCode: emp.empCode, entity: req.entityId, month, year, totalDays, ...s, paidDays, lwpDays: s.absentDays + s.unpaidLeaves }, { upsert: true });
        results.processed++;
      } catch (err) { results.errors.push({ empCode: emp.empCode, error: err.message }); }
    }
    res.json(results);
  } catch (err) { next(err); }
});

attendanceRouter.post('/lock/:year/:month', authenticate, authorize('HR'), entityScope, async (req, res, next) => {
  try {
    const r = await MonthlySummary.updateMany({ ...req.entityFilter, year: parseInt(req.params.year), month: parseInt(req.params.month) }, { isLocked: true, lockedBy: req.user._id, lockedAt: new Date() });
    res.json({ locked: r.modifiedCount });
  } catch (err) { next(err); }
});

attendanceRouter.get('/template', authenticate, (req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=attendance_template.csv');
  res.send('Employee Code,Date (DD/MM/YYYY),Status (P/A/HD/WO/HO/L/WFH/LWP),In Time,Out Time,OT Hours,Remarks\n');
});

// ============================================================
// COMP OFF ROUTES
// ============================================================
const compoffRouter = express.Router();

compoffRouter.get('/', authenticate, entityScope, async (req, res, next) => {
  try {
    const filter = { ...req.entityFilter };
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
    if (req.user.role === 'EMPLOYEE') filter.empCode = req.user.empCode;
    res.json(await CompOff.find(filter).sort({ createdAt: -1 }));
  } catch (err) { next(err); }
});

compoffRouter.get('/balance', authenticate, entityScope, async (req, res, next) => {
  try {
    const match = { ...req.entityFilter };
    if (req.user.role === 'EMPLOYEE') match.empCode = req.user.empCode;
    const balances = await CompOff.aggregate([
      { $match: match },
      { $group: { _id: '$empCode', totalEarned: { $sum: { $cond: [{ $in: ['$status', ['APPROVED', 'PENDING']] }, '$earnedDays', 0] } }, totalEncashed: { $sum: { $cond: [{ $eq: ['$status', 'ENCASHED'] }, '$earnedDays', 0] } }, balance: { $sum: { $cond: [{ $eq: ['$status', 'APPROVED'] }, '$earnedDays', 0] } }, totalAmount: { $sum: '$encashmentAmount' } } },
    ]);
    const emps = await Employee.find({ empCode: { $in: balances.map(b => b._id) } }).select('empCode firstName lastName totalMonthlySalary');
    const empMap = {}; emps.forEach(e => { empMap[e.empCode] = e; });
    res.json(balances.map(b => ({ empCode: b._id, employeeName: empMap[b._id]?.fullName || b._id, monthlySalary: empMap[b._id]?.totalMonthlySalary || 0, dailyRate: Math.round((empMap[b._id]?.totalMonthlySalary || 0) / 28), ...b })));
  } catch (err) { next(err); }
});

compoffRouter.post('/earn', authenticate, authorize('HR', 'MANAGER'), entityScope, async (req, res, next) => {
  try {
    const emp = await Employee.findOne({ empCode: req.body.empCode, entity: req.entityId });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    const expiry = new Date(req.body.earnedDate); expiry.setDate(expiry.getDate() + 30);
    const co = await CompOff.create({ ...req.body, entity: req.entityId, employeeName: emp.fullName, earnedDate: new Date(req.body.earnedDate), expiryDate: expiry, status: 'PENDING' });
    res.status(201).json(co);
  } catch (err) { next(err); }
});

compoffRouter.post('/:id/approve', authenticate, authorize('HR', 'MANAGER'), async (req, res, next) => {
  try { const co = await CompOff.findByIdAndUpdate(req.params.id, { status: 'APPROVED', approvedBy: req.user.firstName }, { new: true }); res.json(co); } catch (err) { next(err); }
});

compoffRouter.post('/:id/encash', authenticate, authorize('HR', 'FINANCE'), async (req, res, next) => {
  try {
    const co = await CompOff.findById(req.params.id);
    if (!co || co.status !== 'APPROVED') return res.status(400).json({ error: 'Not available for encashment' });
    const emp = await Employee.findOne({ empCode: co.empCode });
    const amount = Math.round((emp?.totalMonthlySalary || 0) / 28 * co.earnedDays);
    co.status = 'ENCASHED'; co.isEncashed = true; co.encashedDate = new Date(); co.encashmentAmount = amount;
    await co.save();
    res.json(co);
  } catch (err) { next(err); }
});

compoffRouter.post('/:id/reject', authenticate, authorize('HR', 'MANAGER'), async (req, res, next) => {
  try { res.json(await CompOff.findByIdAndUpdate(req.params.id, { status: 'REJECTED' }, { new: true })); } catch (err) { next(err); }
});

compoffRouter.delete('/:id', authenticate, authorize('HR'), async (req, res, next) => {
  try { await CompOff.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); } catch (err) { next(err); }
});

// ============================================================
// CONFIG / STATUTORY / HOLIDAYS / AUDIT
// ============================================================
const configRouter = express.Router();

// Entity config (current active entity details)
configRouter.get('/entity', authenticate, entityScope, async (req, res, next) => {
  try { res.json(await Entity.findById(req.entityId)); } catch (err) { next(err); }
});
configRouter.put('/entity', authenticate, authorize('HR', 'FINANCE'), entityScope, async (req, res, next) => {
  try { res.json(await Entity.findByIdAndUpdate(req.entityId, req.body, { new: true })); } catch (err) { next(err); }
});

// Statutory
configRouter.get('/statutory', authenticate, async (req, res, next) => {
  try { res.json(await StatutoryConfig.find({ isActive: true }).sort({ type: 1 })); } catch (err) { next(err); }
});
configRouter.post('/statutory', authenticate, authorize('FINANCE'), async (req, res, next) => {
  try { res.status(201).json(await StatutoryConfig.create(req.body)); } catch (err) { next(err); }
});
configRouter.put('/statutory/:id', authenticate, authorize('FINANCE'), async (req, res, next) => {
  try { res.json(await StatutoryConfig.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (err) { next(err); }
});
configRouter.delete('/statutory/:id', authenticate, authorize('FINANCE'), async (req, res, next) => {
  try { await StatutoryConfig.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); } catch (err) { next(err); }
});

// Holidays
configRouter.get('/holidays', authenticate, async (req, res, next) => {
  try { res.json(await Holiday.find(req.query.year ? { year: parseInt(req.query.year) } : {}).sort({ date: 1 })); } catch (err) { next(err); }
});
configRouter.post('/holidays', authenticate, authorize('HR'), async (req, res, next) => {
  try { res.status(201).json(await Holiday.create({ ...req.body, year: new Date(req.body.date).getFullYear() })); } catch (err) { next(err); }
});
configRouter.delete('/holidays/:id', authenticate, authorize('HR'), async (req, res, next) => {
  try { await Holiday.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); } catch (err) { next(err); }
});

// Audit log
configRouter.get('/audit', authenticate, authorize('HR', 'FINANCE'), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.module) filter.module = req.query.module;
    if (req.entityId) filter.entity = req.entityId;
    res.json(await AuditLog.find(filter).sort({ createdAt: -1 }).limit(parseInt(req.query.limit) || 100));
  } catch (err) { next(err); }
});

// Leave balance
configRouter.get('/leave-balance', authenticate, entityScope, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.empCode) filter.empCode = req.query.empCode;
    if (req.user.role === 'EMPLOYEE') filter.empCode = req.user.empCode;
    res.json(await LeaveBalance.find(filter));
  } catch (err) { next(err); }
});

// ============================================================
// BANK FILE ROUTES
// ============================================================
const bankRouter = express.Router();

bankRouter.post('/generate-file/:runId', authenticate, authorize('HR', 'FINANCE'), async (req, res, next) => {
  try {
    const run = await PayrollRun.findOne({ runId: req.params.runId });
    const details = await PayrollDetail.find({ runId: req.params.runId, netPayable: { $gt: 0 } });
    if (!details.length) return res.status(404).json({ error: 'No records' });

    const monthName = new Date(run.year, run.month - 1).toLocaleString('en', { month: 'short' });
    let csv = 'S.No,Employee Code,Employee Name,Net Amount,Payment Mode,Narration\n';
    let a2aC = 0, a2aA = 0, neftC = 0, neftA = 0;
    details.forEach((d, i) => {
      csv += `${i + 1},${d.empCode},${d.employeeName},${d.netPayable.toFixed(2)},${d.paymentMode},Salary ${monthName}-${run.year}\n`;
      if (d.paymentMode === 'NEFT') { neftC++; neftA += d.netPayable; } else { a2aC++; a2aA += d.netPayable; }
    });

    const dir = path.join(process.env.UPLOAD_DIR || './uploads', 'bank-files');
    fs.mkdirSync(dir, { recursive: true });
    const fp = path.join(dir, `HDFC_${run.entityCode}_${req.params.runId}.csv`);
    fs.writeFileSync(fp, csv);

    const fid = `BF-${req.params.runId}`;
    await BankFile.findOneAndUpdate({ fileId: fid }, { fileId: fid, runId: req.params.runId, entity: run.entity, month: run.month, year: run.year, fileName: path.basename(fp), filePath: fp, totalRecords: details.length, totalAmount: a2aA + neftA, a2aCount: a2aC, a2aAmount: a2aA, neftCount: neftC, neftAmount: neftA, generatedBy: req.user.firstName, status: 'GENERATED' }, { upsert: true, new: true });
    await PayrollRun.findOneAndUpdate({ runId: req.params.runId }, { bankFileGenerated: true });
    res.json({ fileId: fid, totalRecords: details.length, totalAmount: a2aA + neftA, a2aCount: a2aC, neftCount: neftC });
  } catch (err) { next(err); }
});

bankRouter.get('/files', authenticate, entityScope, async (req, res, next) => {
  try { res.json(await BankFile.find({ ...req.entityFilter }).sort({ createdAt: -1 })); } catch (err) { next(err); }
});

bankRouter.get('/download/:fileId', authenticate, authorize('FINANCE', 'HR'), async (req, res, next) => {
  try {
    const f = await BankFile.findOne({ fileId: req.params.fileId });
    if (!f?.filePath) return res.status(404).json({ error: 'Not found' });
    res.download(f.filePath, f.fileName);
  } catch (err) { next(err); }
});

// ============================================================
// REPORT ROUTES
// ============================================================
const reportRouter = express.Router();

reportRouter.get('/dashboard', authenticate, entityScope, async (req, res, next) => {
  try {
    const ef = req.entityFilter;
    const [totalEmp, activeEmp, interns, separated, lastRun, loanCount] = await Promise.all([
      Employee.countDocuments(ef), Employee.countDocuments({ ...ef, status: 'Active' }),
      Employee.countDocuments({ ...ef, employmentType: 'Intern', status: 'Active' }),
      Employee.countDocuments({ ...ef, status: { $in: ['Separated', 'FNF', 'Inactive'] } }),
      PayrollRun.findOne(ef).sort({ createdAt: -1 }), Loan.countDocuments({ ...ef, status: 'ACTIVE' }),
    ]);
    const byDept = await Employee.aggregate([{ $match: { ...ef, status: 'Active' } }, { $group: { _id: '$department', count: { $sum: 1 } } }]);
    const byGrade = await Employee.aggregate([{ $match: { ...ef, status: 'Active', grade: { $ne: '' } } }, { $group: { _id: '$grade', count: { $sum: 1 } } }]);
    const byType = await Employee.aggregate([{ $match: { ...ef, status: 'Active' } }, { $group: { _id: '$employmentType', count: { $sum: 1 } } }]);
    const recentRuns = await PayrollRun.find(ef).sort({ createdAt: -1 }).limit(12).select('runId month year totalNet totalGross totalDeductions totalEmployees totalEmployerPF totalEmployerESI status entityCode');

    // Salary distribution (ranges)
    const salaryDist = await Employee.aggregate([
      { $match: { ...ef, status: 'Active' } },
      { $bucket: { groupBy: '$totalMonthlySalary', boundaries: [0, 15000, 25000, 40000, 60000, 80000, 100000, 999999], default: '100000+', output: { count: { $sum: 1 } } } },
    ]);

    // Total payroll cost from last run
    const lastRunDetails = lastRun ? await PayrollDetail.find({ runId: lastRun.runId }) : [];
    const pfTotal = lastRunDetails.reduce((s, d) => s + d.pfEmployee + d.pfEmployer833 + d.pfEmployer367 + d.pfEmployerEDLI, 0);
    const esiTotal = lastRunDetails.reduce((s, d) => s + d.esiEmployee + d.esiEmployer, 0);
    const tdsTotal = lastRunDetails.reduce((s, d) => s + d.tds, 0);
    const loanDeductions = lastRunDetails.reduce((s, d) => s + d.loanDeduction, 0);

    // Active loans summary
    const activeLoans = await Loan.find({ ...ef, status: 'ACTIVE' });
    const totalLoanOutstanding = activeLoans.reduce((s, l) => s + (l.outstandingBalance || 0), 0);
    const totalLoanDisbursed = activeLoans.reduce((s, l) => s + l.amount, 0);

    // Pending items
    const pendingLoans = await Loan.countDocuments({ ...ef, status: { $in: ['APPLIED', 'MANAGER_RECOMMENDED'] } });
    const pendingPayroll = await PayrollRun.countDocuments({ ...ef, status: 'COMPUTED' });

    // Avg salary
    const avgSalary = await Employee.aggregate([{ $match: { ...ef, status: 'Active', employmentType: { $ne: 'Intern' } } }, { $group: { _id: null, avg: { $avg: '$totalMonthlySalary' }, min: { $min: '$totalMonthlySalary' }, max: { $max: '$totalMonthlySalary' }, total: { $sum: '$totalMonthlySalary' } } }]);

    // Top 10 highest paid
    const topPaid = await Employee.find({ ...ef, status: 'Active' }).sort({ totalMonthlySalary: -1 }).limit(10).select('empCode firstName lastName totalMonthlySalary department designation grade');

    // CompOff summary
    const compOffPending = await CompOff.countDocuments({ ...ef, status: 'PENDING' });
    const compOffBalance = await CompOff.countDocuments({ ...ef, status: 'APPROVED' });

    res.json({
      totalEmp, activeEmp, interns, separated, lastRun, loanCount,
      byDept, byGrade, byType, recentRuns, salaryDist,
      statutory: { pfTotal, esiTotal, tdsTotal, loanDeductions },
      loans: { totalLoanOutstanding, totalLoanDisbursed, pendingLoans, activeCount: activeLoans.length },
      pending: { loans: pendingLoans, payroll: pendingPayroll, compOffs: compOffPending, compOffBalance },
      salary: avgSalary[0] || { avg: 0, min: 0, max: 0, total: 0 },
      topPaid,
    });
  } catch (err) { next(err); }
});

reportRouter.get('/salary-register/:runId', authenticate, authorize('HR', 'FINANCE'), async (req, res, next) => {
  try { res.json(await PayrollDetail.find({ runId: req.params.runId }).sort({ empCode: 1 })); } catch (err) { next(err); }
});

reportRouter.get('/pf-register/:runId', authenticate, authorize('HR', 'FINANCE'), async (req, res, next) => {
  try { res.json(await PayrollDetail.find({ runId: req.params.runId, pfEmployee: { $gt: 0 } }).sort({ empCode: 1 })); } catch (err) { next(err); }
});

reportRouter.get('/esi-register/:runId', authenticate, authorize('HR', 'FINANCE'), async (req, res, next) => {
  try { res.json(await PayrollDetail.find({ runId: req.params.runId, esiEmployee: { $gt: 0 } }).sort({ empCode: 1 })); } catch (err) { next(err); }
});

reportRouter.get('/tds-report/:runId', authenticate, authorize('HR', 'FINANCE'), async (req, res, next) => {
  try { res.json(await PayrollDetail.find({ runId: req.params.runId, tds: { $gt: 0 } }).sort({ empCode: 1 })); } catch (err) { next(err); }
});

// Payslip PDF for employee
reportRouter.get('/payslip-pdf/:runId/:empCode', authenticate, async (req, res, next) => {
  try {
    // EMPLOYEE can only download own payslip
    if (req.user.role === 'EMPLOYEE' && req.params.empCode !== req.user.empCode) {
      return res.status(403).json({ error: 'Can only download your own payslip' });
    }
    const detail = await PayrollDetail.findOne({ runId: req.params.runId, empCode: req.params.empCode });
    if (!detail) return res.status(404).json({ error: 'Payslip not found' });
    const emp = await Employee.findOne({ empCode: req.params.empCode });
    const entity = await Entity.findById(detail.entity);

    // Generate PDF using PayslipGenerator
    const PayslipGenerator = require('../services/PayslipGenerator');
    const filePath = await PayslipGenerator.generate(detail, emp, entity);
    res.download(filePath, `Payslip_${detail.empCode}_${detail.month}_${detail.year}.pdf`);
  } catch (err) { next(err); }
});

// Bulk payslip generation
reportRouter.post('/payslips-bulk/:runId', authenticate, authorize('HR', 'FINANCE'), async (req, res, next) => {
  try {
    const PayslipGenerator = require('../services/PayslipGenerator');
    const details = await PayrollDetail.find({ runId: req.params.runId, status: { $in: ['COMPUTED', 'APPROVED'] } });
    const results = { success: 0, failed: 0, errors: [] };
    for (const detail of details) {
      try {
        const emp = await Employee.findOne({ empCode: detail.empCode });
        const entity = await Entity.findById(detail.entity);
        await PayslipGenerator.generate(detail, emp, entity);
        results.success++;
      } catch (err) { results.failed++; results.errors.push({ empCode: detail.empCode, error: err.message }); }
    }
    res.json(results);
  } catch (err) { next(err); }
});

// Form 16 generation
reportRouter.get('/form16/:empCode/:fy', authenticate, async (req, res, next) => {
  try {
    if (req.user.role === 'EMPLOYEE' && req.params.empCode !== req.user.empCode) return res.status(403).json({ error: 'Access denied' });
    const { Form16Generator } = require('../services/Generators');
    const emp = await Employee.findOne({ empCode: req.params.empCode });
    const entity = await Entity.findById(emp?.entity);
    // Get all payroll details for this FY
    const fyParts = req.params.fy.split('-'); // "2025-26"
    const startYear = parseInt(fyParts[0]), endYear = 2000 + parseInt(fyParts[1]);
    const details = await PayrollDetail.find({
      empCode: req.params.empCode,
      $or: [{ year: startYear, month: { $gte: 4 } }, { year: endYear, month: { $lte: 3 } }],
    }).sort({ year: 1, month: 1 });
    if (!details.length) return res.status(404).json({ error: 'No payroll data for this FY' });
    const filePath = await Form16Generator.generate(req.params.empCode, req.params.fy, details, emp, entity);
    res.download(filePath, `Form16_${req.params.empCode}_${req.params.fy}.pdf`);
  } catch (err) { next(err); }
});

// F&F Settlement calculation
reportRouter.post('/fnf/:empCode', authenticate, authorize('HR', 'FINANCE'), async (req, res, next) => {
  try {
    const { FnFCalculator } = require('../services/Generators');
    const emp = await Employee.findOne({ empCode: req.params.empCode });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    const lastPayroll = await PayrollDetail.findOne({ empCode: req.params.empCode }).sort({ year: -1, month: -1 });
    const leaveBalances = await LeaveBalance.find({ empCode: req.params.empCode });
    const loans = await Loan.find({ empCode: req.params.empCode, status: 'ACTIVE' });
    const compOffs = await CompOff.find({ empCode: req.params.empCode, status: 'APPROVED' });
    const result = FnFCalculator.calculate(emp, lastPayroll, leaveBalances, loans, compOffs);
    res.json(result);
  } catch (err) { next(err); }
});

// Salary revision with arrears
reportRouter.post('/salary-revision', authenticate, authorize('HR'), async (req, res, next) => {
  try {
    const { SalaryRevisionEngine } = require('../services/Generators');
    const { empCode, newBasic, newHra, newCov, effectiveFrom } = req.body;
    const emp = await Employee.findOne({ empCode });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    const now = new Date();
    const arrears = SalaryRevisionEngine.calculateArrears(emp, { basicSalary: newBasic, hra: newHra, conveyanceAndOthers: newCov }, effectiveFrom, now.getMonth() + 1, now.getFullYear());
    // Apply revision
    emp.basicSalary = newBasic; emp.hra = newHra; emp.conveyanceAndOthers = newCov;
    emp.totalMonthlySalary = newBasic + newHra + newCov;
    await emp.save();
    await AuditLog.create({ module: 'salary_revision', action: 'UPDATE', recordId: emp._id, recordName: `${empCode} revised`, userName: req.user.firstName, changes: { arrears, newSalary: emp.totalMonthlySalary } });
    res.json({ employee: emp, arrears });
  } catch (err) { next(err); }
});

// ECR file generation
reportRouter.get('/ecr/:runId', authenticate, authorize('HR', 'FINANCE'), async (req, res, next) => {
  try {
    const { ECRGenerator } = require('../services/Generators');
    const details = await PayrollDetail.find({ runId: req.params.runId, pfEmployee: { $gt: 0 } });
    const run = await PayrollRun.findOne({ runId: req.params.runId });
    const entity = await Entity.findById(run?.entity);
    const filePath = await ECRGenerator.generate(details, entity);
    res.download(filePath, `ECR_${req.params.runId}.txt`);
  } catch (err) { next(err); }
});

// Tally GL export
reportRouter.get('/tally-export/:runId', authenticate, authorize('FINANCE'), async (req, res, next) => {
  try {
    const { TallyExporter } = require('../services/Generators');
    const run = await PayrollRun.findOne({ runId: req.params.runId });
    const details = await PayrollDetail.find({ runId: req.params.runId });
    const entity = await Entity.findById(run?.entity);
    const filePath = await TallyExporter.generateGLPosting(run, details, entity);
    res.download(filePath, `TallyGL_${req.params.runId}.xlsx`);
  } catch (err) { next(err); }
});

// Salary register Excel download
reportRouter.get('/salary-register-excel/:runId', authenticate, authorize('HR', 'FINANCE'), async (req, res, next) => {
  try {
    const details = await PayrollDetail.find({ runId: req.params.runId }).sort({ empCode: 1 });
    const run = await PayrollRun.findOne({ runId: req.params.runId });
    const monthName = new Date(run.year, run.month - 1).toLocaleString('en', { month: 'long' });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`Salary ${monthName} ${run.year}`);

    // Determine if v2 (dynamic heads)
    const isV2 = details.some(d => d.version === 'v2' && d.earnings?.length);

    // Collect all unique earning head codes
    const headCodes = [];
    if (isV2) {
      const headSet = new Set();
      details.forEach(d => (d.earnings || []).forEach(e => headSet.add(e.headCode)));
      headCodes.push(...headSet);
    }

    // Header row
    ws.addRow([`SALARY REGISTER - ${(run.entityCode || '').toUpperCase()} - ${monthName.toUpperCase()} ${run.year}`]);
    const headerRow = ['S.No', 'Code', 'Name', 'Days'];
    if (isV2) {
      headCodes.forEach(h => { headerRow.push(`${h}(F)`); headerRow.push(`${h}(E)`); });
    } else {
      headerRow.push('Basic(F)', 'HRA(F)', 'Conv(F)', 'Basic(E)', 'HRA(E)', 'Conv(E)');
    }
    headerRow.push('Gross', 'PF', 'ESI', 'PT', 'TDS', 'Total Ded', 'Loan', 'Net', 'Mode');
    ws.addRow(headerRow);
    ws.getRow(1).font = { bold: true, size: 13 }; ws.mergeCells(1, 1, 1, headerRow.length);
    ws.getRow(2).font = { bold: true }; ws.getRow(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };

    // Data rows
    details.forEach((d, i) => {
      const row = [i + 1, d.empCode, d.employeeName, d.paidDays];
      if (isV2) {
        headCodes.forEach(hc => {
          const e = (d.earnings || []).find(x => x.headCode === hc);
          row.push(e?.fixedAmount || 0); row.push(e?.earnedAmount || 0);
        });
      } else {
        row.push(d.basicFixed, d.hraFixed, d.covFixed, d.basicEarned, d.hraEarned, d.covEarned);
      }
      row.push(d.totalEarned, d.pfEmployee, d.esiEmployee, d.professionalTax, d.tds, d.totalDeductions, d.loanDeduction, d.netPayable, d.paymentMode);
      ws.addRow(row);
    });

    ws.columns.forEach(c => { c.width = 14; }); ws.getColumn(1).width = 5; ws.getColumn(2).width = 10; ws.getColumn(3).width = 25;
    const dir = path.join(process.env.UPLOAD_DIR || './uploads', 'reports'); fs.mkdirSync(dir, { recursive: true });
    const fp = path.join(dir, `SalaryRegister_${req.params.runId}.xlsx`);
    await wb.xlsx.writeFile(fp); res.download(fp);
  } catch (err) { next(err); }
});

// ============================================================
// LEAVE MANAGEMENT ROUTES
// ============================================================
const leaveRouter = express.Router();

// Leave application schema (inline for simplicity)
const leaveAppSchema = new (require('mongoose')).Schema({
  empCode: { type: String, required: true }, employeeName: String,
  entity: { type: require('mongoose').Schema.Types.ObjectId, ref: 'Entity' },
  leaveType: { type: String, enum: ['CL', 'SL', 'EL', 'CO', 'LWP', 'ML', 'PL'], required: true },
  fromDate: { type: Date, required: true }, toDate: { type: Date, required: true },
  days: { type: Number, required: true }, reason: String,
  status: { type: String, enum: ['APPLIED', 'APPROVED', 'REJECTED', 'CANCELLED'], default: 'APPLIED' },
  appliedBy: { type: require('mongoose').Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: require('mongoose').Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date, rejectionReason: String,
}, { timestamps: true });
leaveAppSchema.index({ empCode: 1, status: 1 });
const LeaveApplication = require('mongoose').models.LeaveApplication || require('mongoose').model('LeaveApplication', leaveAppSchema);

leaveRouter.get('/', authenticate, entityScope, async (req, res, next) => {
  try {
    const filter = {};
    if (req.user.role === 'EMPLOYEE') filter.empCode = req.user.empCode;
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
    if (req.query.empCode) filter.empCode = req.query.empCode;
    res.json(await LeaveApplication.find(filter).sort({ createdAt: -1 }));
  } catch (err) { next(err); }
});

leaveRouter.post('/', authenticate, entityScope, async (req, res, next) => {
  try {
    const empCode = req.user.role === 'EMPLOYEE' ? req.user.empCode : req.body.empCode;
    const emp = await Employee.findOne({ empCode });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    const fromDate = new Date(req.body.fromDate), toDate = new Date(req.body.toDate);
    const days = req.body.days || Math.ceil((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1;
    const leave = await LeaveApplication.create({ empCode, employeeName: emp.fullName, entity: req.entityId, leaveType: req.body.leaveType, fromDate, toDate, days, reason: req.body.reason, status: 'APPLIED', appliedBy: req.user._id });
    const EmailService = require('../services/EmailService');
    await EmailService.leaveApplied(emp.fullName, req.body.leaveType, req.body.fromDate, req.body.toDate);
    res.status(201).json(leave);
  } catch (err) { next(err); }
});

leaveRouter.post('/:id/approve', authenticate, authorize('HR', 'MANAGER'), async (req, res, next) => {
  try {
    const leave = await LeaveApplication.findByIdAndUpdate(req.params.id, { status: 'APPROVED', approvedBy: req.user._id, approvedAt: new Date() }, { new: true });
    // Update leave balance
    await LeaveBalance.findOneAndUpdate({ empCode: leave.empCode, financialYear: '2025-26', leaveType: leave.leaveType }, { $inc: { availed: leave.days, closing: -leave.days } }, { upsert: true });
    // Create attendance entries
    const EmailService = require('../services/EmailService');
    const emp = await Employee.findOne({ empCode: leave.empCode });
    await EmailService.leaveApproved(leave.employeeName, emp?.email, leave.leaveType, leave.fromDate, leave.toDate);
    res.json(leave);
  } catch (err) { next(err); }
});

leaveRouter.post('/:id/reject', authenticate, authorize('HR', 'MANAGER'), async (req, res, next) => {
  try {
    res.json(await LeaveApplication.findByIdAndUpdate(req.params.id, { status: 'REJECTED', rejectionReason: req.body.reason }, { new: true }));
  } catch (err) { next(err); }
});

leaveRouter.delete('/:id', authenticate, async (req, res, next) => {
  try { await LeaveApplication.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); }
  catch (err) { next(err); }
});

module.exports = { entityRouter, attendanceRouter, compoffRouter, configRouter, bankRouter, reportRouter, leaveRouter };

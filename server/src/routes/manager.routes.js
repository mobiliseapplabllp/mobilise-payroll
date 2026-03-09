const express = require('express');
const Employee = require('../models/Employee');
const { AttendanceReg, PLIConfig, PLIAssessment, CompOff, Loan } = require('../models/Models');
const { authenticate, authorize, entityScope, auditLog } = require('../middleware/auth');
const router = express.Router();

// ===== MANAGER DASHBOARD =====
router.get('/dashboard', authenticate, entityScope, async (req, res, next) => {
  try {
    const empCode = req.user.empCode;
    // Get manager's department to find team
    const manager = await Employee.findOne({ empCode });
    const dept = manager?.department;
    const teamFilter = { ...req.entityFilter, department: dept, status: 'Active' };

    const [teamCount, pendingLeaves, pendingCompOffs, pendingAttReg, pendingLoans] = await Promise.all([
      Employee.countDocuments(teamFilter),
      require('mongoose').models.LeaveApplication?.countDocuments({ ...req.entityFilter, status: 'APPLIED' }) || 0,
      CompOff.countDocuments({ ...req.entityFilter, status: 'PENDING' }),
      AttendanceReg.countDocuments({ ...req.entityFilter, status: 'PENDING' }),
      Loan.countDocuments({ ...req.entityFilter, status: { $in: ['APPLIED', 'MANAGER_RECOMMENDED'] } }),
    ]);

    // Team members (no salary data)
    const team = await Employee.find(teamFilter)
      .select('empCode firstName lastName department designation grade employmentType status dateOfJoining')
      .sort({ firstName: 1 });

    // PLI pending
    const pliPending = await PLIAssessment.countDocuments({ ...req.entityFilter, status: 'PENDING' });

    res.json({
      teamCount, pendingLeaves, pendingCompOffs, pendingAttReg, pendingLoans, pliPending,
      team: team.map(t => ({ empCode: t.empCode, name: `${t.firstName} ${t.lastName || ''}`.trim(), department: t.department, designation: t.designation, grade: t.grade, type: t.employmentType, joined: t.dateOfJoining })),
    });
  } catch (err) { next(err); }
});

// ===== APPROVALS HUB =====
router.get('/pending', authenticate, authorize('MANAGER', 'HR', 'SUPER_ADMIN'), entityScope, async (req, res, next) => {
  try {
    const LeaveApplication = require('mongoose').models.LeaveApplication;
    const [leaves, compoffs, attRegs, loans] = await Promise.all([
      LeaveApplication ? LeaveApplication.find({ ...req.entityFilter, status: 'APPLIED' }).sort({ createdAt: -1 }).limit(50) : [],
      CompOff.find({ ...req.entityFilter, status: 'PENDING' }).sort({ createdAt: -1 }).limit(50),
      AttendanceReg.find({ ...req.entityFilter, status: 'PENDING' }).sort({ createdAt: -1 }).limit(50),
      Loan.find({ ...req.entityFilter, status: { $in: ['APPLIED'] } }).sort({ createdAt: -1 }).limit(50),
    ]);
    res.json({ leaves, compoffs, attRegs, loans, total: (leaves?.length || 0) + compoffs.length + attRegs.length + loans.length });
  } catch (err) { next(err); }
});

// ===== ATTENDANCE REGULARIZATION =====
// Employee applies
router.post('/attendance-reg', authenticate, entityScope, async (req, res, next) => {
  try {
    const empCode = req.user.role === 'EMPLOYEE' ? req.user.empCode : req.body.empCode;
    const emp = await Employee.findOne({ empCode });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    const existing = await AttendanceReg.findOne({ empCode, date: new Date(req.body.date), status: { $ne: 'REJECTED' } });
    if (existing) return res.status(409).json({ error: 'Regularization already applied for this date' });
    const reg = await AttendanceReg.create({
      empCode, employeeName: `${emp.firstName} ${emp.lastName || ''}`.trim(),
      entity: req.entityId, date: new Date(req.body.date),
      requestedStatus: req.body.requestedStatus, reason: req.body.reason,
      punchIn: req.body.punchIn, punchOut: req.body.punchOut,
      appliedBy: req.user._id,
    });
    auditLog(req, 'attendance_reg', 'CREATE', reg._id, `${empCode}: ${req.body.date}`).catch(() => {});
    res.status(201).json(reg);
  } catch (err) { next(err); }
});

// List attendance regs
router.get('/attendance-reg', authenticate, entityScope, async (req, res, next) => {
  try {
    const filter = { ...req.entityFilter };
    if (req.user.role === 'EMPLOYEE') filter.empCode = req.user.empCode;
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
    res.json(await AttendanceReg.find(filter).sort({ createdAt: -1 }).limit(100));
  } catch (err) { next(err); }
});

// Manager approves
router.post('/attendance-reg/:id/approve', authenticate, authorize('MANAGER', 'HR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const reg = await AttendanceReg.findById(req.params.id);
    if (!reg || reg.status !== 'PENDING') return res.status(400).json({ error: 'Cannot approve' });
    reg.status = 'APPROVED';
    reg.approvedBy = req.user._id;
    reg.approverName = `${req.user.firstName} ${req.user.lastName}`;
    reg.approvedAt = new Date();
    await reg.save();
    auditLog(req, 'attendance_reg', 'APPROVE', reg._id, `Approved: ${reg.empCode} ${reg.date}`).catch(() => {});
    res.json(reg);
  } catch (err) { next(err); }
});

// Manager rejects
router.post('/attendance-reg/:id/reject', authenticate, authorize('MANAGER', 'HR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const reg = await AttendanceReg.findById(req.params.id);
    if (!reg || reg.status !== 'PENDING') return res.status(400).json({ error: 'Cannot reject' });
    reg.status = 'REJECTED';
    reg.approvedBy = req.user._id;
    reg.approverName = `${req.user.firstName} ${req.user.lastName}`;
    reg.rejectionReason = req.body.reason || '';
    await reg.save();
    res.json(reg);
  } catch (err) { next(err); }
});

// Bulk approve attendance regularizations
router.post('/attendance-reg/bulk-approve', authenticate, authorize('MANAGER', 'HR', 'SUPER_ADMIN'), entityScope, async (req, res, next) => {
  try {
    const { ids } = req.body; // array of IDs to approve
    if (ids && ids.length) {
      const result = await AttendanceReg.updateMany(
        { _id: { $in: ids }, status: 'PENDING' },
        { status: 'APPROVED', approvedBy: req.user._id, approverName: `${req.user.firstName} ${req.user.lastName}`, approvedAt: new Date() }
      );
      auditLog(req, 'attendance_reg', 'BULK_APPROVE', null, `Bulk approved ${result.modifiedCount} regs`).catch(() => {});
      res.json({ message: `Approved ${result.modifiedCount} regularizations` });
    } else {
      // Approve all pending in entity
      const result = await AttendanceReg.updateMany(
        { ...req.entityFilter, status: 'PENDING' },
        { status: 'APPROVED', approvedBy: req.user._id, approverName: `${req.user.firstName} ${req.user.lastName}`, approvedAt: new Date() }
      );
      auditLog(req, 'attendance_reg', 'BULK_APPROVE', null, `Bulk approved all ${result.modifiedCount} regs`).catch(() => {});
      res.json({ message: `Approved ${result.modifiedCount} regularizations` });
    }
  } catch (err) { next(err); }
});

// ===== PLI CONFIGURATION (HR/Admin) =====
router.get('/pli/config', authenticate, authorize('HR', 'FINANCE', 'SUPER_ADMIN'), entityScope, async (req, res, next) => {
  try { res.json(await PLIConfig.find(req.entityFilter).sort({ year: -1, quarter: -1 })); } catch (err) { next(err); }
});

router.post('/pli/config', authenticate, authorize('HR', 'SUPER_ADMIN'), entityScope, async (req, res, next) => {
  try {
    const config = await PLIConfig.create({ ...req.body, entity: req.entityId });
    res.status(201).json(config);
  } catch (err) { next(err); }
});

// ===== PLI INITIATE (HR creates pending assessments for all employees) =====
router.post('/pli/initiate', authenticate, authorize('HR', 'SUPER_ADMIN'), entityScope, async (req, res, next) => {
  try {
    const { quarter, year } = req.body;
    const config = await PLIConfig.findOne({ entity: req.entityId, quarter, year });
    if (!config) return res.status(400).json({ error: 'Create PLI config for this quarter first' });
    const employees = await Employee.find({ entity: req.entityId, status: 'Active', employmentType: { $ne: 'Intern' } });
    let created = 0;
    for (const emp of employees) {
      const exists = await PLIAssessment.findOne({ entity: req.entityId, empCode: emp.empCode, quarter, year });
      if (exists) continue;
      await PLIAssessment.create({
        entity: req.entityId, empCode: emp.empCode,
        employeeName: `${emp.firstName} ${emp.lastName || ''}`.trim(),
        department: emp.department, designation: emp.designation,
        quarter, year, calculationBase: config.calculationBase,
        baseAmount: (emp.basicSalary || 0) * 3, // quarterly
        status: 'PENDING',
      });
      created++;
    }
    res.json({ message: `Initiated PLI for ${created} employees`, quarter, year });
  } catch (err) { next(err); }
});

// ===== PLI ASSESSMENTS =====
router.get('/pli/assessments', authenticate, entityScope, async (req, res, next) => {
  try {
    const filter = { ...req.entityFilter };
    if (req.query.quarter) filter.quarter = req.query.quarter;
    if (req.query.year) filter.year = parseInt(req.query.year);
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
    // Manager sees only their department
    if (req.user.role === 'MANAGER') {
      const mgr = await Employee.findOne({ empCode: req.user.empCode });
      if (mgr) filter.department = mgr.department;
    }
    if (req.user.role === 'EMPLOYEE') filter.empCode = req.user.empCode;
    res.json(await PLIAssessment.find(filter).sort({ empCode: 1 }));
  } catch (err) { next(err); }
});

// Manager rates employee
router.put('/pli/assess/:id', authenticate, authorize('MANAGER', 'HR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const assessment = await PLIAssessment.findById(req.params.id);
    if (!assessment) return res.status(404).json({ error: 'Not found' });
    if (!['PENDING', 'ASSESSED'].includes(assessment.status)) return res.status(400).json({ error: 'Cannot modify' });

    const { rating, managerRemarks } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1-5' });

    // Get PLI config for rating → percentage mapping
    const config = await PLIConfig.findOne({ entity: assessment.entity, quarter: assessment.quarter, year: assessment.year });
    const ratingMap = config?.ratingScale?.find(r => r.rating === rating);
    const pliPct = ratingMap?.pliPercentage || 0;
    const pliAmount = Math.round(assessment.baseAmount * pliPct / 100);

    assessment.rating = rating;
    assessment.ratingLabel = ratingMap?.label || ['', 'Below Average', 'Average', 'Good', 'Excellent', 'Outstanding'][rating];
    assessment.pliPercentage = pliPct;
    assessment.pliAmount = pliAmount;
    assessment.status = 'ASSESSED';
    assessment.assessedBy = req.user._id;
    assessment.assessedByName = `${req.user.firstName} ${req.user.lastName}`;
    assessment.assessedAt = new Date();
    assessment.managerRemarks = managerRemarks || '';
    await assessment.save();
    auditLog(req, 'pli', 'ASSESS', assessment._id, `PLI: ${assessment.empCode} Q${assessment.quarter} rated ${rating}`).catch(() => {});
    res.json(assessment);
  } catch (err) { next(err); }
});

// HR approves PLI
router.post('/pli/approve/:id', authenticate, authorize('HR', 'FINANCE', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const a = await PLIAssessment.findById(req.params.id);
    if (!a || a.status !== 'ASSESSED') return res.status(400).json({ error: 'Cannot approve' });
    a.status = 'APPROVED';
    a.approvedBy = req.user._id;
    a.approvedByName = `${req.user.firstName} ${req.user.lastName}`;
    a.approvedAt = new Date();
    await a.save();
    res.json(a);
  } catch (err) { next(err); }
});

// Bulk approve PLI
router.post('/pli/bulk-approve', authenticate, authorize('HR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { quarter, year } = req.body;
    const result = await PLIAssessment.updateMany(
      { entity: req.entityId, quarter, year, status: 'ASSESSED' },
      { status: 'APPROVED', approvedBy: req.user._id, approvedByName: `${req.user.firstName} ${req.user.lastName}`, approvedAt: new Date() }
    );
    res.json({ message: `Approved ${result.modifiedCount} assessments` });
  } catch (err) { next(err); }
});

module.exports = router;

const express = require('express');
const { SalaryHead, SalaryTemplate, EmployeeSalary, MinimumWage, GeoState, GeoCity } = require('../models/SalaryModels');
const { encryptJSON } = require('../utils/encryption');
const { authenticate, authorize, auditLog, autoAudit } = require('../middleware/auth');
const router = express.Router();

// ===== SALARY HEADS =====
router.get('/heads', authenticate, async (req, res, next) => {
  try { res.json(await SalaryHead.find({ isActive: true }).sort({ sortOrder: 1 })); } catch (err) { next(err); }
});
router.get('/heads/all', authenticate, authorize('HR', 'FINANCE', 'SUPER_ADMIN'), async (req, res, next) => {
  try { res.json(await SalaryHead.find({}).sort({ sortOrder: 1 })); } catch (err) { next(err); }
});
router.post('/heads', authenticate, authorize('HR', 'SUPER_ADMIN'), autoAudit('salary_heads'), async (req, res, next) => {
  try { res.status(201).json(await SalaryHead.create({ ...req.body, code: req.body.code?.toUpperCase() })); } catch (err) { next(err); }
});
router.put('/heads/:id', authenticate, authorize('HR', 'SUPER_ADMIN'), autoAudit('salary_heads'), async (req, res, next) => {
  try { res.json(await SalaryHead.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (err) { next(err); }
});
router.delete('/heads/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try { await SalaryHead.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); } catch (err) { next(err); }
});

// ===== SALARY TEMPLATES =====
router.get('/templates', authenticate, async (req, res, next) => {
  try {
    const filter = { isActive: true };
    if (req.query.entity) filter.entity = req.query.entity;
    res.json(await SalaryTemplate.find(filter).sort({ name: 1 }));
  } catch (err) { next(err); }
});
router.get('/templates/:id', authenticate, async (req, res, next) => {
  try { res.json(await SalaryTemplate.findById(req.params.id).populate('heads.headId')); } catch (err) { next(err); }
});
router.post('/templates', authenticate, authorize('HR', 'SUPER_ADMIN'), autoAudit('salary_templates'), async (req, res, next) => {
  try { res.status(201).json(await SalaryTemplate.create(req.body)); } catch (err) { next(err); }
});
router.put('/templates/:id', authenticate, authorize('HR', 'SUPER_ADMIN'), autoAudit('salary_templates'), async (req, res, next) => {
  try { res.json(await SalaryTemplate.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (err) { next(err); }
});
router.delete('/templates/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try { await SalaryTemplate.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); } catch (err) { next(err); }
});

// ===== EMPLOYEE SALARY =====
router.get('/employee-salary/:empCode', authenticate, async (req, res, next) => {
  try {
    const active = await EmployeeSalary.findOne({ empCode: req.params.empCode, isActive: true });
    const history = await EmployeeSalary.find({ empCode: req.params.empCode }).sort({ effectiveFrom: -1 });
    res.json({ active, history });
  } catch (err) { next(err); }
});

router.post('/employee-salary', authenticate, authorize('HR', 'SUPER_ADMIN'), autoAudit('employee_salary'), async (req, res, next) => {
  try {
    const { empCode, entity, templateId, components, effectiveFrom, revisionReason } = req.body;
    // Deactivate previous salary record
    await EmployeeSalary.updateMany({ empCode, isActive: true }, { isActive: false, effectiveTo: new Date(effectiveFrom) });
    // Calculate totals
    const totalMonthly = components.reduce((s, c) => s + (c.headType === 'EARNING' ? c.amount : 0), 0);
    const pfWage = components.filter(c => c.isPFApplicable).reduce((s, c) => s + c.amount, 0);
    const esiWage = components.filter(c => c.isESIApplicable).reduce((s, c) => s + c.amount, 0);
    const grossSalary = components.filter(c => c.isPartOfGross).reduce((s, c) => s + c.amount, 0);

    // Minimum wage validation
    const Employee = require('../models/Employee');
    const emp = await Employee.findOne({ empCode });
    if (emp?.workState) {
      const minWage = await MinimumWage.findOne({ stateCode: emp.workState, category: emp.wageCategory || 'SKILLED', isActive: true }).sort({ effectiveFrom: -1 });
      if (minWage && totalMonthly < minWage.minimumMonthly) {
        return res.status(400).json({
          error: `Salary ₹${totalMonthly} is below minimum wage ₹${minWage.minimumMonthly} for ${minWage.stateName} (${minWage.category})`,
          minimumWage: minWage.minimumMonthly,
          currentSalary: totalMonthly,
        });
      }
    }

    const salary = await EmployeeSalary.create({
      empCode, entity, templateId, templateCode: req.body.templateCode,
      components, totalMonthly, totalAnnual: totalMonthly * 12,
      pfWage, esiWage, grossSalary,
      effectiveFrom: new Date(effectiveFrom),
      isActive: true, revisionReason,
    });

    // Also update Employee model for backward compat
    const basicComp = components.find(c => c.headCode === 'BASIC');
    const hraComp = components.find(c => c.headCode === 'HRA');
    const convComp = components.find(c => c.headCode === 'CONV' || c.headCode === 'CONVEYANCE');
    await Employee.findOneAndUpdate({ empCode }, {
      basicSalary: basicComp?.amount || 0,
      hra: hraComp?.amount || 0,
      conveyanceAndOthers: convComp?.amount || 0,
      totalMonthlySalary: totalMonthly,
    });

    res.status(201).json(salary);
  } catch (err) { next(err); }
});

// ===== MINIMUM WAGES =====
router.get('/minimum-wages', authenticate, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.state) filter.stateCode = req.query.state.toUpperCase();
    if (req.query.active !== 'false') filter.isActive = true;
    res.json(await MinimumWage.find(filter).sort({ stateCode: 1, category: 1 }));
  } catch (err) { next(err); }
});
router.post('/minimum-wages', authenticate, authorize('HR', 'FINANCE', 'SUPER_ADMIN'), autoAudit('minimum_wages'), async (req, res, next) => {
  try { res.status(201).json(await MinimumWage.create(req.body)); } catch (err) { next(err); }
});
router.put('/minimum-wages/:id', authenticate, authorize('HR', 'FINANCE', 'SUPER_ADMIN'), autoAudit('minimum_wages'), async (req, res, next) => {
  try { res.json(await MinimumWage.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (err) { next(err); }
});
router.delete('/minimum-wages/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try { await MinimumWage.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); } catch (err) { next(err); }
});

// ===== GEO STATES =====
router.get('/states', authenticate, async (req, res, next) => {
  try { res.json(await GeoState.find({ isActive: true }).sort({ name: 1 })); } catch (err) { next(err); }
});
router.post('/states', authenticate, authorize('SUPER_ADMIN'), autoAudit('geo'), async (req, res, next) => {
  try { res.status(201).json(await GeoState.create(req.body)); } catch (err) { next(err); }
});
router.put('/states/:id', authenticate, authorize('SUPER_ADMIN'), autoAudit('geo'), async (req, res, next) => {
  try { res.json(await GeoState.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (err) { next(err); }
});

// ===== GEO CITIES =====
router.get('/cities', authenticate, async (req, res, next) => {
  try {
    const filter = { isActive: true };
    if (req.query.state) filter.stateCode = req.query.state.toUpperCase();
    res.json(await GeoCity.find(filter).sort({ name: 1 }));
  } catch (err) { next(err); }
});
router.post('/cities', authenticate, authorize('SUPER_ADMIN'), autoAudit('geo'), async (req, res, next) => {
  try { res.status(201).json(await GeoCity.create(req.body)); } catch (err) { next(err); }
});
router.put('/cities/:id', authenticate, authorize('SUPER_ADMIN'), autoAudit('geo'), async (req, res, next) => {
  try { res.json(await GeoCity.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (err) { next(err); }
});

// ===== GDPR ENDPOINTS =====

// POST record consent
router.post('/gdpr/consent/:empCode', authenticate, authorize('HR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const Employee = require('../models/Employee');
    const emp = await Employee.findOneAndUpdate(
      { empCode: req.params.empCode },
      { dataConsentGiven: true, dataConsentDate: new Date() },
      { new: true }
    );
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    await auditLog(req, 'gdpr', 'CONSENT', emp._id, `Consent recorded: ${emp.empCode}`);
    res.json({ message: 'Consent recorded', empCode: emp.empCode });
  } catch (err) { next(err); }
});

// GET export own data (ESS - employee downloads their data)
router.get('/gdpr/export/:empCode', authenticate, async (req, res, next) => {
  try {
    const empCode = req.params.empCode;
    // EMPLOYEE can only export own data
    if (req.user.role === 'EMPLOYEE' && req.user.empCode !== empCode) {
      return res.status(403).json({ error: 'Can only export your own data' });
    }
    const Employee = require('../models/Employee');
    const { Loan, PayrollDetail, LeaveBalance } = require('../models/Models');
    const AuditLogV2 = require('../models/AuditLogV2');

    const emp = await Employee.findOne({ empCode }).lean();
    if (!emp) return res.status(404).json({ error: 'Not found' });

    const salary = await EmployeeSalary.find({ empCode }).lean();
    const loans = await Loan.find({ empCode }).lean();
    const payroll = await PayrollDetail.find({ empCode }).sort({ year: -1, month: -1 }).lean();

    const exportData = {
      exportDate: new Date().toISOString(),
      exportedBy: req.user.role === 'EMPLOYEE' ? 'Self' : `${req.user.firstName} ${req.user.lastName}`,
      gdprRequest: 'Right to Access / Data Portability',
      personal: {
        empCode: emp.empCode, firstName: emp.firstName, lastName: emp.lastName,
        email: emp.email, department: emp.department, designation: emp.designation,
        dateOfJoining: emp.dateOfJoining, status: emp.status,
      },
      salary: salary.map(s => ({
        templateCode: s.templateCode, totalMonthly: s.totalMonthly,
        effectiveFrom: s.effectiveFrom, isActive: s.isActive,
        components: s.components?.map(c => ({ head: c.headName, amount: c.amount })),
      })),
      loans: loans.map(l => ({
        loanId: l.loanId, type: l.loanType, amount: l.amount,
        emiAmount: l.emiAmount, outstanding: l.outstandingBalance, status: l.status,
      })),
      payrollHistory: payroll.map(p => ({
        month: `${p.month}/${p.year}`, gross: p.totalEarned,
        deductions: p.totalDeductions, net: p.netPayable,
      })),
    };

    await auditLog(req, 'gdpr', 'EXPORT', emp._id, `Data export: ${empCode}`);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=GDPR_Export_${empCode}.json`);
    res.json(exportData);
  } catch (err) { next(err); }
});

// POST anonymize separated employee (SUPER_ADMIN only)
router.post('/gdpr/anonymize/:empCode', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const Employee = require('../models/Employee');
    const emp = await Employee.findOne({ empCode: req.params.empCode });
    if (!emp) return res.status(404).json({ error: 'Not found' });
    if (emp.status === 'Active') return res.status(400).json({ error: 'Cannot anonymize active employee. Separate first.' });

    emp.firstName = 'ANONYMIZED';
    emp.lastName = '';
    emp.email = `anon_${emp.empCode}@removed.local`;
    emp.mobile = '';
    emp.pan = '';
    emp.aadhaar = '';
    emp.fatherName = '';
    emp.accountNumber = '';
    emp.address = { line1: 'REDACTED', line2: '', city: '', state: '', pincode: '' };
    emp.isAnonymized = true;
    emp.anonymizedAt = new Date();
    emp.dataClassification = 'RESTRICTED';
    await emp.save();

    // Also anonymize user account
    const User = require('../models/User');
    await User.findOneAndUpdate({ empCode: req.params.empCode }, { isActive: false, firstName: 'ANONYMIZED', lastName: '', email: `anon_${emp.empCode}@removed.local` });

    await auditLog(req, 'gdpr', 'ANONYMIZE', emp._id, `Anonymized: ${req.params.empCode}`);
    res.json({ message: `Employee ${req.params.empCode} anonymized under GDPR right to erasure` });
  } catch (err) { next(err); }
});

module.exports = router;

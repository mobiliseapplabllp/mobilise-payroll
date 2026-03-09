const express = require('express');
const Employee = require('../models/Employee');
const { MonthlySummary, PayrollRun, PayrollDetail, Loan, StatutoryConfig } = require('../models/Models');
const { EmployeeSalary, MinimumWage } = require('../models/SalaryModels');
const Entity = require('../models/Entity');
const { authenticate, authorize, entityScope, auditLog, autoAudit } = require('../middleware/auth');
const EmailService = require('../services/EmailService');
const router = express.Router();

// POST process payroll - HR only (MAKER)
router.post('/process', authenticate, authorize('HR', 'SUPER_ADMIN'), entityScope, autoAudit('payroll'), async (req, res, next) => {
  try {
    const { month, year } = req.body;
    if (!month || !year) return res.status(400).json({ error: 'Month and year required' });

    const existing = await PayrollRun.findOne({ entity: req.entityId, month, year, status: { $in: ['COMPUTED', 'APPROVED', 'PAID'] } });
    if (existing) return res.status(409).json({ error: `Already processed: ${existing.runId}` });

    const runId = `PR-${req.user.activeEntity?.code || 'ENT'}-${year}-${String(month).padStart(2, '0')}-${Date.now().toString(36).toUpperCase()}`;
    const totalDaysInMonth = new Date(year, month, 0).getDate();
    const employees = await Employee.find({ entity: req.entityId, status: { $in: ['Active', 'OnNotice'] } });
    const pfConfig = await StatutoryConfig.findOne({ type: 'PF', isActive: true });
    const ptConfig = await StatutoryConfig.findOne({ type: 'PT', isActive: true });
    const esiConfig = await StatutoryConfig.findOne({ type: 'ESI', isActive: true });

    const details = [];
    let totals = { gross: 0, ded: 0, net: 0, erPF: 0, erESI: 0, errors: 0 };
    const minWageViolations = [];

    for (const emp of employees) {
      try {
        // Load dynamic salary structure
        const empSalary = await EmployeeSalary.findOne({ empCode: emp.empCode, isActive: true });
        const summary = await MonthlySummary.findOne({ empCode: emp.empCode, month, year });
        const paidDays = summary?.paidDays ?? totalDaysInMonth;
        const ratio = paidDays / totalDaysInMonth;

        // Dynamic earnings computation
        const earnings = [];
        let totalEarned = 0, pfWage = 0, esiWage = 0;

        if (empSalary?.components?.length) {
          // V2: Dynamic salary heads
          for (const comp of empSalary.components) {
            if (comp.headType !== 'EARNING') continue;
            const earned = Math.round(comp.amount * ratio);
            earnings.push({
              headCode: comp.headCode, headName: comp.headName,
              fixedAmount: comp.amount, earnedAmount: earned,
            });
            totalEarned += earned;
            if (comp.isPFApplicable) pfWage += comp.amount;
            if (comp.isESIApplicable) esiWage += earned;
          }
        } else {
          // V1 fallback: hardcoded fields
          const basicEarned = Math.round((emp.basicSalary || 0) * ratio);
          const hraEarned = Math.round((emp.hra || 0) * ratio);
          const covEarned = Math.round((emp.conveyanceAndOthers || 0) * ratio);
          earnings.push(
            { headCode: 'BASIC', headName: 'Basic Salary', fixedAmount: emp.basicSalary || 0, earnedAmount: basicEarned },
            { headCode: 'HRA', headName: 'HRA', fixedAmount: emp.hra || 0, earnedAmount: hraEarned },
            { headCode: 'CONV', headName: 'Conv & Others', fixedAmount: emp.conveyanceAndOthers || 0, earnedAmount: covEarned },
          );
          totalEarned = basicEarned + hraEarned + covEarned;
          pfWage = emp.basicSalary || 0;
          esiWage = totalEarned;
        }

        // PF calculation
        let pfEmployee = 0, pfEr833 = 0, pfEr367 = 0, pfErEDLI = 0;
        if (emp.pfApplicable) {
          const pfCeiling = pfConfig?.wageCeiling || 15000;
          const cappedPfWage = Math.min(pfWage, pfCeiling);
          const proPfWage = Math.round(cappedPfWage * ratio);
          pfEmployee = Math.round(proPfWage * (pfConfig?.employeeRate || 12) / 100);
          pfEr833 = Math.round(proPfWage * (pfConfig?.subRates?.epsEmployer || 8.33) / 100);
          pfEr367 = Math.round(proPfWage * (pfConfig?.subRates?.epfEmployer || 3.67) / 100);
          pfErEDLI = Math.round(proPfWage * (pfConfig?.subRates?.edliEmployer || 0.5) / 100);
        }

        // ESI calculation
        let esiEmployee = 0, esiEmployer = 0;
        const esiCeiling = esiConfig?.wageCeiling || 21000;
        if (emp.esiApplicable && esiWage <= esiCeiling) {
          esiEmployee = Math.ceil(esiWage * (esiConfig?.employeeRate || 0.75) / 100);
          esiEmployer = Math.ceil(esiWage * (esiConfig?.employerRate || 3.25) / 100);
        }

        // PT
        let pt = 0;
        if (ptConfig?.slabs) {
          for (const s of ptConfig.slabs) {
            if (totalEarned >= s.minAmount && totalEarned <= (s.maxAmount || Infinity)) { pt = s.rate; break; }
          }
        }

        const tds = emp.tdsAmount || 0;
        const totalDeductions = pfEmployee + esiEmployee + pt + tds;
        const amountPayable = totalEarned - totalDeductions;

        // Loan deduction
        let loanDeduction = 0;
        const loans = await Loan.find({ empCode: emp.empCode, status: 'ACTIVE' });
        for (const loan of loans) {
          const emi = loan.schedule?.find(s => s.month === month && s.year === year && s.status === 'PENDING');
          if (emi) loanDeduction += emi.emiAmount;
        }

        const netPayable = amountPayable - loanDeduction;

        // V1 compat fields
        const basicEarn = earnings.find(e => e.headCode === 'BASIC')?.earnedAmount || 0;
        const hraEarn = earnings.find(e => e.headCode === 'HRA')?.earnedAmount || 0;
        const convEarn = earnings.find(e => e.headCode === 'CONV')?.earnedAmount || 0;

        details.push({
          runId, entity: req.entityId, empCode: emp.empCode,
          employeeName: `${emp.firstName} ${emp.lastName || ''}`.trim(),
          department: emp.department, designation: emp.designation,
          employmentType: emp.employmentType, month, year,
          totalDays: totalDaysInMonth, paidDays,
          // V1 compat fields
          basicFixed: earnings.find(e => e.headCode === 'BASIC')?.fixedAmount || 0,
          hraFixed: earnings.find(e => e.headCode === 'HRA')?.fixedAmount || 0,
          covFixed: earnings.find(e => e.headCode === 'CONV')?.fixedAmount || 0,
          totalFixed: empSalary?.totalMonthly || emp.totalMonthlySalary || 0,
          basicEarned: basicEarn, hraEarned: hraEarn, covEarned: convEarn,
          totalEarned,
          // V2 dynamic fields
          version: empSalary?.components?.length ? 'v2' : 'v1',
          earnings, // [{headCode, headName, fixedAmount, earnedAmount}]
          deductions: [
            ...(pfEmployee > 0 ? [{ type: 'PF_EE', amount: pfEmployee, description: 'PF Employee' }] : []),
            ...(esiEmployee > 0 ? [{ type: 'ESI_EE', amount: esiEmployee, description: 'ESI Employee' }] : []),
            ...(pt > 0 ? [{ type: 'PT', amount: pt, description: 'Professional Tax' }] : []),
            ...(tds > 0 ? [{ type: 'TDS', amount: tds, description: 'TDS' }] : []),
            ...(loanDeduction > 0 ? [{ type: 'LOAN', amount: loanDeduction, description: 'Loan EMI' }] : []),
          ],
          // Statutory
          pfEmployee, esiEmployee, professionalTax: pt, tds, totalDeductions,
          pfEmployer833: pfEr833, pfEmployer367: pfEr367, pfEmployerEDLI: pfErEDLI, esiEmployer,
          loanDeduction, amountPayable, netPayable,
          pfCalcAmount: Math.min(pfWage, pfConfig?.wageCeiling || 15000),
          paymentMode: emp.paymentMode || 'TR',
          status: 'COMPUTED',
        });

        totals.gross += totalEarned; totals.ded += totalDeductions + loanDeduction;
        totals.net += netPayable; totals.erPF += pfEr833 + pfEr367 + pfErEDLI; totals.erESI += esiEmployer;
      } catch (err) {
        console.error(`Payroll error for ${emp.empCode}: ${err.message}`);
        totals.errors++;
      }
    }

    if (details.length === 0) return res.status(400).json({ error: 'No employees processed' });

    await PayrollDetail.insertMany(details);
    const run = await PayrollRun.create({
      runId, entity: req.entityId, entityCode: req.user.activeEntity?.code,
      month, year, totalEmployees: details.length,
      totalGross: totals.gross, totalDeductions: totals.ded, totalNet: totals.net,
      totalEmployerPF: totals.erPF, totalEmployerESI: totals.erESI,
      errors: totals.errors, status: 'COMPUTED',
      createdBy: req.user._id, createdByName: `${req.user.firstName} ${req.user.lastName}`,
    });

    // Mark loan EMIs as deducted
    for (const d of details) {
      if (d.loanDeduction > 0) {
        const loans = await Loan.find({ empCode: d.empCode, status: 'ACTIVE' });
        for (const loan of loans) {
          const emi = loan.schedule?.find(s => s.month === month && s.year === year && s.status === 'PENDING');
          if (emi) {
            emi.status = 'DEDUCTED';
            loan.totalPaid = (loan.totalPaid || 0) + emi.emiAmount;
            loan.outstandingBalance = Math.max((loan.outstandingBalance || 0) - emi.emiAmount, 0);
            if (loan.outstandingBalance <= 0) loan.status = 'CLOSED';
            await loan.save();
          }
        }
      }
    }

    await auditLog(req, 'payroll', 'PROCESS', runId, `${details.length} employees, Net: ₹${totals.net}`);
    try { await EmailService.payrollProcessed(run, req.user); } catch {}

    res.json({ runId, ...totals, totalEmployees: details.length, minWageViolations });
  } catch (err) { next(err); }
});

// POST approve - FINANCE only (CHECKER)
router.post('/approve/:runId', authenticate, authorize('FINANCE', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const run = await PayrollRun.findOne({ runId: req.params.runId });
    if (!run || run.status !== 'COMPUTED') return res.status(400).json({ error: 'Cannot approve' });
    if (String(run.createdBy) === String(req.user._id) && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Maker-Checker violation: cannot approve your own payroll' });
    }
    run.status = 'APPROVED';
    run.approvedBy = req.user._id;
    run.approvedByName = `${req.user.firstName} ${req.user.lastName}`;
    run.approvedAt = new Date();
    await run.save();
    await PayrollDetail.updateMany({ runId: run.runId }, { status: 'APPROVED' });
    await auditLog(req, 'payroll', 'APPROVE', run.runId, `Approved: ${run.totalEmployees} emp, ₹${run.totalNet}`);
    try { await EmailService.payrollApproved(run, req.user); } catch {}
    res.json(run);
  } catch (err) { next(err); }
});

// GET runs
router.get('/runs', authenticate, entityScope, async (req, res, next) => {
  try {
    res.json(await PayrollRun.find(req.entityFilter).sort({ createdAt: -1 }).limit(24));
  } catch (err) { next(err); }
});

// GET details
router.get('/details/:runId', authenticate, async (req, res, next) => {
  try {
    res.json(await PayrollDetail.find({ runId: req.params.runId }).sort({ empCode: 1 }));
  } catch (err) { next(err); }
});

// DELETE run (HR only, DRAFT/COMPUTED only)
router.delete('/runs/:runId', authenticate, authorize('HR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const run = await PayrollRun.findOne({ runId: req.params.runId });
    if (!run) return res.status(404).json({ error: 'Not found' });
    if (!['COMPUTED', 'DRAFT'].includes(run.status)) return res.status(400).json({ error: 'Only COMPUTED runs can be deleted' });
    await PayrollDetail.deleteMany({ runId: run.runId });
    await PayrollRun.deleteOne({ runId: run.runId });
    await auditLog(req, 'payroll', 'DELETE', run.runId, `Deleted payroll run`);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

module.exports = router;

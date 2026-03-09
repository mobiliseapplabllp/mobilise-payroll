const express = require('express');
const Employee = require('../models/Employee');
const { Loan, AuditLog } = require('../models/Models');
const { authenticate, authorize, entityScope, auditLog } = require('../middleware/auth');
const router = express.Router();

// GET all loans (entity-scoped, role-filtered)
router.get('/', authenticate, entityScope, async (req, res, next) => {
  try {
    const filter = { ...req.entityFilter };
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
    if (req.query.empCode) filter.empCode = req.query.empCode;
    // EMPLOYEE sees only own loans
    if (req.user.role === 'EMPLOYEE') filter.empCode = req.user.empCode;
    res.json(await Loan.find(filter).sort({ createdAt: -1 }));
  } catch (err) { next(err); }
});

// GET single loan
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ error: 'Not found' });
    if (req.user.role === 'EMPLOYEE' && loan.empCode !== req.user.empCode) return res.status(403).json({ error: 'Access denied' });
    res.json(loan);
  } catch (err) { next(err); }
});

// POST apply for loan - EMPLOYEE, MANAGER, or HR can create
router.post('/', authenticate, entityScope, async (req, res, next) => {
  try {
    const { empCode, loanType, amount, tenure, remarks } = req.body;
    // EMPLOYEE can only apply for self
    const targetEmpCode = req.user.role === 'EMPLOYEE' ? req.user.empCode : empCode;
    const emp = await Employee.findOne({ empCode: targetEmpCode, entity: req.entityId });
    if (!emp) return res.status(404).json({ error: 'Employee not found in current entity' });

    const loanId = `LN-${req.entityCode}-${Date.now().toString(36).toUpperCase()}`;
    const emiAmount = Math.ceil(amount / tenure);

    // Generate schedule
    const schedule = [];
    const now = new Date();
    let sm = now.getMonth() + 2, sy = now.getFullYear();
    if (sm > 12) { sm -= 12; sy++; }
    for (let i = 0; i < tenure; i++) {
      let m = sm + i, y = sy;
      while (m > 12) { m -= 12; y++; }
      schedule.push({ month: m, year: y, emiAmount, status: 'PENDING' });
    }

    const loan = await Loan.create({
      loanId, empCode: targetEmpCode, employeeName: emp.fullName,
      entity: req.entityId, loanType, amount, tenure, emiAmount,
      outstandingBalance: amount, schedule,
      status: 'APPLIED', appliedBy: req.user._id, remarks,
    });

    await auditLog(req, 'loans', 'CREATE', loan._id, `${loanId} - ${emp.fullName} - ₹${amount}`);
    // Email notification
    const EmailService = require('../services/EmailService');
    await EmailService.loanApplied(loan, emp?.email || '');
    res.status(201).json(loan);
  } catch (err) { next(err); }
});

// POST Manager recommend - MANAGER only
router.post('/:id/recommend', authenticate, authorize('MANAGER', 'HR'), async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan || loan.status !== 'APPLIED') return res.status(400).json({ error: 'Cannot recommend' });
    loan.status = 'MANAGER_RECOMMENDED';
    loan.managerRecommendedBy = req.user._id;
    loan.managerRecommendedAt = new Date();
    await loan.save();
    await auditLog(req, 'loans', 'RECOMMEND', loan._id, loan.loanId);
    // Email to Finance
    const EmailService = require('../services/EmailService');
    await EmailService.send('finance@mobiliseapps.com', `Loan Recommended: ${loan.employeeName}`, `<p>Manager has recommended loan ${loan.loanId} for ${loan.employeeName} (₹${loan.amount?.toLocaleString('en-IN')}). Please review and approve/reject.</p>`);
    res.json(loan);
  } catch (err) { next(err); }
});

// POST Finance approve - FINANCE only
router.post('/:id/approve', authenticate, authorize('FINANCE'), async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan || !['APPLIED', 'MANAGER_RECOMMENDED'].includes(loan.status)) return res.status(400).json({ error: 'Cannot approve' });
    loan.status = 'ACTIVE';
    loan.approvedBy = req.user._id; loan.approvedAt = new Date();
    loan.disbursementDate = new Date();
    await loan.save();
    await auditLog(req, 'loans', 'APPROVE', loan._id, `${loan.loanId} ₹${loan.amount}`);
    // Email notification
    const EmailService = require('../services/EmailService');
    const emp = await Employee.findOne({ empCode: loan.empCode });
    await EmailService.loanApproved(loan, emp?.email || '');
    res.json(loan);
  } catch (err) { next(err); }
});

// POST reject - MANAGER or FINANCE
router.post('/:id/reject', authenticate, authorize('MANAGER', 'FINANCE'), async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ error: 'Not found' });
    loan.status = 'REJECTED';
    loan.rejectedBy = req.user._id;
    loan.rejectionReason = req.body.reason || 'Rejected';
    await loan.save();
    await auditLog(req, 'loans', 'REJECT', loan._id, loan.loanId);
    // Email notification
    const EmailService = require('../services/EmailService');
    const emp = await Employee.findOne({ empCode: loan.empCode });
    await EmailService.loanRejected(loan, emp?.email || '', loan.rejectionReason);
    res.json(loan);
  } catch (err) { next(err); }
});

// POST close loan - FINANCE
router.post('/:id/close', authenticate, authorize('FINANCE', 'HR'), async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ error: 'Not found' });
    loan.status = 'CLOSED';
    loan.remarks = (loan.remarks || '') + `\nClosed on ${new Date().toLocaleDateString('en-IN')} by ${req.user.firstName}`;
    await loan.save();
    await auditLog(req, 'loans', 'CLOSE', loan._id, loan.loanId);
    res.json(loan);
  } catch (err) { next(err); }
});

// POST reopen a closed loan - FINANCE
router.post('/:id/reopen', authenticate, authorize('FINANCE'), async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ error: 'Not found' });
    if (loan.status !== 'CLOSED') return res.status(400).json({ error: 'Only closed loans can be reopened' });
    loan.status = 'ACTIVE';
    loan.remarks = (loan.remarks || '') + `\nReopened on ${new Date().toLocaleDateString('en-IN')} by ${req.user.firstName}. Reason: ${req.body.reason || 'N/A'}`;
    await loan.save();
    await auditLog(req, 'loans', 'REOPEN', loan._id, `${loan.loanId} reopened`);
    res.json(loan);
  } catch (err) { next(err); }
});

// POST force close with discount - FINANCE
router.post('/:id/force-close', authenticate, authorize('FINANCE'), async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ error: 'Not found' });
    if (loan.status !== 'ACTIVE') return res.status(400).json({ error: 'Only active loans can be force-closed' });
    const { discountAmount = 0, reason = '' } = req.body;
    const finalBalance = Math.max(loan.outstandingBalance - discountAmount, 0);
    loan.status = 'CLOSED';
    loan.outstandingBalance = 0;
    loan.totalPaid = loan.amount - discountAmount;
    loan.remarks = (loan.remarks || '') + `\nForce closed on ${new Date().toLocaleDateString('en-IN')}. Discount: ₹${discountAmount.toLocaleString('en-IN')}. Final settlement: ₹${finalBalance.toLocaleString('en-IN')}. Reason: ${reason}`;
    // Mark remaining EMIs as waived
    if (loan.schedule) {
      loan.schedule.forEach(s => { if (s.status === 'PENDING') s.status = 'WAIVED'; });
    }
    await loan.save();
    await auditLog(req, 'loans', 'FORCE_CLOSE', loan._id, `${loan.loanId} force-closed, discount ₹${discountAmount}`);
    res.json(loan);
  } catch (err) { next(err); }
});

// PUT edit loan details - HR/FINANCE
router.put('/:id', authenticate, authorize('HR', 'FINANCE'), async (req, res, next) => {
  try {
    const allowedFields = ['amount', 'tenure', 'emiAmount', 'loanType', 'remarks', 'outstandingBalance', 'totalPaid'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    const loan = await Loan.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!loan) return res.status(404).json({ error: 'Not found' });
    await auditLog(req, 'loans', 'UPDATE', loan._id, `${loan.loanId} edited`, updates);
    res.json(loan);
  } catch (err) { next(err); }
});

// GET closure letter PDF
router.get('/:id/closure-letter', authenticate, async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ error: 'Not found' });
    if (loan.status !== 'CLOSED') return res.status(400).json({ error: 'Loan must be closed to generate closure letter' });
    const emp = await Employee.findOne({ empCode: loan.empCode });
    const Entity = require('../models/Entity');
    const entity = await Entity.findById(emp?.entity);

    const PDFDocument = require('pdfkit');
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(process.env.UPLOAD_DIR || './uploads', 'loans');
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `LoanClosure_${loan.loanId}.pdf`);

    const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 50, right: 50 } });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Header
    doc.rect(50, 40, 495, 45).fill('#0F2B46');
    doc.fillColor('#fff').fontSize(14).font('Helvetica-Bold').text(entity?.name || 'Mobilise App Lab Limited', 60, 50, { width: 475, align: 'center' });
    doc.fontSize(8).text(entity?.address ? `${entity.address.line1}, ${entity.address.city}, ${entity.address.state} - ${entity.address.pincode}` : '', 60, 68, { width: 475, align: 'center' });

    doc.fillColor('#333').font('Helvetica');
    let y = 110;
    doc.fontSize(12).font('Helvetica-Bold').text('LOAN CLOSURE CERTIFICATE', 50, y, { align: 'center', width: 495 });
    y += 30;
    doc.fontSize(10).font('Helvetica');
    doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 50, y); y += 14;
    doc.text(`Ref: ${loan.loanId}`, 50, y); y += 25;

    doc.text(`To,`, 50, y); y += 14;
    doc.font('Helvetica-Bold').text(`${emp?.firstName || ''} ${emp?.lastName || ''}`, 50, y); y += 14;
    doc.font('Helvetica').text(`Employee Code: ${loan.empCode}`, 50, y); y += 25;

    doc.text('Dear Employee,', 50, y); y += 20;
    doc.text(`This is to certify that your loan (ID: ${loan.loanId}) taken from ${entity?.name || 'the Company'} has been fully settled and closed.`, 50, y, { width: 495 }); y += 30;

    // Loan details table
    const details = [
      ['Loan ID', loan.loanId], ['Loan Type', loan.loanType],
      ['Original Amount', `Rs. ${loan.amount?.toLocaleString('en-IN')}`],
      ['Total Paid', `Rs. ${loan.totalPaid?.toLocaleString('en-IN')}`],
      ['Outstanding at Closure', 'Rs. 0'],
      ['Disbursement Date', loan.disbursementDate ? new Date(loan.disbursementDate).toLocaleDateString('en-IN') : '-'],
      ['Closure Date', new Date().toLocaleDateString('en-IN')],
    ];
    for (const [label, val] of details) {
      doc.font('Helvetica-Bold').text(label + ':', 70, y, { continued: true, width: 200 });
      doc.font('Helvetica').text('  ' + val, { width: 280 });
      y += 16;
    }

    y += 20;
    doc.text('There are no further dues or obligations from your end towards this loan. This certificate is issued upon your request for your records.', 50, y, { width: 495 });
    y += 40;
    doc.text('Yours sincerely,', 50, y); y += 25;
    doc.font('Helvetica-Bold').text(`For ${entity?.name || 'Mobilise App Lab Limited'}`, 50, y); y += 20;
    const sig = entity?.signatories?.find(s => s.isPrimary) || {};
    doc.text(sig.name || 'Authorized Signatory', 50, y); y += 14;
    doc.font('Helvetica').text(sig.designation || '', 50, y);

    y += 40;
    doc.fontSize(7).fillColor('#999').text('This is a system-generated document and does not require a physical signature.', 50, y, { align: 'center', width: 495 });

    doc.end();
    stream.on('finish', () => res.download(filePath, `LoanClosure_${loan.loanId}.pdf`));
    stream.on('error', (err) => next(err));
  } catch (err) { next(err); }
});

// DELETE - HR/FINANCE only
router.delete('/:id', authenticate, authorize('HR', 'FINANCE'), async (req, res, next) => {
  try { await Loan.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); }
  catch (err) { next(err); }
});

// POST upload loan agreement
router.post('/:id/agreement', authenticate, authorize('HR', 'FINANCE', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const multer = require('multer');
    const path = require('path');
    const fs = require('fs');
    const dir = path.join(process.env.UPLOAD_DIR || './uploads', 'loan-agreements');
    fs.mkdirSync(dir, { recursive: true });
    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ error: 'Loan not found' });
    // Save base64 file from body
    if (req.body.fileData) {
      const buffer = Buffer.from(req.body.fileData, 'base64');
      const filePath = path.join(dir, `Agreement_${loan.loanId}.pdf`);
      fs.writeFileSync(filePath, buffer);
      loan.agreementFile = filePath;
      loan.agreementUploadedAt = new Date();
      loan.agreementUploadedBy = `${req.user.firstName} ${req.user.lastName}`;
      await loan.save();
      await auditLog(req, 'loans', 'UPLOAD_AGREEMENT', loan._id, loan.loanId);
    }
    res.json(loan);
  } catch (err) { next(err); }
});

// GET loan statement PDF
router.get('/:id/statement', authenticate, async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ error: 'Not found' });
    const emp = await Employee.findOne({ empCode: loan.empCode });
    const Entity = require('../models/Entity');
    const entity = await Entity.findById(emp?.entity);
    const PDFDocument = require('pdfkit');
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(process.env.UPLOAD_DIR || './uploads', 'loans');
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `LoanStatement_${loan.loanId}.pdf`);
    const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 40, left: 50, right: 50 } });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Header
    doc.rect(50, 35, 495, 40).fill('#0F2B46');
    doc.fillColor('#fff').fontSize(13).font('Helvetica-Bold').text(entity?.name || 'Mobilise App Lab Limited', 60, 43, { width: 475, align: 'center' });
    doc.fontSize(8).text(entity?.address ? `${entity.address.line1}, ${entity.address.city}` : '', 60, 58, { width: 475, align: 'center' });

    doc.fillColor('#333').font('Helvetica');
    let y = 95;
    doc.fontSize(12).font('Helvetica-Bold').text('LOAN STATEMENT', 50, y, { align: 'center', width: 495 }); y += 28;
    doc.fontSize(9).font('Helvetica');
    doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 50, y); y += 14;
    doc.text(`Statement ID: ${loan.loanId}`, 50, y); y += 20;

    // Employee details
    doc.font('Helvetica-Bold').text('Employee Details', 50, y); y += 16;
    const empDetails = [
      ['Name', `${emp?.firstName || ''} ${emp?.lastName || ''}`], ['Code', emp?.empCode || loan.empCode],
      ['Department', emp?.department || '-'], ['Designation', emp?.designation || '-'],
    ];
    for (const [l, v] of empDetails) { doc.font('Helvetica-Bold').fontSize(8).text(`${l}:`, 60, y, { continued: true }); doc.font('Helvetica').text(` ${v}`); y += 13; }
    y += 10;

    // Loan summary
    doc.font('Helvetica-Bold').fontSize(10).text('Loan Summary', 50, y); y += 16;
    const loanDetails = [
      ['Loan ID', loan.loanId], ['Type', loan.loanType], ['Amount', `Rs. ${loan.amount?.toLocaleString('en-IN')}`],
      ['Tenure', `${loan.tenure} months`], ['EMI', `Rs. ${loan.emiAmount?.toLocaleString('en-IN')}`],
      ['Total Paid', `Rs. ${(loan.totalPaid || 0).toLocaleString('en-IN')}`],
      ['Outstanding', `Rs. ${(loan.outstandingBalance || 0).toLocaleString('en-IN')}`],
      ['Status', loan.status], ['Disbursement', loan.disbursementDate ? new Date(loan.disbursementDate).toLocaleDateString('en-IN') : '-'],
    ];
    for (const [l, v] of loanDetails) { doc.font('Helvetica-Bold').fontSize(8).text(`${l}:`, 60, y, { continued: true }); doc.font('Helvetica').text(` ${v}`); y += 13; }
    y += 12;

    // EMI Schedule table
    doc.font('Helvetica-Bold').fontSize(10).text('EMI Schedule', 50, y); y += 16;
    // Header
    doc.rect(50, y, 495, 14).fill('#0F2B46');
    doc.fillColor('#fff').fontSize(7).font('Helvetica-Bold');
    doc.text('#', 55, y + 3, { width: 25 }); doc.text('Month', 85, y + 3, { width: 100 });
    doc.text('EMI Amount', 200, y + 3, { width: 80, align: 'right' }); doc.text('Status', 300, y + 3, { width: 80 });
    y += 14;

    doc.fillColor('#333').font('Helvetica').fontSize(7);
    (loan.schedule || []).forEach((s, i) => {
      const bg = i % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
      doc.rect(50, y, 495, 12).fill(bg);
      doc.fillColor('#333');
      doc.text(String(i + 1), 55, y + 2, { width: 25 });
      doc.text(`${new Date(0, (s.month || 1) - 1).toLocaleString('en', { month: 'short' })} ${s.year}`, 85, y + 2, { width: 100 });
      doc.text(`Rs. ${(s.emiAmount || 0).toLocaleString('en-IN')}`, 200, y + 2, { width: 80, align: 'right' });
      doc.text(s.status || 'PENDING', 300, y + 2, { width: 80 });
      y += 12;
      if (y > 750) { doc.addPage(); y = 50; }
    });

    y += 20;
    doc.fontSize(7).fillColor('#999').text('This is a system-generated statement.', 50, y, { align: 'center', width: 495 });
    doc.end();
    stream.on('finish', () => res.download(filePath, `LoanStatement_${loan.loanId}.pdf`));
  } catch (err) { next(err); }
});

module.exports = router;

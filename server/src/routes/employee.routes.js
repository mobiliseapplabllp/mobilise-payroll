const express = require('express');
const Employee = require('../models/Employee');
const { authenticate, authorize, entityScope, auditLog } = require('../middleware/auth');
const router = express.Router();

// GET all employees (entity-scoped, role-filtered)
router.get('/', authenticate, entityScope, async (req, res, next) => {
  try {
    const { page = 1, limit = 200, status, department, search, employmentType, sort = 'empCode' } = req.query;
    const filter = { ...req.entityFilter };
    if (status && status !== 'all') filter.status = status;
    if (department && department !== 'all') filter.department = department;
    if (employmentType && employmentType !== 'all') filter.employmentType = employmentType;
    if (search) {
      filter.$or = [
        { empCode: { $regex: search, $options: 'i' } }, { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }, { designation: { $regex: search, $options: 'i' } },
        { role: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } },
      ];
    }

    // EMPLOYEE role: can only see own record
    if (req.user.role === 'EMPLOYEE') {
      filter.empCode = req.user.empCode;
    }
    // MANAGER: can see own team (by department) + self
    // For now, managers see all in their entity (can be restricted later by reportingManagerCode)

    const [data, total] = await Promise.all([
      Employee.find(filter).sort(sort).skip((parseInt(page) - 1) * parseInt(limit)).limit(parseInt(limit)),
      Employee.countDocuments(filter),
    ]);

    // Mask PII and salary based on role
    const masked = data.map(emp => {
      const obj = emp.toObject();
      // Mask PII for non-HR/Finance/SuperAdmin roles
      if (!['HR', 'FINANCE', 'SUPER_ADMIN'].includes(req.user.role)) {
        obj.pan = emp.getMaskedPan();
        obj.aadhaar = emp.getMaskedAadhaar();
        obj.accountNumber = emp.getMaskedAccount();
        obj.mobile = '●●●●●●●●●●';
      }
      // MANAGER cannot see salary data
      if (req.user.role === 'MANAGER') {
        obj.basicSalary = undefined; obj.hra = undefined;
        obj.conveyanceAndOthers = undefined; obj.totalMonthlySalary = undefined;
        obj.tdsAmount = undefined;
      }
      return obj;
    });

    res.json({ data: masked, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { next(err); }
});

// GET single employee
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ error: 'Not found' });
    // EMPLOYEE can only view own record
    if (req.user.role === 'EMPLOYEE' && emp.empCode !== req.user.empCode) {
      return res.status(403).json({ error: 'Cannot view other employees' });
    }
    const obj = emp.toObject();
    if (!['HR', 'FINANCE', 'SUPER_ADMIN'].includes(req.user.role)) {
      obj.pan = emp.getMaskedPan(); obj.aadhaar = emp.getMaskedAadhaar(); obj.accountNumber = emp.getMaskedAccount();
      obj.mobile = '●●●●●●●●●●';
    }
    if (req.user.role === 'MANAGER') {
      obj.basicSalary = undefined; obj.hra = undefined; obj.conveyanceAndOthers = undefined;
      obj.totalMonthlySalary = undefined; obj.tdsAmount = undefined;
    }
    res.json(obj);
  } catch (err) { next(err); }
});

// POST create - HR only
router.post('/', authenticate, authorize('HR'), entityScope, async (req, res, next) => {
  try {
    const data = { ...req.body, entity: req.entityId, entityCode: req.entityCode, createdBy: req.user._id };
    data.totalMonthlySalary = (parseFloat(data.basicSalary) || 0) + (parseFloat(data.hra) || 0) + (parseFloat(data.conveyanceAndOthers) || 0);
    const emp = await Employee.create(data);
    await auditLog(req, 'employees', 'CREATE', emp._id, `${emp.empCode} - ${emp.firstName}`, data);
    res.status(201).json(emp);
  } catch (err) { next(err); }
});

// PUT update - HR only
router.put('/:id', authenticate, authorize('HR'), async (req, res, next) => {
  try {
    const data = { ...req.body, updatedBy: req.user._id };
    if (data.basicSalary !== undefined) {
      data.totalMonthlySalary = (parseFloat(data.basicSalary) || 0) + (parseFloat(data.hra) || 0) + (parseFloat(data.conveyanceAndOthers) || 0);
    }
    const emp = await Employee.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!emp) return res.status(404).json({ error: 'Not found' });
    await auditLog(req, 'employees', 'UPDATE', emp._id, `${emp.empCode}`, data);
    res.json(emp);
  } catch (err) { next(err); }
});

// DELETE (soft) - HR only
router.delete('/:id', authenticate, authorize('HR'), async (req, res, next) => {
  try {
    const emp = await Employee.findByIdAndUpdate(req.params.id, { status: 'Inactive' }, { new: true });
    await auditLog(req, 'employees', 'DELETE', emp._id, emp.empCode);
    res.json({ message: 'Deactivated' });
  } catch (err) { next(err); }
});

// GET meta
router.get('/meta/departments', authenticate, entityScope, async (req, res, next) => {
  try { res.json(await Employee.distinct('department', { ...req.entityFilter, status: 'Active' })); } catch (err) { next(err); }
});

router.get('/meta/counts', authenticate, entityScope, async (req, res, next) => {
  try {
    const base = req.entityFilter;
    const [byStatus, byType, byDept, byGrade] = await Promise.all([
      Employee.aggregate([{ $match: base }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Employee.aggregate([{ $match: base }, { $group: { _id: '$employmentType', count: { $sum: 1 } } }]),
      Employee.aggregate([{ $match: { ...base, status: 'Active' } }, { $group: { _id: '$department', count: { $sum: 1 } } }]),
      Employee.aggregate([{ $match: { ...base, status: 'Active', grade: { $ne: '' } } }, { $group: { _id: '$grade', count: { $sum: 1 } } }]),
    ]);
    res.json({
      byStatus: byStatus.reduce((a, c) => { a[c._id] = c.count; return a; }, {}),
      byType: byType.reduce((a, c) => { a[c._id] = c.count; return a; }, {}),
      byDept: byDept.reduce((a, c) => { a[c._id] = c.count; return a; }, {}),
      byGrade: byGrade.reduce((a, c) => { a[c._id] = c.count; return a; }, {}),
    });
  } catch (err) { next(err); }
});

// ===== DOCUMENT MANAGEMENT =====
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const docStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.env.UPLOAD_DIR || './uploads', 'employee-docs', req.params.empCode || 'unknown');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.body.docType || 'DOC'}_${Date.now()}${ext}`);
  },
});
const docUpload = multer({ storage: docStorage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error(`File type ${ext} not allowed. Use: ${allowed.join(', ')}`));
}});

// GET all documents for employee
router.get('/:empCode/documents', authenticate, async (req, res, next) => {
  try {
    const emp = await Employee.findOne({ empCode: req.params.empCode });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    if (req.user.role === 'EMPLOYEE' && req.user.empCode !== req.params.empCode) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json(emp.documents || []);
  } catch (err) { next(err); }
});

// POST upload document
router.post('/:empCode/documents', authenticate, authorize('HR', 'SUPER_ADMIN'), docUpload.single('file'), async (req, res, next) => {
  try {
    const emp = await Employee.findOne({ empCode: req.params.empCode });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const doc = {
      docType: req.body.docType || 'OTHER',
      docName: req.body.docName || req.file.originalname,
      fileName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: new Date(),
      uploadedBy: `${req.user.firstName} ${req.user.lastName}`,
      remarks: req.body.remarks || '',
    };
    emp.documents.push(doc);
    await emp.save();
    await auditLog(req, 'employees', 'UPLOAD_DOC', emp._id, `${emp.empCode}: ${doc.docType} - ${doc.docName}`);
    res.status(201).json(emp.documents[emp.documents.length - 1]);
  } catch (err) { next(err); }
});

// GET download document
router.get('/:empCode/documents/:docId/download', authenticate, async (req, res, next) => {
  try {
    const emp = await Employee.findOne({ empCode: req.params.empCode });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    if (req.user.role === 'EMPLOYEE' && req.user.empCode !== req.params.empCode) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const doc = emp.documents.id(req.params.docId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (!fs.existsSync(doc.filePath)) return res.status(404).json({ error: 'File not found on disk' });
    res.download(doc.filePath, doc.fileName);
  } catch (err) { next(err); }
});

// PUT verify document
router.put('/:empCode/documents/:docId/verify', authenticate, authorize('HR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const emp = await Employee.findOne({ empCode: req.params.empCode });
    if (!emp) return res.status(404).json({ error: 'Not found' });
    const doc = emp.documents.id(req.params.docId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    doc.verified = true;
    doc.verifiedBy = `${req.user.firstName} ${req.user.lastName}`;
    doc.verifiedAt = new Date();
    await emp.save();
    await auditLog(req, 'employees', 'VERIFY_DOC', emp._id, `Verified: ${doc.docType} for ${emp.empCode}`);
    res.json(doc);
  } catch (err) { next(err); }
});

// DELETE document
router.delete('/:empCode/documents/:docId', authenticate, authorize('HR', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const emp = await Employee.findOne({ empCode: req.params.empCode });
    if (!emp) return res.status(404).json({ error: 'Not found' });
    const doc = emp.documents.id(req.params.docId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    // Delete file from disk
    if (doc.filePath && fs.existsSync(doc.filePath)) fs.unlinkSync(doc.filePath);
    doc.deleteOne();
    await emp.save();
    await auditLog(req, 'employees', 'DELETE_DOC', emp._id, `Deleted: ${doc.docType} for ${emp.empCode}`);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

module.exports = router;

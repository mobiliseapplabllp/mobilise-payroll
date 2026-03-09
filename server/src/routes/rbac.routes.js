const express = require('express');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const AuditLog = require('../models/AuditLogV2');
const { authenticate, authorize, hasPermission, auditLog } = require('../middleware/auth');
const router = express.Router();

// ===== ROLES =====
router.get('/roles', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try { res.json(await Role.find({}).sort({ level: -1, name: 1 })); } catch (err) { next(err); }
});

router.post('/roles', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const role = await Role.create(req.body);
    await auditLog(req, 'rbac', 'CREATE', role._id, `Role: ${role.code}`);
    res.status(201).json(role);
  } catch (err) { next(err); }
});

router.put('/roles/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ error: 'Not found' });
    if (role.code === 'SUPER_ADMIN' && role.isSystem) return res.status(403).json({ error: 'Cannot modify SUPER_ADMIN role' });
    Object.assign(role, req.body);
    await role.save();
    await auditLog(req, 'rbac', 'UPDATE', role._id, `Role: ${role.code}`);
    res.json(role);
  } catch (err) { next(err); }
});

// ===== PERMISSIONS =====
router.get('/permissions', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try { res.json(await Permission.find({}).sort({ roleCode: 1, module: 1 })); } catch (err) { next(err); }
});

router.get('/permissions/:roleCode', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try { res.json(await Permission.find({ roleCode: req.params.roleCode.toUpperCase() }).sort({ module: 1 })); } catch (err) { next(err); }
});

// Bulk update permissions for a role
router.put('/permissions/:roleCode', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const roleCode = req.params.roleCode.toUpperCase();
    if (roleCode === 'SUPER_ADMIN') return res.status(403).json({ error: 'Cannot modify SUPER_ADMIN permissions' });
    const { permissions } = req.body; // [{module, create, read, update, delete, approve, export, viewSalary, viewPII}]
    for (const p of permissions) {
      await Permission.findOneAndUpdate(
        { roleCode, module: p.module },
        { ...p, roleCode },
        { upsert: true, new: true }
      );
    }
    Permission.clearCache();
    await auditLog(req, 'rbac', 'UPDATE', roleCode, `Permissions for ${roleCode}`, { modules: permissions.length });
    res.json({ message: `Updated ${permissions.length} permissions for ${roleCode}` });
  } catch (err) { next(err); }
});

// Get permission matrix (all roles × all modules)
router.get('/matrix', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const roles = await Role.find({ isActive: true }).sort({ level: -1 });
    const perms = await Permission.find({});
    const modules = [...new Set(perms.map(p => p.module))].sort();
    const matrix = {};
    for (const role of roles) {
      matrix[role.code] = {};
      for (const mod of modules) {
        const p = perms.find(x => x.roleCode === role.code && x.module === mod);
        matrix[role.code][mod] = p ? { create: p.create, read: p.read, update: p.update, delete: p.delete, approve: p.approve, export: p.export, viewSalary: p.viewSalary, viewPII: p.viewPII } : {};
      }
    }
    res.json({ roles, modules, matrix });
  } catch (err) { next(err); }
});

// ===== AUDIT LOGS =====
router.get('/audit', authenticate, authorize('SUPER_ADMIN', 'HR', 'FINANCE'), async (req, res, next) => {
  try {
    const { module, action, userId, from, to, search, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (module) filter.module = module;
    if (action) filter.action = action;
    if (userId) filter.userId = userId;
    if (search) filter.$or = [
      { actionDetail: { $regex: search, $options: 'i' } },
      { recordName: { $regex: search, $options: 'i' } },
      { userName: { $regex: search, $options: 'i' } },
    ];
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }
    // Non-super-admin can only see their entity's logs
    if (req.user.role !== 'SUPER_ADMIN' && req.entityId) filter.entity = req.entityId;

    const total = await AuditLog.countDocuments(filter);
    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({ data: logs, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// Audit stats
router.get('/audit/stats', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);

    const [todayCount, weekCount, totalCount, byModule, byAction, byUser] = await Promise.all([
      AuditLog.countDocuments({ createdAt: { $gte: today } }),
      AuditLog.countDocuments({ createdAt: { $gte: weekAgo } }),
      AuditLog.countDocuments({}),
      AuditLog.aggregate([{ $group: { _id: '$module', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
      AuditLog.aggregate([{ $group: { _id: '$action', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      AuditLog.aggregate([{ $group: { _id: { name: '$userName', role: '$userRole' }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
    ]);
    res.json({ todayCount, weekCount, totalCount, byModule, byAction, byUser });
  } catch (err) { next(err); }
});

// Audit export CSV
router.get('/audit/export', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const logs = await AuditLog.find({}).sort({ createdAt: -1 }).limit(5000);
    let csv = 'Timestamp,Module,Action,Detail,User,Role,IP,Record\n';
    for (const l of logs) {
      csv += `"${l.createdAt?.toISOString()}","${l.module}","${l.action}","${(l.actionDetail || '').replace(/"/g, '""')}","${l.userName}","${l.userRole}","${l.ipAddress}","${l.recordName}"\n`;
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit_log.csv');
    res.send(csv);
  } catch (err) { next(err); }
});

module.exports = router;

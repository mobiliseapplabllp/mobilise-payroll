const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Permission = require('../models/Permission');
const AuditLog = require('../models/AuditLogV2');

// JWT Authentication
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.query?.token;
    if (!token) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).populate('activeEntity', 'code name');
    if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid user' });
    req.user = user;
    req.entityId = user.activeEntity?._id;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Role-based authorization (legacy support — checks hardcoded roles)
const authorize = (...roles) => (req, res, next) => {
  if (req.user?.role === 'SUPER_ADMIN') return next();
  if (!roles.includes(req.user?.role)) return res.status(403).json({ error: `Access denied. Required: ${roles.join(' or ')}` });
  next();
};

// Permission-based authorization (new — checks DB-driven permission matrix)
const hasPermission = (module, action) => async (req, res, next) => {
  if (req.user?.role === 'SUPER_ADMIN') return next();
  try {
    const allowed = await Permission.check(req.user.role, module, action);
    if (!allowed) return res.status(403).json({ error: `No ${action} permission for ${module}` });
    next();
  } catch { return res.status(403).json({ error: 'Permission check failed' }); }
};

// Entity scoping
const entityScope = (req, res, next) => {
  if (req.user?.role === 'SUPER_ADMIN' && !req.entityId) {
    req.entityFilter = {};
    return next();
  }
  if (!req.entityId) return res.status(400).json({ error: 'No active entity' });
  req.entityFilter = { entity: req.entityId };
  next();
};

// Audit log helper (manual use for specific cases)
const auditLog = async (req, module, action, recordId, recordName, changes) => {
  try {
    await AuditLog.create({
      entity: req.entityId,
      module, action, recordId, recordName,
      actionDetail: `${action}: ${recordName || ''}`,
      afterValue: changes,
      userId: req.user?._id,
      userName: req.user ? `${req.user.firstName} ${req.user.lastName}` : 'System',
      userRole: req.user?.role || 'SYSTEM',
      ipAddress: req.ip || req.headers?.['x-forwarded-for'] || req.connection?.remoteAddress,
      browserInfo: req.headers?.['user-agent']?.substring(0, 200),
    });
  } catch (err) { console.error('Audit failed:', err.message); }
};

// Auto-audit middleware (for all write operations)
const autoAudit = (module) => async (req, res, next) => {
  const start = Date.now();
  const originalJson = res.json.bind(res);

  res.json = (data) => {
    const method = req.method;
    const action = method === 'POST' ? 'CREATE' : method === 'PUT' ? 'UPDATE' : method === 'DELETE' ? 'DELETE' : 'READ';

    // Don't log GET requests unless explicitly tagged
    if (method === 'GET' && !req._auditRead) return originalJson(data);

    AuditLog.create({
      entity: req.entityId,
      module,
      action,
      actionDetail: `${action} ${module} ${req.params?.id || req.params?.runId || req.params?.empCode || ''}`.trim(),
      recordId: data?._id || data?.runId || req.params?.id || '',
      recordName: data?.employeeName || data?.empCode || data?.name || data?.username || data?.loanId || '',
      afterValue: method === 'POST' ? (typeof data === 'object' ? { summary: true } : undefined) : undefined,
      userId: req.user?._id,
      userName: req.user ? `${req.user.firstName} ${req.user.lastName}` : '',
      userRole: req.user?.role,
      ipAddress: req.ip || req.headers?.['x-forwarded-for'] || '',
      browserInfo: req.headers?.['user-agent']?.substring(0, 200),
      durationMs: Date.now() - start,
    }).catch(() => {});

    return originalJson(data);
  };
  next();
};

// Tag GET route for audit logging (sensitive reads)
const auditRead = (req, res, next) => { req._auditRead = true; next(); };

// Error handler
const errorHandler = (err, req, res, next) => {
  const status = err.statusCode || 500;
  console.error(`[ERROR] ${req.method} ${req.originalUrl}: ${err.message}`);
  res.status(status).json({ error: err.message || 'Internal server error' });
};

module.exports = { authenticate, authorize, hasPermission, entityScope, auditLog, autoAudit, auditRead, errorHandler };

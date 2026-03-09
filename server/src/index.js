const dotenvPath = require('fs').existsSync(require('path').join(__dirname, '../.env.production')) ? require('path').join(__dirname, '../.env.production') : undefined;
require('dotenv').config(dotenvPath ? { path: dotenvPath } : {});
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { connectDB } = require('./config/database');
const { errorHandler } = require('./middleware/auth');

const app = express();

// ===== SECURITY HARDENING =====

// Helmet - comprehensive HTTP security headers
app.use(helmet({
  contentSecurityPolicy: false, // disabled for dev, enable in prod
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  frameguard: { action: 'deny' }, // Clickjacking protection
  noSniff: true, // X-Content-Type-Options: nosniff
  xssFilter: true, // X-XSS-Protection
}));

// CORS - strict origin
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000').split(',').concat(['http://localhost:3000', 'http://localhost:5000']);
app.use(cors({ origin: (origin, cb) => { if (!origin || allowedOrigins.some(o => origin.startsWith(o.trim()))) cb(null, true); else cb(null, true); }, credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }));

// Remove X-Powered-By header (don't reveal Express)
app.disable('x-powered-by');

// Rate limiting - tiered
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Too many login attempts. Try again in 15 minutes.' }, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth/', rateLimit({ windowMs: 15 * 60 * 1000, max: 30, message: { error: 'Rate limit exceeded' } }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

// Body parsing with size limits
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

// NoSQL injection sanitization middleware
app.use((req, res, next) => {
  const sanitize = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    for (const key in obj) {
      // Only strip keys that start with $ (MongoDB operators)
      if (typeof key === 'string' && key.startsWith('$')) { delete obj[key]; continue; }
      // Recursively sanitize nested objects (but NOT string values — passwords can have $)
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) sanitize(obj[key]);
    }
    return obj;
  };
  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  next();
});

// Request logging (no sensitive data)
if (process.env.NODE_ENV !== 'test') app.use(morgan('short'));

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/employees', require('./routes/employee.routes'));
app.use('/api/payroll', require('./routes/payroll.routes'));
app.use('/api/loans', require('./routes/loan.routes'));
app.use('/api/masters', require('./routes/master.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/rbac', require('./routes/rbac.routes'));
app.use('/api/salary', require('./routes/salary.routes'));
app.use('/api/manager', require('./routes/manager.routes'));

const { entityRouter, attendanceRouter, compoffRouter, configRouter, bankRouter, reportRouter, leaveRouter } = require('./routes/combined.routes');
app.use('/api/entities', entityRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/compoff', compoffRouter);
app.use('/api/config', configRouter);
app.use('/api/bank', bankRouter);
app.use('/api/reports', reportRouter);
app.use('/api/leaves', leaveRouter);

app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '4.0.0' }));

// Catch 404 for API routes
app.use('/api/*', (req, res) => res.status(404).json({ error: 'Endpoint not found' }));

app.use(errorHandler);

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  const clientBuild = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientBuild));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) res.sendFile(path.join(clientBuild, 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
connectDB().then(() => app.listen(PORT, () => console.log(`🚀 Mobilise Payroll v4 on port ${PORT}`)));
module.exports = app;

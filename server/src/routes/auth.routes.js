const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Entity = require('../models/Entity');
const AuditLog = require('../models/AuditLogV2');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    // Input validation
    if (typeof username !== 'string' || username.length > 50) return res.status(400).json({ error: 'Invalid username' });
    if (typeof password !== 'string' || password.length > 128) return res.status(400).json({ error: 'Invalid password' });

    const cleanUsername = username.toLowerCase().trim().replace(/[^a-z0-9_.-]/g, '');
    const user = await User.findOne({ username: cleanUsername }).populate('entities activeEntity');
    
    if (!user) {
      // Log failed attempt (user not found) - don't reveal if user exists
      AuditLog.create({ module: 'auth', action: 'LOGIN_FAILED', actionDetail: 'Failed login: unknown user', ipAddress: req.ip, browserInfo: req.headers['user-agent']?.substring(0, 200) }).catch(() => {});
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!user.isActive) return res.status(401).json({ error: 'Account deactivated. Contact administrator.' });
    if (user.isLocked()) return res.status(423).json({ error: 'Account locked. Try again in 15 minutes.' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      user.failedAttempts = (user.failedAttempts || 0) + 1;
      if (user.failedAttempts >= 5) user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      await user.save();
      AuditLog.create({ module: 'auth', action: 'LOGIN_FAILED', actionDetail: `Failed login: ${cleanUsername} (attempt ${user.failedAttempts})`, userName: cleanUsername, ipAddress: req.ip, browserInfo: req.headers['user-agent']?.substring(0, 200) }).catch(() => {});
      const remaining = Math.max(5 - user.failedAttempts, 0);
      return res.status(401).json({ error: remaining > 0 ? `Invalid credentials. ${remaining} attempts remaining.` : 'Account locked for 15 minutes.' });
    }

    user.failedAttempts = 0; user.lockedUntil = null; user.lastLogin = new Date();
    const accessToken = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
    const refreshToken = jwt.sign({ userId: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
    user.refreshToken = refreshToken; await user.save();

    // Audit successful login (non-blocking)
    AuditLog.create({ module: 'auth', action: 'LOGIN', actionDetail: `Login: ${cleanUsername} (${user.role})`, userId: user._id, userName: `${user.firstName} ${user.lastName}`, userRole: user.role, ipAddress: req.ip, browserInfo: req.headers['user-agent']?.substring(0, 200) }).catch(() => {});

    res.json({
      accessToken, refreshToken,
      user: { id: user._id, username: user.username, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, empCode: user.empCode, entities: user.entities, activeEntity: user.activeEntity },
    });
  } catch (err) { next(err); }
});

router.post('/refresh', async (req, res) => {
  try {
    const decoded = jwt.verify(req.body.refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(401).json({ error: 'Invalid' });
    const accessToken = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ accessToken });
  } catch { res.status(401).json({ error: 'Invalid refresh token' }); }
});

router.get('/me', authenticate, (req, res) => res.json({ user: req.user }));

// Switch active entity
router.post('/switch-entity', authenticate, async (req, res, next) => {
  try {
    const { entityId } = req.body;
    const entity = await Entity.findById(entityId);
    if (!entity) return res.status(404).json({ error: 'Entity not found' });
    // Check user has access to this entity
    if (!req.user.entities.some(e => e.toString() === entityId.toString())) {
      return res.status(403).json({ error: 'No access to this entity' });
    }
    await User.findByIdAndUpdate(req.user._id, { activeEntity: entityId });
    const updatedUser = await User.findById(req.user._id).populate('entities activeEntity').select('-password -refreshToken');
    res.json({ user: updatedUser });
  } catch (err) { next(err); }
});

router.post('/logout', authenticate, async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
  res.json({ message: 'Logged out' });
});

module.exports = router;

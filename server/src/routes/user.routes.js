const express = require('express');
const User = require('../models/User');
const Entity = require('../models/Entity');
const { authenticate, authorize, auditLog } = require('../middleware/auth');
const router = express.Router();

// GET all users - SUPER_ADMIN only
router.get('/', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.role && req.query.role !== 'all') filter.role = req.query.role;
    if (req.query.active === 'true') filter.isActive = true;
    if (req.query.active === 'false') filter.isActive = false;
    if (req.query.search) {
      filter.$or = [
        { username: { $regex: req.query.search, $options: 'i' } },
        { firstName: { $regex: req.query.search, $options: 'i' } },
        { lastName: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { empCode: { $regex: req.query.search, $options: 'i' } },
      ];
    }
    const users = await User.find(filter).select('-password -refreshToken').populate('entities activeEntity', 'code name').sort({ role: 1, username: 1 });
    res.json(users);
  } catch (err) { next(err); }
});

// GET single user
router.get('/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password -refreshToken').populate('entities activeEntity', 'code name');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) { next(err); }
});

// POST create new user
router.post('/', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { username, email, password, firstName, lastName, role, empCode, entityIds } = req.body;
    if (!username || !password || !firstName || !role) return res.status(400).json({ error: 'username, password, firstName, role required' });

    const entities = entityIds || [];
    const user = await User.create({
      username: username.toLowerCase().trim(),
      email: email || `${username.toLowerCase()}@mobiliseapps.com`,
      password,
      firstName, lastName: lastName || '',
      role,
      empCode: empCode || '',
      entities,
      activeEntity: entities[0] || null,
      isActive: true,
    });

    await auditLog(req, 'users', 'CREATE', user._id, `${user.username} (${user.role})`);
    const result = await User.findById(user._id).select('-password -refreshToken').populate('entities activeEntity', 'code name');
    res.status(201).json(result);
  } catch (err) { next(err); }
});

// PUT update user
router.put('/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { firstName, lastName, email, role, empCode, entityIds, isActive } = req.body;
    const updates = {};
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (email !== undefined) updates.email = email;
    if (role !== undefined) updates.role = role;
    if (empCode !== undefined) updates.empCode = empCode;
    if (entityIds !== undefined) { updates.entities = entityIds; updates.activeEntity = entityIds[0] || null; }
    if (isActive !== undefined) updates.isActive = isActive;

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password -refreshToken').populate('entities activeEntity', 'code name');
    if (!user) return res.status(404).json({ error: 'User not found' });
    await auditLog(req, 'users', 'UPDATE', user._id, `${user.username} updated`, updates);
    res.json(user);
  } catch (err) { next(err); }
});

// POST reset password
router.post('/:id/reset-password', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.password = newPassword;
    user.failedAttempts = 0;
    user.lockedUntil = null;
    user.mustChangePassword = true;
    await user.save(); // Triggers bcrypt hashing
    await auditLog(req, 'users', 'RESET_PASSWORD', user._id, `${user.username} password reset`);
    res.json({ message: `Password reset for ${user.username}` });
  } catch (err) { next(err); }
});

// POST toggle active status
router.post('/:id/toggle-active', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.isActive = !user.isActive;
    user.failedAttempts = 0;
    user.lockedUntil = null;
    await user.save();
    await auditLog(req, 'users', user.isActive ? 'ACTIVATE' : 'DEACTIVATE', user._id, user.username);
    res.json({ message: `User ${user.isActive ? 'activated' : 'deactivated'}`, isActive: user.isActive });
  } catch (err) { next(err); }
});

// POST unlock account
router.post('/:id/unlock', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { failedAttempts: 0, lockedUntil: null }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    await auditLog(req, 'users', 'UNLOCK', user._id, user.username);
    res.json({ message: `Account unlocked for ${user.username}` });
  } catch (err) { next(err); }
});

// DELETE user
router.delete('/:id', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'SUPER_ADMIN') return res.status(403).json({ error: 'Cannot delete super admin' });
    await User.findByIdAndDelete(req.params.id);
    await auditLog(req, 'users', 'DELETE', req.params.id, user.username);
    res.json({ message: 'User deleted' });
  } catch (err) { next(err); }
});

// GET stats
router.get('/meta/stats', authenticate, authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    const byRole = await User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]);
    const active = await User.countDocuments({ isActive: true });
    const locked = await User.countDocuments({ lockedUntil: { $gt: new Date() } });
    const total = await User.countDocuments();
    res.json({ byRole: byRole.reduce((a, c) => { a[c._id] = c.count; return a; }, {}), active, locked, total });
  } catch (err) { next(err); }
});

module.exports = router;

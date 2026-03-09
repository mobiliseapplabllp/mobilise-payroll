const express = require('express');
const MasterData = require('../models/MasterData');
const { authenticate, authorize, auditLog } = require('../middleware/auth');
const router = express.Router();

// GET all master data or by category
router.get('/', authenticate, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.category) filter.category = req.query.category.toUpperCase();
    if (req.query.active !== 'false') filter.isActive = true;
    const data = await MasterData.find(filter).sort({ category: 1, sortOrder: 1, name: 1 });
    res.json(data);
  } catch (err) { next(err); }
});

// GET distinct categories
router.get('/categories', authenticate, async (req, res, next) => {
  try {
    const cats = await MasterData.distinct('category');
    res.json(cats.sort());
  } catch (err) { next(err); }
});

// GET by category (convenience)
router.get('/category/:category', authenticate, async (req, res, next) => {
  try {
    const data = await MasterData.find({ category: req.params.category.toUpperCase(), isActive: true }).sort({ sortOrder: 1, name: 1 });
    res.json(data);
  } catch (err) { next(err); }
});

// POST create
router.post('/', authenticate, authorize('HR', 'FINANCE'), async (req, res, next) => {
  try {
    const data = { ...req.body, category: req.body.category?.toUpperCase(), code: req.body.code?.toUpperCase() };
    const item = await MasterData.create(data);
    await auditLog(req, 'master_data', 'CREATE', item._id, `${item.category}: ${item.name}`);
    res.status(201).json(item);
  } catch (err) { next(err); }
});

// PUT update
router.put('/:id', authenticate, authorize('HR', 'FINANCE'), async (req, res, next) => {
  try {
    const item = await MasterData.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ error: 'Not found' });
    await auditLog(req, 'master_data', 'UPDATE', item._id, `${item.category}: ${item.name}`);
    res.json(item);
  } catch (err) { next(err); }
});

// DELETE
router.delete('/:id', authenticate, authorize('HR', 'FINANCE'), async (req, res, next) => {
  try {
    const item = await MasterData.findByIdAndDelete(req.params.id);
    await auditLog(req, 'master_data', 'DELETE', item?._id, `${item?.category}: ${item?.name}`);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

module.exports = router;

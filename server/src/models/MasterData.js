const mongoose = require('mongoose');

const masterDataSchema = new mongoose.Schema({
  category: { type: String, required: true, index: true },
  // Categories: DEPARTMENT, DESIGNATION, GRADE, EMPLOYMENT_TYPE, LEAVE_TYPE,
  //             LOAN_TYPE, PAYMENT_MODE, HOLIDAY_TYPE, DOCUMENT_TYPE, LOCATION,
  //             SALARY_COMPONENT, SHIFT
  code: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  metadata: mongoose.Schema.Types.Mixed, // Extra config per category
  // e.g. LEAVE_TYPE: { paidLeave: true, maxDays: 12, carryForward: false }
  // e.g. SALARY_COMPONENT: { taxable: true, partOfGross: true }
  // e.g. GRADE: { level: 1, minSalary: 15000, maxSalary: 50000 }
}, { timestamps: true });

masterDataSchema.index({ category: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('MasterData', masterDataSchema);

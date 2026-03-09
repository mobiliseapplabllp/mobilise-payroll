const mongoose = require('mongoose');
const { encrypt, decrypt, mask } = require('../utils/encryption');

const employeeSchema = new mongoose.Schema({
  empCode: { type: String, required: true, unique: true, trim: true },
  entity: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity', required: true },
  entityCode: { type: String, required: true }, // MALL or MIE

  // Personal
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, default: '', trim: true },
  email: { type: String, default: '' },
  mobile: { type: String, default: '', set: encrypt, get: decrypt },
  dateOfBirth: Date,
  gender: { type: String, enum: ['Male', 'Female', 'Other', ''], default: '' },
  fatherName: String,
  maritalStatus: { type: String, enum: ['Single', 'Married', 'Divorced', 'Widowed', ''], default: '' },

  // PII - encrypted at rest, masked in display
  pan: { type: String, default: '', set: encrypt, get: decrypt },
  aadhaar: { type: String, default: '', set: encrypt, get: decrypt },
  address: { line1: String, line2: String, city: String, state: String, pincode: String },

  // GDPR
  dataConsentGiven: { type: Boolean, default: false },
  dataConsentDate: Date,
  dataClassification: { type: String, enum: ['STANDARD', 'SENSITIVE', 'RESTRICTED'], default: 'SENSITIVE' },
  isAnonymized: { type: Boolean, default: false },
  anonymizedAt: Date,

  // Employment
  dateOfJoining: { type: Date, default: Date.now },
  department: { type: String, default: 'Engineering' },
  designation: { type: String, default: '' },
  grade: { type: String, default: '' },
  role: { type: String, default: '' },
  reportingManager: { type: String, default: '' },
  reportingManagerCode: { type: String, default: '' },
  workLocation: { type: String, default: 'Faridabad' },
  employmentType: { type: String, enum: ['Permanent', 'Contract', 'Intern', 'Consultant'], default: 'Permanent' },
  wageCategory: { type: String, enum: ['UNSKILLED', 'SEMI_SKILLED', 'SKILLED', 'HIGHLY_SKILLED', 'CLERICAL'], default: 'SKILLED' },
  workState: { type: String, default: 'HR' }, // state code for min wage / PT

  // Salary (Mobilise structure: Basic + HRA + Conv & Others = Total)
  basicSalary: { type: Number, default: 0 },
  hra: { type: Number, default: 0 },
  conveyanceAndOthers: { type: Number, default: 0 },
  totalMonthlySalary: { type: Number, default: 0 },

  // Statutory
  pfApplicable: { type: Boolean, default: false },
  esiApplicable: { type: Boolean, default: false },
  tdsAmount: { type: Number, default: 0 },
  taxRegime: { type: String, enum: ['OLD', 'NEW'], default: 'NEW' },
  uan: String, pfNumber: String, esicNumber: String,

  // Bank
  bankName: { type: String, default: 'HDFC Bank' },
  accountNumber: { type: String, default: '', set: encrypt, get: decrypt },
  ifscCode: { type: String, default: '' },
  branchName: String,
  paymentMode: { type: String, enum: ['TR', 'NEFT', 'RTGS', 'CHEQUE'], default: 'TR' },

  esslUserId: Number,
  status: { type: String, enum: ['Active', 'Inactive', 'OnNotice', 'Separated', 'FNF'], default: 'Active' },
  lastWorkingDay: Date,
  separationReason: String,

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Documents
  documents: [{
    docType: { type: String, required: true }, // AADHAAR, PAN, PASSPORT, EDUCATION, OFFER_LETTER, RELIEVING, PAYSLIP, LOAN_AGREEMENT, OTHER
    docName: { type: String, required: true },
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    fileSize: { type: Number, default: 0 },
    mimeType: { type: String, default: '' },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: String,
    verified: { type: Boolean, default: false },
    verifiedBy: String,
    verifiedAt: Date,
    remarks: String,
  }],
}, { timestamps: true, toJSON: { virtuals: true, getters: true }, toObject: { virtuals: true, getters: true } });

employeeSchema.virtual('fullName').get(function() {
  return `${this.firstName}${this.lastName ? ' ' + this.lastName : ''}`.trim();
});

// Masked PII for API responses
employeeSchema.methods.getMaskedPan = function() { return mask(this.pan); };
employeeSchema.methods.getMaskedAadhaar = function() { return mask(this.aadhaar); };
employeeSchema.methods.getMaskedAccount = function() { return mask(this.accountNumber); };

employeeSchema.index({ empCode: 1 }, { unique: true });
employeeSchema.index({ entity: 1, status: 1 });
employeeSchema.index({ entityCode: 1, department: 1 });

module.exports = mongoose.model('Employee', employeeSchema);

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class PayslipGenerator {

  static numberToWords(num) {
    if (!num || num === 0) return 'Zero';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    function convert(n) {
      if (n < 0) return 'Minus ' + convert(-n);
      if (n < 20) return ones[n];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
      if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
      if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
      if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
      return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
    }
    return convert(Math.round(Math.abs(num))) + ' Rupees Only';
  }

  static async generate(detail, employee, company) {
    const dir = path.join(process.env.UPLOAD_DIR || './uploads', 'payslips', detail.runId);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `Payslip_${detail.empCode}_${detail.month}_${detail.year}.pdf`);

    const monthName = new Date(detail.year, detail.month - 1).toLocaleString('en', { month: 'long', year: 'numeric' });
    const PRIMARY = '#1B4F72';
    const ACCENT = '#2980B9';
    const LIGHT = '#EBF5FB';
    const BORDER = '#D5D8DC';

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 40, left: 40, right: 40 } });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      const W = 515; // usable width
      const L = 40;  // left margin

      // ===== HEADER =====
      doc.rect(L, 35, W, 55).fill(PRIMARY);
      doc.fillColor('#FFFFFF').fontSize(16).font('Helvetica-Bold')
        .text(company?.companyName || company?.name || 'Mobilise App Lab Limited', L + 15, 45, { width: W - 30 });
      doc.fontSize(8).font('Helvetica')
        .text(company?.address ? `${company.address.line1 || ''}, ${company.address.city || ''}, ${company.address.state || ''} - ${company.address.pincode || ''}` : 'Plot No. 62/B, HSIIDC, Sector 31, Faridabad, Haryana - 121006', L + 15, 65, { width: W - 30 });
      doc.text(`Phone: ${company?.phone || '+91-9599194330'}`, L + 15, 75, { width: W - 30 });

      // ===== PAYSLIP TITLE =====
      doc.fillColor(PRIMARY).fontSize(12).font('Helvetica-Bold')
        .text(`PAYSLIP FOR ${monthName.toUpperCase()}`, L, 105, { align: 'center', width: W });
      doc.moveTo(L, 122).lineTo(L + W, 122).strokeColor(ACCENT).lineWidth(1.5).stroke();

      // ===== EMPLOYEE DETAILS =====
      let y = 132;
      doc.fillColor('#333333').fontSize(8).font('Helvetica');

      const empDetails = [
        ['Employee Code', detail.empCode, 'Employee Name', detail.employeeName],
        ['Department', detail.department || '-', 'Designation', detail.designation || '-'],
        ['Date of Joining', employee?.dateOfJoining ? new Date(employee.dateOfJoining).toLocaleDateString('en-IN') : '-', 'Employment Type', detail.employmentType || 'Permanent'],
        ['UAN', employee?.uan || '-', 'PAN', employee?.pan || '-'],
        ['Bank Account', employee?.accountNumber ? '****' + String(employee.accountNumber).slice(-4) : '-', 'Payment Mode', detail.paymentMode || 'TR'],
        ['Working Days', String(detail.totalDays), 'Paid Days', String(detail.paidDays)],
      ];

      // Background for employee section
      doc.rect(L, y - 2, W, empDetails.length * 16 + 4).fill('#F8F9FA').stroke();
      doc.fillColor('#333333');

      for (const [label1, val1, label2, val2] of empDetails) {
        doc.font('Helvetica-Bold').fontSize(7.5).text(label1, L + 8, y, { width: 100 });
        doc.font('Helvetica').text(': ' + val1, L + 100, y, { width: 155 });
        doc.font('Helvetica-Bold').text(label2, L + 265, y, { width: 100 });
        doc.font('Helvetica').text(': ' + val2, L + 365, y, { width: 150 });
        y += 16;
      }

      y += 8;

      // ===== SALARY TABLE =====
      // Table header
      doc.rect(L, y, W, 20).fill(PRIMARY);
      doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
      doc.text('EARNINGS', L + 8, y + 5, { width: W / 2 - 20 });
      doc.text('Amount (₹)', L + W / 2 - 75, y + 5, { width: 60, align: 'right' });
      doc.text('DEDUCTIONS', L + W / 2 + 8, y + 5, { width: W / 2 - 80 });
      doc.text('Amount (₹)', L + W - 70, y + 5, { width: 60, align: 'right' });
      y += 20;

      // Earnings - V2 dynamic or V1 fallback
      let earnings = [];
      if (detail.version === 'v2' && detail.earnings?.length) {
        earnings = detail.earnings.map(e => [e.headName, e.earnedAmount]);
      } else {
        earnings = [
          ['Basic Salary', detail.basicEarned],
          ['House Rent Allowance (HRA)', detail.hraEarned],
          ['Conveyance & Other Allowances', detail.covEarned],
        ];
      }
      if (detail.compOffEncashed > 0) earnings.push(['Comp-Off Encashment (' + detail.compOffEncashed + ' days)', detail.encashedAmount]);
      if (detail.incentives > 0) earnings.push(['Incentives / Arrears', detail.incentives]);

      // Deductions - V2 dynamic or V1 fallback
      let deductions = [];
      if (detail.version === 'v2' && detail.deductions?.length) {
        deductions = detail.deductions.map(d => [d.description || d.type, d.amount]);
      } else {
        if (detail.pfEmployee > 0) deductions.push(['Provident Fund (PF) @ 12%', detail.pfEmployee]);
        if (detail.esiEmployee > 0) deductions.push(['ESI @ 0.75%', detail.esiEmployee]);
        if (detail.professionalTax > 0) deductions.push(['Professional Tax', detail.professionalTax]);
        if (detail.tds > 0) deductions.push(['Income Tax (TDS)', detail.tds]);
        if (detail.loanDeduction > 0) deductions.push(['Loan Recovery', detail.loanDeduction]);
      }

      const maxRows = Math.max(earnings.length, deductions.length);

      for (let i = 0; i < maxRows; i++) {
        const bgColor = i % 2 === 0 ? '#FFFFFF' : LIGHT;
        doc.rect(L, y, W, 16).fill(bgColor);

        doc.fillColor('#333333').fontSize(7.5);
        if (earnings[i]) {
          doc.font('Helvetica').text(earnings[i][0], L + 8, y + 4, { width: W / 2 - 85 });
          doc.font('Helvetica-Bold').text(earnings[i][1]?.toLocaleString('en-IN'), L + W / 2 - 75, y + 4, { width: 60, align: 'right' });
        }
        if (deductions[i]) {
          doc.font('Helvetica').text(deductions[i][0], L + W / 2 + 8, y + 4, { width: W / 2 - 85 });
          doc.font('Helvetica-Bold').text(deductions[i][1]?.toLocaleString('en-IN'), L + W - 70, y + 4, { width: 60, align: 'right' });
        }
        y += 16;
      }

      // Divider line in middle
      doc.moveTo(L + W / 2, y - (maxRows * 16)).lineTo(L + W / 2, y).strokeColor(BORDER).lineWidth(0.5).stroke();

      // ===== TOTALS ROW =====
      doc.rect(L, y, W, 20).fill('#E8F0FE');
      doc.fillColor(PRIMARY).fontSize(8).font('Helvetica-Bold');
      const totalEarnings = detail.totalEarned + (detail.encashedAmount || 0) + (detail.incentives || 0);
      const totalDeductions = detail.totalDeductions + detail.loanDeduction;
      doc.text('TOTAL EARNINGS', L + 8, y + 5);
      doc.text(totalEarnings.toLocaleString('en-IN'), L + W / 2 - 75, y + 5, { width: 60, align: 'right' });
      doc.text('TOTAL DEDUCTIONS', L + W / 2 + 8, y + 5);
      doc.text(totalDeductions.toLocaleString('en-IN'), L + W - 70, y + 5, { width: 60, align: 'right' });
      y += 20;

      // ===== NET PAYABLE =====
      doc.rect(L, y, W, 28).fill(PRIMARY);
      doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold');
      doc.text('NET PAYABLE', L + 8, y + 7);
      const netPay = detail.totalPayout || detail.netPayable;
      doc.fontSize(14).text(`₹ ${netPay.toLocaleString('en-IN')}`, L + W - 160, y + 5, { width: 150, align: 'right' });
      y += 28;

      // Amount in words
      doc.rect(L, y, W, 18).fill(LIGHT);
      doc.fillColor('#555555').fontSize(7).font('Helvetica-Oblique');
      doc.text(`Amount in words: ${this.numberToWords(netPay)}`, L + 8, y + 5, { width: W - 16 });
      y += 22;

      // ===== EMPLOYER CONTRIBUTIONS (informational) =====
      if (detail.pfEmployer833 > 0 || detail.esiEmployer > 0) {
        doc.fillColor('#888888').fontSize(7).font('Helvetica');
        doc.text('Employer Contributions (not deducted from salary):', L + 8, y);
        y += 12;
        const erItems = [];
        if (detail.pfEmployer833 > 0) erItems.push(`PF Employer (8.33% EPS): ₹${detail.pfEmployer833}`);
        if (detail.pfEmployer367 > 0) erItems.push(`PF Employer (3.67% EPF): ₹${detail.pfEmployer367}`);
        if (detail.pfEmployerEDLI > 0) erItems.push(`EDLI: ₹${detail.pfEmployerEDLI}`);
        if (detail.esiEmployer > 0) erItems.push(`ESI Employer (3.25%): ₹${detail.esiEmployer}`);
        doc.text(erItems.join('  |  '), L + 8, y);
        y += 16;
      }

      // ===== FOOTER =====
      y = Math.max(y + 20, 720);
      doc.moveTo(L, y).lineTo(L + W, y).strokeColor(BORDER).lineWidth(0.5).stroke();
      doc.fillColor('#999999').fontSize(6.5).font('Helvetica');
      doc.text('This is a system-generated payslip and does not require a signature.', L, y + 5, { align: 'center', width: W });
      doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}  |  ${company?.companyName || company?.name || 'Mobilise App Lab Limited'}`, L, y + 14, { align: 'center', width: W });

      doc.end();

      stream.on('finish', () => resolve(filePath));
      stream.on('error', reject);
    });
  }

  // Generate payslips for entire payroll run
  static async generateBulk(runId) {
    const { PayrollDetail } = require('../models/Models');
    const Employee = require('../models/Employee');
    const Entity = require('../models/Entity');

    const details = await PayrollDetail.find({ runId, status: { $in: ['COMPUTED', 'APPROVED'] } });
    const results = { success: 0, failed: 0, errors: [], files: [] };

    for (const detail of details) {
      try {
        const emp = await Employee.findOne({ empCode: detail.empCode });
        const entity = await Entity.findById(detail.entity);
        const filePath = await this.generate(detail, emp, entity);
        results.success++;
        results.files.push({ empCode: detail.empCode, filePath });
      } catch (err) {
        results.failed++;
        results.errors.push({ empCode: detail.empCode, error: err.message });
      }
    }

    return results;
  }
}

module.exports = PayslipGenerator;

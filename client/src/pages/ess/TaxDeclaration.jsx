import React, { useState, useEffect } from 'react';
import { Card, Typography, Row, Col, Statistic, Tag, Button, Table, Divider, message, Spin } from 'antd';
import { DownloadOutlined, FileTextOutlined , AuditOutlined} from '@ant-design/icons';
import { useAuth } from '../../main';
import api, { downloadFile } from '../../utils/api';
const { Title, Text } = Typography;

export default function TaxDeclaration() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/employees', { params: { status: 'Active' } }),
      api.get('/payroll/runs'),
    ]).then(([empRes, runRes]) => {
      setProfile(empRes.data.data?.[0]);
      setRuns(runRes.data.filter(r => ['APPROVED', 'PAID'].includes(r.status)));
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  const annualSalary = (profile?.totalMonthlySalary || 0) * 12;
  const annualBasic = (profile?.basicSalary || 0) * 12;
  const annualHra = (profile?.hra || 0) * 12;
  const annualTds = (profile?.tdsAmount || 0) * 12;
  const annualPf = profile?.pfApplicable ? Math.min(profile.basicSalary, 15000) * 0.12 * 12 : 0;
  const standardDed = 75000;

  const taxableIncome = annualSalary - standardDed - annualPf;

  // FY 2025-26 New Regime (Union Budget 2025)
  let tax = 0;
  const slabs = [
    { limit: 400000, rate: 0 }, { limit: 800000, rate: 5 }, { limit: 1200000, rate: 10 },
    { limit: 1600000, rate: 15 }, { limit: 2000000, rate: 20 }, { limit: 2400000, rate: 25 },
    { limit: Infinity, rate: 30 },
  ];
  let remaining = Math.max(taxableIncome, 0);
  let prev = 0;
  for (const slab of slabs) {
    const taxable = Math.min(remaining, slab.limit - prev);
    tax += taxable * slab.rate / 100;
    remaining -= taxable;
    prev = slab.limit;
    if (remaining <= 0) break;
  }
  // Rebate u/s 87A: taxable ≤ 12L → tax = 0; marginal relief 12-12.75L
  if (taxableIncome <= 1200000) tax = 0;
  else if (taxableIncome <= 1275000) tax = Math.min(tax, taxableIncome - 1200000);
  const cess = Math.round(tax * 0.04);
  const totalTax = Math.round(tax + cess);

  return (
    <div>
      <div className="page-header">
        <Title level={3} style={{ margin: 0, fontFamily: 'DM Sans' }}>Tax Summary & Declaration</Title>
        <Button icon={<DownloadOutlined />} onClick={() => downloadFile(`/reports/form16/${user.empCode}/2025-26`)}>Download Form 16</Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} md={6}><Card className="stat-card"><Statistic title="Annual CTC" value={annualSalary} prefix="₹" formatter={v => `${(v / 100000).toFixed(1)}L`} /></Card></Col>
        <Col xs={24} sm={12} md={6}><Card className="stat-card"><Statistic title="Taxable Income" value={taxableIncome} prefix="₹" formatter={v => `${(v / 100000).toFixed(1)}L`} /></Card></Col>
        <Col xs={24} sm={12} md={6}><Card className="stat-card"><Statistic title="Estimated Tax" value={totalTax} prefix="₹" formatter={v => v.toLocaleString('en-IN')} valueStyle={{ color: totalTax > 0 ? '#DC2626' : '#059669' }} /></Card></Col>
        <Col xs={24} sm={12} md={6}><Card className="stat-card"><Statistic title="Tax Regime" value={profile?.taxRegime || 'NEW'} valueStyle={{ fontSize: 22 }} /><Tag color={profile?.taxRegime === 'OLD' ? 'orange' : 'green'}>{profile?.taxRegime === 'OLD' ? 'Old Regime' : 'New Regime'}</Tag></Card></Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card title="Income Breakup (Annual)" bordered={false}>
            <Table pagination={false} size="small" dataSource={[
              { key: '1', item: 'Basic Salary', amount: annualBasic },
              { key: '2', item: 'House Rent Allowance', amount: annualHra },
              { key: '3', item: 'Conveyance & Others', amount: (profile?.conveyanceAndOthers || 0) * 12 },
              { key: '4', item: 'Gross Salary', amount: annualSalary, bold: true },
              { key: '5', item: 'Less: Standard Deduction u/s 16(ia)', amount: -standardDed },
              { key: '6', item: 'Less: Professional Tax u/s 16(iii)', amount: -(profile?.pfApplicable ? 200 * 12 : 0) },
              { key: '7', item: 'Net Salary Income', amount: taxableIncome, bold: true },
            ]} columns={[
              { title: 'Particulars', dataIndex: 'item', render: (v, r) => r.bold ? <Text strong>{v}</Text> : v },
              { title: 'Amount (₹)', dataIndex: 'amount', align: 'right', render: (v, r) => <Text strong={r.bold} style={v < 0 ? { color: '#DC2626' } : {}}>{v < 0 ? `(${Math.abs(v).toLocaleString('en-IN')})` : v.toLocaleString('en-IN')}</Text> },
            ]} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Deductions & Tax Calculation" bordered={false}>
            <Table pagination={false} size="small" dataSource={[
              { key: '1', item: 'PF (Employee) u/s 80C', amount: Math.round(annualPf), section: '80C' },
              { key: '2', item: 'Total Deductions Chapter VI-A', amount: Math.round(annualPf), bold: true },
              { key: '3', item: '', amount: 0 },
              { key: '4', item: 'Taxable Income', amount: Math.max(taxableIncome - annualPf, 0), bold: true },
              { key: '5', item: 'Tax on Total Income', amount: Math.round(tax) },
              { key: '6', item: taxableIncome <= 1200000 ? 'Less: Rebate u/s 87A (≤₹12L)' : 'No Rebate (Income > ₹12L)', amount: taxableIncome <= 1200000 ? -Math.round(tax) : 0 },
              { key: '7', item: 'Health & Education Cess (4%)', amount: cess },
              { key: '8', item: 'Total Tax Liability', amount: totalTax, bold: true },
              { key: '9', item: 'Monthly TDS Deducted', amount: profile?.tdsAmount || 0 },
              { key: '10', item: 'YTD TDS Deducted (estimated)', amount: (profile?.tdsAmount || 0) * runs.length },
            ]} columns={[
              { title: 'Particulars', dataIndex: 'item', render: (v, r) => r.bold ? <Text strong>{v}</Text> : v },
              { title: 'Amount (₹)', dataIndex: 'amount', align: 'right', render: (v, r) => {
                if (v === 0 && !r.bold) return '-';
                return <Text strong={r.bold} style={v < 0 ? { color: '#059669' } : {}}>{v < 0 ? `(${Math.abs(v).toLocaleString('en-IN')})` : v.toLocaleString('en-IN')}</Text>;
              }},
            ]} />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 16, background: '#FFF7ED', border: '1px solid #FED7AA' }}>
        <Text type="secondary">
          <strong>Note:</strong> This is an estimated tax calculation based on your current salary structure under the {profile?.taxRegime === 'OLD' ? 'Old' : 'New'} Tax Regime.
          Actual tax may vary based on additional deductions (80C, 80D, HRA exemption under Old Regime), other income sources, and investment proofs submitted.
          Consult your finance team or CA for precise tax planning.
        </Text>
      </Card>
    </div>
  );
}

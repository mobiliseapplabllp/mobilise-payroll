import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Typography, Tag, Spin, Space, Tabs, Table, Progress, Badge, Divider, Alert } from 'antd';
import {
  TeamOutlined, DollarOutlined, MoneyCollectOutlined, RiseOutlined,
  BarChartOutlined, PieChartOutlined, SafetyCertificateOutlined,
  ClockCircleOutlined, WarningOutlined, CheckCircleOutlined, BankOutlined,
  FundOutlined, UserOutlined, CalendarOutlined
} from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend,
  RadialBarChart, RadialBar, Treemap
} from 'recharts';
import { useAuth } from '../../main';
import api from '../../utils/api';

const { Title, Text } = Typography;
const C = ['#0F2B46', '#1A6FB5', '#3498DB', '#5DADE2', '#85C1E9', '#059669', '#D97706', '#DC2626', '#8B5CF6', '#EC4899'];
const fmtL = v => `₹${(v / 100000).toFixed(2)}L`;
const fmtK = v => `₹${(v / 1000).toFixed(0)}K`;
const fmtI = v => `₹${v.toLocaleString('en-IN')}`;

export default function Dashboard() {
  const { user } = useAuth();
  const [s, setS] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/dashboard').then(({ data }) => setS(data)).catch(console.error).finally(() => setLoading(false));
  }, [user?.activeEntity]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!s) return <Text>Failed to load dashboard data</Text>;

  const deptData = (s.byDept || []).map(d => ({ name: d._id || 'Other', value: d.count }));
  const gradeData = (s.byGrade || []).map(d => ({ name: d._id, value: d.count })).sort((a, b) => a.name.localeCompare(b.name));
  const typeData = (s.byType || []).map(d => ({ name: d._id || 'Other', value: d.count }));
  const payrollTrend = [...(s.recentRuns || [])].reverse().map(r => ({
    month: `${new Date(0, r.month - 1).toLocaleString('en', { month: 'short' })} ${String(r.year).slice(2)}`,
    gross: r.totalGross, net: r.totalNet, deductions: r.totalDeductions,
    employees: r.totalEmployees, pf: r.totalEmployerPF || 0, esi: r.totalEmployerESI || 0,
  }));
  const salaryRanges = (s.salaryDist || []).map(d => {
    const labels = { 0: '0-15K', 15000: '15-25K', 25000: '25-40K', 40000: '40-60K', 60000: '60-80K', 80000: '80-100K', 100000: '100K+' };
    return { range: labels[d._id] || `${(d._id/1000).toFixed(0)}K+`, count: d.count };
  });

  const totalPending = (s.pending?.loans || 0) + (s.pending?.payroll || 0) + (s.pending?.compOffs || 0);

  const tabs = [
    // ===== OVERVIEW TAB =====
    { key: 'overview', label: <Space><BarChartOutlined />Executive Overview</Space>, children: (
      <div>
        {totalPending > 0 && (
          <Alert type="warning" showIcon icon={<WarningOutlined />} style={{ marginBottom: 16 }}
            message={<Space size="large">
              <Text strong>Pending Actions:</Text>
              {s.pending?.payroll > 0 && <Tag color="orange">{s.pending.payroll} Payroll awaiting approval</Tag>}
              {s.pending?.loans > 0 && <Tag color="blue">{s.pending.loans} Loan applications</Tag>}
              {s.pending?.compOffs > 0 && <Tag color="purple">{s.pending.compOffs} Comp-off requests</Tag>}
            </Space>} />
        )}

        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={12} sm={8} lg={4}><Card className="stat-card"><Statistic title="Total Headcount" value={s.totalEmp} prefix={<TeamOutlined style={{ color: '#0F2B46' }} />} /><Text type="secondary" style={{ fontSize: 11 }}>{s.activeEmp} active • {s.interns} interns</Text></Card></Col>
          <Col xs={12} sm={8} lg={4}><Card className="stat-card"><Statistic title="Monthly Payroll" value={s.lastRun?.totalNet || 0} formatter={v => fmtL(v)} valueStyle={{ color: '#1A6FB5' }} /><Text type="secondary" style={{ fontSize: 11 }}>Gross: {fmtL(s.lastRun?.totalGross || 0)}</Text></Card></Col>
          <Col xs={12} sm={8} lg={4}><Card className="stat-card"><Statistic title="Annual CTC" value={(s.salary?.total || 0) * 12} formatter={v => `₹${(v/10000000).toFixed(1)}Cr`} /><Text type="secondary" style={{ fontSize: 11 }}>Monthly: {fmtL(s.salary?.total || 0)}</Text></Card></Col>
          <Col xs={12} sm={8} lg={4}><Card className="stat-card"><Statistic title="Avg Salary" value={Math.round(s.salary?.avg || 0)} formatter={v => fmtK(v)} prefix={<FundOutlined style={{ color: '#059669' }} />} /><Text type="secondary" style={{ fontSize: 11 }}>Range: {fmtK(s.salary?.min || 0)} - {fmtK(s.salary?.max || 0)}</Text></Card></Col>
          <Col xs={12} sm={8} lg={4}><Card className="stat-card"><Statistic title="Loan Exposure" value={s.loans?.totalLoanOutstanding || 0} formatter={v => fmtL(v)} valueStyle={{ color: '#D97706' }} /><Text type="secondary" style={{ fontSize: 11 }}>{s.loans?.activeCount || 0} active loans</Text></Card></Col>
          <Col xs={12} sm={8} lg={4}><Card className="stat-card"><Statistic title="Statutory Cost" value={(s.statutory?.pfTotal || 0) + (s.statutory?.esiTotal || 0)} formatter={v => fmtK(v)} prefix={<SafetyCertificateOutlined style={{ color: '#8B5CF6' }} />} /><Text type="secondary" style={{ fontSize: 11 }}>PF+ESI employer share</Text></Card></Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={16}>
            <Card title={<Space><FundOutlined /> Payroll Trend (Last 12 Months)</Space>} bordered={false}>
              {payrollTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={payrollTrend}>
                    <defs>
                      <linearGradient id="grossGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1A6FB5" stopOpacity={0.15} /><stop offset="95%" stopColor="#1A6FB5" stopOpacity={0} /></linearGradient>
                      <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#059669" stopOpacity={0.15} /><stop offset="95%" stopColor="#059669" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v, n) => [fmtL(v), n === 'gross' ? 'Gross' : n === 'net' ? 'Net' : 'Deductions']} />
                    <Legend />
                    <Area type="monotone" dataKey="gross" name="Gross" stroke="#1A6FB5" fillOpacity={1} fill="url(#grossGrad)" />
                    <Area type="monotone" dataKey="net" name="Net" stroke="#059669" fillOpacity={1} fill="url(#netGrad)" />
                    <Area type="monotone" dataKey="deductions" name="Deductions" stroke="#D97706" fillOpacity={0.05} fill="#D97706" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <div style={{ padding: 60, textAlign: 'center' }}><Text type="secondary">Process payroll to see trends</Text></div>}
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card title={<Space><PieChartOutlined /> Department Split</Space>} bordered={false}>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={deptData} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={{ strokeWidth: 0.5 }}>
                    {deptData.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>
      </div>
    )},

    // ===== PAYROLL ANALYTICS TAB =====
    { key: 'payroll', label: <Space><DollarOutlined />Payroll Analytics</Space>, children: (
      <div>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={6}><Card className="stat-card"><Statistic title="Last Gross" value={s.lastRun?.totalGross || 0} formatter={v => fmtL(v)} /></Card></Col>
          <Col span={6}><Card className="stat-card"><Statistic title="Last Net" value={s.lastRun?.totalNet || 0} formatter={v => fmtL(v)} valueStyle={{ color: '#059669' }} /></Card></Col>
          <Col span={6}><Card className="stat-card"><Statistic title="PF (EE+ER)" value={s.statutory?.pfTotal || 0} formatter={v => fmtK(v)} valueStyle={{ color: '#8B5CF6' }} /></Card></Col>
          <Col span={6}><Card className="stat-card"><Statistic title="TDS Deducted" value={s.statutory?.tdsTotal || 0} formatter={v => fmtI(v)} valueStyle={{ color: '#DC2626' }} /></Card></Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title="Gross vs Net vs Deductions Trend" bordered={false}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={payrollTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={v => `${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={v => fmtL(v)} />
                  <Legend />
                  <Bar dataKey="gross" name="Gross" fill="#1A6FB5" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="net" name="Net" fill="#059669" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="deductions" name="Deductions" fill="#D97706" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="Headcount Trend" bordered={false}>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={payrollTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="employees" name="Employees" stroke="#0F2B46" strokeWidth={2} dot={{ fill: '#0F2B46', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        <Card title="Payroll Cost Breakdown (Last Run)" bordered={false} style={{ marginTop: 16 }}>
          {s.lastRun ? (
            <Row gutter={[16, 16]}>
              {[
                { label: 'Basic Salary', pct: 50, color: '#0F2B46' },
                { label: 'HRA', pct: 25, color: '#1A6FB5' },
                { label: 'Conveyance & Others', pct: 25, color: '#3498DB' },
              ].map((item, i) => (
                <Col span={8} key={i}>
                  <div style={{ marginBottom: 8 }}><Text>{item.label}</Text></div>
                  <Progress percent={item.pct} strokeColor={item.color} format={p => `~${p}%`} />
                </Col>
              ))}
            </Row>
          ) : <Text type="secondary">No payroll data</Text>}
        </Card>
      </div>
    )},

    // ===== WORKFORCE TAB =====
    { key: 'workforce', label: <Space><TeamOutlined />Workforce</Space>, children: (
      <div>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={6}><Card className="stat-card"><Statistic title="Active" value={s.activeEmp} valueStyle={{ color: '#059669' }} prefix={<UserOutlined />} /></Card></Col>
          <Col span={6}><Card className="stat-card"><Statistic title="Permanent" value={typeData.find(t => t.name === 'Permanent')?.value || 0} prefix={<TeamOutlined />} /></Card></Col>
          <Col span={6}><Card className="stat-card"><Statistic title="Interns" value={s.interns} valueStyle={{ color: '#D97706' }} /></Card></Col>
          <Col span={6}><Card className="stat-card"><Statistic title="Separated" value={s.separated} valueStyle={{ color: '#DC2626' }} /></Card></Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={8}>
            <Card title="Employment Type" bordered={false}>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart><Pie data={typeData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {typeData.map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
                </Pie><Tooltip /></PieChart>
              </ResponsiveContainer>
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card title="Grade Distribution" bordered={false}>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={gradeData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={30} />
                  <Tooltip />
                  <Bar dataKey="value" name="Employees" fill="#1A6FB5" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card title="Salary Distribution" bordered={false}>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={salaryRanges}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="range" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Employees" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        <Card title={`Top 10 Highest Paid Employees`} bordered={false} style={{ marginTop: 16 }}>
          <Table size="small" pagination={false} dataSource={s.topPaid || []} rowKey="empCode" columns={[
            { title: '#', render: (_, __, i) => i + 1, width: 40 },
            { title: 'Code', dataIndex: 'empCode', width: 80 },
            { title: 'Name', render: (_, r) => <Text strong>{r.firstName} {r.lastName}</Text>, width: 180 },
            { title: 'Department', dataIndex: 'department', width: 100 },
            { title: 'Designation', dataIndex: 'designation', width: 150 },
            { title: 'Grade', dataIndex: 'grade', width: 60, render: v => <Tag color="blue">{v}</Tag> },
            { title: 'Monthly CTC', dataIndex: 'totalMonthlySalary', width: 120, render: v => <Text strong style={{ color: '#1A6FB5' }}>{fmtI(v)}</Text> },
            { title: 'Annual CTC', dataIndex: 'totalMonthlySalary', width: 120, render: v => fmtL(v * 12) },
          ]} />
        </Card>
      </div>
    )},

    // ===== FINANCE TAB =====
    { key: 'finance', label: <Space><BankOutlined />Finance & Loans</Space>, children: (
      <div>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={6}><Card className="stat-card"><Statistic title="Active Loans" value={s.loans?.activeCount || 0} prefix={<MoneyCollectOutlined style={{ color: '#D97706' }} />} /></Card></Col>
          <Col span={6}><Card className="stat-card"><Statistic title="Total Disbursed" value={s.loans?.totalLoanDisbursed || 0} formatter={v => fmtL(v)} /></Card></Col>
          <Col span={6}><Card className="stat-card"><Statistic title="Outstanding" value={s.loans?.totalLoanOutstanding || 0} formatter={v => fmtL(v)} valueStyle={{ color: '#DC2626' }} /></Card></Col>
          <Col span={6}><Card className="stat-card"><Statistic title="Pending Approvals" value={s.pending?.loans || 0} valueStyle={{ color: '#D97706' }} /></Card></Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title="Employer Statutory Cost Trend" bordered={false}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={payrollTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={v => fmtK(v)} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={v => fmtK(v)} />
                  <Legend />
                  <Bar dataKey="pf" name="PF (ER)" fill="#8B5CF6" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="esi" name="ESI (ER)" fill="#EC4899" radius={[4, 4, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="Last Month Cost Allocation" bordered={false}>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={[
                    { name: 'Net Salary', value: s.lastRun?.totalNet || 0 },
                    { name: 'PF (EE+ER)', value: s.statutory?.pfTotal || 0 },
                    { name: 'ESI (EE+ER)', value: s.statutory?.esiTotal || 0 },
                    { name: 'TDS', value: s.statutory?.tdsTotal || 0 },
                    { name: 'Loan Recovery', value: s.statutory?.loanDeductions || 0 },
                  ].filter(d => d.value > 0)} cx="50%" cy="50%" outerRadius={90} innerRadius={45} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {[0,1,2,3,4].map(i => <Cell key={i} fill={C[i]} />)}
                  </Pie>
                  <Tooltip formatter={v => fmtI(v)} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>
      </div>
    )},

    // ===== COMPLIANCE TAB =====
    { key: 'compliance', label: <Space><SafetyCertificateOutlined />Compliance</Space>, children: (
      <div>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={6}><Card className="stat-card"><Statistic title="PF Cost (EE+ER)" value={s.statutory?.pfTotal || 0} formatter={v => fmtK(v)} prefix={<SafetyCertificateOutlined style={{ color: '#8B5CF6' }} />} /></Card></Col>
          <Col span={6}><Card className="stat-card"><Statistic title="ESI Cost (EE+ER)" value={s.statutory?.esiTotal || 0} formatter={v => fmtI(v)} /></Card></Col>
          <Col span={6}><Card className="stat-card"><Statistic title="TDS Deducted" value={s.statutory?.tdsTotal || 0} formatter={v => fmtI(v)} valueStyle={{ color: '#DC2626' }} /></Card></Col>
          <Col span={6}><Card className="stat-card"><Statistic title="Comp-Off Balance" value={s.pending?.compOffBalance || 0} suffix="days" prefix={<ClockCircleOutlined style={{ color: '#D97706' }} />} /></Card></Col>
        </Row>

        <Card title="Compliance Checklist" bordered={false}>
          <Table size="small" pagination={false} dataSource={[
            { key: '1', item: 'PF Filing (ECR)', due: '15th of next month', status: s.lastRun ? 'Ready' : 'Pending', ok: !!s.lastRun },
            { key: '2', item: 'ESI Filing', due: '15th of next month', status: s.lastRun ? 'Ready' : 'Pending', ok: !!s.lastRun },
            { key: '3', item: 'TDS Deposit', due: '7th of next month', status: (s.statutory?.tdsTotal || 0) > 0 ? 'Due' : 'N/A', ok: (s.statutory?.tdsTotal || 0) === 0 },
            { key: '4', item: 'Professional Tax', due: 'Monthly/Quarterly', status: 'Regular', ok: true },
            { key: '5', item: 'LWF', due: 'June & December', status: 'Bi-annual', ok: true },
            { key: '6', item: 'Form 16 (Annual)', due: '15th June', status: 'Annual', ok: true },
            { key: '7', item: 'Form 24Q (Quarterly)', due: 'Quarterly', status: 'Quarterly', ok: true },
            { key: '8', item: 'Bonus (Payment of Bonus Act)', due: 'Annual', status: 'Annual', ok: true },
          ]} columns={[
            { title: 'Compliance Item', dataIndex: 'item', render: v => <Text strong>{v}</Text> },
            { title: 'Due', dataIndex: 'due' },
            { title: 'Status', dataIndex: 'status', render: (v, r) => <Tag color={r.ok ? 'green' : 'orange'}>{v}</Tag> },
            { title: '', dataIndex: 'ok', render: v => v ? <CheckCircleOutlined style={{ color: '#059669' }} /> : <WarningOutlined style={{ color: '#D97706' }} /> },
          ]} />
        </Card>
      </div>
    )},
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <Title level={3} style={{ margin: 0, fontFamily: 'DM Sans' }}><RiseOutlined style={{ color: '#1A6FB5' }} /> Leadership Dashboard</Title>
          <Text type="secondary">{user?.activeEntity?.name} • FY 2025-26</Text>
        </div>
        <Space>
          <Tag color="blue">{s.activeEmp} Active Employees</Tag>
          {s.lastRun && <Tag color="green">Last Payroll: {new Date(0, s.lastRun.month - 1).toLocaleString('en', { month: 'short' })} {s.lastRun.year}</Tag>}
        </Space>
      </div>

      <Tabs items={tabs} size="large" type="card" style={{ background: 'transparent' }} />
    </div>
  );
}

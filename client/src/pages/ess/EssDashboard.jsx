import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Statistic, Button, Tag, Space, Spin, Table, Divider } from 'antd';
import { DollarOutlined, DownloadOutlined, MoneyCollectOutlined, UserOutlined, CalendarOutlined, FileTextOutlined , HomeOutlined} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../main';
import api, { downloadFile } from '../../utils/api';
const { Title, Text } = Typography;

export default function EssDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [loans, setLoans] = useState([]);
  const [runs, setRuns] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/employees', { params: { status: 'Active' } }),
      api.get('/loans'),
      api.get('/payroll/runs'),
    ]).then(([empRes, loanRes, runRes]) => {
      setProfile(empRes.data.data?.[0]);
      setLoans(loanRes.data);
      setRuns(runRes.data.filter(r => ['APPROVED', 'PAID'].includes(r.status)));
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  const activeLoans = loans.filter(l => l.status === 'ACTIVE');
  const totalOutstanding = activeLoans.reduce((s, l) => s + (l.outstandingBalance || 0), 0);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, fontFamily: 'DM Sans' }}>Welcome, {user?.firstName}!</Title>
        <Text type="secondary">Employee Self-Service Portal • {user?.empCode}</Text>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card" hoverable onClick={() => navigate('/payslips')}>
            <Statistic title="Monthly Salary" value={profile?.totalMonthlySalary || 0} prefix={<DollarOutlined style={{ color: '#1A6FB5' }} />} formatter={v => `₹${v.toLocaleString('en-IN')}`} />
            <Text type="secondary" style={{ fontSize: 11 }}>Click to view payslips →</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card" hoverable onClick={() => navigate('/loans')}>
            <Statistic title="Loan Outstanding" value={totalOutstanding} prefix={<MoneyCollectOutlined style={{ color: '#D97706' }} />} formatter={v => `₹${v.toLocaleString('en-IN')}`} />
            <Text type="secondary" style={{ fontSize: 11 }}>{activeLoans.length} active loan(s) →</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card">
            <Statistic title="Department" value={profile?.department || '-'} prefix={<UserOutlined style={{ color: '#0F2B46' }} />} valueStyle={{ fontSize: 16 }} />
            <Text type="secondary" style={{ fontSize: 11 }}>{profile?.designation} • {profile?.grade}</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card" hoverable onClick={() => navigate('/tax')}>
            <Statistic title="Tax Regime" value={profile?.taxRegime || 'NEW'} prefix={<FileTextOutlined style={{ color: '#059669' }} />} valueStyle={{ fontSize: 18 }} />
            <Text type="secondary" style={{ fontSize: 11 }}>TDS: ₹{(profile?.tdsAmount || 0).toLocaleString('en-IN')}/month →</Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title={<Space><DollarOutlined /> Recent Payslips</Space>} bordered={false} extra={<Button size="small" type="link" onClick={() => navigate('/payslips')}>View All</Button>}>
            <Table dataSource={runs.slice(0, 5)} rowKey="runId" size="small" pagination={false} columns={[
              { title: 'Period', render: (_, r) => `${new Date(0, r.month - 1).toLocaleString('en', { month: 'long' })} ${r.year}` },
              { title: 'Status', dataIndex: 'status', render: v => <Tag color="green">{v}</Tag> },
              { title: '', render: (_, r) => <Button size="small" type="primary" ghost icon={<DownloadOutlined />} onClick={() => downloadFile(`/reports/payslip-pdf/${r.runId}/${user.empCode}`)}>Download</Button> },
            ]} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={<Space><MoneyCollectOutlined /> My Loans</Space>} bordered={false} extra={<Button size="small" type="primary" onClick={() => navigate('/loan-apply')}>Apply New</Button>}>
            {loans.length > 0 ? <Table dataSource={loans} rowKey="_id" size="small" pagination={false} columns={[
              { title: 'Loan', dataIndex: 'loanId', width: 100 },
              { title: 'Amount', dataIndex: 'amount', render: v => `₹${v?.toLocaleString('en-IN')}` },
              { title: 'EMI', dataIndex: 'emiAmount', render: v => `₹${v?.toLocaleString('en-IN')}` },
              { title: 'Balance', dataIndex: 'outstandingBalance', render: v => `₹${v?.toLocaleString('en-IN')}` },
              { title: 'Status', dataIndex: 'status', render: v => <Tag color={v === 'ACTIVE' ? 'green' : v === 'APPLIED' ? 'blue' : 'default'}>{v}</Tag> },
            ]} /> : <Text type="secondary">No loans. <a onClick={() => navigate('/loan-apply')}>Apply for one?</a></Text>}
          </Card>
        </Col>
      </Row>

      {profile && (
        <Card title={<Space><UserOutlined /> My Profile</Space>} bordered={false} style={{ marginTop: 16 }}>
          <Row gutter={[24, 12]}>
            <Col span={6}><Text type="secondary">Employee Code</Text><br /><Text strong>{profile.empCode}</Text></Col>
            <Col span={6}><Text type="secondary">Name</Text><br /><Text strong>{profile.firstName} {profile.lastName}</Text></Col>
            <Col span={6}><Text type="secondary">Department</Text><br /><Text strong>{profile.department}</Text></Col>
            <Col span={6}><Text type="secondary">Designation</Text><br /><Text strong>{profile.designation || '-'}</Text></Col>
            <Col span={6}><Text type="secondary">Grade</Text><br /><Tag color="blue">{profile.grade || '-'}</Tag></Col>
            <Col span={6}><Text type="secondary">Role</Text><br /><Text>{profile.role || '-'}</Text></Col>
            <Col span={6}><Text type="secondary">DOJ</Text><br /><Text>{profile.dateOfJoining ? new Date(profile.dateOfJoining).toLocaleDateString('en-IN') : '-'}</Text></Col>
            <Col span={6}><Text type="secondary">Location</Text><br /><Text>{profile.workLocation}</Text></Col>
          </Row>
          <Divider />
          <Row gutter={[24, 12]}>
            <Col span={6}><Text type="secondary">Basic</Text><br /><Text strong>₹{(profile.basicSalary || 0).toLocaleString('en-IN')}</Text></Col>
            <Col span={6}><Text type="secondary">HRA</Text><br /><Text strong>₹{(profile.hra || 0).toLocaleString('en-IN')}</Text></Col>
            <Col span={6}><Text type="secondary">Conv & Others</Text><br /><Text strong>₹{(profile.conveyanceAndOthers || 0).toLocaleString('en-IN')}</Text></Col>
            <Col span={6}><Text type="secondary">Total Monthly</Text><br /><Text strong style={{ fontSize: 16, color: '#1A6FB5' }}>₹{(profile.totalMonthlySalary || 0).toLocaleString('en-IN')}</Text></Col>
          </Row>
        </Card>
      )}
    </div>
  );
}

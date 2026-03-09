import React, { useState, useEffect } from 'react';
import { Card, Typography, Table, Tag, Space, Button, Select, Row, Col, Statistic, message, Modal, Form, InputNumber, Input, Rate, Tabs, Badge, Alert } from 'antd';
import { TrophyOutlined, CheckCircleOutlined, SettingOutlined, TeamOutlined, DollarOutlined } from '@ant-design/icons';
import { useAuth } from '../../main';
import api from '../../utils/api';
const { Title, Text } = Typography;

const QUARTERS = [{ value: 'Q1', label: 'Q1 (Apr-Jun)' }, { value: 'Q2', label: 'Q2 (Jul-Sep)' }, { value: 'Q3', label: 'Q3 (Oct-Dec)' }, { value: 'Q4', label: 'Q4 (Jan-Mar)' }];
const RATINGS = { 1: { label: 'Below Average', color: '#DC2626' }, 2: { label: 'Average', color: '#D97706' }, 3: { label: 'Good', color: '#2563EB' }, 4: { label: 'Excellent', color: '#059669' }, 5: { label: 'Outstanding', color: '#7C3AED' } };
const STATUS_COLOR = { PENDING: 'default', ASSESSED: 'blue', APPROVED: 'green', DISBURSED: 'cyan', REJECTED: 'red' };

export default function PLIAssessment() {
  const { user } = useAuth();
  const isManager = user?.role === 'MANAGER';
  const isHR = ['HR', 'SUPER_ADMIN', 'FINANCE'].includes(user?.role);
  const [assessments, setAssessments] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quarter, setQuarter] = useState('Q4');
  const [year, setYear] = useState(2026);
  const [rateModal, setRateModal] = useState(null);
  const [rating, setRating] = useState(3);
  const [remarks, setRemarks] = useState('');
  const [configModal, setConfigModal] = useState(false);
  const [configForm] = Form.useForm();

  const fetch = () => {
    setLoading(true);
    Promise.all([
      api.get('/manager/pli/assessments', { params: { quarter, year } }),
      isHR ? api.get('/manager/pli/config').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
    ]).then(([a, c]) => { setAssessments(a.data); setConfigs(c.data); }).finally(() => setLoading(false));
  };
  useEffect(fetch, [quarter, year]);

  const submitRating = async () => {
    try {
      await api.put(`/manager/pli/assess/${rateModal._id}`, { rating, managerRemarks: remarks });
      message.success(`Rated ${rateModal.employeeName}: ${RATINGS[rating]?.label}`);
      setRateModal(null); setRating(3); setRemarks(''); fetch();
    } catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  };

  const approvePLI = async (id) => { try { await api.post(`/manager/pli/approve/${id}`); message.success('Approved'); fetch(); } catch { message.error('Failed'); } };
  const bulkApprove = async () => { try { await api.post('/manager/pli/bulk-approve', { quarter, year }); message.success('All assessed PLIs approved'); fetch(); } catch { message.error('Failed'); } };

  const initiate = async () => {
    try { const { data } = await api.post('/manager/pli/initiate', { quarter, year }); message.success(data.message); fetch(); }
    catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  };

  const createConfig = async (values) => {
    try {
      const ratingScale = [
        { rating: 1, label: 'Below Average', pliPercentage: values.pct1 || 0 },
        { rating: 2, label: 'Average', pliPercentage: values.pct2 || 0 },
        { rating: 3, label: 'Good', pliPercentage: values.pct3 || 0 },
        { rating: 4, label: 'Excellent', pliPercentage: values.pct4 || 0 },
        { rating: 5, label: 'Outstanding', pliPercentage: values.pct5 || 0 },
      ];
      await api.post('/manager/pli/config', { quarter, year, calculationBase: values.calculationBase || 'BASIC', ratingScale, maxPercentage: values.pct5 || 100 });
      message.success('PLI config created'); setConfigModal(false); configForm.resetFields(); fetch();
    } catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  };

  const totalPLI = assessments.filter(a => ['ASSESSED', 'APPROVED'].includes(a.status)).reduce((s, a) => s + (a.pliAmount || 0), 0);
  const assessed = assessments.filter(a => a.status !== 'PENDING').length;
  const currentConfig = configs.find(c => c.quarter === quarter && c.year === year);

  return (
    <div>
      <div className="page-header">
        <div>
          <Title level={3} style={{ margin: 0, fontFamily: 'DM Sans' }}><TrophyOutlined style={{ color: '#EA580C' }} /> PLI Assessment</Title>
          <Text type="secondary">Performance Linked Incentive — Quarterly Assessment</Text>
        </div>
        <Space>
          <Select value={quarter} onChange={setQuarter} options={QUARTERS} style={{ width: 140 }} />
          <Select value={year} onChange={setYear} options={[2025, 2026, 2027].map(y => ({ label: y, value: y }))} style={{ width: 90 }} />
          {isHR && <Button icon={<SettingOutlined />} onClick={() => setConfigModal(true)}>Config</Button>}
          {isHR && <Button type="primary" onClick={initiate}>Initiate PLI</Button>}
          {isHR && assessed > 0 && <Button type="primary" style={{ background: '#059669' }} onClick={bulkApprove}>Approve All Assessed</Button>}
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}><Card className="stat-card"><Statistic title="Total Employees" value={assessments.length} prefix={<TeamOutlined />} /></Card></Col>
        <Col span={6}><Card className="stat-card"><Statistic title="Assessed" value={assessed} suffix={`/ ${assessments.length}`} valueStyle={{ color: '#059669' }} /></Card></Col>
        <Col span={6}><Card className="stat-card"><Statistic title="Total PLI Amount" value={totalPLI} prefix="₹" formatter={v => v.toLocaleString('en-IN')} valueStyle={{ color: '#EA580C' }} /></Card></Col>
        <Col span={6}><Card className="stat-card"><Statistic title="Avg PLI %" value={assessed > 0 ? (assessments.filter(a => a.status !== 'PENDING').reduce((s, a) => s + (a.pliPercentage || 0), 0) / assessed).toFixed(1) : 0} suffix="%" /></Card></Col>
      </Row>

      {!currentConfig && isHR && <Alert message="No PLI configuration for this quarter. Click Config to set up rating scale and percentages." type="warning" showIcon style={{ marginBottom: 16 }} />}

      <Card bordered={false}>
        <Table dataSource={assessments} rowKey="_id" loading={loading} size="small" pagination={{ pageSize: 20 }} columns={[
          { title: 'Code', dataIndex: 'empCode', width: 80, render: v => <Text strong>{v}</Text> },
          { title: 'Name', dataIndex: 'employeeName' },
          { title: 'Department', dataIndex: 'department', width: 120 },
          { title: 'Base (3m)', dataIndex: 'baseAmount', width: 100, render: v => `₹${(v || 0).toLocaleString('en-IN')}` },
          { title: 'Rating', dataIndex: 'rating', width: 80, render: (v, r) => v ? <Tag color={RATINGS[v]?.color}>{v}/5 {RATINGS[v]?.label}</Tag> : <Tag>-</Tag> },
          { title: 'PLI %', dataIndex: 'pliPercentage', width: 60, render: v => v ? `${v}%` : '-' },
          { title: 'PLI Amount', dataIndex: 'pliAmount', width: 100, render: v => v ? <Text strong style={{ color: '#059669' }}>₹{v.toLocaleString('en-IN')}</Text> : '-' },
          { title: 'Status', dataIndex: 'status', width: 90, render: v => <Tag color={STATUS_COLOR[v]}>{v}</Tag> },
          { title: 'Actions', width: 140, render: (_, r) => (
            <Space size={4}>
              {(isManager || isHR) && r.status === 'PENDING' && <Button size="small" type="primary" onClick={() => { setRateModal(r); setRating(3); setRemarks(''); }}>Rate</Button>}
              {isHR && r.status === 'ASSESSED' && <Button size="small" type="primary" style={{ background: '#059669' }} icon={<CheckCircleOutlined />} onClick={() => approvePLI(r._id)}>Approve</Button>}
            </Space>
          )},
        ]} />
      </Card>

      {/* Rate Modal */}
      <Modal title={`Rate: ${rateModal?.employeeName}`} open={!!rateModal} onCancel={() => setRateModal(null)} onOk={submitRating} okText="Submit Rating" width={450}>
        {rateModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: 12, background: '#F8FAFC', borderRadius: 8 }}>
              <Text type="secondary">{rateModal.empCode} • {rateModal.department} • {rateModal.designation}</Text><br />
              <Text>Base Amount (3 months): <Text strong>₹{(rateModal.baseAmount || 0).toLocaleString('en-IN')}</Text></Text>
            </div>
            <div>
              <Text strong>Performance Rating</Text>
              <div style={{ marginTop: 8 }}><Rate value={rating} onChange={setRating} tooltips={['Below Average', 'Average', 'Good', 'Excellent', 'Outstanding']} /></div>
              <Tag color={RATINGS[rating]?.color} style={{ marginTop: 4 }}>{RATINGS[rating]?.label} ({currentConfig?.ratingScale?.find(r => r.rating === rating)?.pliPercentage || 0}%)</Tag>
            </div>
            <div>
              <Text strong>Manager Remarks</Text>
              <Input.TextArea value={remarks} onChange={e => setRemarks(e.target.value)} rows={3} placeholder="Performance notes..." />
            </div>
          </div>
        )}
      </Modal>

      {/* Config Modal */}
      <Modal title={`PLI Config: ${quarter} ${year}`} open={configModal} onCancel={() => setConfigModal(false)} onOk={() => configForm.submit()} okText="Save Config" width={500}>
        <Form form={configForm} layout="vertical" onFinish={createConfig} initialValues={{ calculationBase: 'BASIC', pct1: 0, pct2: 5, pct3: 10, pct4: 15, pct5: 20 }}>
          <Form.Item name="calculationBase" label="Calculation Base"><Select options={[{ label: 'Basic Salary', value: 'BASIC' }, { label: 'Gross Salary', value: 'GROSS' }]} /></Form.Item>
          <Text strong>Rating → PLI Percentage</Text>
          <Row gutter={8} style={{ marginTop: 8 }}>
            <Col span={5}><Form.Item name="pct1" label="★ 1"><InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" /></Form.Item></Col>
            <Col span={5}><Form.Item name="pct2" label="★ 2"><InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" /></Form.Item></Col>
            <Col span={5}><Form.Item name="pct3" label="★ 3"><InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" /></Form.Item></Col>
            <Col span={5}><Form.Item name="pct4" label="★ 4"><InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" /></Form.Item></Col>
            <Col span={4}><Form.Item name="pct5" label="★ 5"><InputNumber min={0} max={100} style={{ width: '100%' }} addonAfter="%" /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}

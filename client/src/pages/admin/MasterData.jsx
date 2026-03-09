import React, { useState, useEffect } from 'react';
import { Card, Typography, Table, Button, Modal, Form, Input, InputNumber, Select, Switch, Space, Tag, message, Popconfirm, Row, Col, Badge } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DatabaseOutlined, ArrowLeftOutlined, TeamOutlined, CalendarOutlined, DollarOutlined, BankOutlined, EnvironmentOutlined, FileOutlined, ClockCircleOutlined, SafetyCertificateOutlined, IdcardOutlined, AppstoreOutlined, RiseOutlined } from '@ant-design/icons';
import api from '../../utils/api';
const { Title, Text } = Typography;

const CATEGORIES = [
  { key: 'DEPARTMENT', label: 'Departments', icon: <TeamOutlined />, color: '#1A6FB5', desc: 'Engineering, Product, HR, etc.' },
  { key: 'DESIGNATION', label: 'Designations', icon: <IdcardOutlined />, color: '#7C3AED', desc: 'Engineer, Manager, Director, etc.' },
  { key: 'GRADE', label: 'Grades', icon: <RiseOutlined />, color: '#059669', desc: 'A1, A2, B1, B2, C1 levels' },
  { key: 'EMPLOYMENT_TYPE', label: 'Employment Types', icon: <AppstoreOutlined />, color: '#D97706', desc: 'Permanent, Contract, Intern' },
  { key: 'LEAVE_TYPE', label: 'Leave Types', icon: <CalendarOutlined />, color: '#DC2626', desc: 'CL, SL, EL, Maternity, etc.' },
  { key: 'LOAN_TYPE', label: 'Loan Types', icon: <DollarOutlined />, color: '#0891B2', desc: 'Salary Advance, Personal, Emergency' },
  { key: 'PAYMENT_MODE', label: 'Payment Modes', icon: <BankOutlined />, color: '#4F46E5', desc: 'HDFC Transfer, NEFT, RTGS' },
  { key: 'LOCATION', label: 'Locations', icon: <EnvironmentOutlined />, color: '#16A34A', desc: 'Office locations and WFH' },
  { key: 'DOCUMENT_TYPE', label: 'Document Types', icon: <FileOutlined />, color: '#EA580C', desc: 'Aadhaar, PAN, Certificates' },
  { key: 'HOLIDAY_TYPE', label: 'Holiday Types', icon: <SafetyCertificateOutlined />, color: '#BE185D', desc: 'National, State, Company' },
  { key: 'SHIFT', label: 'Shifts', icon: <ClockCircleOutlined />, color: '#6D28D9', desc: 'General, Morning, Evening, Night' },
];

const LEAVE_META = [
  { name: ['metadata', 'maxDaysPerYear'], label: 'Max Days/Year', type: 'number' },
  { name: ['metadata', 'isPaid'], label: 'Paid Leave', type: 'switch' },
  { name: ['metadata', 'carryForward'], label: 'Carry Forward', type: 'switch' },
];
const GRADE_META = [
  { name: ['metadata', 'level'], label: 'Level', type: 'number' },
  { name: ['metadata', 'minSalary'], label: 'Min Salary (₹)', type: 'number' },
  { name: ['metadata', 'maxSalary'], label: 'Max Salary (₹)', type: 'number' },
];

export default function MasterDataPage() {
  const [selectedCat, setSelectedCat] = useState(null);
  const [data, setData] = useState([]);
  const [catCounts, setCatCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    api.get('/masters', { params: { active: 'all' } }).then(({ data }) => {
      const counts = {};
      data.forEach(d => { counts[d.category] = (counts[d.category] || 0) + 1; });
      setCatCounts(counts);
    });
  }, []);

  const fetchCat = (cat) => {
    setLoading(true);
    api.get(`/masters/category/${cat}`).then(({ data }) => setData(data)).finally(() => setLoading(false));
  };

  useEffect(() => { if (selectedCat) fetchCat(selectedCat); }, [selectedCat]);

  const save = async (values) => {
    try {
      if (editing) { await api.put(`/masters/${editing._id}`, { ...values, category: selectedCat }); message.success('Updated'); }
      else { await api.post('/masters', { ...values, category: selectedCat }); message.success('Created'); }
      setModal(false); setEditing(null); form.resetFields(); fetchCat(selectedCat);
      setCatCounts(prev => ({ ...prev, [selectedCat]: editing ? prev[selectedCat] : (prev[selectedCat] || 0) + 1 }));
    } catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  };

  const del = async (id) => {
    try { await api.delete(`/masters/${id}`); message.success('Deleted'); fetchCat(selectedCat);
      setCatCounts(prev => ({ ...prev, [selectedCat]: Math.max((prev[selectedCat] || 1) - 1, 0) }));
    } catch { message.error('Failed'); }
  };

  const catInfo = CATEGORIES.find(c => c.key === selectedCat);
  const metaFields = selectedCat === 'LEAVE_TYPE' ? LEAVE_META : selectedCat === 'GRADE' ? GRADE_META : [];

  const cols = [
    { title: 'Code', dataIndex: 'code', width: 130, render: v => <Tag style={{ fontFamily: 'monospace' }}>{v}</Tag> },
    { title: 'Name', dataIndex: 'name', width: 200, render: v => <Text strong>{v}</Text> },
    { title: 'Description', dataIndex: 'description', ellipsis: true },
    { title: 'Order', dataIndex: 'sortOrder', width: 60 },
    { title: 'Active', dataIndex: 'isActive', width: 65, render: v => v ? <Tag color="success">Active</Tag> : <Tag color="error">Inactive</Tag> },
  ];

  if (selectedCat === 'LEAVE_TYPE') {
    cols.splice(3, 0, { title: 'Max Days', width: 75, render: (_, r) => r.metadata?.maxDaysPerYear ?? '-' });
    cols.splice(4, 0, { title: 'Paid', width: 55, render: (_, r) => r.metadata?.isPaid ? <Tag color="success">Yes</Tag> : <Tag>No</Tag> });
    cols.splice(5, 0, { title: 'Carry', width: 55, render: (_, r) => r.metadata?.carryForward ? <Tag color="processing">Yes</Tag> : <Tag>No</Tag> });
  }
  if (selectedCat === 'GRADE') {
    cols.splice(3, 0, { title: 'Level', width: 55, render: (_, r) => r.metadata?.level ?? '-' });
    cols.splice(4, 0, { title: 'Salary Range', width: 160, render: (_, r) => r.metadata?.minSalary ? `₹${r.metadata.minSalary.toLocaleString('en-IN')} – ₹${(r.metadata.maxSalary || 0).toLocaleString('en-IN')}` : '-' });
  }

  cols.push({ title: '', width: 80, render: (_, r) => (
    <Space size={4}>
      <Button size="small" type="text" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue({ ...r, metadata: r.metadata || {} }); setModal(true); }} />
      <Popconfirm title="Delete?" onConfirm={() => del(r._id)}><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Popconfirm>
    </Space>
  )});

  // CARD VIEW
  if (!selectedCat) {
    return (
      <div>
        <div className="page-header">
          <div><Title level={3} style={{ margin: 0, fontFamily: 'DM Sans' }}><AppstoreOutlined style={{ color: '#7C3AED' }} /> Master Data Management</Title><Text type="secondary">Configure lookup values used across the payroll system</Text></div>
          <Tag style={{ fontSize: 12, padding: '4px 12px' }}>{Object.values(catCounts).reduce((s, v) => s + v, 0)} total records in {CATEGORIES.length} categories</Tag>
        </div>
        <Row gutter={[16, 16]}>
          {CATEGORIES.map((cat, i) => (
            <Col xs={24} sm={12} md={8} lg={6} key={cat.key}>
              <div className="master-card" onClick={() => setSelectedCat(cat.key)} style={{ animationDelay: `${i * 0.05}s`, animation: 'fadeInUp 0.4s ease-out backwards' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: `${cat.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cat.color, fontSize: 16 }}>
                    {cat.icon}
                  </div>
                </div>
                <div className="master-card-count">{catCounts[cat.key] || 0}</div>
                <div className="master-card-label">{cat.label}</div>
                <div className="master-card-sub">{cat.desc}</div>
              </div>
            </Col>
          ))}
        </Row>
      </div>
    );
  }

  // TABLE VIEW
  return (
    <div>
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => setSelectedCat(null)} type="text" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: `${catInfo?.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: catInfo?.color, fontSize: 16 }}>{catInfo?.icon}</div>
            <div><Title level={4} style={{ margin: 0, fontFamily: 'DM Sans' }}>{catInfo?.label}</Title><Text type="secondary">{data.length} entries</Text></div>
          </div>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); form.setFieldsValue({ isActive: true, sortOrder: data.length }); setModal(true); }}>
          Add {catInfo?.label?.replace(/s$/, '')}
        </Button>
      </div>
      <Card bordered={false}>
        <Table dataSource={data} columns={cols} loading={loading} rowKey="_id" size="small" pagination={false} />
      </Card>
      <Modal title={editing ? `Edit ${catInfo?.label?.replace(/s$/, '')}` : `Add ${catInfo?.label?.replace(/s$/, '')}`} open={modal} onCancel={() => { setModal(false); setEditing(null); }} onOk={() => form.submit()} width={520}>
        <Form form={form} layout="vertical" onFinish={save} initialValues={{ isActive: true, sortOrder: 0 }}>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="code" label="Code" rules={[{ required: true }]}><Input placeholder="CODE" /></Form.Item></Col>
            <Col span={12}><Form.Item name="name" label="Display Name" rules={[{ required: true }]}><Input /></Form.Item></Col>
          </Row>
          <Form.Item name="description" label="Description"><Input.TextArea rows={2} /></Form.Item>
          <Row gutter={12}>
            <Col span={8}><Form.Item name="sortOrder" label="Sort Order"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
            <Col span={8}><Form.Item name="isActive" label="Active" valuePropName="checked"><Switch /></Form.Item></Col>
          </Row>
          {metaFields.length > 0 && (<>
            <Text strong style={{ display: 'block', margin: '8px 0' }}>Category Settings</Text>
            <Row gutter={12}>{metaFields.map(mf => (
              <Col span={8} key={mf.name.join('.')}><Form.Item name={mf.name} label={mf.label} valuePropName={mf.type === 'switch' ? 'checked' : 'value'}>
                {mf.type === 'switch' ? <Switch /> : <InputNumber style={{ width: '100%' }} min={0} />}
              </Form.Item></Col>
            ))}</Row>
          </>)}
        </Form>
      </Modal>
    </div>
  );
}

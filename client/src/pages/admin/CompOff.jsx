import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Table, Tag, message, Modal, Form, Input, InputNumber, DatePicker, Space, Tabs, Popconfirm, Statistic, Row, Col } from 'antd';
import { PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, DollarOutlined, DeleteOutlined, CalendarOutlined, SwapOutlined} from '@ant-design/icons';
import EmployeeSelect from '../../components/common/EmployeeSelect';
import api from '../../utils/api';

const { Title, Text } = Typography;

export default function CompOffPage() {
  const [compOffs, setCompOffs] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [earnModal, setEarnModal] = useState(false);
  const [form] = Form.useForm();
  const [tab, setTab] = useState('records');

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get('/compoff'),
      api.get('/compoff/balance'),
    ]).then(([records, bals]) => {
      setCompOffs(records.data);
      setBalances(bals.data);
    }).finally(() => setLoading(false));
  };

  useEffect(fetchData, []);

  const earnCompOff = async (values) => {
    try {
      await api.post('/compoff/earn', {
        empCode: values.empCode,
        earnedDate: values.earnedDate.toISOString(),
        earnedDays: values.earnedDays,
        earnedReason: values.earnedReason,
        remarks: values.remarks,
      });
      message.success('Comp-off created');
      setEarnModal(false);
      form.resetFields();
      fetchData();
    } catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  };

  const approve = async (id) => {
    try { await api.post(`/compoff/${id}/approve`); message.success('Approved'); fetchData(); }
    catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  };

  const reject = async (id) => {
    try { await api.post(`/compoff/${id}/reject`); message.success('Rejected'); fetchData(); }
    catch (err) { message.error('Failed'); }
  };

  const encash = async (id) => {
    try { await api.post(`/compoff/${id}/encash`); message.success('Encashed!'); fetchData(); }
    catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  };

  const avail = async (id) => {
    try { await api.post(`/compoff/${id}/avail`, { date: new Date() }); message.success('Marked as availed'); fetchData(); }
    catch (err) { message.error('Failed'); }
  };

  const del = async (id) => {
    try { await api.delete(`/compoff/${id}`); message.success('Deleted'); fetchData(); }
    catch (err) { message.error('Failed'); }
  };

  const expireOld = async () => {
    try { const { data } = await api.post('/compoff/expire'); message.success(`Expired ${data.expired} comp-offs`); fetchData(); }
    catch (err) { message.error('Failed'); }
  };

  const totalBalance = balances.reduce((s, b) => s + b.balance, 0);
  const totalEncashed = balances.reduce((s, b) => s + b.totalEncashmentAmount, 0);

  const recordCols = [
    { title: 'Employee', dataIndex: 'employeeName', width: 160 },
    { title: 'Code', dataIndex: 'empCode', width: 80 },
    { title: 'Earned On', dataIndex: 'earnedDate', width: 100, render: d => new Date(d).toLocaleDateString('en-IN') },
    { title: 'Days', dataIndex: 'earnedDays', width: 60 },
    { title: 'Reason', dataIndex: 'earnedReason', width: 150, ellipsis: true },
    { title: 'Expiry', dataIndex: 'expiryDate', width: 100, render: d => d ? new Date(d).toLocaleDateString('en-IN') : '-' },
    { title: 'Encashment', dataIndex: 'encashmentAmount', width: 100, render: v => v > 0 ? <Text strong style={{ color: '#27ae60' }}>₹{v.toLocaleString('en-IN')}</Text> : '-' },
    { title: 'Status', dataIndex: 'status', width: 90, render: v => {
      const colors = { PENDING: 'orange', APPROVED: 'blue', ENCASHED: 'green', AVAILED: 'cyan', EXPIRED: 'red', REJECTED: 'default' };
      return <Tag color={colors[v]}>{v}</Tag>;
    }},
    { title: 'Actions', key: 'actions', width: 220, render: (_, r) => (
      <Space size="small">
        {r.status === 'PENDING' && <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => approve(r._id)}>Approve</Button>}
        {r.status === 'PENDING' && <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => reject(r._id)} />}
        {r.status === 'APPROVED' && <Button size="small" style={{ color: '#27ae60', borderColor: '#27ae60' }} icon={<DollarOutlined />} onClick={() => encash(r._id)}>Encash</Button>}
        {r.status === 'APPROVED' && <Button size="small" icon={<CalendarOutlined />} onClick={() => avail(r._id)}>Avail</Button>}
        <Popconfirm title="Delete?" onConfirm={() => del(r._id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    )},
  ];

  const balanceCols = [
    { title: 'Employee', dataIndex: 'employeeName', width: 160 },
    { title: 'Code', dataIndex: 'empCode', width: 80 },
    { title: 'Monthly Salary', dataIndex: 'monthlySalary', width: 100, render: v => `₹${v.toLocaleString('en-IN')}` },
    { title: 'Daily Rate', dataIndex: 'dailyRate', width: 80, render: v => `₹${v.toLocaleString('en-IN')}` },
    { title: 'Total Earned', dataIndex: 'totalEarned', width: 90 },
    { title: 'Encashed', dataIndex: 'totalEncashed', width: 80, render: v => <Tag color="green">{v}</Tag> },
    { title: 'Availed', dataIndex: 'totalAvailed', width: 70 },
    { title: 'Expired', dataIndex: 'totalExpired', width: 70, render: v => v > 0 ? <Tag color="red">{v}</Tag> : 0 },
    { title: 'Pending', dataIndex: 'totalPending', width: 70, render: v => v > 0 ? <Tag color="orange">{v}</Tag> : 0 },
    { title: 'Balance', dataIndex: 'balance', width: 80, render: v => <Text strong style={{ color: '#1B4F72' }}>{v}</Text> },
    { title: 'Total Encashed ₹', dataIndex: 'totalEncashmentAmount', width: 110, render: v => v > 0 ? `₹${v.toLocaleString('en-IN')}` : '-' },
  ];

  const tabs = [
    {
      key: 'records', label: `All Records (${compOffs.length})`,
      children: <Table dataSource={compOffs} columns={recordCols} loading={loading} rowKey="_id" size="small" scroll={{ x: 1200 }} pagination={{ pageSize: 50 }} />,
    },
    {
      key: 'balance', label: `Balance Summary (${balances.length})`,
      children: <Table dataSource={balances} columns={balanceCols} loading={loading} rowKey="empCode" size="small" scroll={{ x: 1100 }} />,
    },
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={3} style={{ margin: 0 }}><SwapOutlined style={{ color: '#8B5CF6' }} /> Comp-Off Management</Title>
        <Space>
          <Button onClick={expireOld}>Expire Old</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEarnModal(true)}>Earn Comp-Off</Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card className="stat-card"><Statistic title="Total Records" value={compOffs.length} /></Card></Col>
        <Col span={6}><Card className="stat-card"><Statistic title="Pending Approval" value={compOffs.filter(c => c.status === 'PENDING').length} valueStyle={{ color: '#e67e22' }} /></Card></Col>
        <Col span={6}><Card className="stat-card"><Statistic title="Available Balance" value={totalBalance} suffix="days" valueStyle={{ color: '#1B4F72' }} /></Card></Col>
        <Col span={6}><Card className="stat-card"><Statistic title="Total Encashed" value={totalEncashed} prefix="₹" formatter={v => v.toLocaleString('en-IN')} valueStyle={{ color: '#27ae60' }} /></Card></Col>
      </Row>

      <Card bordered={false}>
        <Tabs items={tabs} activeKey={tab} onChange={setTab} />
      </Card>

      <Modal title="Earn Comp-Off" open={earnModal} onCancel={() => setEarnModal(false)} onOk={() => form.submit()} okText="Create">
        <Form form={form} layout="vertical" onFinish={earnCompOff} initialValues={{ earnedDays: 1 }}>
          <Form.Item name="empCode" label="Employee" rules={[{ required: true }]}>
            <EmployeeSelect />
          </Form.Item>
          <Form.Item name="earnedDate" label="Date Worked (Weekend/Holiday)" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="earnedDays" label="Days" rules={[{ required: true }]}>
            <InputNumber min={0.5} max={2} step={0.5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="earnedReason" label="Reason">
            <Input placeholder="Project deadline / Client delivery / Production issue" />
          </Form.Item>
          <Form.Item name="remarks" label="Remarks">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Table, Tag, message, Modal, Form, Input, Select, DatePicker, Space, Row, Col, Statistic, Popconfirm } from 'antd';
import { PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, DeleteOutlined, ScheduleOutlined} from '@ant-design/icons';
import EmployeeSelect from '../../components/common/EmployeeSelect';
import { useAuth } from '../../main';
import api from '../../utils/api';
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function Leaves() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [form] = Form.useForm();

  const fetch = () => { setLoading(true); api.get('/leaves').then(({ data }) => setLeaves(data)).catch(console.error).finally(() => setLoading(false)); };
  useEffect(fetch, []);

  const apply = async (values) => {
    try {
      const [fromDate, toDate] = values.dateRange;
      const days = Math.ceil((toDate.toDate() - fromDate.toDate()) / (1000 * 60 * 60 * 24)) + 1;
      await api.post('/leaves', { empCode: values.empCode || user.empCode, leaveType: values.leaveType, fromDate: fromDate.toISOString(), toDate: toDate.toISOString(), days, reason: values.reason });
      message.success('Leave applied'); setModal(false); form.resetFields(); fetch();
    } catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  };

  const approve = async (id) => { try { await api.post(`/leaves/${id}/approve`); message.success('Approved'); fetch(); } catch { message.error('Failed'); } };
  const reject = async (id) => { try { await api.post(`/leaves/${id}/reject`, { reason: 'Rejected' }); message.success('Rejected'); fetch(); } catch { message.error('Failed'); } };
  const del = async (id) => { try { await api.delete(`/leaves/${id}`); message.success('Deleted'); fetch(); } catch { message.error('Failed'); } };

  const pending = leaves.filter(l => l.status === 'APPLIED').length;
  const approved = leaves.filter(l => l.status === 'APPROVED').length;

  return (
    <div>
      <div className="page-header">
        <Title level={3} style={{ margin: 0, fontFamily: 'DM Sans' }}><ScheduleOutlined style={{ color: '#16A34A' }} /> Leave Management</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModal(true)}>Apply Leave</Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card className="stat-card"><Statistic title="Total Applications" value={leaves.length} /></Card></Col>
        <Col span={6}><Card className="stat-card"><Statistic title="Pending" value={pending} valueStyle={{ color: '#D97706' }} /></Card></Col>
        <Col span={6}><Card className="stat-card"><Statistic title="Approved" value={approved} valueStyle={{ color: '#059669' }} /></Card></Col>
        <Col span={6}><Card className="stat-card"><Statistic title="Rejected" value={leaves.filter(l => l.status === 'REJECTED').length} valueStyle={{ color: '#DC2626' }} /></Card></Col>
      </Row>

      <Card bordered={false}>
        <Table dataSource={leaves} loading={loading} rowKey="_id" size="small" columns={[
          { title: 'Employee', dataIndex: 'employeeName', width: 150 },
          { title: 'Code', dataIndex: 'empCode', width: 80 },
          { title: 'Type', dataIndex: 'leaveType', width: 60, render: v => <Tag color="blue">{v}</Tag> },
          { title: 'From', dataIndex: 'fromDate', width: 100, render: d => new Date(d).toLocaleDateString('en-IN') },
          { title: 'To', dataIndex: 'toDate', width: 100, render: d => new Date(d).toLocaleDateString('en-IN') },
          { title: 'Days', dataIndex: 'days', width: 50 },
          { title: 'Reason', dataIndex: 'reason', ellipsis: true },
          { title: 'Status', dataIndex: 'status', width: 90, render: v => <Tag color={v === 'APPROVED' ? 'green' : v === 'REJECTED' ? 'red' : 'orange'}>{v}</Tag> },
          { title: 'Actions', key: 'actions', width: 180, render: (_, r) => (
            <Space size="small">
              {r.status === 'APPLIED' && ['HR', 'MANAGER'].includes(user.role) && (
                <><Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => approve(r._id)}>Approve</Button>
                <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => reject(r._id)} /></>
              )}
              <Popconfirm title="Delete?" onConfirm={() => del(r._id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
            </Space>
          )},
        ]} />
      </Card>

      <Modal title="Apply for Leave" open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={apply}>
          {user.role !== 'EMPLOYEE' && <Form.Item name="empCode" label="Employee"><EmployeeSelect /></Form.Item>}
          <Form.Item name="leaveType" label="Leave Type" rules={[{ required: true }]}>
            <Select options={[{ label: 'Casual Leave (CL)', value: 'CL' }, { label: 'Sick Leave (SL)', value: 'SL' }, { label: 'Earned Leave (EL)', value: 'EL' }, { label: 'Comp Off (CO)', value: 'CO' }, { label: 'Leave Without Pay', value: 'LWP' }]} />
          </Form.Item>
          <Form.Item name="dateRange" label="Date Range" rules={[{ required: true }]}><RangePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="reason" label="Reason"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

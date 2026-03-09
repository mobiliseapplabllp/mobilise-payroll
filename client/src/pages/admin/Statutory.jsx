import React, { useState, useEffect } from 'react';
import { Card, Typography, Table, Tag, Button, Modal, Form, Input, InputNumber, Select, Space, message, Descriptions, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, SafetyCertificateOutlined} from '@ant-design/icons';
import api from '../../utils/api';
const { Title, Text } = Typography;

export default function Statutory() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const fetch = () => { setLoading(true); api.get('/config/statutory').then(({ data }) => setConfigs(data)).finally(() => setLoading(false)); };
  useEffect(fetch, []);

  const save = async (values) => {
    try {
      if (editing) { await api.put(`/config/statutory/${editing._id}`, values); message.success('Updated'); }
      else { await api.post('/config/statutory', { ...values, effectiveFrom: new Date() }); message.success('Created'); }
      setModal(false); setEditing(null); form.resetFields(); fetch();
    } catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  };

  const del = async (id) => { try { await api.delete(`/config/statutory/${id}`); message.success('Deleted'); fetch(); } catch { message.error('Failed'); } };

  const openEdit = (record) => { setEditing(record); form.setFieldsValue(record); setModal(true); };

  return (
    <div>
      <div className="page-header">
        <Title level={3} style={{ margin: 0 }}><SafetyCertificateOutlined style={{ color: '#DC2626' }} /> Statutory Configuration</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModal(true); }}>Add Config</Button>
      </div>
      <Card bordered={false}>
        <Table dataSource={configs} loading={loading} rowKey="_id" size="small" columns={[
          { title: 'Type', dataIndex: 'type', render: v => <Tag color="blue">{v}</Tag> },
          { title: 'Name', dataIndex: 'name' },
          { title: 'State', dataIndex: 'state' },
          { title: 'EE Rate', dataIndex: 'employeeRate', render: v => v ? `${v}%` : '-' },
          { title: 'ER Rate', dataIndex: 'employerRate', render: v => v ? `${v}%` : '-' },
          { title: 'Ceiling', dataIndex: 'wageCeiling', render: v => v ? `₹${v.toLocaleString('en-IN')}` : '-' },
          { title: 'Slabs', dataIndex: 'slabs', render: v => v?.length ? `${v.length} slabs` : '-' },
          { title: 'Active', dataIndex: 'isActive', render: v => v ? <Tag color="green">Yes</Tag> : <Tag>No</Tag> },
          { title: 'Actions', render: (_, r) => (
            <Space>
              <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
              <Popconfirm title="Delete?" onConfirm={() => del(r._id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
            </Space>
          )},
        ]} />
      </Card>
      <Modal title={editing ? 'Edit Statutory Config' : 'New Statutory Config'} open={modal} onCancel={() => { setModal(false); setEditing(null); }} onOk={() => form.submit()} width={600}>
        <Form form={form} layout="vertical" onFinish={save}>
          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Select options={['PF', 'ESI', 'PT', 'LWF', 'GRATUITY', 'BONUS', 'TAX_NEW', 'TAX_OLD'].map(t => ({ label: t, value: t }))} />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="state" label="State"><Input placeholder="ALL / HARYANA / MAHARASHTRA" /></Form.Item>
          <Form.Item name="employeeRate" label="Employee Rate (%)"><InputNumber style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="employerRate" label="Employer Rate (%)"><InputNumber style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="wageCeiling" label="Wage Ceiling (₹)"><InputNumber style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="fixedEmployeeAmount" label="Fixed EE Amount"><InputNumber style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="fixedEmployerAmount" label="Fixed ER Amount"><InputNumber style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Card, Typography, Table, Button, Tag, Space, Modal, Form, Input, Select, Switch, message, Popconfirm, Row, Col, Statistic, Tooltip, Badge } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined, UnlockOutlined, KeyOutlined, UserOutlined, SearchOutlined } from '@ant-design/icons';
import api from '../../utils/api';
const { Title, Text } = Typography;

const ROLE_COLORS = { SUPER_ADMIN: 'red', HR: 'blue', FINANCE: 'green', MANAGER: 'orange', EMPLOYEE: 'default' };

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({});
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pwdModal, setPwdModal] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [form] = Form.useForm();
  const [pwdForm] = Form.useForm();

  const fetch = () => {
    setLoading(true);
    const params = {};
    if (search) params.search = search;
    if (roleFilter !== 'all') params.role = roleFilter;
    Promise.all([
      api.get('/users', { params }),
      api.get('/users/meta/stats'),
      api.get('/entities'),
    ]).then(([uRes, sRes, eRes]) => {
      setUsers(uRes.data); setStats(sRes.data); setEntities(eRes.data);
    }).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(fetch, [search, roleFilter]);

  const save = async (values) => {
    try {
      const data = { ...values, entityIds: values.entityIds || [] };
      if (editing) { await api.put(`/users/${editing._id}`, data); message.success('Updated'); }
      else { await api.post('/users', data); message.success('User created'); }
      setModal(false); setEditing(null); form.resetFields(); fetch();
    } catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  };

  const resetPwd = async (values) => {
    try { await api.post(`/users/${pwdModal._id}/reset-password`, values); message.success(`Password reset for ${pwdModal.username}`); setPwdModal(null); pwdForm.resetFields(); }
    catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  };

  const toggleActive = async (id) => { try { await api.post(`/users/${id}/toggle-active`); message.success('Status toggled'); fetch(); } catch { message.error('Failed'); } };
  const unlock = async (id) => { try { await api.post(`/users/${id}/unlock`); message.success('Account unlocked'); fetch(); } catch { message.error('Failed'); } };
  const del = async (id) => { try { await api.delete(`/users/${id}`); message.success('Deleted'); fetch(); } catch (err) { message.error(err.response?.data?.error || 'Failed'); } };

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue({ ...record, entityIds: record.entities?.map(e => e._id) || [] });
    setModal(true);
  };

  return (
    <div>
      <div className="page-header">
        <div><Title level={3} style={{ margin: 0, fontFamily: 'DM Sans' }}><UserOutlined style={{ color: '#1A6FB5' }} /> User Management</Title><Text type="secondary">Manage system users, roles, and access</Text></div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModal(true); }}>Create User</Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}><Card className="stat-card"><Statistic title="Total Users" value={stats.total || 0} prefix={<UserOutlined />} /></Card></Col>
        <Col span={6}><Card className="stat-card"><Statistic title="Active" value={stats.active || 0} valueStyle={{ color: '#059669' }} /></Card></Col>
        <Col span={6}><Card className="stat-card"><Statistic title="Locked" value={stats.locked || 0} valueStyle={{ color: '#DC2626' }} /></Card></Col>
        <Col span={6}><Card className="stat-card">
          <Space wrap size={[4, 4]}>
            {Object.entries(stats.byRole || {}).sort().map(([role, count]) => (
              <Tag key={role} color={ROLE_COLORS[role]}>{role}: {count}</Tag>
            ))}
          </Space>
        </Card></Col>
      </Row>

      <Card bordered={false}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input.Search placeholder="Search username, name, email, code..." onSearch={setSearch} allowClear style={{ width: 300 }} />
          <Select value={roleFilter} onChange={setRoleFilter} style={{ width: 150 }} options={[
            { label: 'All Roles', value: 'all' },
            ...['SUPER_ADMIN', 'HR', 'FINANCE', 'MANAGER', 'EMPLOYEE'].map(r => ({ label: r, value: r })),
          ]} />
        </Space>

        <Table dataSource={users} loading={loading} rowKey="_id" size="small" scroll={{ x: 1200 }} pagination={{ pageSize: 50, showTotal: t => `${t} users` }} columns={[
          { title: 'Username', dataIndex: 'username', width: 100, render: v => <Text strong>{v}</Text> },
          { title: 'Name', render: (_, r) => `${r.firstName} ${r.lastName || ''}`, width: 150 },
          { title: 'Email', dataIndex: 'email', width: 200, ellipsis: true },
          { title: 'Role', dataIndex: 'role', width: 110, render: v => <Tag color={ROLE_COLORS[v]}>{v}</Tag> },
          { title: 'Emp Code', dataIndex: 'empCode', width: 80 },
          { title: 'Entities', dataIndex: 'entities', width: 150, render: v => v?.map(e => <Tag key={e._id}>{e.code}</Tag>) },
          { title: 'Active', dataIndex: 'isActive', width: 65, render: v => v ? <Badge status="success" text="Yes" /> : <Badge status="error" text="No" /> },
          { title: 'Last Login', dataIndex: 'lastLogin', width: 110, render: d => d ? new Date(d).toLocaleDateString('en-IN') : 'Never' },
          { title: 'Failed', dataIndex: 'failedAttempts', width: 55, render: v => v > 0 ? <Tag color="red">{v}</Tag> : 0 },
          { title: 'Actions', key: 'actions', width: 220, fixed: 'right', render: (_, r) => (
            <Space size="small" wrap>
              <Tooltip title="Edit"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
              <Tooltip title="Reset Password"><Button size="small" icon={<KeyOutlined />} onClick={() => { setPwdModal(r); pwdForm.resetFields(); }} /></Tooltip>
              <Tooltip title={r.isActive ? 'Deactivate' : 'Activate'}><Button size="small" icon={r.isActive ? <LockOutlined /> : <UnlockOutlined />} danger={r.isActive} onClick={() => toggleActive(r._id)} /></Tooltip>
              {r.failedAttempts > 0 && <Tooltip title="Unlock"><Button size="small" type="primary" ghost icon={<UnlockOutlined />} onClick={() => unlock(r._id)} /></Tooltip>}
              {r.role !== 'SUPER_ADMIN' && <Popconfirm title="Delete this user?" onConfirm={() => del(r._id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>}
            </Space>
          )},
        ]} />
      </Card>

      {/* CREATE/EDIT MODAL */}
      <Modal title={editing ? `Edit User: ${editing.username}` : 'Create User'} open={modal} onCancel={() => { setModal(false); setEditing(null); }} onOk={() => form.submit()} width={550}>
        <Form form={form} layout="vertical" onFinish={save} initialValues={{ role: 'EMPLOYEE', isActive: true }}>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="username" label="Username" rules={[{ required: !editing }]}><Input disabled={!!editing} placeholder="john.doe" /></Form.Item></Col>
            <Col span={12}><Form.Item name="email" label="Email"><Input placeholder="john@mobiliseapps.com" /></Form.Item></Col>
          </Row>
          {!editing && <Form.Item name="password" label="Password" rules={[{ required: true, min: 6 }]}><Input.Password placeholder="Min 6 characters" /></Form.Item>}
          <Row gutter={16}>
            <Col span={12}><Form.Item name="firstName" label="First Name" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="lastName" label="Last Name"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="role" label="Role" rules={[{ required: true }]}>
              <Select options={['SUPER_ADMIN', 'HR', 'FINANCE', 'MANAGER', 'EMPLOYEE'].map(r => ({ label: r, value: r }))} />
            </Form.Item></Col>
            <Col span={12}><Form.Item name="empCode" label="Employee Code (for Employee/Manager)"><Input placeholder="MLP049" /></Form.Item></Col>
          </Row>
          <Form.Item name="entityIds" label="Entities Access">
            <Select mode="multiple" placeholder="Select entities" options={entities.map(e => ({ label: `${e.code} — ${e.name}`, value: e._id }))} />
          </Form.Item>
          {editing && <Form.Item name="isActive" label="Active" valuePropName="checked"><Switch /></Form.Item>}
        </Form>
      </Modal>

      {/* RESET PASSWORD MODAL */}
      <Modal title={`Reset Password: ${pwdModal?.username}`} open={!!pwdModal} onCancel={() => setPwdModal(null)} onOk={() => pwdForm.submit()}>
        <Form form={pwdForm} layout="vertical" onFinish={resetPwd}>
          <Form.Item name="newPassword" label="New Password" rules={[{ required: true, min: 6, message: 'Min 6 characters' }]}>
            <Input.Password placeholder="Enter new password" />
          </Form.Item>
          <Text type="secondary" style={{ fontSize: 12 }}>User will be required to change password on next login.</Text>
        </Form>
      </Modal>
    </div>
  );
}

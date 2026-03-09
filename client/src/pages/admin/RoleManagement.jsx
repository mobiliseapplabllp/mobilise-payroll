import React, { useState, useEffect } from 'react';
import { Card, Typography, Table, Switch, Tag, Space, Tabs, message, Row, Col, Statistic, Button, Spin } from 'antd';
import { SafetyCertificateOutlined, SaveOutlined, LockOutlined } from '@ant-design/icons';
import api from '../../utils/api';
const { Title, Text } = Typography;

const ACTIONS = ['create', 'read', 'update', 'delete', 'approve', 'export', 'viewSalary', 'viewPII'];
const ACTION_LABELS = { create: 'Create', read: 'Read', update: 'Update', delete: 'Delete', approve: 'Approve', export: 'Export', viewSalary: 'View Salary', viewPII: 'View PII' };
const ROLE_COLORS = { SUPER_ADMIN: '#DC2626', HR: '#1A6FB5', FINANCE: '#059669', MANAGER: '#D97706', EMPLOYEE: '#64748B' };

export default function RoleManagement() {
  const [roles, setRoles] = useState([]);
  const [modules, setModules] = useState([]);
  const [matrix, setMatrix] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeRole, setActiveRole] = useState('HR');
  const [changes, setChanges] = useState({});

  const fetch = () => {
    setLoading(true);
    api.get('/rbac/matrix').then(({ data }) => {
      setRoles(data.roles); setModules(data.modules); setMatrix(data.matrix);
    }).finally(() => setLoading(false));
  };
  useEffect(fetch, []);

  const toggle = (module, action) => {
    if (activeRole === 'SUPER_ADMIN') return;
    const key = `${module}.${action}`;
    const current = matrix[activeRole]?.[module]?.[action] || false;
    setMatrix(prev => ({
      ...prev,
      [activeRole]: { ...prev[activeRole], [module]: { ...prev[activeRole]?.[module], [action]: !current } }
    }));
    setChanges(prev => ({ ...prev, [key]: !current }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const perms = modules.map(m => ({ module: m, ...matrix[activeRole]?.[m] }));
      await api.put(`/rbac/permissions/${activeRole}`, { permissions: perms });
      message.success(`Permissions saved for ${activeRole}`);
      setChanges({});
    } catch (err) { message.error('Failed to save'); }
    finally { setSaving(false); }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  const permCount = (role) => {
    let count = 0;
    for (const mod of modules) for (const act of ACTIONS) if (matrix[role]?.[mod]?.[act]) count++;
    return count;
  };

  const roleInfo = roles.find(r => r.code === activeRole);

  return (
    <div>
      <div className="page-header">
        <div>
          <Title level={3} style={{ margin: 0, fontFamily: 'DM Sans' }}><SafetyCertificateOutlined style={{ color: '#7C3AED' }} /> Role & Permission Management</Title>
          <Text type="secondary">Configure access control for each role across all system modules</Text>
        </div>
        {activeRole !== 'SUPER_ADMIN' && Object.keys(changes).length > 0 && (
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>
            Save Changes ({Object.keys(changes).length})
          </Button>
        )}
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {roles.map(r => (
          <Col key={r.code} xs={12} sm={8} lg={4}>
            <Card className="stat-card" style={{ cursor: 'pointer', borderColor: activeRole === r.code ? r.color : undefined }}
              onClick={() => { setActiveRole(r.code); setChanges({}); }}>
              <Tag color={r.color} style={{ marginBottom: 8 }}>{r.code}</Tag>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'DM Sans' }}>{permCount(r.code)}</div>
              <Text type="secondary" style={{ fontSize: 11 }}>permissions enabled</Text>
            </Card>
          </Col>
        ))}
      </Row>

      <Card bordered={false} title={<Space>
        <Tag color={roleInfo?.color} style={{ fontSize: 13, padding: '2px 12px' }}>{activeRole}</Tag>
        <Text strong>{roleInfo?.name}</Text>
        {activeRole === 'SUPER_ADMIN' && <Tag icon={<LockOutlined />} color="red">All Access — Cannot Modify</Tag>}
      </Space>}>
        <Table dataSource={modules.map(m => ({ module: m }))} rowKey="module" size="small" pagination={false}
          columns={[
            { title: 'Module', dataIndex: 'module', width: 150, fixed: 'left',
              render: v => <Text strong style={{ textTransform: 'capitalize' }}>{v.replace(/_/g, ' ')}</Text> },
            ...ACTIONS.map(action => ({
              title: <Text style={{ fontSize: 10, textTransform: 'uppercase' }}>{ACTION_LABELS[action]}</Text>,
              width: 85, align: 'center',
              render: (_, row) => {
                const checked = activeRole === 'SUPER_ADMIN' ? true : (matrix[activeRole]?.[row.module]?.[action] || false);
                return (
                  <Switch size="small" checked={checked} disabled={activeRole === 'SUPER_ADMIN'}
                    onChange={() => toggle(row.module, action)}
                    style={checked ? { background: ROLE_COLORS[activeRole] || '#1A6FB5' } : {}} />
                );
              },
            })),
          ]}
          scroll={{ x: 900 }}
        />
      </Card>
    </div>
  );
}

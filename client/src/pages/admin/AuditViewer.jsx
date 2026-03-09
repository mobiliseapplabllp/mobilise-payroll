import React, { useState, useEffect } from 'react';
import { Card, Typography, Table, Tag, Space, Input, Select, DatePicker, Row, Col, Statistic, Button, Badge, Spin, Tabs } from 'antd';
import { AuditOutlined, DownloadOutlined, SearchOutlined, ClockCircleOutlined, UserOutlined, FilterOutlined } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api, { downloadFile } from '../../utils/api';
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const ACTION_COLORS = {
  CREATE: 'green', READ: 'blue', UPDATE: 'orange', DELETE: 'red',
  APPROVE: 'cyan', REJECT: 'magenta', LOGIN: 'purple', LOGOUT: 'default',
  LOGIN_FAILED: 'red', EXPORT: 'geekblue', DOWNLOAD: 'blue', PROCESS: 'green',
  SEED: 'default', LOCK: 'orange', UNLOCK: 'green', SWITCH_ENTITY: 'purple',
};
const C = ['#1A6FB5', '#059669', '#D97706', '#DC2626', '#7C3AED', '#0891B2', '#EA580C', '#BE185D'];

export default function AuditViewer() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ module: '', action: '', search: '' });
  const [tab, setTab] = useState('logs');

  const fetchLogs = () => {
    setLoading(true);
    const params = { page, limit: 50 };
    if (filters.module) params.module = filters.module;
    if (filters.action) params.action = filters.action;
    if (filters.search) params.search = filters.search;
    api.get('/rbac/audit', { params }).then(({ data }) => { setLogs(data.data); setTotal(data.total); }).finally(() => setLoading(false));
  };
  const fetchStats = () => api.get('/rbac/audit/stats').then(({ data }) => setStats(data)).catch(() => {});

  useEffect(fetchLogs, [page, filters]);
  useEffect(fetchStats, []);

  const exportCSV = () => downloadFile('/rbac/audit/export');

  const moduleOpts = [...new Set(logs.map(l => l.module))].sort().map(m => ({ label: m, value: m }));
  const actionOpts = [...new Set(logs.map(l => l.action))].sort().map(a => ({ label: a, value: a }));

  return (
    <div>
      <div className="page-header">
        <div>
          <Title level={3} style={{ margin: 0, fontFamily: 'DM Sans' }}><AuditOutlined style={{ color: '#7C3AED' }} /> Audit Trail</Title>
          <Text type="secondary">Complete activity log of all system operations</Text>
        </div>
        <Button icon={<DownloadOutlined />} onClick={exportCSV}>Export CSV</Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}><Card className="stat-card"><Statistic title="Total Events" value={stats.totalCount || 0} prefix={<AuditOutlined />} /></Card></Col>
        <Col span={6}><Card className="stat-card"><Statistic title="Today" value={stats.todayCount || 0} valueStyle={{ color: '#1A6FB5' }} /></Card></Col>
        <Col span={6}><Card className="stat-card"><Statistic title="This Week" value={stats.weekCount || 0} valueStyle={{ color: '#059669' }} /></Card></Col>
        <Col span={6}><Card className="stat-card"><Statistic title="Modules Active" value={stats.byModule?.length || 0} /></Card></Col>
      </Row>

      <Tabs activeKey={tab} onChange={setTab} items={[
        { key: 'logs', label: <Space><ClockCircleOutlined />Activity Log</Space>, children: (
          <Card bordered={false}>
            <Space style={{ marginBottom: 16 }} wrap>
              <Input.Search placeholder="Search..." allowClear onSearch={v => setFilters(p => ({ ...p, search: v }))} style={{ width: 250 }} />
              <Select placeholder="Module" allowClear style={{ width: 140 }} options={moduleOpts} onChange={v => setFilters(p => ({ ...p, module: v || '' }))} />
              <Select placeholder="Action" allowClear style={{ width: 120 }} options={actionOpts} onChange={v => setFilters(p => ({ ...p, action: v || '' }))} />
            </Space>
            <Table dataSource={logs} loading={loading} rowKey="_id" size="small"
              pagination={{ current: page, total, pageSize: 50, onChange: setPage, showTotal: t => `${t} events` }}
              columns={[
                { title: 'Time', dataIndex: 'createdAt', width: 140, render: d => <Text style={{ fontSize: 11 }}>{new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</Text> },
                { title: 'Module', dataIndex: 'module', width: 100, render: v => <Tag>{v}</Tag> },
                { title: 'Action', dataIndex: 'action', width: 90, render: v => <Tag color={ACTION_COLORS[v] || 'default'}>{v}</Tag> },
                { title: 'Detail', dataIndex: 'actionDetail', ellipsis: true, render: v => <Text>{v}</Text> },
                { title: 'Record', dataIndex: 'recordName', width: 120, ellipsis: true },
                { title: 'User', dataIndex: 'userName', width: 120, render: (v, r) => <Space size={4}><Text>{v}</Text><Tag style={{ fontSize: 9 }}>{r.userRole}</Tag></Space> },
                { title: 'IP', dataIndex: 'ipAddress', width: 100, render: v => <Text type="secondary" style={{ fontSize: 10 }}>{v}</Text> },
                { title: 'ms', dataIndex: 'durationMs', width: 45, render: v => v ? <Text type="secondary" style={{ fontSize: 10 }}>{v}</Text> : '' },
              ]}
            />
          </Card>
        )},
        { key: 'stats', label: <Space><FilterOutlined />Statistics</Space>, children: (
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Card title="Activity by Module" bordered={false}>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stats.byModule || []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="_id" type="category" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#1A6FB5" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Activity by Action" bordered={false}>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={stats.byAction || []} cx="50%" cy="50%" outerRadius={90} innerRadius={45} dataKey="count" nameKey="_id"
                      label={({ _id, percent }) => `${_id} ${(percent * 100).toFixed(0)}%`}>
                      {(stats.byAction || []).map((_, i) => <Cell key={i} fill={C[i % C.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col span={24}>
              <Card title="Top Users by Activity" bordered={false}>
                <Table dataSource={stats.byUser || []} rowKey={r => r._id?.name} size="small" pagination={false} columns={[
                  { title: '#', render: (_, __, i) => i + 1, width: 40 },
                  { title: 'User', render: (_, r) => <Text strong>{r._id?.name}</Text> },
                  { title: 'Role', render: (_, r) => <Tag>{r._id?.role}</Tag>, width: 100 },
                  { title: 'Actions', dataIndex: 'count', width: 80 },
                ]} />
              </Card>
            </Col>
          </Row>
        )},
      ]} />
    </div>
  );
}

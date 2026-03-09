import React, { useState, useEffect } from 'react';
import { Card, Typography, Row, Col, Statistic, Table, Tag, Space, Spin, Badge, Button, Tabs } from 'antd';
import { TeamOutlined, CheckCircleOutlined, ClockCircleOutlined, CalendarOutlined, FileTextOutlined, MoneyCollectOutlined, TrophyOutlined } from '@ant-design/icons';
import { useAuth } from '../../main';
import api from '../../utils/api';
const { Title, Text } = Typography;

export default function ManagerDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/manager/dashboard').then(({ data }) => setData(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!data) return <Card><Text type="secondary">Unable to load dashboard</Text></Card>;

  const totalPending = (data.pendingLeaves || 0) + (data.pendingCompOffs || 0) + (data.pendingAttReg || 0) + (data.pendingLoans || 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <Title level={3} style={{ margin: 0, fontFamily: 'DM Sans' }}><TeamOutlined style={{ color: '#D97706' }} /> My Team Dashboard</Title>
          <Text type="secondary">Welcome, {user?.firstName}. Manage your team approvals and assessments.</Text>
        </div>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} lg={4}>
          <Card className="stat-card"><Statistic title="Team Members" value={data.teamCount || 0} prefix={<TeamOutlined />} valueStyle={{ color: '#1A6FB5' }} /></Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card className="stat-card"><Statistic title="Pending Approvals" value={totalPending} prefix={<ClockCircleOutlined />} valueStyle={{ color: totalPending > 0 ? '#DC2626' : '#059669' }} /></Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card className="stat-card"><Statistic title="Leave Requests" value={data.pendingLeaves || 0} prefix={<CalendarOutlined />} valueStyle={{ color: '#D97706' }} /></Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card className="stat-card"><Statistic title="Comp-Off Pending" value={data.pendingCompOffs || 0} prefix={<FileTextOutlined />} valueStyle={{ color: '#7C3AED' }} /></Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card className="stat-card"><Statistic title="Attendance Reg" value={data.pendingAttReg || 0} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#0891B2' }} /></Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card className="stat-card"><Statistic title="PLI Pending" value={data.pliPending || 0} prefix={<TrophyOutlined />} valueStyle={{ color: '#EA580C' }} /></Card>
        </Col>
      </Row>

      <Card bordered={false} title={<Space><TeamOutlined />Team Members ({data.team?.length || 0})</Space>} style={{ marginTop: 16 }}>
        <Table dataSource={data.team || []} rowKey="empCode" size="small" pagination={{ pageSize: 15 }} columns={[
          { title: 'Code', dataIndex: 'empCode', width: 80, render: v => <Text strong>{v}</Text> },
          { title: 'Name', dataIndex: 'name', render: v => <Text>{v}</Text> },
          { title: 'Designation', dataIndex: 'designation', width: 150 },
          { title: 'Grade', dataIndex: 'grade', width: 80, render: v => v ? <Tag>{v}</Tag> : '-' },
          { title: 'Type', dataIndex: 'type', width: 90, render: v => <Tag color={v === 'Permanent' ? 'blue' : 'orange'}>{v}</Tag> },
          { title: 'Joined', dataIndex: 'joined', width: 100, render: v => v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '-' },
        ]} />
      </Card>
    </div>
  );
}

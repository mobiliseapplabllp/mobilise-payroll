import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Space, Tag, Input, Select, Typography, message, Popconfirm, Tooltip } from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, TeamOutlined} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';

const { Title, Text } = Typography;

export default function Employees() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Active');
  const [typeFilter, setTypeFilter] = useState('all');
  const [departments, setDepartments] = useState([]);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 200, status: statusFilter, search };
      if (typeFilter !== 'all') params.employmentType = typeFilter;
      const { data } = await api.get('/employees', { params });
      setEmployees(data.data);
      setTotal(data.pagination.total);
    } catch (err) { message.error('Failed to load employees'); }
    finally { setLoading(false); }
  }, [search, statusFilter, typeFilter]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);
  useEffect(() => { api.get('/employees/meta/departments').then(({ data }) => setDepartments(data)); }, []);

  const handleDelete = async (id) => {
    try { await api.delete(`/employees/${id}`); message.success('Employee deactivated'); fetchEmployees(); }
    catch (err) { message.error('Failed to deactivate'); }
  };

  const columns = [
    { title: 'Code', dataIndex: 'empCode', width: 90, sorter: (a, b) => a.empCode.localeCompare(b.empCode) },
    { title: 'Name', key: 'name', render: (_, r) => <Text strong>{r.firstName} {r.lastName}</Text>, sorter: (a, b) => a.firstName.localeCompare(b.firstName) },
    { title: 'Department', dataIndex: 'department', width: 110,
      filters: departments.map(d => ({ text: d, value: d })),
      onFilter: (v, r) => r.department === v },
    { title: 'Designation', dataIndex: 'designation', width: 140, ellipsis: true },
    { title: 'Grade', dataIndex: 'grade', width: 60 },
    { title: 'Role', dataIndex: 'role', width: 150, ellipsis: true },
    { title: 'Basic', dataIndex: 'basicSalary', width: 90, align: 'right', render: v => `₹${(v || 0).toLocaleString('en-IN')}`, sorter: (a, b) => a.basicSalary - b.basicSalary },
    { title: 'Total Salary', dataIndex: 'totalMonthlySalary', width: 110, align: 'right', render: v => <Text strong>₹{(v || 0).toLocaleString('en-IN')}</Text>, sorter: (a, b) => a.totalMonthlySalary - b.totalMonthlySalary },
    { title: 'PF', dataIndex: 'pfApplicable', width: 50, render: v => v ? <Tag color="green">Y</Tag> : <Tag>N</Tag> },
    { title: 'Type', dataIndex: 'employmentType', width: 80, render: v => <Tag color={v === 'Intern' ? 'orange' : 'blue'}>{v}</Tag> },
    { title: 'Status', dataIndex: 'status', width: 80, render: v => <Tag color={v === 'Active' ? 'green' : 'red'}>{v}</Tag> },
    { title: 'Actions', key: 'actions', width: 120, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View"><Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/employees/view/${record._id}`)} /></Tooltip>
          <Tooltip title="Edit"><Button type="link" size="small" icon={<EditOutlined />} onClick={() => navigate(`/employees/edit/${record._id}`)} /></Tooltip>
          <Popconfirm title="Deactivate this employee?" onConfirm={() => handleDelete(record._id)}>
            <Tooltip title="Deactivate"><Button type="link" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <Title level={3} style={{ margin: 0 }}><TeamOutlined style={{ color: '#7C3AED' }} /> Employees ({total})</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchEmployees}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/employees/new')}>Add Employee</Button>
        </Space>
      </div>

      <Card bordered={false}>
        <Space style={{ marginBottom: 16 }} wrap>
          <Input.Search placeholder="Search name, code, role..." onSearch={setSearch} allowClear style={{ width: 280 }} />
          <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 120 }}
            options={[{ label: 'Active', value: 'Active' }, { label: 'All', value: 'all' }, { label: 'Inactive', value: 'Inactive' }, { label: 'Separated', value: 'Separated' }]} />
          <Select value={typeFilter} onChange={setTypeFilter} style={{ width: 130 }}
            options={[{ label: 'All Types', value: 'all' }, { label: 'Permanent', value: 'Permanent' }, { label: 'Intern', value: 'Intern' }, { label: 'Contract', value: 'Contract' }]} />
        </Space>

        <Table dataSource={employees} columns={columns} loading={loading} rowKey="_id" size="small"
          scroll={{ x: 1400 }} pagination={{ pageSize: 50, showSizeChanger: true, showTotal: t => `Total ${t}` }} />
      </Card>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Table, Tag, message, Modal, Form, Input, InputNumber, Select, Space, Popconfirm, Descriptions, Tabs, Divider, Row, Col, Statistic, Upload } from 'antd';
import { PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, DeleteOutlined, EditOutlined, UndoOutlined, FilePdfOutlined, WarningOutlined, UploadOutlined, MoneyCollectOutlined} from '@ant-design/icons';
import EmployeeSelect from '../../components/common/EmployeeSelect';
import api, { downloadFile } from '../../utils/api';
const { Title, Text } = Typography;

export default function Loans() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createModal, setCreateModal] = useState(false);
  const [detailModal, setDetailModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [forceCloseModal, setForceCloseModal] = useState(null);
  const [reopenModal, setReopenModal] = useState(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [forceCloseForm] = Form.useForm();

  const fetch = () => { setLoading(true); api.get('/loans').then(({ data }) => setLoans(data)).finally(() => setLoading(false)); };
  useEffect(fetch, []);

  const create = async (values) => {
    try { await api.post('/loans', values); message.success('Loan created'); setCreateModal(false); createForm.resetFields(); fetch(); }
    catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  };

  const approve = async (id) => { try { await api.post(`/loans/${id}/approve`); message.success('Approved'); fetch(); } catch (err) { message.error(err.response?.data?.error || 'Failed'); } };
  const recommend = async (id) => { try { await api.post(`/loans/${id}/recommend`); message.success('Recommended'); fetch(); } catch (err) { message.error(err.response?.data?.error || 'Failed'); } };
  const reject = async (id) => { try { await api.post(`/loans/${id}/reject`, { reason: 'Rejected' }); message.success('Rejected'); fetch(); } catch (err) { message.error(err.response?.data?.error || 'Failed'); } };
  const closeLoan = async (id) => { try { await api.post(`/loans/${id}/close`); message.success('Closed'); fetch(); setDetailModal(null); } catch (err) { message.error(err.response?.data?.error || 'Failed'); } };
  const del = async (id) => { try { await api.delete(`/loans/${id}`); message.success('Deleted'); fetch(); } catch (err) { message.error(err.response?.data?.error || 'Failed'); } };

  const reopenLoan = async () => {
    try { await api.post(`/loans/${reopenModal._id}/reopen`, { reason: document.getElementById('reopen-reason')?.value || '' }); message.success('Loan reopened!'); setReopenModal(null); fetch(); }
    catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  };

  const forceClose = async (values) => {
    try { await api.post(`/loans/${forceCloseModal._id}/force-close`, values); message.success('Loan force-closed with discount'); setForceCloseModal(null); forceCloseForm.resetFields(); fetch(); }
    catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  };

  const editLoan = async (values) => {
    try { await api.put(`/loans/${editModal._id}`, values); message.success('Loan updated'); setEditModal(null); editForm.resetFields(); fetch(); }
    catch (err) { message.error(err.response?.data?.error || 'Failed'); }
  };

  const downloadClosure = (id) => downloadFile(`/loans/${id}/closure-letter`);
  const downloadStatement = (id) => downloadFile(`/loans/${id}/statement`);

  const statusColor = { APPLIED: 'blue', MANAGER_RECOMMENDED: 'orange', ACTIVE: 'green', CLOSED: 'default', REJECTED: 'red' };

  return (
    <div>
      <div className="page-header">
        <Title level={3} style={{ margin: 0, fontFamily: 'DM Sans' }}><MoneyCollectOutlined style={{ color: '#EA580C' }} /> Loan Management</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>New Loan</Button>
      </div>

      <Card bordered={false}>
        <Table dataSource={loans} loading={loading} rowKey="_id" size="small" scroll={{ x: 1300 }} columns={[
          { title: 'Loan ID', dataIndex: 'loanId', width: 130 },
          { title: 'Employee', dataIndex: 'employeeName', width: 150 },
          { title: 'Code', dataIndex: 'empCode', width: 75 },
          { title: 'Type', dataIndex: 'loanType', width: 120, render: v => <Tag>{v?.replace(/_/g, ' ')}</Tag> },
          { title: 'Amount', dataIndex: 'amount', width: 90, render: v => `₹${v?.toLocaleString('en-IN')}` },
          { title: 'EMI', dataIndex: 'emiAmount', width: 80, render: v => `₹${v?.toLocaleString('en-IN')}` },
          { title: 'Paid', dataIndex: 'totalPaid', width: 80, render: v => `₹${(v || 0).toLocaleString('en-IN')}` },
          { title: 'Outstanding', dataIndex: 'outstandingBalance', width: 100, render: v => <Text strong>₹{(v || 0).toLocaleString('en-IN')}</Text> },
          { title: 'Status', dataIndex: 'status', width: 110, render: v => <Tag color={statusColor[v]}>{v?.replace(/_/g, ' ')}</Tag> },
          { title: 'Actions', key: 'actions', width: 250, fixed: 'right', render: (_, r) => (
            <Space size="small" wrap>
              <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailModal(r)}>View</Button>
              <Button size="small" icon={<EditOutlined />} onClick={() => { setEditModal(r); editForm.setFieldsValue(r); }}>Edit</Button>
              {r.status === 'APPLIED' && <Button size="small" type="primary" ghost onClick={() => recommend(r._id)}>Recommend</Button>}
              {['APPLIED', 'MANAGER_RECOMMENDED'].includes(r.status) && <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => approve(r._id)}>Approve</Button>}
              {['APPLIED', 'MANAGER_RECOMMENDED'].includes(r.status) && <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => reject(r._id)} />}
              {r.status === 'ACTIVE' && <Popconfirm title="Close this loan?" onConfirm={() => closeLoan(r._id)}><Button size="small">Close</Button></Popconfirm>}
              {r.status === 'ACTIVE' && <Button size="small" icon={<FilePdfOutlined />} onClick={() => downloadStatement(r._id)}>Statement</Button>}
              {r.status === 'ACTIVE' && <Button size="small" danger icon={<WarningOutlined />} onClick={() => { setForceCloseModal(r); forceCloseForm.resetFields(); }}>Force Close</Button>}
              {r.status === 'CLOSED' && <Button size="small" icon={<UndoOutlined />} onClick={() => setReopenModal(r)}>Reopen</Button>}
              {r.status === 'CLOSED' && <Button size="small" icon={<FilePdfOutlined />} onClick={() => downloadClosure(r._id)}>Closure Letter</Button>}
              {r.status === 'CLOSED' && <Button size="small" icon={<FilePdfOutlined />} onClick={() => downloadStatement(r._id)}>Statement</Button>}
              <Popconfirm title="Delete?" onConfirm={() => del(r._id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
            </Space>
          )},
        ]} />
      </Card>

      {/* CREATE MODAL */}
      <Modal title="Create Loan" open={createModal} onCancel={() => setCreateModal(false)} onOk={() => createForm.submit()} width={500}>
        <Form form={createForm} layout="vertical" onFinish={create}>
          <Form.Item name="empCode" label="Employee" rules={[{ required: true }]}><EmployeeSelect /></Form.Item>
          <Form.Item name="loanType" label="Type" rules={[{ required: true }]}>
            <Select options={[{ label: 'Salary Advance', value: 'SALARY_ADVANCE' }, { label: 'Personal Loan', value: 'PERSONAL_LOAN' }, { label: 'Emergency Loan', value: 'EMERGENCY_LOAN' }, { label: 'Festival Advance', value: 'FESTIVAL_ADVANCE' }]} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="amount" label="Amount (₹)" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} min={1000} /></Form.Item></Col>
            <Col span={12}><Form.Item name="tenure" label="Tenure (Months)" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} min={1} max={60} /></Form.Item></Col>
          </Row>
          <Form.Item name="remarks" label="Remarks"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      {/* DETAIL MODAL */}
      <Modal title={`Loan Details: ${detailModal?.loanId}`} open={!!detailModal} onCancel={() => setDetailModal(null)} footer={null} width={700}>
        {detailModal && (
          <Tabs items={[
            { key: 'details', label: 'Loan Agreement', children: (
              <div>
                <Descriptions bordered size="small" column={2}>
                  <Descriptions.Item label="Loan ID">{detailModal.loanId}</Descriptions.Item>
                  <Descriptions.Item label="Status"><Tag color={statusColor[detailModal.status]}>{detailModal.status}</Tag></Descriptions.Item>
                  <Descriptions.Item label="Employee">{detailModal.employeeName} ({detailModal.empCode})</Descriptions.Item>
                  <Descriptions.Item label="Type"><Tag>{detailModal.loanType?.replace(/_/g, ' ')}</Tag></Descriptions.Item>
                  <Descriptions.Item label="Loan Amount">₹{detailModal.amount?.toLocaleString('en-IN')}</Descriptions.Item>
                  <Descriptions.Item label="Monthly EMI">₹{detailModal.emiAmount?.toLocaleString('en-IN')}</Descriptions.Item>
                  <Descriptions.Item label="Tenure">{detailModal.tenure} months</Descriptions.Item>
                  <Descriptions.Item label="Total Paid">₹{(detailModal.totalPaid || 0).toLocaleString('en-IN')}</Descriptions.Item>
                  <Descriptions.Item label="Outstanding">₹{(detailModal.outstandingBalance || 0).toLocaleString('en-IN')}</Descriptions.Item>
                  <Descriptions.Item label="Disbursement">{detailModal.disbursementDate ? new Date(detailModal.disbursementDate).toLocaleDateString('en-IN') : '-'}</Descriptions.Item>
                  <Descriptions.Item label="Applied">{new Date(detailModal.createdAt).toLocaleDateString('en-IN')}</Descriptions.Item>
                  <Descriptions.Item label="Approved At">{detailModal.approvedAt ? new Date(detailModal.approvedAt).toLocaleDateString('en-IN') : '-'}</Descriptions.Item>
                </Descriptions>
                {detailModal.remarks && <div style={{ marginTop: 12, padding: 10, background: '#F8FAFC', borderRadius: 6, fontSize: 12, whiteSpace: 'pre-wrap' }}><Text type="secondary" strong>Remarks / History:</Text><br />{detailModal.remarks}</div>}

                <Divider style={{ margin: '16px 0 12px' }}>Loan Agreement Document</Divider>
                {detailModal.agreementFile ? (
                  <Space>
                    <Tag color="success" icon={<CheckCircleOutlined />}>Agreement Uploaded</Tag>
                    <Text type="secondary" style={{ fontSize: 11 }}>by {detailModal.agreementUploadedBy} on {detailModal.agreementUploadedAt ? new Date(detailModal.agreementUploadedAt).toLocaleDateString('en-IN') : ''}</Text>
                  </Space>
                ) : (
                  <Upload beforeUpload={async (file) => {
                    try {
                      const reader = new FileReader();
                      reader.onload = async (e) => {
                        const base64 = e.target.result.split(',')[1];
                        await api.post(`/loans/${detailModal._id}/agreement`, { fileData: base64 });
                        message.success('Agreement uploaded');
                        fetch();
                        setDetailModal(prev => ({ ...prev, agreementFile: 'uploaded' }));
                      };
                      reader.readAsDataURL(file);
                    } catch { message.error('Upload failed'); }
                    return false;
                  }} accept=".pdf" maxCount={1} showUploadList={false}>
                    <Button icon={<UploadOutlined />}>Upload Loan Agreement (PDF)</Button>
                  </Upload>
                )}
              </div>
            )},
            { key: 'schedule', label: `EMI Schedule (${detailModal.schedule?.length || 0})`, children: (
              <Table size="small" pagination={false} dataSource={detailModal.schedule || []} rowKey={(_, i) => i} columns={[
                { title: '#', render: (_, __, i) => i + 1, width: 40 },
                { title: 'Month', render: (_, s) => `${new Date(0, (s.month || 1) - 1).toLocaleString('en', { month: 'short' })} ${s.year}` },
                { title: 'EMI Amount', dataIndex: 'emiAmount', render: v => `₹${(v || 0).toLocaleString('en-IN')}` },
                { title: 'Status', dataIndex: 'status', render: v => <Tag color={v === 'DEDUCTED' ? 'green' : v === 'WAIVED' ? 'orange' : 'default'}>{v}</Tag> },
              ]} />
            )},
          ]} />
        )}
      </Modal>

      {/* EDIT MODAL */}
      <Modal title={`Edit Loan: ${editModal?.loanId}`} open={!!editModal} onCancel={() => setEditModal(null)} onOk={() => editForm.submit()} width={500}>
        <Form form={editForm} layout="vertical" onFinish={editLoan}>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="amount" label="Amount (₹)"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
            <Col span={12}><Form.Item name="emiAmount" label="EMI (₹)"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
            <Col span={12}><Form.Item name="tenure" label="Tenure (Months)"><InputNumber style={{ width: '100%' }} min={1} /></Form.Item></Col>
            <Col span={12}><Form.Item name="outstandingBalance" label="Outstanding"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
          </Row>
          <Form.Item name="loanType" label="Loan Type">
            <Select options={[{ label: 'Salary Advance', value: 'SALARY_ADVANCE' }, { label: 'Personal Loan', value: 'PERSONAL_LOAN' }, { label: 'Emergency Loan', value: 'EMERGENCY_LOAN' }, { label: 'Festival Advance', value: 'FESTIVAL_ADVANCE' }]} />
          </Form.Item>
          <Form.Item name="remarks" label="Remarks"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      {/* FORCE CLOSE MODAL */}
      <Modal title={<Space><WarningOutlined style={{ color: '#DC2626' }} /> Force Close Loan: {forceCloseModal?.loanId}</Space>} open={!!forceCloseModal} onCancel={() => setForceCloseModal(null)} onOk={() => forceCloseForm.submit()} okText="Force Close" okButtonProps={{ danger: true }}>
        {forceCloseModal && (
          <Form form={forceCloseForm} layout="vertical" onFinish={forceClose}>
            <div style={{ padding: 12, background: '#FFF5F5', borderRadius: 6, marginBottom: 16 }}>
              <Text>Outstanding: <Text strong>₹{(forceCloseModal.outstandingBalance || 0).toLocaleString('en-IN')}</Text></Text>
            </div>
            <Form.Item name="discountAmount" label="Discount / Waiver Amount (₹)" initialValue={0}>
              <InputNumber style={{ width: '100%' }} min={0} max={forceCloseModal?.outstandingBalance || 0} />
            </Form.Item>
            <Form.Item name="reason" label="Reason for Force Close" rules={[{ required: true }]}>
              <Input.TextArea rows={3} placeholder="Why is this loan being force-closed with a discount?" />
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* REOPEN MODAL */}
      <Modal title={`Reopen Loan: ${reopenModal?.loanId}`} open={!!reopenModal} onCancel={() => setReopenModal(null)} onOk={reopenLoan} okText="Reopen Loan">
        <Text>This will change the loan status back to ACTIVE. The employee will resume EMI payments.</Text>
        <div style={{ marginTop: 16 }}>
          <Text strong>Reason for reopening:</Text>
          <Input.TextArea id="reopen-reason" rows={3} placeholder="Why is this loan being reopened?" style={{ marginTop: 8 }} />
        </div>
      </Modal>
    </div>
  );
}

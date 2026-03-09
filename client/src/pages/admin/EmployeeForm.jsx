import React, { useState, useEffect } from 'react';
import { Card, Form, Input, InputNumber, Select, DatePicker, Switch, Button, Row, Col, Typography, message, Divider, Space, Alert, Progress, Tabs, Tag } from 'antd';
import { ArrowLeftOutlined, SaveOutlined, UserAddOutlined, EditOutlined, DollarOutlined, BankOutlined, SafetyCertificateOutlined, WarningOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../utils/api';
const { Title, Text } = Typography;

export default function EmployeeForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [salaryHeads, setSalaryHeads] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [salaryComponents, setSalaryComponents] = useState([]);
  const [states, setStates] = useState([]);
  const [minWage, setMinWage] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/salary/templates'), api.get('/salary/heads'), api.get('/salary/states'),
    ]).then(([t, h, s]) => { setTemplates(t.data); setSalaryHeads(h.data); setStates(s.data); });
    if (isEdit) {
      setLoading(true);
      Promise.all([api.get(`/employees/${id}`), api.get(`/salary/employee-salary/${id}`).catch(() => ({ data: {} }))]).then(([empRes, salRes]) => {
        const emp = empRes.data;
        form.setFieldsValue({ ...emp, dateOfJoining: emp.dateOfJoining ? dayjs(emp.dateOfJoining) : null, dateOfBirth: emp.dateOfBirth ? dayjs(emp.dateOfBirth) : null });
        if (salRes.data?.active) {
          setSalaryComponents(salRes.data.active.components || []);
          setSelectedTemplate(salRes.data.active.templateCode);
        }
      }).finally(() => setLoading(false));
    }
  }, [id]);

  const applyTemplate = (tmplCode) => {
    const tmpl = templates.find(t => t.code === tmplCode);
    if (!tmpl) return;
    setSelectedTemplate(tmplCode);
    const comps = tmpl.heads.map(h => {
      const head = salaryHeads.find(sh => sh.code === h.headCode) || {};
      return {
        headId: h.headId, headCode: h.headCode, headName: h.headName || head.name,
        headType: h.headType || head.type || 'EARNING', amount: 0,
        isTaxable: head.isTaxable ?? true, isPFApplicable: head.isPFApplicable ?? false,
        isESIApplicable: head.isESIApplicable ?? false, isPartOfGross: head.isPartOfGross ?? true,
      };
    });
    setSalaryComponents(comps);
  };

  const updateCompAmount = (idx, amount) => {
    const updated = [...salaryComponents];
    updated[idx] = { ...updated[idx], amount: amount || 0 };
    setSalaryComponents(updated);
  };

  const totalSalary = salaryComponents.filter(c => c.headType === 'EARNING').reduce((s, c) => s + (c.amount || 0), 0);
  const minWageCheck = minWage ? totalSalary >= minWage.minimumMonthly : true;
  const minWagePercent = minWage ? Math.min((totalSalary / minWage.minimumMonthly) * 100, 100) : 100;

  const save = async (values) => {
    setSaving(true);
    try {
      const data = { ...values, dateOfJoining: values.dateOfJoining?.toISOString(), dateOfBirth: values.dateOfBirth?.toISOString() };
      let empCode = values.empCode;
      if (isEdit) {
        await api.put(`/employees/${id}`, data);
        empCode = form.getFieldValue('empCode');
      } else {
        const res = await api.post('/employees', data);
        empCode = res.data.empCode;
      }

      // Save salary if components exist
      if (salaryComponents.length > 0 && totalSalary > 0) {
        await api.post('/salary/employee-salary', {
          empCode, entity: values.entity, templateCode: selectedTemplate,
          components: salaryComponents, effectiveFrom: values.dateOfJoining?.toISOString() || new Date().toISOString(),
          revisionReason: isEdit ? 'Updated via employee form' : 'Initial salary assignment',
        });
      }

      message.success(isEdit ? 'Updated' : 'Created');
      navigate('/employees');
    } catch (err) { message.error(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/employees')} type="text" />
          <Title level={3} style={{ margin: 0, fontFamily: 'DM Sans' }}>
            {isEdit ? <><EditOutlined style={{ color: '#D97706' }} /> Edit Employee</> : <><UserAddOutlined style={{ color: '#059669' }} /> New Employee</>}
          </Title>
        </Space>
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => form.submit()}>Save</Button>
      </div>

      <Form form={form} layout="vertical" onFinish={save} initialValues={{ status: 'Active', employmentType: 'Permanent', taxRegime: 'NEW', paymentMode: 'TR', pfApplicable: false, esiApplicable: false, wageCategory: 'SKILLED', workState: 'HR' }}>
        <Tabs items={[
          { key: 'personal', label: <Space><UserAddOutlined />Personal</Space>, children: (
            <Card bordered={false} size="small">
              <Row gutter={16}>
                <Col span={6}><Form.Item name="empCode" label="Employee Code" rules={[{ required: true }]}><Input placeholder="MLP001" /></Form.Item></Col>
                <Col span={6}><Form.Item name="firstName" label="First Name" rules={[{ required: true }]}><Input /></Form.Item></Col>
                <Col span={6}><Form.Item name="lastName" label="Last Name"><Input /></Form.Item></Col>
                <Col span={6}><Form.Item name="gender" label="Gender"><Select options={[{ label: 'Male', value: 'Male' }, { label: 'Female', value: 'Female' }, { label: 'Other', value: 'Other' }]} /></Form.Item></Col>
                <Col span={6}><Form.Item name="dateOfBirth" label="Date of Birth"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={6}><Form.Item name="fatherName" label="Father's Name"><Input /></Form.Item></Col>
                <Col span={6}><Form.Item name="email" label="Email"><Input /></Form.Item></Col>
                <Col span={6}><Form.Item name="mobile" label="Mobile"><Input /></Form.Item></Col>
              </Row>
            </Card>
          )},
          { key: 'employment', label: <Space><SafetyCertificateOutlined />Employment</Space>, children: (
            <Card bordered={false} size="small">
              <Row gutter={16}>
                <Col span={6}><Form.Item name="dateOfJoining" label="Date of Joining" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={6}><Form.Item name="department" label="Department" rules={[{ required: true }]}><Input /></Form.Item></Col>
                <Col span={6}><Form.Item name="designation" label="Designation"><Input /></Form.Item></Col>
                <Col span={6}><Form.Item name="grade" label="Grade"><Input /></Form.Item></Col>
                <Col span={6}><Form.Item name="employmentType" label="Employment Type"><Select options={['Permanent', 'Contract', 'Intern', 'Consultant'].map(v => ({ label: v, value: v }))} /></Form.Item></Col>
                <Col span={6}><Form.Item name="status" label="Status"><Select options={['Active', 'OnNotice', 'Separated', 'Inactive'].map(v => ({ label: v, value: v }))} /></Form.Item></Col>
                <Col span={6}><Form.Item name="workState" label="Work State"><Select showSearch options={states.map(s => ({ label: `${s.code} - ${s.name}`, value: s.code }))} /></Form.Item></Col>
                <Col span={6}><Form.Item name="wageCategory" label="Wage Category"><Select options={['UNSKILLED', 'SEMI_SKILLED', 'SKILLED', 'HIGHLY_SKILLED', 'CLERICAL'].map(v => ({ label: v.replace(/_/g, ' '), value: v }))} /></Form.Item></Col>
              </Row>
            </Card>
          )},
          { key: 'salary', label: <Space><DollarOutlined />Salary Structure</Space>, children: (
            <Card bordered={false} size="small">
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={8}>
                  <Text strong>Salary Template</Text>
                  <Select value={selectedTemplate} onChange={applyTemplate} style={{ width: '100%', marginTop: 4 }} placeholder="Select template"
                    options={templates.map(t => ({ label: `${t.name} (${t.heads?.length} heads)`, value: t.code }))} />
                </Col>
                <Col span={8}>
                  <Text strong>Total Monthly</Text>
                  <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'DM Sans', color: '#1A6FB5', marginTop: 4 }}>₹{totalSalary.toLocaleString('en-IN')}</div>
                </Col>
                <Col span={8}>
                  {minWage && (
                    <div>
                      <Text strong>Min Wage: ₹{minWage.minimumMonthly.toLocaleString('en-IN')}</Text>
                      <Progress percent={Math.round(minWagePercent)} status={minWageCheck ? 'success' : 'exception'} size="small" style={{ marginTop: 4 }} />
                      {!minWageCheck && <Tag color="error" icon={<WarningOutlined />}>Below minimum wage!</Tag>}
                    </div>
                  )}
                </Col>
              </Row>

              {salaryComponents.length === 0 && <Alert message="Select a salary template above to define salary components" type="info" showIcon />}

              {salaryComponents.filter(c => c.headType === 'EARNING').map((comp, idx) => (
                <Row key={comp.headCode} gutter={16} style={{ marginBottom: 8 }} align="middle">
                  <Col span={6}><Text strong>{comp.headName}</Text><br /><Text type="secondary" style={{ fontSize: 10 }}>{comp.headCode} {comp.isPFApplicable ? '• PF' : ''} {comp.isESIApplicable ? '• ESI' : ''}</Text></Col>
                  <Col span={6}><InputNumber value={comp.amount} onChange={v => updateCompAmount(salaryComponents.indexOf(comp), v)} style={{ width: '100%' }} min={0} prefix="₹" /></Col>
                  <Col span={4}><Text type="secondary">₹{((comp.amount || 0) * 12).toLocaleString('en-IN')}/yr</Text></Col>
                </Row>
              ))}

              {salaryComponents.length > 0 && (
                <Divider style={{ margin: '12px 0' }}>
                  <Text strong>Annual CTC: ₹{(totalSalary * 12).toLocaleString('en-IN')}</Text>
                </Divider>
              )}

              {/* Legacy fields (hidden, for backward compat) */}
              <Form.Item name="basicSalary" hidden><InputNumber /></Form.Item>
              <Form.Item name="hra" hidden><InputNumber /></Form.Item>
              <Form.Item name="conveyanceAndOthers" hidden><InputNumber /></Form.Item>
              <Form.Item name="totalMonthlySalary" hidden><InputNumber /></Form.Item>
            </Card>
          )},
          { key: 'statutory', label: <Space><SafetyCertificateOutlined />Statutory</Space>, children: (
            <Card bordered={false} size="small">
              <Row gutter={16}>
                <Col span={6}><Form.Item name="pfApplicable" label="PF Applicable" valuePropName="checked"><Switch /></Form.Item></Col>
                <Col span={6}><Form.Item name="esiApplicable" label="ESI Applicable" valuePropName="checked"><Switch /></Form.Item></Col>
                <Col span={6}><Form.Item name="tdsAmount" label="Monthly TDS (₹)"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
                <Col span={6}><Form.Item name="taxRegime" label="Tax Regime"><Select options={[{ label: 'New', value: 'NEW' }, { label: 'Old', value: 'OLD' }]} /></Form.Item></Col>
                <Col span={6}><Form.Item name="uan" label="UAN"><Input /></Form.Item></Col>
                <Col span={6}><Form.Item name="pfNumber" label="PF Number"><Input /></Form.Item></Col>
                <Col span={6}><Form.Item name="esicNumber" label="ESIC Number"><Input /></Form.Item></Col>
                <Col span={6}><Form.Item name="pan" label="PAN"><Input /></Form.Item></Col>
                <Col span={6}><Form.Item name="aadhaar" label="Aadhaar"><Input /></Form.Item></Col>
              </Row>
            </Card>
          )},
          { key: 'bank', label: <Space><BankOutlined />Bank</Space>, children: (
            <Card bordered={false} size="small">
              <Row gutter={16}>
                <Col span={8}><Form.Item name="bankName" label="Bank Name"><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="accountNumber" label="Account Number"><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="ifscCode" label="IFSC"><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="paymentMode" label="Payment Mode"><Select options={['TR', 'NEFT', 'RTGS', 'CHEQUE'].map(v => ({ label: v, value: v }))} /></Form.Item></Col>
              </Row>
            </Card>
          )},
        ]} />
      </Form>
    </div>
  );
}

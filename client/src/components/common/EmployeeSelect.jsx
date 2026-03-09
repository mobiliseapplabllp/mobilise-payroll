import React, { useState, useEffect, useMemo } from 'react';
import { Select } from 'antd';
import api from '../../utils/api';

export default function EmployeeSelect({ value, onChange, placeholder = 'Search employee by name or code...', style, disabled, allowClear = true, status = 'Active' }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/employees', { params: { limit: 500, status: status || 'Active' } })
      .then(({ data }) => setEmployees(data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);

  const options = useMemo(() => 
    employees.map(emp => ({
      value: emp.empCode,
      label: `${emp.empCode} — ${emp.firstName} ${emp.lastName || ''}`.trim(),
      searchText: `${emp.empCode} ${emp.firstName} ${emp.lastName || ''} ${emp.department || ''} ${emp.designation || ''}`.toLowerCase(),
    })),
    [employees]
  );

  return (
    <Select
      showSearch
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{ width: '100%', ...style }}
      loading={loading}
      disabled={disabled}
      allowClear={allowClear}
      options={options}
      filterOption={(input, option) =>
        option?.searchText?.includes(input.toLowerCase()) || false
      }
      optionRender={(option) => (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{option.label}</span>
        </div>
      )}
    />
  );
}

import axios from 'axios';
const api = axios.create({ baseURL: '/api' });
api.interceptors.request.use(c => { const t = localStorage.getItem('accessToken'); if (t) c.headers.Authorization = `Bearer ${t}`; return c; });
api.interceptors.response.use(r => r, async err => {
  if (err.response?.status === 401 && err.response?.data?.code === 'TOKEN_EXPIRED') {
    try { const { data } = await axios.post('/api/auth/refresh', { refreshToken: localStorage.getItem('refreshToken') }); localStorage.setItem('accessToken', data.accessToken); err.config.headers.Authorization = `Bearer ${data.accessToken}`; return api(err.config); }
    catch { localStorage.clear(); window.location.href = '/login'; }
  }
  return Promise.reject(err);
});

// Download helper — opens URL with JWT token as query param
export const downloadFile = (path) => {
  const token = localStorage.getItem('accessToken');
  const url = path.startsWith('/api') ? path : `/api${path}`;
  window.open(`${url}${url.includes('?') ? '&' : '?'}token=${token}`, '_blank');
};

export default api;

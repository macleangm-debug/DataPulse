import axios from 'axios';
import { useAuthStore } from '../store';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API_BASE = `${BACKEND_URL}/api`;

// Create axios instance
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ============= AUTH API =============
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (email, password, name) => api.post('/auth/register', { email, password, name }),
  getMe: () => api.get('/auth/me'),
  getSSOUrl: (redirectUri) => api.get('/auth/sso/url', { params: { redirect_uri: redirectUri } }),
  ssoCallback: (code, redirectUri) => api.post('/auth/sso/callback', { code, redirect_uri: redirectUri }),
};

// ============= ORGANIZATION API =============
export const orgAPI = {
  list: () => api.get('/organizations'),
  get: (orgId) => api.get(`/organizations/${orgId}`),
  create: (data) => api.post('/organizations', data),
  update: (orgId, data) => api.put(`/organizations/${orgId}`, data),
  getMembers: (orgId) => api.get(`/organizations/${orgId}/members`),
  addMember: (orgId, email, role) => api.post(`/organizations/${orgId}/members`, null, { params: { email, role } }),
  removeMember: (orgId, memberId) => api.delete(`/organizations/${orgId}/members/${memberId}`),
};

// ============= PROJECT API =============
export const projectAPI = {
  list: (orgId, status) => api.get('/projects', { params: { org_id: orgId, status } }),
  get: (projectId) => api.get(`/projects/${projectId}`),
  create: (data) => api.post('/projects', data),
  update: (projectId, data) => api.put(`/projects/${projectId}`, data),
  updateStatus: (projectId, status) => api.patch(`/projects/${projectId}/status`, null, { params: { new_status: status } }),
  delete: (projectId) => api.delete(`/projects/${projectId}`),
};

// ============= FORM API =============
export const formAPI = {
  list: (projectId, status) => api.get('/forms', { params: { project_id: projectId, status_filter: status } }),
  get: (formId) => api.get(`/forms/${formId}`),
  create: (data) => api.post('/forms', data),
  update: (formId, data) => api.put(`/forms/${formId}`, data),
  updateFields: (formId, fields) => api.patch(`/forms/${formId}/fields`, { fields }),
  publish: (formId) => api.post(`/forms/${formId}/publish`),
  archive: (formId) => api.post(`/forms/${formId}/archive`),
  duplicate: (formId, newName) => api.post(`/forms/${formId}/duplicate`, null, { params: { new_name: newName } }),
};

// ============= SUBMISSION API =============
export const submissionAPI = {
  list: (formId, params) => api.get('/submissions', { params: { form_id: formId, ...params } }),
  get: (submissionId) => api.get(`/submissions/${submissionId}`),
  create: (data) => api.post('/submissions', data),
  createBulk: (submissions) => api.post('/submissions/bulk', { submissions }),
  review: (submissionId, status, notes) => api.patch(`/submissions/${submissionId}/review`, { status, notes }),
  delete: (submissionId) => api.delete(`/submissions/${submissionId}`),
};

// ============= CASE API =============
export const caseAPI = {
  list: (projectId, params) => api.get('/cases', { params: { project_id: projectId, ...params } }),
  get: (caseId) => api.get(`/cases/${caseId}`),
  create: (data) => api.post('/cases', data),
  update: (caseId, data) => api.put(`/cases/${caseId}`, data),
  updateStatus: (caseId, status) => api.patch(`/cases/${caseId}/status`, null, { params: { new_status: status } }),
  assign: (caseId, userId) => api.patch(`/cases/${caseId}/assign`, null, { params: { user_id: userId } }),
  getSubmissions: (caseId) => api.get(`/cases/${caseId}/submissions`),
};

// ============= EXPORT API =============
export const exportAPI = {
  toCSV: (formId, filters = {}) => api.post('/exports/csv', { form_id: formId, filters }, { responseType: 'blob' }),
  toJSON: (formId, filters = {}) => api.post('/exports/json', { form_id: formId, filters }, { responseType: 'blob' }),
  toXLSX: (formId, filters = {}) => api.post('/exports/xlsx', { form_id: formId, filters }, { responseType: 'blob' }),
  getHistory: (orgId) => api.get('/exports/history', { params: { org_id: orgId } }),
};

// ============= DASHBOARD API =============
export const dashboardAPI = {
  getStats: (orgId) => api.get('/dashboard/stats', { params: { org_id: orgId } }),
  getSubmissionTrends: (orgId, days = 30, projectId = null) => 
    api.get('/dashboard/submission-trends', { params: { org_id: orgId, days, project_id: projectId } }),
  getQualityMetrics: (orgId, projectId = null, formId = null) => 
    api.get('/dashboard/quality-metrics', { params: { org_id: orgId, project_id: projectId, form_id: formId } }),
  getEnumeratorPerformance: (orgId, projectId = null, days = 30) => 
    api.get('/dashboard/enumerator-performance', { params: { org_id: orgId, project_id: projectId, days } }),
  getGPSLocations: (orgId, projectId = null, formId = null, days = 7) => 
    api.get('/dashboard/gps-locations', { params: { org_id: orgId, project_id: projectId, form_id: formId, days } }),
  getRecentActivity: (orgId, limit = 20) => 
    api.get('/dashboard/recent-activity', { params: { org_id: orgId, limit } }),
};

// ============= MEDIA API =============
export const mediaAPI = {
  upload: (file, mediaType, fieldId = null, submissionId = null) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('media_type', mediaType);
    formData.append('user_id', localStorage.getItem('user_id') || 'anonymous');
    if (fieldId) formData.append('field_id', fieldId);
    if (submissionId) formData.append('submission_id', submissionId);
    return api.post('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  getFile: (fileId) => api.get(`/media/file/${fileId}`, { responseType: 'blob' }),
  getThumbnail: (fileId) => api.get(`/media/thumbnail/${fileId}`, { responseType: 'blob' }),
  delete: (fileId) => api.delete(`/media/${fileId}`),
  getBySubmission: (submissionId) => api.get(`/media/submission/${submissionId}`),
  getLimits: () => api.get('/media/limits'),
};

export default api;

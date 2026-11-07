const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const TOKEN_KEY = 'agent-hub-token';
const getToken = () => sessionStorage.getItem(TOKEN_KEY);
const setToken = token => token ? sessionStorage.setItem(TOKEN_KEY, token) : sessionStorage.removeItem(TOKEN_KEY);

async function request(path, options = {}) {
  const token = ['/auth/register', '/auth/login'].includes(path) ? null : getToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
  });
  const raw = await response.text();
  let payload = null;
  try { payload = raw ? JSON.parse(raw) : null; } catch { payload = raw; }
  if (!response.ok) {
    if (response.status === 401 && token && getToken() === token) {
      setToken(null);
      window.dispatchEvent(new Event('agent-hub-unauthorized'));
    }
    const message = typeof payload === 'string' ? payload : payload?.message || payload?.error || `Request failed (${response.status})`;
    throw Object.assign(new Error(message), { status: response.status, errors: payload?.errors });
  }
  return payload;
}

function unwrap(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.agents)) return value.agents;
  if (Array.isArray(value?.data?.agents)) return value.data.agents;
  return value?.data ?? value;
}

export const api = {
  getToken,
  setToken,
  async register(data) { return unwrap(await request('/auth/register', { method: 'POST', body: JSON.stringify(data) })); },
  async login(data) { return unwrap(await request('/auth/login', { method: 'POST', body: JSON.stringify(data) })); },
  async me() { return unwrap(await request('/auth/me')); },
  async listAgents() {
    const result = await request('/agents');
    const data = unwrap(result);
    return Array.isArray(data) ? data : [];
  },
  async getAgent(id) {
    return unwrap(await request(`/agents/${encodeURIComponent(id)}`));
  },
  async createAgent(agent) {
    return unwrap(await request('/agents', { method: 'POST', body: JSON.stringify(agent) }));
  },
  async updateAgent(id, agent) {
    return unwrap(await request(`/agents/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(agent) }));
  },
  async deleteAgent(id) {
    return request(`/agents/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};
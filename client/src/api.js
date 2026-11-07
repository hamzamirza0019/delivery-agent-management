const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const raw = await response.text();
  let payload = null;
  try { payload = raw ? JSON.parse(raw) : null; } catch { payload = raw; }
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.message || payload?.error || `Request failed (${response.status})`;
    throw new Error(message);
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
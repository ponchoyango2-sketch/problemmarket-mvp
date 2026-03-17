const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function request(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  register: (body) => request('POST', '/users/register', body),
  login: (body) => request('POST', '/users/login', body),
  getProblems: () => request('GET', '/problems'),
  getProblem: (id) => request('GET', `/problems/${id}`),
  createProblem: (body, token) => request('POST', '/problems', body, token),
  createCheckoutSession: (body, token) =>
    request('POST', '/api/payments/create-checkout-session', body, token),
  submitSolution: (problemId, body, token) =>
    request('POST', `/problems/${problemId}/solutions`, body, token),
  selectWinner: (problemId, body, token) =>
    request('POST', `/problems/${problemId}/select-winner`, body, token),
  platformFees: () => request('GET', '/platform/fees'),
  aiChat: (body, token) => request('POST', '/api/ai/chat', body, token),
  aiHistory: (token) => request('GET', '/api/ai/history', null, token),
};

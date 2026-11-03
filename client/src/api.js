// Appels HTTP vers /api. Le cookie de session (HttpOnly) est envoyé automatiquement par le navigateur.
async function call(method, path, body) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error || `Erreur ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  me: () => call('GET', '/api/me'),
  rooms: () => call('GET', '/api/rooms'),
  register: body => call('POST', '/api/register', body),
  login: body => call('POST', '/api/login', body),
  logout: () => call('POST', '/api/logout'),
  ticket: () => call('POST', '/api/ws-ticket').then(d => d.ticket),
};

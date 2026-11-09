const base = process.env.API_URL || 'http://localhost:4000/api/v1';
const password = 'Parking@123';
const call = async (path, token, options = {}) => {
  const response = await fetch(`${base}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(`${response.status} ${path}: ${body.message}`);
  return body.data;
};
const login = (email) => call('/auth/login', null, { method: 'POST', body: JSON.stringify({ email, password }) });

const resident = await login('resident1@parking.local');
if (resident.user.role !== 'RESIDENT') throw new Error('Sai role cư dân');
const residentPaths = ['/auth/me', `/residents/${resident.user.resident.id}`, '/vehicles', '/plans', '/areas', '/registrations', '/payments', '/tickets', '/parking/sessions', '/notifications'];
for (const path of residentPaths) await call(path, resident.accessToken);

const guard = await login('guard1@parking.local');
if (guard.user.role !== 'GUARD') throw new Error('Sai role bảo vệ');
for (const path of ['/auth/me', '/areas', '/parking/sessions', '/violations']) await call(path, guard.accessToken);

const tickets = await call('/tickets', resident.accessToken);
const active = tickets.find((ticket) => ticket.status === 'ACTIVE');
if (active) {
  const qr = await call(`/tickets/${active.id}/qr`, resident.accessToken);
  const verified = await call('/parking/verify-qr', guard.accessToken, { method: 'POST', body: JSON.stringify({ qrToken: qr.token }) });
  if (verified.id !== active.id) throw new Error('QR trả về sai vé');
}
console.log(`MOBILE_API_SMOKE_OK: resident ${residentPaths.length} API, guard 4 API${active ? ', QR thật đã xác thực' : ', seed không có vé ACTIVE để xác thực QR'}.`);

import axios from './axiosClient';
export const residentApi = {
  getProfile: (id) => axios.get(`/residents/${id}`), updateProfile: (id, data) => axios.patch(`/residents/${id}`, data),
  vehicles: () => axios.get('/vehicles'), createVehicle: (data) => axios.post('/vehicles', data),
  updateVehicle: (id, data) => axios.patch(`/vehicles/${id}`, data), deleteVehicle: (id) => axios.delete(`/vehicles/${id}`),
  prices: () => axios.get('/prices'), plans: () => axios.get('/plans'), areas: () => axios.get('/areas'), registrations: () => axios.get('/registrations'),
  createRegistration: (data) => axios.post('/registrations', data), cancelRegistration: (id) => axios.patch(`/registrations/${id}/cancel`),
  tickets: () => axios.get('/tickets'), ticketQr: (id) => axios.get(`/tickets/${id}/qr`),
  renewTicket: (id, data = {}) => axios.post(`/tickets/${id}/renew`, data),
  reportLost: (id) => axios.post(`/tickets/${id}/report-lost`), regenerateQr: (id) => axios.post(`/tickets/${id}/regenerate-qr`),
  payments: () => axios.get('/payments'), sessions: () => axios.get('/parking/sessions'),
  notifications: () => axios.get('/notifications'), readNotification: (id) => axios.patch(`/notifications/${id}/read`),
  readAllNotifications: () => axios.patch('/notifications/read-all')
};
export const guardApi = {
  lookupVehicle: (licensePlate) => axios.get('/parking/vehicles/lookup', { params: { licensePlate } }),
  areas: () => axios.get('/areas'), sessions: () => axios.get('/parking/sessions'), violations: () => axios.get('/violations'),
  verifyQr: (qrToken, details = {}) => axios.post('/parking/verify-qr', { qrToken, ...details }),
  checkIn: (qrToken, gate, requestId, details = {}) => axios.post('/parking/check-in', { qrToken, gate, requestId, ...details }),
  checkOut: (qrToken, gate, requestId, details = {}) => axios.post('/parking/check-out', { qrToken, gate, requestId, ...details }),
  createViolation: (data) => axios.post('/violations', data)
};

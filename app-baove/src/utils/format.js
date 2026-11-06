export const formatDate = (value, withTime = false) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('vi-VN', withTime ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'short' }).format(new Date(value));
};
export const formatTime = (value) => value ? new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '-';
export const formatMoney = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0));
export const daysUntil = (value) => value ? Math.ceil((new Date(value).getTime() - Date.now()) / 86400000) : null;

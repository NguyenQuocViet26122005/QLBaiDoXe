// Business dates use Vietnam time regardless of the server's operating-system timezone.
const VN_OFFSET = 7 * 60 * 60 * 1000;
export const addMonths = (date: Date, months: number) => {
  const local = new Date(date.getTime() + VN_OFFSET);
  const day = local.getUTCDate();
  local.setUTCDate(1);
  local.setUTCMonth(local.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0)).getUTCDate();
  local.setUTCDate(Math.min(day, lastDay));
  return new Date(local.getTime() - VN_OFFSET);
};
export const startOfDay = (date: Date) => {
  const local = new Date(date.getTime() + VN_OFFSET);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - VN_OFFSET);
};
export const daysUntil = (date: Date, now = new Date()) => Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / 86400000);

import { useEffect, useState } from 'react';

const dateFmt = new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' });

/** Ngày + giờ hiện tại, cập nhật mỗi 20 giây. */
export default function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 20000); return () => clearInterval(id); }, []);
  return <time dateTime={now.toISOString()} className="live-clock">{dateFmt.format(now)}<b>{timeFmt.format(now)}</b></time>;
}

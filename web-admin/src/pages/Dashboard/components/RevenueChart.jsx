import { formatDate } from '../../../utils/formatDate';

export default function RevenueChart({ tickets = [] }) {
  const months = Array.from({ length: 6 }, (_, offset) => {
    const date = new Date(); date.setDate(1); date.setMonth(date.getMonth() - (5 - offset));
    const count = tickets.filter((ticket) => { const created = new Date(ticket.createdAt); return created.getMonth() === date.getMonth() && created.getFullYear() === date.getFullYear(); }).length;
    return { label: `T${date.getMonth() + 1}`, count };
  });
  const max = Math.max(...months.map((item) => item.count), 1);
  return <section className="panel chart-panel"><div className="panel-heading"><div><h2>Đăng ký vé mới</h2><p>Dữ liệu 6 tháng gần nhất, cập nhật {formatDate(new Date())}.</p></div></div><div className="bar-chart" role="img" aria-label="Biểu đồ số vé đăng ký trong 6 tháng gần nhất">{months.map((item) => <div className="bar-column" key={item.label}><div className="bar-value">{item.count}</div><div className="bar-track"><span style={{ height: `${Math.max(item.count ? 14 : 2, (item.count / max) * 100)}%` }} /></div><small>{item.label}</small></div>)}</div></section>;
}

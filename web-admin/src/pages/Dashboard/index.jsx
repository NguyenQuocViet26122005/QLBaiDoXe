import { useEffect, useMemo, useState } from 'react';
import { Button } from '@fluentui/react-components';
import {
  ArrowClockwise, ArrowRight, Buildings, Car, CarProfile as Parking,
  CurrencyCircleDollar, Scan, Ticket, Users, Warning
} from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import StatusBadge from '../../components/common/StatusBadge';
import ParkingVisual from '../../components/visual/ParkingVisual';
import { getDashboard, getRevenue, getParking } from '../../services/reportApi';
import { getApartments } from '../../services/apartmentApi';
import { getRegistrations } from '../../services/registrationApi';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatDate } from '../../utils/formatDate';
import { useAuth } from '../../hooks/useAuth';
import dashboardBuilding from '../../assets/visuals/dashboard-building.webp';

const number = new Intl.NumberFormat('vi-VN');
const columns = [
  { key: 'time', label: 'Ngày đăng ký', render: row => formatDate(row.createdAt, true) },
  {
    key: 'resident', label: 'Cư dân',
    render: row => (
      <div className="cell-main">
        <strong>{row.resident.user.fullName}</strong>
        <small>{row.resident.residentCode}</small>
      </div>
    )
  },
  { key: 'plate', label: 'Biển số', render: row => <b className="plate">{row.vehicle.licensePlate}</b> },
  { key: 'plan', label: 'Gói gửi', render: row => row.plan.name },
  { key: 'status', label: 'Trạng thái', render: row => <StatusBadge status={row.status} /> }
];

export default function Dashboard() {
  const { user } = useAuth();
  const [state, setState] = useState({ summary: null, revenue: [], parking: [], apartments: [], registrations: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [summary, revenue, parking, apartments, registrations] = await Promise.all([
        getDashboard(), getRevenue(), getParking(), getApartments(), getRegistrations()
      ]);
      setState({ summary, revenue, parking, apartments, registrations });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  const pending = useMemo(() => state.registrations.filter(item => item.status === 'PENDING'), [state.registrations]);
  const summary = state.summary ?? {};
  const firstName = user?.fullName?.trim().split(' ').at(-1) || 'bạn';
  const metrics = [
    { label: 'Cư dân', value: summary.residents, icon: Users },
    { label: 'Căn hộ', value: state.apartments.length, icon: Buildings },
    { label: 'Phương tiện', value: summary.vehicles, icon: Car },
    { label: 'Vé hoạt động', value: summary.activeTickets, icon: Ticket },
    { label: 'Xe trong bãi', value: summary.vehiclesParking, icon: Parking },
    { label: 'Doanh thu', value: formatCurrency(summary.revenue), icon: CurrencyCircleDollar, wide: true }
  ];
  const totalRevenue = state.revenue.reduce((sum, item) => sum + Number(item._sum?.amount || 0), 0);
  const usage = summary.parkingUsageRate || 0;

  return (
    <div className="page-stack dashboard-page" aria-busy={loading}>
      <PageHeader
        title="Tổng quan vận hành"
        eyebrow=""
        description="Theo dõi trạng thái bãi xe và công việc cần xử lý trong ngày."
        actions={<Button appearance="secondary" icon={<ArrowClockwise />} onClick={load} disabled={loading}>Làm mới</Button>}
      />
      {error && (
        <div className="error-banner" role="alert">
          <div><strong>Không tải được dữ liệu tổng quan</strong><span>{error}</span></div>
          <button onClick={load}>Thử lại</button>
        </div>
      )}
      {loading && (
        <div className="dashboard-skeleton" role="status" aria-label="Đang tải tổng quan">
          <span /><span /><span /><span /><b /><b />
        </div>
      )}
      {!loading && state.summary && (
        <>
          <section className="dashboard-hero" aria-label="Thao tác vận hành">
            <div className="dashboard-welcome">
              <h2>Chào {firstName}</h2>
              <p>{pending.length ? `${pending.length} đăng ký đang chờ duyệt.` : 'Không có đăng ký nào đang chờ duyệt.'}</p>
              <div className="hero-actions">
                <Link className="primary-link" to="/registrations">Xử lý đăng ký <ArrowRight /></Link>
              </div>
            </div>
            <ParkingVisual
              className="hero-scene" image={dashboardBuilding} alt=""
              background="#171a17" zoom={1.04} minWidth={1100}
            />
            <nav className="quick-actions" aria-label="Thao tác nhanh">
              <Link to="/parking-sessions"><Scan />Xem lượt ra vào</Link>
              <Link to="/violations"><Warning />Xử lý vi phạm</Link>
            </nav>
          </section>

          <section className="metric-strip" aria-label="Chỉ số vận hành">
            {metrics.map(({ label, value, icon: Icon, wide }) => (
              <article key={label} className={wide ? 'wide' : undefined}>
                <span className="metric-icon"><Icon aria-hidden="true" /></span>
                <span className="metric-label">{label}</span>
                <strong>{typeof value === 'number' ? number.format(value) : value ?? 0}</strong>
              </article>
            ))}
          </section>

          <section className="data-panel dashboard-queue" aria-labelledby="dashboard-queue-title">
            <header>
              <div>
                <h2 id="dashboard-queue-title">Đăng ký chờ duyệt</h2>
                <p>Cần xác minh xe và gói gửi trước khi phê duyệt.</p>
              </div>
              <Link to="/registrations">Xem tất cả ({pending.length}) <ArrowRight /></Link>
            </header>
            <DataTable
              columns={columns} data={pending.slice(0, 6)}
              emptyTitle="Không có hồ sơ chờ duyệt"
              emptyDescription="Các đăng ký mới sẽ xuất hiện tại đây."
            />
          </section>

          <section className="dashboard-alerts" aria-label="Công việc cần theo dõi">
            <article>
              <Warning aria-hidden="true" />
              <div><strong>{summary.openViolations || 0} vi phạm chưa xử lý</strong><span>Cần cập nhật kết quả xử lý biên bản.</span></div>
              <Link to="/violations">Mở danh sách</Link>
            </article>
            <article>
              <Ticket aria-hidden="true" />
              <div><strong>{summary.expiringTickets || 0} vé sắp hết hạn</strong><span>Hệ thống đang tự động gửi nhắc hạn.</span></div>
              <Link to="/parking-tickets">Kiểm tra vé</Link>
            </article>
          </section>

          <section className="dashboard-analytics" aria-label="Doanh thu và sử dụng bãi xe">
            <article className="analytics-panel">
              <header>
                <div><h2>Doanh thu theo phương thức</h2><p>Dữ liệu thanh toán đã xác nhận từ hệ thống.</p></div>
                <b>{formatCurrency(totalRevenue)}</b>
              </header>
              <div className="revenue-bars">
                {state.revenue.length ? state.revenue.map(item => {
                  const amount = Number(item._sum?.amount || 0);
                  return (
                    <div key={item.method} className="revenue-method">
                      <span>{item.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}</span>
                      <strong>{formatCurrency(amount)}</strong>
                      <div className="revenue-track" aria-hidden="true">
                        <i style={{ width: `${totalRevenue ? amount / totalRevenue * 100 : 0}%` }} />
                      </div>
                      <small>{item._count} giao dịch</small>
                    </div>
                  );
                }) : <p className="analytics-empty">Chưa có giao dịch đã xác nhận.</p>}
              </div>
            </article>
            <article className="occupancy-panel">
              <header><h2>Công suất bãi xe</h2><span>{number.format(usage)}%</span></header>
              <div className="occupancy-overview">
                <span><strong>{number.format(summary.vehiclesParking || 0)}</strong> xe đang gửi</span>
                <div className="occupancy-track" aria-hidden="true">
                  <i style={{ width: `${Math.min(100, usage)}%` }} />
                </div>
              </div>
              <div className="area-list">
                {state.parking.map(area => (
                  <div key={area.id}><span>{area.name}</span><b>{area._count?.sessions || 0}/{area.capacity}</b></div>
                ))}
              </div>
              <Link to="/parking-areas">Xem các bãi xe <ArrowRight /></Link>
            </article>
          </section>
        </>
      )}
    </div>
  );
}

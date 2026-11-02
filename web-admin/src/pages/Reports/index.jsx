import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Button } from '@fluentui/react-components';
import { ArrowClockwise, CarProfile, ChartBar, Cube, Info, Warning } from '@phosphor-icons/react';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/common/StatusBadge';
import { getDashboard, getParking, getRevenue, getViolationReport } from '../../services/reportApi';
import { formatCurrency } from '../../utils/formatCurrency';

function UnavailablePreview() {
  return <p className="report-preview-note" role="status">Không mở được mô hình 3D trên thiết bị này.</p>;
}

const OccupancyTowers3D = lazy(() => import('../../components/visual/OccupancyTowers3D')
  .catch(() => ({ default: UnavailablePreview })));

const TYPE_LABEL = {
  INVALID_QR: 'QR không hợp lệ',
  EXPIRED_TICKET: 'Vé hết hạn',
  WRONG_VEHICLE: 'Sai phương tiện',
  UNAUTHORIZED_VEHICLE: 'Xe chưa đăng ký',
  OTHER: 'Khác'
};
const number = new Intl.NumberFormat('vi-VN');

function ReportPanel({ id, title, icon: Icon, summary, children, wide }) {
  return (
    <section className={wide ? 'report-block wide' : 'report-block'} aria-labelledby={id}>
      <header>
        <Icon aria-hidden="true" />
        <div><h2 id={id}>{title}</h2><strong>{summary}</strong></div>
      </header>
      {children}
    </section>
  );
}

function ReportBar({ label, value, share, detail, status }) {
  return (
    <li className="report-bar">
      <div className="report-bar-label">
        <span>{label}</span>
        {status && <StatusBadge status={status} />}
      </div>
      <strong>{value}</strong>
      <div className="report-track" aria-hidden="true">
        <span style={{ width: `${Math.max(0, Math.min(100, share))}%` }} />
      </div>
      {detail && <small>{detail}</small>}
    </li>
  );
}

export default function Reports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [show3D, setShow3D] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [dashboard, revenue, parking, violations] = await Promise.all([
        getDashboard(), getRevenue(), getParking(), getViolationReport()
      ]);
      setData({ dashboard, revenue, parking, violations });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const areas = useMemo(() => (data?.parking ?? []).map(area => ({
    id: area.id, name: area.name, used: area._count?.sessions || 0, capacity: area.capacity
  })), [data?.parking]);

  const totalRevenue = data?.revenue.reduce((sum, item) => sum + Number(item._sum?.amount || 0), 0) ?? 0;
  const totalViolations = data?.violations.reduce((sum, item) => sum + item._count, 0) ?? 0;
  const maxViolation = Math.max(...(data?.violations.map(item => item._count) ?? []), 1);

  return (
    <div className="page-stack reports-page" aria-busy={loading}>
      <PageHeader
        title="Báo cáo vận hành"
        eyebrow=""
        description="Theo dõi doanh thu, mức sử dụng bãi xe và vi phạm."
        actions={<Button appearance="secondary" icon={<ArrowClockwise />} onClick={load} disabled={loading}>Làm mới</Button>}
      />
      <p className="report-scope"><Info aria-hidden="true" /> Số liệu tổng hợp toàn hệ thống.</p>
      {error && (
        <div className="error-banner" role="alert">
          <div><strong>Không tải được báo cáo</strong><span>{error}</span></div>
          <button type="button" onClick={load}>Thử lại</button>
        </div>
      )}
      {loading && !data && <div className="report-skeleton" role="status" aria-label="Đang tải báo cáo"><span /><span /><span /></div>}
      {data && (
        <div className="report-grid">
          <ReportPanel id="report-revenue" title="Doanh thu đã xác nhận" icon={ChartBar} summary={formatCurrency(totalRevenue)}>
            {data.revenue.length ? (
              <ul className="report-bars">
                {data.revenue.map(item => {
                  const amount = Number(item._sum?.amount || 0);
                  return (
                    <ReportBar
                      key={item.method}
                      label={item.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}
                      value={formatCurrency(amount)}
                      share={totalRevenue ? amount / totalRevenue * 100 : 0}
                      detail={`${number.format(item._count)} giao dịch`}
                    />
                  );
                })}
              </ul>
            ) : <p className="report-empty">Chưa có giao dịch đã xác nhận.</p>}
          </ReportPanel>

          <ReportPanel
            id="report-parking"
            title="Sử dụng bãi xe"
            icon={CarProfile}
            summary={`${number.format(data.dashboard?.parkingUsageRate || 0)}%`}
          >
            {areas.length ? (
              <>
                <ul className="report-bars">
                  {areas.map(area => (
                    <ReportBar
                      key={area.id}
                      label={area.name}
                      value={`${number.format(area.used)}/${number.format(area.capacity)} chỗ`}
                      share={area.capacity ? area.used / area.capacity * 100 : 0}
                    />
                  ))}
                </ul>
                <div className="report-preview">
                  <Button appearance="secondary" icon={<Cube />} aria-expanded={show3D} aria-controls="report-3d" onClick={() => setShow3D(visible => !visible)}>
                    {show3D ? 'Ẩn mô hình 3D' : 'Xem mô hình 3D'}
                  </Button>
                  <div id="report-3d" hidden={!show3D}>
                    {show3D && (
                      <Suspense fallback={<p className="report-preview-note" role="status">Đang tải mô hình 3D…</p>}>
                        <OccupancyTowers3D areas={areas} />
                        <p className="report-3d-caption">Các cột theo thứ tự danh sách trên. Cột đỏ đánh dấu bãi đã sử dụng từ 90% sức chứa.</p>
                      </Suspense>
                    )}
                  </div>
                </div>
              </>
            ) : <p className="report-empty">Chưa có dữ liệu bãi xe.</p>}
          </ReportPanel>

          <ReportPanel id="report-violations" title="Vi phạm theo loại" icon={Warning} summary={`${number.format(totalViolations)} biên bản`} wide>
            {data.violations.length ? (
              <ul className="report-bars report-violations">
                {data.violations.map(item => (
                  <ReportBar
                    key={`${item.type}-${item.status}`}
                    label={TYPE_LABEL[item.type] || item.type}
                    value={number.format(item._count)}
                    share={item._count / maxViolation * 100}
                    status={item.status}
                  />
                ))}
              </ul>
            ) : <p className="report-empty">Chưa ghi nhận vi phạm.</p>}
          </ReportPanel>
        </div>
      )}
    </div>
  );
}

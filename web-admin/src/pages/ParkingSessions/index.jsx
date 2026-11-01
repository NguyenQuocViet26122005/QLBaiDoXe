import { useMemo, useState } from 'react';
import { Button } from '@fluentui/react-components';
import PageHeader from '../../components/common/PageHeader';
import Toolbar from '../../components/common/Toolbar';
import DataTable from '../../components/common/DataTable';
import StatusBadge from '../../components/common/StatusBadge';
import FormDialog from '../../components/common/FormDialog';
import { useResource } from '../../hooks/useResource';
import { getSessions, manualCheckout } from '../../services/sessionApi';
import { useToast } from '../../context/ToastContext';
import { formatDate } from '../../utils/formatDate';

export default function ParkingSessions() {
  const { items, loading, error, refresh } = useResource(getSessions);
  const [query, setQuery] = useState(''), [status, setStatus] = useState('ALL');
  const [selected, setSelected] = useState(null), [values, setValues] = useState({ gate: '', reason: '' }), [busy, setBusy] = useState(false);
  const toast = useToast();
  const filtered = useMemo(() => items.filter(r => (status === 'ALL' || r.status === status) && `${r.vehicle.licensePlate} ${r.ticket.ticketCode} ${r.area.name}`.toLowerCase().includes(query.toLowerCase())), [items, query, status]);
  const save = async event => {
    event.preventDefault();
    if (values.reason.trim().length < 3 || values.gate.trim().length < 2) return toast.error('Nhập cổng ra và lý do xác minh.');
    setBusy(true);
    try {
      await manualCheckout(selected.id, { gate: values.gate.trim(), reason: values.reason.trim() });
      toast.success('Đã ghi nhận xe ra và lưu lý do xác minh.');
      setSelected(null); await refresh();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  const columns = [
    { key: 'plate', label: 'Biển số', render: r => <b className="plate">{r.vehicle.licensePlate}</b> },
    { key: 'ticket', label: 'Mã vé', render: r => <span className="mono">{r.ticket.ticketCode}</span> },
    { key: 'area', label: 'Khu vực', render: r => r.area.name },
    { key: 'in', label: 'Thời gian vào', render: r => <div className="cell-main"><strong>{formatDate(r.checkInAt, true)}</strong><small>{r.checkInGate} · {r.checkInGuard?.fullName}</small></div> },
    { key: 'out', label: 'Thời gian ra', render: r => <div className="cell-main"><strong>{formatDate(r.checkOutAt, true)}</strong><small>{r.checkOutGate || '-'} · {r.checkOutGuard?.fullName || '-'}</small></div> },
    { key: 'status', label: 'Trạng thái', render: r => r.status === 'ABNORMAL' && !r.checkOutAt ? <span>Cần xác minh giờ ra</span> : <StatusBadge status={r.status} /> },
    { key: 'reason', label: 'Ghi chú xác minh', render: r => r.abnormalReason || '-' },
    { key: 'actions', label: 'Xử lý', render: r => (r.status === 'PARKING' || (r.status === 'ABNORMAL' && !r.checkOutAt)) ? <Button onClick={() => { setSelected(r); setValues({ gate: '', reason: '' }); }}>Xác minh xe ra</Button> : null },
  ];
  return <div className="page-stack">
    <PageHeader title="Lượt ra vào" description="Xe gửi qua đêm vẫn chiếm chỗ. Chỉ đóng lượt sau khi xác minh xe thực tế đã ra." />
    <Toolbar query={query} onQuery={setQuery} placeholder="Tìm biển số, mã vé, khu vực"><select value={status} onChange={e => setStatus(e.target.value)}><option value="ALL">Tất cả trạng thái</option><option value="PARKING">Đang trong bãi</option><option value="COMPLETED">Đã ra</option><option value="ABNORMAL">Ra qua xác minh</option></select></Toolbar>
    {error && <div className="error-banner">{error}</div>}
    <section className="data-panel"><header><h2>Nhật ký cổng xe</h2><span>{filtered.length} lượt</span></header><DataTable columns={columns} data={filtered} loading={loading} /></section>
    <FormDialog open={Boolean(selected)} title={`Xác minh xe ${selected?.vehicle.licensePlate || ''} đã ra`}
      fields={[{ key: 'gate', label: 'Cổng ra thực tế', required: true }, { key: 'reason', label: 'Lý do và căn cứ đối chiếu chủ xe/camera (mất QR, vé khóa...)', type: 'textarea', required: true, full: true }]}
      values={values} setValues={setValues} onSubmit={save} onClose={() => !busy && setSelected(null)} busy={busy} submitLabel="Đã đối chiếu và xác nhận xe ra" />
  </div>;
}

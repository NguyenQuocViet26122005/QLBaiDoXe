import { useMemo, useState } from 'react';
import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, Field, Input, Select, Textarea } from '@fluentui/react-components';
import PageHeader from '../../components/common/PageHeader';
import Toolbar from '../../components/common/Toolbar';
import DataTable from '../../components/common/DataTable';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmModal from '../../components/common/ConfirmModal';
import { useResource } from '../../hooks/useResource';
import { getRegistrations, approveRegistration, rejectRegistration, cancelRegistration, recordPayment, updatePaymentStatus } from '../../services/registrationApi';
import { useToast } from '../../context/ToastContext';
import { formatDate } from '../../utils/formatDate';
import { formatCurrency } from '../../utils/formatCurrency';

export default function Registrations() {
  const { items, loading, error, refresh } = useResource(getRegistrations);
  const toast = useToast();
  const [query, setQuery] = useState(''), [status, setStatus] = useState('ALL'), [action, setAction] = useState(null);
  const [reason, setReason] = useState(''), [method, setMethod] = useState('CASH'), [reference, setReference] = useState(''), [busy, setBusy] = useState(false);
  const filtered = useMemo(() => items.filter(r => (status === 'ALL' || r.status === status) && `${r.resident.user.fullName} ${r.vehicle.licensePlate} ${r.plan.name}`.toLowerCase().includes(query.toLowerCase())), [items, query, status]);
  const open = (kind, row) => {
    setAction({ kind, row, requestId: `admin-pay-${row.id}-${Date.now()}-${Math.random().toString(36).slice(2)}` });
    setReason(''); setMethod('CASH'); setReference('');
  };
  const run = async () => {
    setBusy(true);
    try {
      const { kind, row } = action;
      if (kind === 'approve') await approveRegistration(row.id);
      if (kind === 'reject') await rejectRegistration(row.id, reason.trim());
      if (kind === 'cancel') await cancelRegistration(row.id);
      if (kind === 'pay') await recordPayment({ registrationId: row.id, method, status: 'PAID', reference: reference.trim() || undefined, idempotencyKey: action.requestId });
      if (kind === 'refund') await updatePaymentStatus(row.payments.find(p => p.status === 'PAID').id, 'REFUNDED');
      toast.success(kind === 'pay' ? 'Đã ghi nhận tiền thực nhận và cấp vé.' : kind === 'refund' ? 'Đã ghi nhận hoàn tiền và thu hồi vé.' : 'Đã cập nhật hồ sơ.');
      setAction(null); await refresh();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  const columns = [
    { key: 'created', label: 'Đăng ký', render: r => formatDate(r.createdAt, true) },
    { key: 'resident', label: 'Cư dân', render: r => <div className="cell-main"><strong>{r.resident.user.fullName}</strong><small>{r.resident.residentCode}</small></div> },
    { key: 'vehicle', label: 'Phương tiện', render: r => <b className="plate">{r.vehicle.licensePlate}</b> },
    { key: 'plan', label: 'Gói / tổng tiền', render: r => <div className="cell-main"><strong>{r.plan.name}</strong><small>{formatCurrency(r.quotedAmount)} · {r.plan.durationMonths} tháng</small></div> },
    { key: 'start', label: 'Ngày yêu cầu', render: r => formatDate(r.requestedStartDate) },
    { key: 'status', label: 'Hồ sơ', render: r => <StatusBadge status={r.status} /> },
    { key: 'ticket', label: 'Vé / thanh toán', render: r => r.ticket ? <div className="cell-main"><StatusBadge status={r.ticket.status} /><small>{r.payments.some(p => p.status === 'PAID') ? 'Đã thanh toán' : r.payments.some(p => p.status === 'REFUNDED') ? 'Đã hoàn tiền' : ''}</small></div> : 'Chưa cấp vé' },
    { key: 'actions', label: 'Thao tác', render: r => <div className="row-actions">
      {r.status === 'PENDING' && <><Button onClick={() => open('approve', r)}>Duyệt</Button><Button onClick={() => open('reject', r)}>Từ chối</Button></>}
      {r.status === 'APPROVED' && !r.ticket && !r.payments.some(p => p.status === 'PAID') && <Button onClick={() => open('pay', r)}>Ghi nhận tiền</Button>}
      {['PENDING', 'APPROVED'].includes(r.status) && !r.ticket && <Button onClick={() => open('cancel', r)}>Hủy yêu cầu</Button>}
      {r.payments.some(p => p.status === 'PAID') && <Button onClick={() => open('refund', r)}>Hoàn tiền</Button>}
    </div> },
  ];
  const close = () => { if (!busy) setAction(null); };
  return <div className="page-stack">
    <PageHeader title="Đăng ký gửi xe" description="Duyệt giữ chỗ, xác nhận tiền thực nhận và phát hành vé. Hồ sơ chờ tiền hết hạn sau thời hạn ghi nhận." />
    <Toolbar query={query} onQuery={setQuery} placeholder="Tìm cư dân, biển số, gói gửi"><select value={status} onChange={e => setStatus(e.target.value)}><option value="ALL">Tất cả hồ sơ</option><option value="PENDING">Chờ duyệt</option><option value="APPROVED">Đã duyệt</option><option value="REJECTED">Bị từ chối</option><option value="CANCELLED">Đã hủy</option></select></Toolbar>
    {error && <div className="error-banner">{error}</div>}
    <section className="data-panel"><header><h2>Hồ sơ đăng ký</h2><span>{filtered.length} hồ sơ</span></header><DataTable columns={columns} data={filtered} loading={loading} /></section>
    <ConfirmModal open={['approve', 'cancel', 'refund'].includes(action?.kind)}
      title={action?.kind === 'refund' ? 'Xác nhận đã hoàn tiền' : action?.kind === 'cancel' ? 'Hủy yêu cầu' : 'Duyệt đăng ký'}
      message={action?.kind === 'refund' ? `Chỉ xác nhận sau khi đã hoàn đủ ${formatCurrency(action?.row.quotedAmount)} theo quyết định của quản lý. Thao tác thu hồi vé; hệ thống không tự chuyển tiền qua ngân hàng.` : action?.kind === 'cancel' ? 'Hủy hồ sơ chưa cấp vé và giải phóng chỗ đang giữ.' : 'Đã đối chiếu hồ sơ cư dân và phương tiện? Hệ thống sẽ kiểm tra điều kiện và sức chứa trước khi giữ chỗ.'}
      confirmLabel={action?.kind === 'refund' ? 'Đã hoàn tiền thực tế' : 'Xác nhận'} onConfirm={run} onClose={close} busy={busy} />
    <Dialog open={action?.kind === 'pay' || action?.kind === 'reject'} onOpenChange={(_, d) => !d.open && close()}><DialogSurface><DialogBody>
      <DialogTitle>{action?.kind === 'pay' ? 'Ghi nhận thanh toán thực nhận' : 'Từ chối đăng ký'}</DialogTitle>
      <DialogContent>{action?.kind === 'pay' ? <>
        <p>Tổng tiền: <strong>{formatCurrency(action.row.quotedAmount)}</strong>. Chỉ xác nhận khi đã nhận đủ tiền. Hạn thanh toán: {formatDate(action.row.expiresAt, true)}.</p>
        <Field label="Phương thức"><Select value={method} onChange={e => setMethod(e.target.value)}><option value="CASH">Tiền mặt</option><option value="BANK_TRANSFER">Chuyển khoản</option></Select></Field>
        <Field label="Mã giao dịch / chứng từ" required={method === 'BANK_TRANSFER'}><Input value={reference} onChange={(_, d) => setReference(d.value)} /></Field>
      </> : <Field label="Lý do" required><Textarea value={reason} onChange={e => setReason(e.target.value)} /></Field>}</DialogContent>
      <DialogActions><Button onClick={close} disabled={busy}>Đóng</Button><Button appearance="primary" disabled={busy || (action?.kind === 'reject' ? reason.trim().length < 3 : method === 'BANK_TRANSFER' && !reference.trim())} onClick={run}>{action?.kind === 'pay' ? 'Đã nhận đủ tiền' : 'Từ chối'}</Button></DialogActions>
    </DialogBody></DialogSurface></Dialog>
  </div>;
}

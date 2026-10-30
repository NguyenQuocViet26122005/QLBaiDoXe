import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle } from '@fluentui/react-components';

export default function ConfirmModal({ open, title = 'Xác nhận thao tác', message, confirmLabel = 'Xác nhận', danger = false, busy = false, onConfirm, onClose }) {
  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{title}</DialogTitle>
          <DialogContent>{message}</DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose} disabled={busy}>Hủy</Button>
            <Button appearance="primary" className={danger ? 'danger-button' : ''} onClick={onConfirm} disabled={busy}>{busy ? 'Đang xử lý...' : confirmLabel}</Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowElbowDownLeft, MagnifyingGlass, X } from '@phosphor-icons/react';
import { NAV_GROUPS, NAV_ITEMS } from '../../constants/navigation';
import { useAuth } from '../../hooks/useAuth';

export const OPEN_COMMAND_EVENT = 'parkops:command';
export const openCommandPalette = () => window.dispatchEvent(new Event(OPEN_COMMAND_EVENT));

// Bỏ dấu tiếng Việt để gõ "dang ky" vẫn tìm ra "Đăng ký".
const fold = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

const SHORTCUTS = [
  { to: '/registrations', label: 'Duyệt đăng ký đang chờ', hint: 'Đăng ký gửi xe' },
  { to: '/parking-sessions', label: 'Tra cứu lượt xe ra vào', hint: 'Lượt ra vào' },
  { to: '/violations', label: 'Xử lý vi phạm', hint: 'Vi phạm' },
  { to: '/parking-tickets', label: 'Kiểm tra vé sắp hết hạn', hint: 'Vé tháng' }
];

/** Bảng lệnh Ctrl/⌘ + K: chỉ điều hướng giữa các trang sẵn có, không gọi API. */
export default function CommandPalette() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    const onOpen = () => {
      setQuery('');
      setActive(0);
      setOpen(true);
    };
    const onKey = (e) => {
      if (e.repeat || e.isComposing || !(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'k') return;
      e.preventDefault();
      if (dialogRef.current?.open) setOpen(false);
      else if (!document.querySelector('[aria-modal="true"], dialog:modal')) onOpen();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_COMMAND_EVENT, onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener(OPEN_COMMAND_EVENT, onOpen); };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const dialog = dialogRef.current;
    dialog.showModal();
    inputRef.current.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const results = useMemo(() => {
    const allowed = NAV_ITEMS.filter((item) => !item.adminOnly || user?.role === 'ADMIN');
    const q = fold(query.trim());
    const pages = allowed
      .filter((item) => !q || fold(item.label).includes(q) || item.to.includes(q))
      .map((item) => ({ ...item, kind: 'page', group: NAV_GROUPS[item.to] }));
    const actions = SHORTCUTS
      .filter((a) => allowed.some((item) => item.to === a.to))
      .filter((a) => !q || fold(`${a.label} ${a.hint}`).includes(q))
      .map((a) => ({ ...a, kind: 'action', icon: allowed.find((item) => item.to === a.to).icon }));
    return [...actions, ...pages];
  }, [query, user]);

  useEffect(() => { setActive((i) => Math.min(i, Math.max(0, results.length - 1))); }, [results.length]);
  useEffect(() => {
    if (open) listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open, active, query]);

  const go = (item) => { setOpen(false); navigate(item.to); };
  const onKeyDown = (e) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % Math.max(1, results.length)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + results.length) % Math.max(1, results.length)); }
    else if (e.key === 'Enter' && results[active]) { e.preventDefault(); go(results[active]); }
  };

  let lastSection = '';
  return createPortal(
    <dialog
      ref={dialogRef}
      className="command-palette"
      aria-label="Tìm nhanh"
      onCancel={e => { e.preventDefault(); setOpen(false); }}
      onClick={e => {
        if (e.target !== e.currentTarget) return;
        const { left, right, top, bottom } = e.currentTarget.getBoundingClientRect();
        if (e.clientX < left || e.clientX > right || e.clientY < top || e.clientY > bottom) setOpen(false);
      }}
    >
      <div className="command-search">
          <MagnifyingGlass aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            aria-label="Tìm trang hoặc thao tác"
            placeholder="Tìm trang hoặc thao tác…"
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded="true"
            aria-controls="command-results"
            aria-activedescendant={results[active] ? `command-item-${active}` : undefined}
          />
          <button className="command-close" type="button" onClick={() => setOpen(false)} aria-label="Đóng tìm nhanh"><X aria-hidden="true" /></button>
        </div>
        <ul id="command-results" className="command-results" role="listbox" ref={listRef}>
          {results.length === 0 && <li className="command-empty">Không có kết quả cho “{query}”.</li>}
          {results.map((item, index) => {
            const section = item.kind === 'action' ? 'Thao tác nhanh' : 'Trang';
            const header = section !== lastSection ? <li key={`section-${section}`} className="command-section" role="presentation">{section}</li> : null;
            lastSection = section;
            const Icon = item.icon;
            return [
              header,
              <li
                key={`${item.kind}-${item.to}-${item.label}`}
                id={`command-item-${index}`}
                role="option"
                aria-selected={index === active}
                data-active={index === active}
                className="command-item"
                onMouseMove={() => setActive(index)}
                onClick={() => go(item)}
              >
                <span className="command-icon">{Icon && <Icon />}</span>
                <span className="command-label">{item.label}<small>{item.kind === 'action' ? item.hint : item.group}</small></span>
                <ArrowElbowDownLeft className="command-enter" />
              </li>
            ];
          })}
        </ul>
        <footer className="command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> di chuyển</span><span><kbd>Enter</kbd> mở</span><span><kbd>Ctrl</kbd><kbd>K</kbd> bật/tắt</span></footer>
    </dialog>,
    document.body
  );
}

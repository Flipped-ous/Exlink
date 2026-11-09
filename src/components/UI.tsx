import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

export function IconButton({ label, children, onClick, selected = false }: { label: string; children: ReactNode; onClick: () => void; selected?: boolean }) {
  return <button className={`icon-button${selected ? ' selected' : ''}`} aria-label={label} title={label} onClick={onClick}>{children}</button>;
}
export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <input className="switch" type="checkbox" role="switch" aria-label={label} checked={checked} onChange={e => onChange(e.target.checked)}/>;
}
export function SettingRow({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="setting-row"><div><strong>{title}</strong><p>{description}</p></div><div className="setting-control">{children}</div></div>;
}
export function ConnectionPopover({ children, onClose, trigger }: { children: ReactNode; onClose: () => void; trigger: React.RefObject<HTMLButtonElement | null> }) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const opener = trigger.current;
    panel.current?.querySelector<HTMLElement>('select,button,input')?.focus();
    function pointer(e: PointerEvent) { if (!panel.current?.contains(e.target as Node) && !opener?.contains(e.target as Node)) close.current(); }
    function key(e: KeyboardEvent) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close.current(); } }
    document.addEventListener('pointerdown', pointer); document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('pointerdown', pointer); document.removeEventListener('keydown', key, true); if (document.contains(opener)) opener?.focus(); };
  }, [trigger]);
  return createPortal(<div className="connection-popover glass" id="connection-popover" role="dialog" aria-label="连接与协议" ref={panel}><header><div><strong>连接与协议</strong><p>当前会话的通信配置</p></div><IconButton label="关闭连接配置" onClick={onClose}><X size={17}/></IconButton></header>{children}</div>, document.body);
}

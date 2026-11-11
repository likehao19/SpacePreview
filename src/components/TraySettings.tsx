import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Eye } from 'lucide-react';
import { desktop } from '../lib/bridge';

export default function TraySettings({
  macos,
  onError,
}: {
  macos: boolean;
  onError: (message: string) => void;
}) {
  const [visible, setVisible] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(false);
  const label = macos ? '显示菜单栏图标' : '显示托盘图标';
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    if (desktop)
      void invoke<boolean>('tray_visible')
        .then((value) => {
          if (!cancelled) setVisible(value);
        })
        .catch((error) => {
          if (!cancelled) onError(`读取图标显示设置失败：${String(error)}`);
        });
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, [onError]);
  const toggle = async () => {
    if (visible === null || busy) return;
    setBusy(true);
    try {
      const value = await invoke<boolean>('set_tray_visible', { visible: !visible });
      if (mounted.current) setVisible(value);
    } catch (error) {
      if (mounted.current) onError(`图标显示设置失败：${String(error)}`);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <div className="setting-row">
      <Eye className="setting-icon" size={22} strokeWidth={1.5} />
      <div>
        <strong>{label}</strong>
        <p>
          {!desktop
            ? '仅在桌面版中生效'
            : visible === null
              ? '正在读取图标显示设置；若读取失败，请重新打开设置'
              : '隐藏后仍在后台运行。重新打开瞬览，可回到此处恢复显示。'}
        </p>
      </div>
      <button
        role="switch"
        aria-label={label}
        aria-checked={visible === true}
        disabled={!desktop || visible === null || busy}
        className={`switch ${visible ? 'on' : ''}`}
        onClick={() => void toggle()}
      >
        <span />
      </button>
    </div>
  );
}

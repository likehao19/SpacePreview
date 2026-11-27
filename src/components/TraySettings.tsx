import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Eye, PanelBottom } from 'lucide-react';
import { desktop } from '../lib/bridge';

export default function TraySettings({
  macos,
  dock = false,
  onError,
}: {
  macos: boolean;
  dock?: boolean;
  onError: (message: string) => void;
}) {
  const [visible, setVisible] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(false);
  const label = dock ? '显示 Dock 图标' : macos ? '显示菜单栏图标' : '显示托盘图标';
  const command = dock ? 'dock_visible' : 'tray_visible';
  const Icon = dock ? PanelBottom : Eye;
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    if (desktop)
      void invoke<boolean>(command)
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
  }, [command, onError]);
  const toggle = async () => {
    if (visible === null || busy) return;
    setBusy(true);
    try {
      const value = await invoke<boolean>(`set_${command}`, { visible: !visible });
      if (mounted.current) setVisible(value);
    } catch (error) {
      if (mounted.current) onError(`图标显示设置失败：${String(error)}`);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <div className="setting-row">
      <Icon className="setting-icon" size={22} strokeWidth={1.5} />
      <div>
        <strong>{label}</strong>
        <p>
          {!desktop
            ? '仅在桌面版中生效'
            : visible === null
              ? '正在读取图标显示设置；若读取失败，请重新打开设置'
              : dock
                ? '隐藏后仍可用快捷键预览。可通过菜单栏或 Spotlight 重新打开瞬览。'
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

import keys from './shortcut-keys.json';

export type Shortcut = { code: string; ctrl: boolean; alt: boolean; meta: boolean };
export const defaultShortcut: Shortcut = { code: 'Space', ctrl: false, alt: false, meta: false };
const punctuation: Record<string, string> = {
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
};

export function shortcutEventCode(event: Pick<KeyboardEvent, 'code' | 'key'>): string {
  if (event.code && event.code !== 'Unidentified') return event.code;
  // Remote/injected Windows input can omit the physical code in WebView2.
  if (event.key === ' ') return 'Space';
  if (/^[a-z]$/i.test(event.key)) return `Key${event.key.toUpperCase()}`;
  if (/^[0-9]$/.test(event.key)) return `Digit${event.key}`;
  return Object.entries(punctuation).find(([, key]) => key === event.key)?.[0] ?? event.key;
}

export function validShortcut(value: unknown): value is Shortcut {
  if (!value || typeof value !== 'object') return false;
  const s = value as Shortcut;
  return (
    Object.hasOwn(keys, s.code) &&
    [s.ctrl, s.alt, s.meta].every((v) => typeof v === 'boolean') &&
    !(['KeyO', 'KeyC', 'KeyF', 'Equal', 'Minus'].includes(s.code) && (s.ctrl || s.meta) && !s.alt)
  );
}

export function shortcutFromEvent(
  event: Pick<
    KeyboardEvent,
    'code' | 'key' | 'ctrlKey' | 'altKey' | 'metaKey' | 'shiftKey' | 'isComposing'
  >,
): Shortcut | null {
  const s = {
    code: shortcutEventCode(event),
    ctrl: event.ctrlKey,
    alt: event.altKey,
    meta: event.metaKey,
  };
  return !event.shiftKey && !event.isComposing && validShortcut(s) ? s : null;
}

export function matchesShortcut(
  event: Pick<KeyboardEvent, 'code' | 'key' | 'ctrlKey' | 'altKey' | 'metaKey' | 'isComposing'>,
  shortcut: Shortcut,
): boolean {
  return (
    !event.isComposing &&
    shortcutEventCode(event) === shortcut.code &&
    event.ctrlKey === shortcut.ctrl &&
    event.altKey === shortcut.alt &&
    event.metaKey === shortcut.meta
  );
}

export function shortcutLabel(s: Shortcut, macos = false): string {
  const name = s.code.replace(/^(Key|Digit)/, '');
  return [
    s.ctrl && 'Ctrl',
    s.alt && (macos ? 'Option' : 'Alt'),
    s.meta && (macos ? '⌘' : 'Win'),
    punctuation[name] ?? name,
  ]
    .filter(Boolean)
    .join(' + ');
}

// Sandboxed document frames cannot bubble keyboard events into the app window.
// Let the app decide which keys it handles so custom shortcuts and modifiers work too.
export function forwardPreviewKey(event: KeyboardEvent): void {
  const find = (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'f';
  if (
    !find &&
    (event.target as HTMLElement | null)?.closest('input,textarea,select,[contenteditable]')
  )
    return;
  if (
    ['ArrowUp', 'ArrowDown'].includes(event.key) &&
    (event.target as HTMLElement | null)?.closest('button,[role=tree],[role=slider]')
  )
    return;
  const forwarded = new KeyboardEvent(event.type, {
    key: event.key,
    code: event.code,
    repeat: event.repeat,
    shiftKey: event.shiftKey,
    ctrlKey: event.ctrlKey,
    altKey: event.altKey,
    metaKey: event.metaKey,
    isComposing: event.isComposing,
    cancelable: true,
  });
  if (!window.dispatchEvent(forwarded)) event.preventDefault();
}

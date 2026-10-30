import keys from './shortcut-keys.json';
import { matchesShortcut, shortcutEventCode, shortcutLabel, type Shortcut } from './shortcuts';

export const actionLabels = {
  copyPath: '复制文件路径',
  openDefault: '默认应用打开',
  previousFile: '上一文件',
  nextFile: '下一文件',
} as const;
export type PreviewAction = keyof typeof actionLabels;
export type ActionShortcut = Shortcut & { shift: boolean };
export type ActionShortcuts = Record<PreviewAction, ActionShortcut>;
export const previewActions = Object.keys(actionLabels) as PreviewAction[];
export function defaultActions(macos: boolean): ActionShortcuts {
  const plain = { ctrl: false, alt: false, meta: false, shift: false };
  return {
    copyPath: { ...plain, code: 'KeyC', ctrl: !macos, meta: macos, shift: true },
    openDefault: { ...plain, code: 'Enter' },
    previousFile: { ...plain, code: 'ArrowUp' },
    nextFile: { ...plain, code: 'ArrowDown' },
  };
}
export function validActionShortcut(value: unknown): value is ActionShortcut {
  if (!value || typeof value !== 'object') return false;
  const s = value as ActionShortcut;
  if (![s.ctrl, s.alt, s.meta, s.shift].every((v) => typeof v === 'boolean')) return false;
  if (!(Object.hasOwn(keys, s.code) || ['Enter', 'ArrowUp', 'ArrowDown'].includes(s.code)))
    return false;
  if (s.code === 'Space') return false;
  // Keep native app menus, editing, search and typography shortcuts available.
  if ((s.ctrl || s.meta) && !s.alt) {
    if (
      ['KeyO', 'KeyF', 'KeyQ', 'KeyW', 'KeyH', 'KeyM', 'Comma', 'Equal', 'Minus'].includes(s.code)
    )
      return false;
    if (!s.shift && ['KeyC', 'KeyV', 'KeyX', 'KeyA', 'KeyZ'].includes(s.code)) return false;
  }
  return true;
}
export function actionFromEvent(event: KeyboardEvent): ActionShortcut | null {
  const s = {
    code: shortcutEventCode(event),
    ctrl: event.ctrlKey,
    alt: event.altKey,
    meta: event.metaKey,
    shift: event.shiftKey,
  };
  return !event.isComposing && validActionShortcut(s) ? s : null;
}
export function matchesAction(event: KeyboardEvent, s: ActionShortcut): boolean {
  return matchesShortcut(event, s) && event.shiftKey === s.shift;
}
export function sameShortcut(a: Shortcut, b: Shortcut): boolean {
  return a.code === b.code && a.ctrl === b.ctrl && a.alt === b.alt && a.meta === b.meta;
}
export function actionConflict(
  s: ActionShortcut,
  action: PreviewAction,
  actions: ActionShortcuts,
  preview: Shortcut,
): boolean {
  return (
    sameShortcut(s, preview) ||
    previewActions.some(
      (other) =>
        other !== action && sameShortcut(s, actions[other]) && s.shift === actions[other].shift,
    )
  );
}
export function restoreActions(value: unknown, macos: boolean, preview: Shortcut): ActionShortcuts {
  const defaults = defaultActions(macos);
  if (!value || typeof value !== 'object') return defaults;
  const result = { ...defaults, ...value } as ActionShortcuts;
  if (
    previewActions.some((action) => !validActionShortcut(result[action])) ||
    previewActions.some((action) => actionConflict(result[action], action, result, preview))
  )
    return defaults;
  return Object.fromEntries(
    previewActions.map((action) => [action, result[action]]),
  ) as ActionShortcuts;
}
export function actionLabel(s: ActionShortcut, macos: boolean): string {
  const label = shortcutLabel(s, macos).replace('ArrowUp', '↑').replace('ArrowDown', '↓');
  return `${s.shift ? 'Shift + ' : ''}${label}`;
}

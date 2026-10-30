import { describe, expect, it } from 'vitest';
import {
  actionConflict,
  actionFromEvent,
  defaultActions,
  matchesAction,
  restoreActions,
  validActionShortcut,
} from './action-shortcuts';
import { defaultShortcut } from './shortcuts';
const event = (code: string, mods: Partial<KeyboardEvent> = {}) =>
  ({
    code,
    key: code,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    shiftKey: false,
    isComposing: false,
    ...mods,
  }) as KeyboardEvent;
describe('preview action shortcuts', () => {
  it('keeps platform defaults and distinguishes copy from copy path', () => {
    for (const mac of [false, true]) {
      const actions = defaultActions(mac);
      const modifiers = mac ? { metaKey: true } : { ctrlKey: true };
      expect(matchesAction(event('KeyC', modifiers), actions.copyPath)).toBe(false);
      expect(matchesAction(event('KeyC', { ...modifiers, shiftKey: true }), actions.copyPath)).toBe(
        true,
      );
      expect(matchesAction(event('ArrowDown'), actions.nextFile)).toBe(true);
      expect(matchesAction(event('ArrowDown', { shiftKey: true }), actions.nextFile)).toBe(false);
    }
  });
  it('records simple combinations and remote WebView2 keys but rejects editing/menu keys', () => {
    expect(actionFromEvent(event('KeyP', { altKey: true }))).toMatchObject({
      code: 'KeyP',
      alt: true,
    });
    expect(actionFromEvent(event('Unidentified', { key: 'p', ctrlKey: true }))).toMatchObject({
      code: 'KeyP',
      ctrl: true,
    });
    for (const code of ['Space', 'Escape', 'Tab']) expect(actionFromEvent(event(code))).toBeNull();
    for (const code of ['KeyC', 'KeyV', 'KeyF', 'KeyO', 'Equal', 'Minus', 'Comma'])
      expect(actionFromEvent(event(code, { metaKey: true }))).toBeNull();
    expect(actionFromEvent(event('KeyP', { isComposing: true }))).toBeNull();
  });
  it('rejects duplicate actions and the global preview key including its Shift variant', () => {
    const actions = defaultActions(true);
    expect(actionConflict(actions.nextFile, 'copyPath', actions, defaultShortcut)).toBe(true);
    expect(
      actionConflict({ ...actions.copyPath, code: 'KeyP', shift: true }, 'copyPath', actions, {
        code: 'KeyP',
        ctrl: false,
        alt: false,
        meta: true,
      }),
    ).toBe(true);
  });
  it('restores old settings safely, validates saved keys, and preserves valid customization', () => {
    const defaults = defaultActions(false);
    expect(restoreActions(undefined, false, defaultShortcut)).toEqual(defaults);
    expect(restoreActions({ copyPath: null }, false, defaultShortcut)).toEqual(defaults);
    expect(restoreActions({ nextFile: null }, false, defaultShortcut)).toEqual(defaults);
    expect(restoreActions({ copyPath: defaults.nextFile }, false, defaultShortcut)).toEqual(
      defaults,
    );
    expect(validActionShortcut({ ...defaults.copyPath, shift: 'true' })).toBe(false);
    const custom = { ...defaults.copyPath, code: 'KeyP', shift: false };
    expect(restoreActions({ copyPath: custom }, false, defaultShortcut).copyPath).toEqual(custom);
  });
});

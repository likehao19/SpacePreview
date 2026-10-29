import { describe, expect, it } from 'vitest';
import { detectKind } from './files';
import { expandDeltas, parseBox, resolvePath, sealPicture, svgPath } from './ofd';

describe('OFD page description helpers', () => {
  it('routes .ofd files to the OFD reader', () => {
    expect(detectKind('发票.OFD')).toBe('ofd');
  });
  it('converts abbreviated path operators to SVG commands', () => {
    expect(svgPath('S 0 0 L 10 0 B 1 2 3 4 5 6 Q 1 1 2 2 A 1 1 0 0 1 3 3 C')).toBe(
      'M 0 0 L 10 0 C 1 2 3 4 5 6 Q 1 1 2 2 A 1 1 0 0 1 3 3 Z',
    );
  });
  it('expands repeated glyph advances within the character limit', () => {
    expect(expandDeltas('g 3 2.5 1 g 2 4', 10)).toEqual([2.5, 2.5, 2.5, 1, 4, 4]);
    expect(expandDeltas('g 100000 1', 3)).toEqual([1, 1, 1]);
  });
  it('resolves package-relative and root paths', () => {
    expect(resolvePath('Doc_0', 'Pages/Page_0/Content.xml')).toBe('Doc_0/Pages/Page_0/Content.xml');
    expect(resolvePath('Doc_0/Pages', '/Doc_0/Res/a.png')).toBe('Doc_0/Res/a.png');
    expect(resolvePath('Doc_0/Signs/Sign_0', '..\\..\\Res\\seal.png')).toBe('Doc_0/Res/seal.png');
  });
  it('parses physical boxes and rejects empty areas', () => {
    expect(parseBox('0 0 210 297')).toEqual([0, 0, 210, 297]);
    expect(parseBox('0 0 0 297')).toBeUndefined();
  });
  it('finds the seal picture inside an SES signature value', () => {
    const png = [0x89, 0x50, 0x4e, 0x47, 1, 2, 0x49, 0x45, 0x4e, 0x44, 9, 9, 9, 9];
    const value = new Uint8Array([0x30, 0x82, 0, 0, ...png, 0x30, 0]);
    expect(sealPicture(value)).toEqual({ kind: 'image', bytes: new Uint8Array(png) });
  });
});

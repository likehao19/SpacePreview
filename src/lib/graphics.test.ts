import { describe, expect, it } from 'vitest';
import * as UTIF from 'utif';
import { readDxf } from './cad';
import { readModel } from './model';
import { readTiff } from './tiff';
import { decodeHtml } from './html';
import { sourceLanguage } from './source-languages';
import { detectKind } from './files';
import hljs from './highlighter';
const bytes = (text: string) => new TextEncoder().encode(text);
const dxf = (entities: string, blocks = '') =>
  bytes(`${blocks}0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`);
describe('graphics and code formats', () => {
  it('routes engineering, images, build files and language aliases', () => {
    for (const file of [
      'index.astro',
      'build.psm1',
      'main.fsx',
      'shader.frag',
      'chip.sv',
      'app.axaml',
      'Dockerfile.dev',
      '.env.local',
      'build.cmd',
    ])
      expect(detectKind(file)).toBe('text');
    expect(detectKind('plan.DXF')).toBe('dxf');
    expect(detectKind('mesh.STL')).toBe('model');
    expect(detectKind('scan.TIF')).toBe('tiff');
    expect(sourceLanguage('CMakeLists.txt')).toBe('cmake');
    expect(sourceLanguage('.env.local')).toBe('ini');
    expect(sourceLanguage('script.psm1')).toBe('powershell');
    expect(
      hljs.highlight('FROM node:22', { language: sourceLanguage('Dockerfile.dev') }).value,
    ).toContain('hljs-keyword');
    expect(
      hljs.highlight('function Read-File { param($name) }', { language: 'powershell' }).value,
    ).toContain('hljs-keyword');
  });
  it('honors HTML declared legacy encodings and UTF16 BOM', () => {
    expect(
      decodeHtml(Uint8Array.from([0xef, 0xbb, 0xbf, ...bytes('<meta charset="gbk"><p>中文</p>')]))
        .text,
    ).toContain('中文');
    const prefix = bytes('<meta charset="windows-1252"><p>caf');
    expect(decodeHtml(Uint8Array.from([...prefix, 0xe9, ...bytes('</p>')])).text).toContain('café');
    expect(decodeHtml(bytes('<meta charset="unknown"><p>中文</p>')).text).toContain('中文');
    expect(decodeHtml(new Uint8Array([255, 254, 65, 0])).text).toBe('A');
  });
  it('renders DXF line, circle, bulge and text with layers', () => {
    const drawing = readDxf(
      dxf(
        '0\nLINE\n8\n边框\n10\n0\n20\n0\n11\n100\n21\n50\n0\nCIRCLE\n8\n孔位\n10\n20\n20\n20\n40\n5\n0\nLWPOLYLINE\n90\n2\n70\n0\n10\n0\n20\n0\n42\n1\n10\n10\n20\n0\n0\nTEXT\n10\n5\n20\n10\n40\n2\n1\n中文图纸\n',
      ),
    );
    expect(drawing.paths).toHaveLength(3);
    expect(drawing.paths[0].points).toEqual([
      [0, 0],
      [100, 50],
    ]);
    expect(drawing.paths[2].points.some((p) => p[1] < -4.9)).toBe(true);
    expect(drawing.labels[0].text).toBe('中文图纸');
    expect(drawing.layers).toContain('孔位');
  });
  it('applies DXF block origin, insertion, rotation and scale', () => {
    const blocks =
      '0\nSECTION\n2\nBLOCKS\n0\nBLOCK\n2\nB\n10\n1\n20\n0\n0\nLINE\n10\n1\n20\n0\n11\n2\n21\n0\n0\nENDBLK\n0\nENDSEC\n';
    const drawing = readDxf(dxf('0\nINSERT\n2\nB\n10\n10\n20\n20\n41\n2\n42\n2\n50\n90\n', blocks));
    expect(drawing.paths[0].points[0][0]).toBeCloseTo(10);
    expect(drawing.paths[0].points[1][1]).toBeCloseTo(22);
  });
  it('rejects binary, empty and invalid-coordinate DXF', () => {
    expect(() => readDxf(bytes('AutoCAD Binary DXF'))).toThrow('二进制');
    expect(() => readDxf(dxf(''))).toThrow('没有可预览');
    expect(() => readDxf(dxf('0\nLINE\n10\nNaN\n20\n0\n11\n1\n21\n1\n'))).toThrow();
  });
  it('reads binary STL even when header starts with solid and rejects truncation', () => {
    const data = new Uint8Array(134);
    data.set(bytes('solid binary'));
    const view = new DataView(data.buffer);
    view.setUint32(80, 1, true);
    [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((n, i) => view.setFloat32(96 + i * 4, n, true));
    expect([...readModel(data, 'part.stl')]).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    expect(() => readModel(data.slice(0, -1), 'part.stl')).toThrow();
  });
  it('reads ASCII STL and rejects non-finite vertices', () => {
    const mesh =
      'solid a\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid a';
    expect(readModel(bytes(mesh), 'part.stl')).toHaveLength(9);
    expect(() => readModel(bytes(mesh.replace('vertex 1', 'vertex NaN')), 'part.stl')).toThrow(
      '无效顶点',
    );
  });
  it('triangulates concave OBJ faces and supports negative indices', () => {
    const mesh = 'v 0 0 0\nv 2 0 0\nv 2 2 0\nv 1 1 0\nv 0 2 0\nf -5 -4 -3 -2 -1\n';
    const points = readModel(bytes(mesh), 'part.obj');
    expect(points).toHaveLength(27);
    let area = 0;
    for (let i = 0; i < points.length; i += 9)
      area +=
        Math.abs(
          (points[i + 3] - points[i]) * (points[i + 7] - points[i + 1]) -
            (points[i + 6] - points[i]) * (points[i + 4] - points[i + 1]),
        ) / 2;
    expect(area).toBeCloseTo(3);
    expect(() => readModel(bytes('v 0 0 0\nf 1 2 3'), 'part.obj')).toThrow('不存在');
  });
  it('decodes TIFF pixels and enforces pixel/page limits before decompression', () => {
    const rgba = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]);
    const encoded = new Uint8Array(UTIF.encodeImage(rgba, 2, 1));
    const image = readTiff(encoded);
    expect(image.width).toBe(2);
    expect([...image.pixels]).toEqual([...rgba]);
    expect(() => readTiff(encoded, 1)).toThrow('页码');
    const oversized = new Uint8Array(
      UTIF.encode([{ t256: [100000], t257: [100000] } as unknown as UTIF.IFD]),
    );
    expect(() => readTiff(oversized)).toThrow('像素');
  });
});
it('reads a large binary STL and rejects non-finite binary coordinates', () => {
  const count = 200000;
  const bytes = new Uint8Array(84 + count * 50);
  const view = new DataView(bytes.buffer);
  view.setUint32(80, count, true);
  for (let i = 0; i < count; i++) {
    const x = i % 500,
      y = Math.floor(i / 500);
    [x, y, 0, x + 1, y, 0, x, y + 1, 0].forEach((value, axis) =>
      view.setFloat32(84 + i * 50 + 12 + axis * 4, value, true),
    );
  }
  const positions = readModel(bytes, 'large.stl');
  expect(positions.length).toBe(count * 9);
  expect([...positions.slice(-9)]).toEqual([499, 399, 0, 500, 399, 0, 499, 400, 0]);
  view.setFloat32(96, Infinity, true);
  expect(() => readModel(bytes, 'invalid.stl')).toThrow('无效顶点');
});

it('routes native DWG drawings and templates to CAD preview', () => {
  for (const suffix of ['dwg', 'dwt', 'dws', 'dxf'])
    expect(detectKind(`drawing.${suffix}`)).toBe('dxf');
});

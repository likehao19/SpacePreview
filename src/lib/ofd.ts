import { ofdResources } from './ofd-resources';
import {
  inflateZipEntry,
  parseZipDirectory,
  readZipDirectory,
  readZipEntry,
  type RangeReader,
} from './zip-range';
import { parseInWorker } from './worker-client';
import type { ArchiveEntry } from './worker-types';

// OFD (GB/T 33190) is a ZIP of XML page descriptions in millimetres. Pages are converted to SVG
// only when they approach the viewport; resources are read once per opened document.
export type OfdBox = [number, number, number, number];
export interface OfdPage {
  id: string;
  path: string;
  // Default page area of the owning document; a page's own Area may still override it.
  box: OfdBox;
  document: number;
}
export interface OfdDocument {
  pages: OfdPage[];
  box: OfdBox;
  documents: number;
  renderPage(
    index: number,
    signal?: AbortSignal,
  ): Promise<{ svg: string; box: OfdBox; release: () => void }>;
  pageText(index: number): Promise<string>;
  close(): void;
}

interface Color {
  value: string;
  alpha?: number;
}
interface Paint {
  fill?: Color;
  stroke?: Color;
  lineWidth?: number;
  join?: string;
  cap?: string;
  dash?: string;
}
interface Font {
  family: string;
  file?: string;
  bold: boolean;
  italic: boolean;
}

const numbers = (value?: string | null) =>
  (value ?? '')
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number)
    .filter(Number.isFinite);
export function parseBox(value?: string | null): OfdBox | undefined {
  const n = numbers(value);
  return n.length >= 4 && n[2] > 0 && n[3] > 0 ? [n[0], n[1], n[2], n[3]] : undefined;
}
// DeltaX/DeltaY allow "g <count> <step>" runs for repeated advances.
export function expandDeltas(value: string | null | undefined, limit: number): number[] {
  const tokens = (value ?? '')
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  const out: number[] = [];
  for (let i = 0; i < tokens.length && out.length < limit; i++) {
    if (tokens[i] === 'g') {
      const count = Math.min(Number(tokens[i + 1]) || 0, limit - out.length);
      const step = Number(tokens[i + 2]);
      if (Number.isFinite(step)) for (let k = 0; k < count; k++) out.push(step);
      i += 2;
    } else if (Number.isFinite(Number(tokens[i]))) out.push(Number(tokens[i]));
  }
  return out;
}
// OFD path operators: S/M move, L line, Q quadratic, B cubic, A arc, C close.
const pathOps: Record<string, string> = { S: 'M', M: 'M', L: 'L', Q: 'Q', B: 'C', A: 'A', C: 'Z' };
export function svgPath(data?: string | null) {
  return (data ?? '')
    .trim()
    .split(/[\s,]+/)
    .map((token) => pathOps[token] ?? (Number.isFinite(Number(token)) ? token : ''))
    .filter(Boolean)
    .join(' ');
}
export function resolvePath(base: string, target: string) {
  const path = target.trim().replace(/\\/g, '/');
  const out: string[] = [];
  for (const part of (path.startsWith('/') ? path : `${base}/${path}`).split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}
const dirname = (path: string) => path.slice(0, Math.max(0, path.lastIndexOf('/')));
export function parseColor(element?: Element | null): Color | undefined {
  if (!element) return;
  const raw = element.getAttribute('Value');
  if (!raw) {
    // Shadings fall back to their first segment colour; plain empty colours are black.
    const segment = Array.from(element.getElementsByTagNameNS('*', 'Color')).find((c) =>
      c.getAttribute('Value'),
    );
    return segment ? parseColor(segment) : { value: '#000' };
  }
  const parts = raw
    .trim()
    .split(/\s+/)
    .map((p) => (p.startsWith('#') ? parseInt(p.slice(1), 16) : Number(p)));
  if (!parts.length || parts.some((n) => !Number.isFinite(n))) return;
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  let rgb: number[];
  if (parts.length >= 4) {
    const [c, m, y, k] = parts.map((n) => n / 255);
    rgb = [(1 - c) * (1 - k) * 255, (1 - m) * (1 - k) * 255, (1 - y) * (1 - k) * 255];
  } else if (parts.length === 3) rgb = parts;
  else rgb = [parts[0], parts[0], parts[0]];
  const alpha = element.getAttribute('Alpha');
  return {
    value: `rgb(${rgb.map(clamp).join(',')})`,
    alpha: alpha === null ? undefined : clamp(Number(alpha)) / 255,
  };
}
const escape = (text: string) =>
  text.replace(
    /[&<>"\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? '',
  );
const child = (element: Element | null | undefined, name: string) =>
  element ? Array.from(element.children).find((c) => c.localName === name) : undefined;
const children = (element: Element | null | undefined, name: string) =>
  element ? Array.from(element.children).filter((c) => c.localName === name) : [];
const all = (element: Element | Document, name: string) =>
  Array.from(element.getElementsByTagNameNS('*', name));
const text = (element?: Element | null) => element?.textContent?.trim() ?? '';
function fontFallback(name: string) {
  if (/仿宋|fangsong/i.test(name)) return "FangSong, STFangsong, 'FangSong_GB2312', serif";
  if (/楷|kai/i.test(name)) return "KaiTi, STKaiti, 'Kaiti SC', 'KaiTi_GB2312', serif";
  if (/黑|hei|yahei|雅黑/i.test(name))
    return "SimHei, 'Microsoft YaHei', 'Heiti SC', 'PingFang SC', sans-serif";
  if (/courier|mono/i.test(name)) return "'Courier New', Courier, monospace";
  if (/arial|helvetica|sans/i.test(name)) return 'Arial, Helvetica, sans-serif';
  if (/times/i.test(name)) return "'Times New Roman', Times, serif";
  return "SimSun, 'Songti SC', STSong, serif";
}
function imageMime(bytes: Uint8Array) {
  const hex = Array.from(bytes.subarray(0, 4), (b) => b.toString(16).padStart(2, '0')).join('');
  if (hex.startsWith('89504e47')) return 'image/png';
  if (hex.startsWith('ffd8ff')) return 'image/jpeg';
  if (hex.startsWith('47494638')) return 'image/gif';
  if (hex.startsWith('424d')) return 'image/bmp';
  if (hex === '52494646') return 'image/webp';
}
function indexOf(bytes: Uint8Array, pattern: number[], from = 0) {
  outer: for (let i = from; i <= bytes.length - pattern.length; i++) {
    for (let k = 0; k < pattern.length; k++) if (bytes[i + k] !== pattern[k]) continue outer;
    return i;
  }
  return -1;
}
function lastIndexOf(bytes: Uint8Array, pattern: number[]) {
  outer: for (let i = bytes.length - pattern.length; i >= 0; i--) {
    for (let k = 0; k < pattern.length; k++) if (bytes[i + k] !== pattern[k]) continue outer;
    return i;
  }
  return -1;
}
// Seal values are DER-encoded SES structures; the visible stamp is an embedded OFD, PNG or JPEG.
export function sealPicture(
  bytes: Uint8Array,
): { kind: 'ofd' | 'image'; bytes: Uint8Array } | undefined {
  const zip = indexOf(bytes, [0x50, 0x4b, 3, 4]);
  const end = lastIndexOf(bytes, [0x50, 0x4b, 5, 6]);
  if (zip >= 0 && end > zip && end + 22 <= bytes.length) {
    const comment = bytes[end + 20] | (bytes[end + 21] << 8);
    return { kind: 'ofd', bytes: bytes.slice(zip, Math.min(bytes.length, end + 22 + comment)) };
  }
  const png = indexOf(bytes, [0x89, 0x50, 0x4e, 0x47]);
  if (png >= 0) {
    const iend = indexOf(bytes, [0x49, 0x45, 0x4e, 0x44], png);
    if (iend > png) return { kind: 'image', bytes: bytes.slice(png, iend + 8) };
  }
  const jpeg = indexOf(bytes, [0xff, 0xd8, 0xff]);
  if (jpeg >= 0) {
    const eoi = lastIndexOf(bytes, [0xff, 0xd9]);
    if (eoi > jpeg) return { kind: 'image', bytes: bytes.slice(jpeg, eoi + 2) };
  }
}

const OBJECT_LIMIT = 200_000;
let sessions = 0;

export async function openOfd({
  size,
  read,
  signal,
  worker = false,
}: {
  size: number;
  read: RangeReader;
  signal: AbortSignal;
  worker?: boolean;
}): Promise<OfdDocument> {
  // Font family names are per session so nested seals and other previews never share faces.
  const tag = `ofd-${++sessions}`;
  let closed = false;
  const directory = await readZipDirectory(size, read);
  const entries = new Map<string, ArchiveEntry>();
  for (const entry of parseZipDirectory(directory.bytes, directory.count))
    if (!entry.directory) entries.set(resolvePath('', entry.name).toLowerCase(), entry);
  const lookup = (path: string) => entries.get(path.toLowerCase());
  const bytes = async (path: string) => {
    signal.throwIfAborted();
    const entry = lookup(path);
    if (!entry) throw new Error(`OFD 缺少 ${path}`);
    const raw = await readZipEntry(entry, size, read);
    signal.throwIfAborted();
    // Large fonts and images inflate off the UI thread; XML parts stay inline to avoid worker startup.
    if (worker && entry.method === 8 && entry.size > 1024 * 1024)
      return (await parseInWorker({ kind: 'archive-data', name: path, bytes: raw, entry }, signal))
        .data as Uint8Array;
    return inflateZipEntry(raw, entry);
  };
  const xml = async (path: string) => {
    const data = await bytes(path);
    const head = new TextDecoder('latin1').decode(data.subarray(0, 120));
    const encoding = /encoding=["']([\w-]+)["']/i.exec(head)?.[1]?.toLowerCase();
    const source = new TextDecoder(
      encoding && /gb|2312|gbk/.test(encoding) ? 'gb18030' : 'utf-8',
    ).decode(data);
    const parsed = new DOMParser().parseFromString(source, 'application/xml');
    if (parsed.getElementsByTagName('parsererror').length)
      throw new Error(`${path} 不是有效的 XML。`);
    return parsed.documentElement;
  };
  const cleanups = new Set<() => void>();
  const blobUrl = (data: Uint8Array) => {
    const mime = imageMime(data);
    if (!mime || closed) return;
    const url = URL.createObjectURL(new Blob([data as Uint8Array<ArrayBuffer>], { type: mime }));
    return url;
  };

  // Each DocBody is an independent document with its own resources, templates and seals.
  const openBody = async (body: Element, docIndex: number) => {
    const docPath = resolvePath('', text(child(body, 'DocRoot')));
    if (!docPath) throw new Error('OFD.xml 未声明文档入口。');
    const doc = await xml(docPath);
    const docDir = dirname(docPath);
    // BaseLoc values are usually relative to Document.xml, but some writers emit package-root paths.
    const locate = (base: string, target: string) => {
      const path = resolvePath(base, target);
      if (lookup(path) || !target) return path;
      const fromRoot = resolvePath('', target);
      return lookup(fromRoot) ? fromRoot : path;
    };
    const common = child(doc, 'CommonData');
    const box = parseBox(text(child(child(common, 'PageArea'), 'PhysicalBox'))) ?? [0, 0, 210, 297];
    const templates = new Map<string, string>();
    for (const template of children(common, 'TemplatePage'))
      templates.set(
        template.getAttribute('ID') ?? '',
        locate(docDir, template.getAttribute('BaseLoc') ?? ''),
      );
    const pages: OfdPage[] = children(child(doc, 'Pages'), 'Page').map((page) => ({
      id: page.getAttribute('ID') ?? '',
      path: locate(docDir, page.getAttribute('BaseLoc') ?? ''),
      box,
      document: docIndex,
    }));
    if (!pages.length) throw new Error('文档没有页面。');

    const fonts = new Map<string, Font>();
    const media = new Map<string, string>();
    const params = new Map<string, Element>();
    const composites = new Map<string, Element>();
    const loadedRes = new Map<string, Promise<void>>();
    const loadRes = (path: string) => {
      let pending = loadedRes.get(path);
      if (!pending) {
        pending = xml(path)
          .then((res) => {
            const base = resolvePath(dirname(path), res.getAttribute('BaseLoc') ?? '');
            for (const font of all(res, 'Font')) {
              const id = font.getAttribute('ID') ?? '';
              const name = font.getAttribute('FontName') ?? font.getAttribute('FamilyName') ?? '';
              const file = text(child(font, 'FontFile'));
              fonts.set(id, {
                family: `'${tag}-${docIndex}-${id.replace(/\W/g, '')}', '${name.replace(/['"\\;<>&]/g, '')}', ${fontFallback(name)}`,
                file: file ? locate(base, file) : undefined,
                bold: font.getAttribute('Bold') === 'true',
                italic: font.getAttribute('Italic') === 'true',
              });
            }
            for (const item of all(res, 'MultiMedia')) {
              const file = text(child(item, 'MediaFile'));
              if (file) media.set(item.getAttribute('ID') ?? '', locate(base, file));
            }
            for (const param of all(res, 'DrawParam'))
              params.set(param.getAttribute('ID') ?? '', param);
            for (const unit of all(res, 'CompositeGraphicUnit'))
              composites.set(unit.getAttribute('ID') ?? '', unit);
          })
          .catch(() => {});
        loadedRes.set(path, pending);
      }
      return pending;
    };
    await Promise.all(
      [...children(common, 'PublicRes'), ...children(common, 'DocumentRes')].map((res) =>
        loadRes(locate(docDir, text(res))),
      ),
    );

    const fontLoads = ofdResources(
      async (id) => {
        const font = fonts.get(id);
        if (!font?.file || typeof FontFace === 'undefined') return;
        try {
          const data = await bytes(font.file);
          const face = new FontFace(
            `${tag}-${docIndex}-${id.replace(/\W/g, '')}`,
            data.slice().buffer,
          );
          await face.load();
          if (closed) return;
          document.fonts.add(face);
          return face;
        } catch {
          /* Unsupported subsets use the system fallback. */
        }
      },
      (face) => {
        if (face) document.fonts.delete(face);
      },
    );
    const images = ofdResources(
      async (id) => {
        const path = media.get(id);
        if (!path) return;
        try {
          return blobUrl(await bytes(path));
        } catch {
          return;
        }
      },
      (url) => {
        if (url) URL.revokeObjectURL(url);
      },
    );
    cleanups.add(fontLoads.clear);
    cleanups.add(images.clear);
    const xmlCache = new Map<string, Promise<Element | undefined>>();
    const cachedXml = (path: string) => {
      let pending = xmlCache.get(path);
      if (!pending) {
        pending = xml(path).catch(() => undefined);
        xmlCache.set(path, pending);
      }
      return pending;
    };

    // Annotations and seals are indexed by page ID on first use.
    let annotations: Promise<Map<string, string[]>> | undefined;
    const pageAnnotations = () =>
      (annotations ??= (async () => {
        const map = new Map<string, string[]>();
        const loc = text(child(doc, 'Annotations'));
        if (!loc) return map;
        const path = locate(docDir, loc);
        const list = await cachedXml(path);
        for (const page of children(list, 'Page')) {
          const id = page.getAttribute('PageID') ?? '';
          const file = text(child(page, 'FileLoc'));
          if (file) map.set(id, [...(map.get(id) ?? []), locate(dirname(path), file)]);
        }
        return map;
      })());
    interface Stamp {
      page: string;
      box: OfdBox;
      value: string;
    }
    let stamps: Promise<Stamp[]> | undefined;
    const pageStamps = () =>
      (stamps ??= (async () => {
        const found: Stamp[] = [];
        const loc = text(child(body, 'Signatures'));
        if (!loc) return found;
        const path = locate('', loc);
        const list = await cachedXml(path);
        for (const signature of children(list, 'Signature')) {
          const signPath = locate(dirname(path), signature.getAttribute('BaseLoc') ?? '');
          const sign = await cachedXml(signPath);
          const value = text(child(sign, 'SignedValue'));
          if (!sign || !value) continue;
          for (const annot of all(sign, 'StampAnnot')) {
            const area = parseBox(annot.getAttribute('Boundary'));
            if (area)
              found.push({
                page: annot.getAttribute('PageRef') ?? '',
                box: area,
                value: locate(dirname(signPath), value),
              });
          }
        }
        return found;
      })().catch(() => []));
    const sealCache = ofdResources(
      async (path) => {
        let seal: OfdDocument | undefined;
        try {
          const picture = sealPicture(await bytes(path));
          if (!picture) return;
          if (picture.kind === 'image') {
            const url = blobUrl(picture.bytes);
            return url
              ? {
                  svg: `<image href="${url}" preserveAspectRatio="none" />`,
                  release: () => URL.revokeObjectURL(url),
                }
              : undefined;
          }
          const inner = picture.bytes;
          seal = await openOfd({
            size: inner.length,
            read: async (offset, length) => inner.subarray(offset, offset + length),
            signal,
          });
          if (closed) {
            seal.close();
            return;
          }
          const page = await seal.renderPage(0);
          const opened = seal;
          return {
            svg: page.svg,
            release: () => {
              page.release();
              opened.close();
            },
          };
        } catch {
          seal?.close();
          return;
        }
      },
      (seal) => seal?.release(),
    );
    cleanups.add(sealCache.clear);

    const paramOf = (id: string | null, inherited: Paint, depth = 0): Paint => {
      const param = id ? params.get(id) : undefined;
      if (!param || depth > 8) return inherited;
      const base = paramOf(param.getAttribute('Relative'), inherited, depth + 1);
      const width = Number(param.getAttribute('LineWidth'));
      return {
        fill: parseColor(child(param, 'FillColor')) ?? base.fill,
        stroke: parseColor(child(param, 'StrokeColor')) ?? base.stroke,
        lineWidth:
          Number.isFinite(width) && param.hasAttribute('LineWidth') ? width : base.lineWidth,
        join: param.getAttribute('Join') ?? base.join,
        cap: param.getAttribute('Cap') ?? base.cap,
        dash: param.getAttribute('DashPattern') ?? base.dash,
      };
    };
    const frame = (element: Element, fallbackScale = false) => {
      const area = numbers(element.getAttribute('Boundary'));
      const ctm = numbers(element.getAttribute('CTM'));
      let transform = area.length >= 2 ? `translate(${area[0]} ${area[1]})` : '';
      if (ctm.length === 6) transform += ` matrix(${ctm.join(' ')})`;
      else if (fallbackScale && area.length >= 4) transform += ` scale(${area[2]} ${area[3]})`;
      const alpha = element.getAttribute('Alpha');
      return (
        (transform ? ` transform="${transform}"` : '') +
        (alpha === null ? '' : ` opacity="${Math.max(0, Math.min(255, Number(alpha) || 0)) / 255}"`)
      );
    };
    const paint = (kind: 'fill' | 'stroke', color: Color | undefined) =>
      color
        ? ` ${kind}="${color.value}"${color.alpha === undefined ? '' : ` ${kind}-opacity="${color.alpha}"`}`
        : ` ${kind}="none"`;

    const render = (
      parent: Element,
      inherited: Paint,
      out: string[],
      budget: { left: number },
      resolvedImages: Map<string, string>,
      depth = 0,
    ) => {
      if (depth > 32) return;
      for (const element of Array.from(parent.children)) {
        if (budget.left-- <= 0) return;
        if (element.getAttribute('Visible') === 'false') continue;
        const local = paramOf(element.getAttribute('DrawParam'), inherited);
        switch (element.localName) {
          case 'Layer':
          case 'PageBlock':
            render(element, local, out, budget, resolvedImages, depth + 1);
            break;
          case 'TextObject': {
            const font = fonts.get(element.getAttribute('Font') ?? '');
            const fontSize = Number(element.getAttribute('Size')) || 3.5;
            const fill =
              element.getAttribute('Fill') === 'false'
                ? undefined
                : (parseColor(child(element, 'FillColor')) ?? local.fill ?? { value: '#000' });
            const stroke =
              element.getAttribute('Stroke') === 'true'
                ? (parseColor(child(element, 'StrokeColor')) ?? local.stroke ?? { value: '#000' })
                : undefined;
            const weight = Number(element.getAttribute('Weight')) || (font?.bold ? 700 : 0);
            out.push(
              `<g${frame(element)} font-size="${fontSize}" font-family="${escape(font?.family ?? fontFallback(''))}"${weight ? ` font-weight="${weight}"` : ''}${element.getAttribute('Italic') === 'true' || font?.italic ? ' font-style="italic"' : ''}${paint('fill', fill)}${stroke ? `${paint('stroke', stroke)} stroke-width="${local.lineWidth ?? 0.353}"` : ''}>`,
            );
            let x = 0,
              y = 0;
            for (const code of children(element, 'TextCode')) {
              const content = code.textContent ?? '';
              const chars = Array.from(content);
              if (!chars.length) continue;
              if (code.hasAttribute('X')) x = Number(code.getAttribute('X')) || 0;
              if (code.hasAttribute('Y')) y = Number(code.getAttribute('Y')) || 0;
              const xs = [x],
                ys = [y];
              for (const dx of expandDeltas(code.getAttribute('DeltaX'), chars.length - 1))
                xs.push(xs[xs.length - 1] + dx);
              for (const dy of expandDeltas(code.getAttribute('DeltaY'), chars.length - 1))
                ys.push(ys[ys.length - 1] + dy);
              const round = (n: number) => Math.round(n * 1000) / 1000;
              // Glyph positions are per character, so whitespace must never collapse.
              out.push(
                `<text xml:space="preserve" x="${xs.map(round).join(' ')}" y="${ys.map(round).join(' ')}">${escape(content)}</text>`,
              );
              x = xs[xs.length - 1];
              y = ys[ys.length - 1];
            }
            out.push('</g>');
            break;
          }
          case 'PathObject': {
            const d = svgPath(text(child(element, 'AbbreviatedData')));
            if (!d) break;
            const stroke =
              element.getAttribute('Stroke') === 'false'
                ? undefined
                : (parseColor(child(element, 'StrokeColor')) ?? local.stroke ?? { value: '#000' });
            const fill =
              // Paths without a fill colour stay transparent even when Fill="true" (e.g. invoice ⊗ marks).
              element.getAttribute('Fill') === 'true'
                ? (parseColor(child(element, 'FillColor')) ?? local.fill)
                : undefined;
            const width = element.hasAttribute('LineWidth')
              ? Number(element.getAttribute('LineWidth'))
              : (local.lineWidth ?? 0.353);
            const cap = element.getAttribute('Cap') ?? local.cap;
            const join = element.getAttribute('Join') ?? local.join;
            const dash = numbers(element.getAttribute('DashPattern') ?? local.dash);
            out.push(
              `<path${frame(element)} d="${d}"${paint('fill', fill)}${paint('stroke', stroke)}${
                stroke ? ` stroke-width="${width > 0 ? width : 0.1}"` : ''
              }${element.getAttribute('Rule') === 'Even-Odd' ? ' fill-rule="evenodd"' : ''}${
                cap ? ` stroke-linecap="${cap.toLowerCase().replace(/[^a-z]/g, '')}"` : ''
              }${join ? ` stroke-linejoin="${join.toLowerCase().replace(/[^a-z]/g, '')}"` : ''}${
                dash.length ? ` stroke-dasharray="${dash.join(' ')}"` : ''
              } />`,
            );
            break;
          }
          case 'ImageObject': {
            const url = resolvedImages.get(element.getAttribute('ResourceID') ?? '');
            if (url)
              out.push(
                `<image${frame(element, true)} href="${url}" width="1" height="1" preserveAspectRatio="none" />`,
              );
            break;
          }
          case 'CompositeObject': {
            const unit = composites.get(element.getAttribute('ResourceID') ?? '');
            const content = child(unit, 'Content');
            if (!content) break;
            out.push(`<g${frame(element)}>`);
            render(content, local, out, budget, resolvedImages, depth + 1);
            out.push('</g>');
            break;
          }
        }
      }
    };
    const loadPage = async (index: number) => {
      const page = pages[index];
      if (!page) throw new Error('页码超出范围。');
      const content = await xml(page.path);
      await Promise.all(
        children(content, 'PageRes').map((res) => loadRes(locate(dirname(page.path), text(res)))),
      );
      return content;
    };

    return {
      pages,
      box,
      async renderPage(index: number, pageSignal?: AbortSignal) {
        const releases: (() => void)[] = [];
        let released = false;
        const release = () => {
          if (released) return;
          released = true;
          pageSignal?.removeEventListener('abort', release);
          cleanups.delete(release);
          for (const drop of releases) drop();
          releases.length = 0;
        };
        const check = () => {
          signal.throwIfAborted();
          pageSignal?.throwIfAborted();
          if (closed || released) throw new DOMException('已取消', 'AbortError');
        };
        cleanups.add(release);
        pageSignal?.addEventListener('abort', release, { once: true });
        try {
          check();
          const content = await loadPage(index);
          check();
          const page = pages[index];
          const pageBox = parseBox(text(child(child(content, 'Area'), 'PhysicalBox'))) ?? box;
          const background: Element[] = [];
          const foreground: Element[] = [];
          for (const template of children(content, 'Template')) {
            const path = templates.get(template.getAttribute('TemplateID') ?? '');
            const parsed = path ? await cachedXml(path) : undefined;
            check();
            if (!parsed) continue;
            await Promise.all(
              children(parsed, 'PageRes').map((res) => loadRes(locate(dirname(path!), text(res)))),
            );
            (template.getAttribute('ZOrder') === 'Foreground' ? foreground : background).push(
              parsed,
            );
          }
          const annotationRoots: { element: Element; box: number[] }[] = [];
          for (const path of (await pageAnnotations()).get(page.id) ?? []) {
            const list = await cachedXml(path);
            check();
            for (const annot of children(list, 'Annot')) {
              if (annot.getAttribute('Visible') === 'false') continue;
              const appearance = child(annot, 'Appearance');
              if (appearance)
                annotationRoots.push({
                  element: appearance,
                  box: numbers(appearance.getAttribute('Boundary')),
                });
            }
          }
          const seals = (await pageStamps()).filter((stamp) => stamp.page === page.id);
          check();
          const sealMarkups = await Promise.all(
            seals.map((stamp) => {
              const held = sealCache.acquire(stamp.value);
              releases.push(held.release);
              return held.value.then((value) => value?.svg);
            }),
          );
          check();
          const resolvedImages = new Map<string, string>();
          const fontIds = new Set<string>(),
            imageIds = new Set<string>(),
            compositeIds = new Set<string>();
          let remaining = OBJECT_LIMIT;
          const collect = (element: Element, depth = 0) => {
            if (depth > 32 || remaining-- <= 0) return;
            if (element.getAttribute('Visible') === 'false') return;
            if (element.localName === 'TextObject') fontIds.add(element.getAttribute('Font') ?? '');
            if (element.localName === 'ImageObject')
              imageIds.add(element.getAttribute('ResourceID') ?? '');
            if (element.localName === 'CompositeObject') {
              const id = element.getAttribute('ResourceID') ?? '';
              const content = child(composites.get(id), 'Content');
              if (content && !compositeIds.has(id)) {
                compositeIds.add(id);
                collect(content, depth + 1);
              }
            }
            for (const child of Array.from(element.children)) collect(child, depth + 1);
          };
          const roots = [
            ...background,
            content,
            ...foreground,
            ...annotationRoots.map((a) => a.element),
          ];
          roots.forEach((root) => collect(root));
          const work: Promise<unknown>[] = [];
          for (const id of fontIds) {
            const held = fontLoads.acquire(id);
            releases.push(held.release);
            work.push(held.value);
          }
          for (const id of imageIds) {
            const held = images.acquire(id);
            releases.push(held.release);
            work.push(
              held.value.then((url) => {
                if (url) resolvedImages.set(id, url);
              }),
            );
          }
          await Promise.all(work);
          check();
          const out: string[] = [
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${pageBox.join(' ')}" width="100%" height="100%" preserveAspectRatio="none" style="white-space:pre">`,
          ];
          const budget = { left: OBJECT_LIMIT };
          for (const layer of [...background, content, ...foreground])
            render(child(layer, 'Content') ?? layer, {}, out, budget, resolvedImages);
          for (const annot of annotationRoots) {
            out.push(
              annot.box.length >= 2
                ? `<g transform="translate(${annot.box[0]} ${annot.box[1]})">`
                : '<g>',
            );
            render(annot.element, {}, out, budget, resolvedImages);
            out.push('</g>');
          }
          seals.forEach((stamp, i) => {
            const markup = sealMarkups[i];
            if (!markup) return;
            const [x, y, w, h] = stamp.box;
            // Nested seal SVGs carry their own viewBox; raster seals fill the stamp boundary.
            out.push(
              markup.startsWith('<svg')
                ? markup
                    .replace('<svg', `<svg x="${x}" y="${y}" width="${w}" height="${h}"`)
                    .replace(' width="100%" height="100%"', '')
                : markup.replace('<image', `<image x="${x}" y="${y}" width="${w}" height="${h}"`),
            );
          });
          out.push('</svg>');
          return { svg: out.join(''), box: pageBox, release };
        } catch (error) {
          release();
          throw error;
        }
      },
      async pageText(index: number) {
        const content = await loadPage(index);
        return all(content, 'TextCode')
          .map((code) => code.textContent ?? '')
          .join('');
      },
    };
  };

  const root = await xml('OFD.xml');
  const bodies = all(root, 'DocBody');
  if (!bodies.length) throw new Error('OFD.xml 未声明文档。');
  const opened = await Promise.allSettled(bodies.map(openBody));
  const documents = opened.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : [],
  );
  // A damaged document should not hide the readable ones next to it.
  if (!documents.length) throw (opened[0] as PromiseRejectedResult).reason;
  const pages = documents.flatMap((document) => document.pages);
  const owners = documents.flatMap((document) =>
    document.pages.map((_, local) => ({ document, local })),
  );
  const owner = (index: number) => {
    const found = owners[index];
    if (!found) throw new Error('页码超出范围。');
    return found;
  };
  return {
    pages,
    box: documents[0].box,
    documents: documents.length,
    renderPage(index, pageSignal) {
      const { document, local } = owner(index);
      return document.renderPage(local, pageSignal);
    },
    pageText(index) {
      const { document, local } = owner(index);
      return document.pageText(local);
    },
    close() {
      closed = true;
      for (const cleanup of cleanups) cleanup();
      cleanups.clear();
    },
  };
}

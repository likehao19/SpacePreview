import type { WorkbookCellStyle } from './worker-types';

const list = (value: any): any[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];
const enabled = (value: any) =>
  value !== undefined && !['0', 'false'].includes(String(value?.['@_val']));
const indexedColors = [
  '000000',
  'FFFFFF',
  'FF0000',
  '00FF00',
  '0000FF',
  'FFFF00',
  'FF00FF',
  '00FFFF',
  '000000',
  'FFFFFF',
  'FF0000',
  '00FF00',
  '0000FF',
  'FFFF00',
  'FF00FF',
  '00FFFF',
  '800000',
  '008000',
  '000080',
  '808000',
  '800080',
  '008080',
  'C0C0C0',
  '808080',
  '9999FF',
  '993366',
  'FFFFCC',
  'CCFFFF',
  '660066',
  'FF8080',
  '0066CC',
  'CCCCFF',
  '000080',
  'FF00FF',
  'FFFF00',
  '00FFFF',
  '800080',
  '800000',
  '008080',
  '0000FF',
  '00CCFF',
  'CCFFFF',
  'CCFFCC',
  'FFFF99',
  '99CCFF',
  'FF99CC',
  'CC99FF',
  'FFCC99',
  '3366FF',
  '33CCCC',
  '99CC00',
  'FFCC00',
  'FF9900',
  'FF6600',
  '666699',
  '969696',
  '003366',
  '339966',
  '003300',
  '333300',
  '993300',
  '993366',
  '333399',
  '333333',
];
const defaultTheme = [
  'FFFFFF',
  '000000',
  'EEECE1',
  '1F497D',
  '4F81BD',
  'C0504D',
  '9BBB59',
  '8064A2',
  '4BACC6',
  'F79646',
  '0000FF',
  '800080',
];

export function workbookStyles(root: any, theme: any): WorkbookCellStyle[] {
  const scheme = theme?.themeElements?.clrScheme;
  const themeColors = [
    'lt1',
    'dk1',
    'lt2',
    'dk2',
    'accent1',
    'accent2',
    'accent3',
    'accent4',
    'accent5',
    'accent6',
    'hlink',
    'folHlink',
  ].map((key, index) => {
    const entry = scheme?.[key];
    return entry?.srgbClr?.['@_val'] ?? entry?.sysClr?.['@_lastClr'] ?? defaultTheme[index];
  });
  const color = (node: any): string | undefined => {
    if (!node) return undefined;
    const rgb =
      node['@_rgb'] ??
      (node['@_theme'] !== undefined
        ? themeColors[Number(node['@_theme'])]
        : indexedColors[Number(node['@_indexed'])]);
    if (!/^(?:[a-f\d]{2})?[a-f\d]{6}$/i.test(String(rgb))) return undefined;
    const hex = String(rgb).slice(-6);
    const tint = Math.max(-1, Math.min(1, Number(node['@_tint']) || 0));
    const channels = hex.match(/../g)!.map((part) => parseInt(part, 16) / 255);
    const range = Math.max(...channels) - Math.min(...channels);
    const luminance = (Math.max(...channels) + Math.min(...channels)) / 2;
    // OOXML tint changes HSL luminance, rather than blending each RGB channel.
    const tinted = tint < 0 ? luminance * (1 + tint) : luminance + (1 - luminance) * tint;
    const saturation = range ? range / (1 - Math.abs(2 * luminance - 1)) : 0;
    const factor = range ? ((1 - Math.abs(2 * tinted - 1)) * saturation) / range : 0;
    return (
      '#' +
      channels
        .map((channel) => {
          return Math.round(Math.max(0, Math.min(1, tinted + (channel - luminance) * factor)) * 255)
            .toString(16)
            .padStart(2, '0');
        })
        .join('')
    );
  };
  const border = (side: any): string | undefined => {
    const type = side?.['@_style'];
    if (!type || type === 'none') return undefined;
    const width = type === 'thick' ? 3 : /medium|double/i.test(type) ? 2 : 1;
    const line =
      type === 'double'
        ? 'double'
        : /dash/i.test(type)
          ? 'dashed'
          : /dot|hair/i.test(type)
            ? 'dotted'
            : 'solid';
    return `${width}px ${line} ${color(side.color) ?? '#000000'}`;
  };
  const fonts = list(root?.fonts?.font);
  const fills = list(root?.fills?.fill);
  const borders = list(root?.borders?.border);
  const bases = list(root?.cellStyleXfs?.xf);
  const fontScheme = theme?.themeElements?.fontScheme;
  return list(root?.cellXfs?.xf).map((xf) => {
    const base = bases[Number(xf['@_xfId'] ?? 0)] ?? {};
    const format = { ...base, ...xf };
    const font = fonts[Number(format['@_fontId'] ?? 0)] ?? {};
    const scheme =
      font.scheme?.['@_val'] === 'major' ? fontScheme?.majorFont : fontScheme?.minorFont;
    const family = font.name?.['@_val'] ?? scheme?.latin?.['@_typeface'] ?? 'Calibri';
    const fill = fills[Number(format['@_fillId'] ?? 0)]?.patternFill;
    const edges = borders[Number(format['@_borderId'] ?? 0)] ?? {};
    const alignment = format.alignment ?? {};
    const horizontal = alignment['@_horizontal'];
    const vertical = alignment['@_vertical'];
    const decoration = [enabled(font.u) && 'underline', enabled(font.strike) && 'line-through']
      .filter(Boolean)
      .join(' ');
    return {
      fontFamily: `"${String(family).replace(/["\\\r\n]/g, '')}", "Microsoft YaHei", sans-serif`,
      fontSize: (Math.max(6, Math.min(200, Number(font.sz?.['@_val']) || 11)) * 4) / 3,
      fontWeight: enabled(font.b) ? 700 : 400,
      fontStyle: enabled(font.i) ? 'italic' : 'normal',
      textDecoration: decoration || 'none',
      color: color(font.color) ?? '#000000',
      backgroundColor:
        fill?.['@_patternType'] === 'solid' ? (color(fill.fgColor) ?? '#ffffff') : '#ffffff',
      textAlign: ['left', 'center', 'right', 'justify'].includes(horizontal)
        ? horizontal
        : undefined,
      verticalAlign: vertical === 'center' ? 'middle' : vertical === 'top' ? 'top' : 'bottom',
      whiteSpace:
        alignment['@_wrapText'] === '1' || alignment['@_wrapText'] === 'true' ? 'pre-wrap' : 'pre',
      borderTop: border(edges.top),
      borderRight: border(edges.right),
      borderBottom: border(edges.bottom),
      borderLeft: border(edges.left),
    };
  });
}

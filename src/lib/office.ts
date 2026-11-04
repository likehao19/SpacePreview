import { XMLParser } from 'fast-xml-parser';
import { strFromU8 } from 'fflate';
import { listZip, extractZipEntries } from './archive';
import type { WorkbookSheet } from './worker-types';
import { workbookStyles } from './workbook-styles';
import { SSF } from 'xlsx';

// OOXML is untrusted: return plain data, reject entities, and bound expanded XML.
const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: false,
  transformTagName: (name) => name.split(':').pop()!,
  transformAttributeName: (name) => (name.endsWith(':id') ? '@_relationshipId' : name),
  parseTagValue: false,
  processEntities: true,
});
const slideParser = new XMLParser({
  preserveOrder: true,
  trimValues: false,
  parseTagValue: false,
  transformTagName: (name) => name.split(':').pop()!,
});
const asArray = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];
function textOf(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (!value || typeof value !== 'object') return '';
  if (Array.isArray(value)) return value.map(textOf).join('');
  const node = value as Record<string, unknown>;
  if ('t' in node) return textOf(node.t);
  if ('#text' in node) return textOf(node['#text']);
  if ('r' in node) return textOf(node.r);
  return '';
}
function xmlParts(bytes: Uint8Array, prefix: string) {
  const entries = listZip(bytes).filter(
    (e) => e.name.startsWith(prefix) && (e.name.endsWith('.xml') || e.name.endsWith('.rels')),
  );
  if (
    entries.reduce((sum, e) => sum + e.size, 0) > 48 * 1024 * 1024 ||
    entries.some((e) => e.size > 12 * 1024 * 1024)
  )
    throw new Error('文档 XML 过大，已停止解析。');
  const names = new Set(entries.map((e) => e.name));
  const parts = extractZipEntries(bytes, names, 12 * 1024 * 1024, 48 * 1024 * 1024);
  return (path: string, xmlParser = parser) => {
    if (!parts[path]) return {};
    const xml = strFromU8(parts[path]);
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('文档包含不受支持的 XML 实体声明。');
    return xmlParser.parse(xml);
  };
}
export function columnIndex(reference: string): number {
  let result = 0;
  for (const letter of reference.toUpperCase().match(/^[A-Z]+/)?.[0] ?? '')
    result = result * 26 + letter.charCodeAt(0) - 64;
  return result - 1;
}
export function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}
function partPath(base: string, target: string) {
  const segments: string[] = target.startsWith('/') ? [] : base.split('/');
  for (const segment of target.split('/')) {
    if (segment === '..') segments.pop();
    else if (segment && segment !== '.') segments.push(segment);
  }
  return segments.join('/');
}
export function officeIndex(bytes: Uint8Array, kind: 'xlsx' | 'pptx') {
  const prefix = kind === 'xlsx' ? 'xl' : 'ppt';
  const name = kind === 'xlsx' ? 'workbook' : 'presentation';
  const read = xmlParts(bytes, `${prefix}/`);
  const root = read(`${prefix}/${name}.xml`)[name];
  if (!root) throw new Error('文档清单不存在。');
  const rels = asArray<any>(read(`${prefix}/_rels/${name}.xml.rels`).Relationships?.Relationship);
  const items = asArray<any>(kind === 'xlsx' ? root.sheets?.sheet : root.sldIdLst?.sldId);
  if (items.length > (kind === 'xlsx' ? 100 : 500))
    throw new Error('文档页数或工作表数量超过预览上限。');
  return items.map((item, index) => {
    const relation = rels.find(
      (rel) => rel['@_Id'] === item['@_relationshipId'] && rel['@_TargetMode'] !== 'External',
    );
    if (!relation) throw new Error('文档内部引用无效。');
    return {
      path: partPath(prefix, relation['@_Target']),
      name: String(item['@_name'] ?? `第 ${index + 1} 页`),
    };
  });
}
export function readWorkbook(bytes: Uint8Array, selected?: number): WorkbookSheet[] {
  const read = xmlParts(bytes, 'xl/');
  const workbook = read('xl/workbook.xml').workbook;
  if (!workbook) throw new Error('没有找到有效的 Excel 工作簿。');
  const rels = asArray<any>(read('xl/_rels/workbook.xml.rels').Relationships?.Relationship);
  const shared = asArray(read('xl/sharedStrings.xml').sst?.si).map(textOf);
  const styles = read('xl/styles.xml').styleSheet;
  const cellFormats = workbookStyles(styles, read('xl/theme/theme1.xml').theme);
  const rightAlignedFormats = new Map<number, number>();
  const customFormats = new Map<number, string>(
    asArray<any>(styles?.numFmts?.numFmt).map((format) => [
      Number(format['@_numFmtId']),
      String(format['@_formatCode']),
    ]),
  );
  const formats = asArray<any>(styles?.cellXfs?.xf).map((x) => Number(x['@_numFmtId']));
  const sheets = asArray<any>(workbook.sheets?.sheet);
  if (sheets.length > 100) throw new Error('工作簿超过 100 个工作表。');
  return sheets
    .filter((_, index) => selected === undefined || selected === index)
    .map((sheet) => {
      const relationship = rels.find(
        (r) => r['@_Id'] === sheet['@_relationshipId'] && r['@_TargetMode'] !== 'External',
      );
      const worksheet = relationship
        ? read(partPath('xl', relationship['@_Target'])).worksheet
        : null;
      const rows: string[][] = [];
      const cellStyles: number[][] = [];
      const rowHeights: Record<number, number> = {};
      const columnWidths: Record<number, number> = {};
      let columns = 0;
      let truncated = false;
      for (const row of asArray<any>(worksheet?.sheetData?.row)) {
        const rowIndex = Math.max(0, Number(row['@_r'] ?? rows.length + 1) - 1);
        if (!Number.isSafeInteger(rowIndex) || rowIndex >= 5000) {
          truncated = true;
          continue;
        }
        const cells: string[] = [];
        const rowStyles: number[] = [];
        const height = Number(row['@_ht']);
        if (row['@_hidden'] === '1') rowHeights[rowIndex] = 0;
        else if (Number.isFinite(height) && height > 0)
          rowHeights[rowIndex] = Math.min(4096, (height * 4) / 3);
        for (const cell of asArray<any>(row.c)) {
          const index = cell['@_r'] ? columnIndex(cell['@_r']) : cells.length;
          if (index < 0 || index >= 100) {
            truncated = true;
            continue;
          }
          let value = textOf(cell.v);
          const styleIndex = Number(cell['@_s'] ?? row['@_s'] ?? 0);
          rowStyles[index] =
            Number.isSafeInteger(styleIndex) && cellFormats[styleIndex] ? styleIndex : 0;
          if (cell['@_t'] === 's') value = shared[Number(value)] ?? '';
          else if (cell['@_t'] === 'inlineStr') value = textOf(cell.is);
          else if (cell['@_t'] === 'b') value = value === '1' ? 'TRUE' : 'FALSE';
          else if (
            value &&
            (!cell['@_t'] || cell['@_t'] === 'n') &&
            Number.isFinite(Number(value))
          ) {
            const numberFormat = formats[styleIndex];
            try {
              value = SSF.format(
                customFormats.get(numberFormat) ?? numberFormat ?? 0,
                Number(value),
                { date1904: ['1', 'true'].includes(String(workbook.workbookPr?.['@_date1904'])) },
              );
            } catch {
              /* Retain the saved value for unsupported number formats. */
            }
          }
          if ('f' in cell && !('v' in cell)) value = '（公式无缓存结果）';
          if (
            (!cell['@_t'] || cell['@_t'] === 'n') &&
            textOf(cell.v) &&
            cellFormats[styleIndex] &&
            !cellFormats[styleIndex].textAlign
          ) {
            if (!rightAlignedFormats.has(styleIndex)) {
              rightAlignedFormats.set(styleIndex, cellFormats.length);
              cellFormats.push({ ...cellFormats[styleIndex], textAlign: 'right' });
            }
            rowStyles[index] = rightAlignedFormats.get(styleIndex)!;
          }
          cells[index] = value;
          columns = Math.max(columns, index + 1);
        }
        rows[rowIndex] = cells;
        cellStyles[rowIndex] = rowStyles;
      }
      for (const column of asArray<any>(worksheet?.cols?.col)) {
        const width =
          column['@_hidden'] === '1'
            ? 0
            : Math.max(8, Math.min(2000, (Number(column['@_width']) || 8.43) * 7 + 5));
        const first = Math.max(0, Number(column['@_min']) - 1);
        const last = Math.min(99, Number(column['@_max']) - 1);
        for (let index = first; index <= last; index++) columnWidths[index] = width;
      }
      const merges = asArray<any>(worksheet?.mergeCells?.mergeCell).flatMap((entry) => {
        const match = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(String(entry['@_ref']));
        if (!match) return [];
        const row = Number(match[2]) - 1,
          column = columnIndex(match[1]);
        const lastRow = Math.min(4999, Number(match[4]) - 1),
          lastColumn = Math.min(99, columnIndex(match[3]));
        if (row < 0 || row > lastRow || column < 0 || column > lastColumn) return [];
        if (Number(match[4]) > 5000 || columnIndex(match[3]) >= 100) truncated = true;
        while (rows.length <= lastRow) rows.push([]);
        columns = Math.max(columns, lastColumn + 1);
        return [{ row, column, rows: lastRow - row + 1, columns: lastColumn - column + 1 }];
      });
      return {
        name: String(sheet['@_name'] ?? 'Sheet'),
        rows: Array.from({ length: rows.length }, (_, i) => rows[i] ?? []),
        columns,
        truncated,
        styles: cellFormats.length ? cellFormats : undefined,
        cellStyles,
        rowHeights,
        columnWidths,
        defaultRowHeight: Math.max(
          16,
          Math.min(
            4096,
            ((Number(worksheet?.sheetFormatPr?.['@_defaultRowHeight']) || 15) * 4) / 3,
          ),
        ),
        merges,
      };
    });
}

export function readSlides(bytes: Uint8Array, selected?: number) {
  const read = xmlParts(bytes, 'ppt/');
  const presentation = read('ppt/presentation.xml').presentation;
  if (!presentation) throw new Error('没有找到有效的 PowerPoint 演示文稿。');
  const rels = asArray<any>(read('ppt/_rels/presentation.xml.rels').Relationships?.Relationship);
  const slides = asArray<any>(presentation.sldIdLst?.sldId);
  if (slides.length > 500) throw new Error('幻灯片超过 500 页，已停止解析。');
  return slides
    .filter((_, index) => selected === undefined || selected === index)
    .map((slide) => {
      const relation = rels.find(
        (r) => r['@_Id'] === slide['@_relationshipId'] && r['@_TargetMode'] !== 'External',
      );
      const root = relation ? read(partPath('ppt', relation['@_Target']), slideParser) : null;
      const paragraphs: string[] = [];
      const inlineText = (nodes: Record<string, any>[]): string =>
        nodes
          .map((node) =>
            Object.entries(node)
              .map(([key, value]) => {
                if (key === '#text') return String(value);
                if (key === 'br') return '\n';
                if (key === 'tab') return '\t';
                return ['r', 'fld', 't'].includes(key) ? inlineText(value) : '';
              })
              .join(''),
          )
          .join('');
      const collect = (node: unknown) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
          node.forEach(collect);
          return;
        }
        for (const [key, value] of Object.entries(node)) {
          if (key === 'p') {
            const text = inlineText(value as Record<string, any>[]);
            if (text.trim()) paragraphs.push(text);
          } else if (!key.startsWith('@_')) collect(value);
        }
      };
      collect(root);
      return { title: paragraphs[0] ?? '无文字内容', paragraphs: paragraphs.slice(1) };
    });
}

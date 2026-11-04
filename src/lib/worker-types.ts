export interface ArchiveEntry {
  name: string;
  size: number;
  compressed: number;
  directory: boolean;
  index: number;
  offset?: number;
  method?: number;
  encrypted?: boolean;
  crc?: number;
  sourcePath?: string;
}
export interface WorkerRequest {
  progressive?: boolean;
  phase?: 'index' | 'package';
  unit?: number;
  encoding?: import('./files').TextEncoding;
  partial?: boolean;
  kind:
    | 'text'
    | 'markdown'
    | 'archive'
    | 'archive-entry'
    | 'archive-directory'
    | 'archive-data'
    | 'archive-decompress'
    | 'package-directory'
    | 'compound-data'
    | 'web-archive'
    | 'design-thumbnail'
    | 'xar-data'
    | 'legacy-doc'
    | 'legacy-ppt'
    | 'graphviz'
    | 'metafile'
    | 'docx'
    | 'xlsx'
    | 'legacy-xlsx'
    | 'asciidoc'
    | 'pptx'
    | 'csv'
    | 'odt'
    | 'ods'
    | 'odp'
    | 'epub'
    | 'html'
    | 'fb2'
    | 'notebook'
    | 'dxf'
    | 'model'
    | 'tiff'
    | 'decoded-image'
    | 'mail'
    | 'animation'
    | 'docx-layout';
  name: string;
  bytes: Uint8Array;
  entryName?: string;
  entry?: ArchiveEntry;
  count?: number;
  page?: number;
  fileSize?: number;
}
export interface WorkbookCellStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  textDecoration?: string;
  color?: string;
  backgroundColor?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  whiteSpace?: 'pre' | 'pre-wrap';
  borderTop?: string;
  borderRight?: string;
  borderBottom?: string;
  borderLeft?: string;
}
export interface WorkbookMerge {
  row: number;
  column: number;
  rows: number;
  columns: number;
}
export interface WorkbookSheet {
  name: string;
  rows: string[][];
  columns: number;
  truncated: boolean;
  styles?: WorkbookCellStyle[];
  cellStyles?: number[][];
  rowHeights?: Record<number, number>;
  columnWidths?: Record<number, number>;
  defaultRowHeight?: number;
  merges?: WorkbookMerge[];
}
export interface WorkerResult {
  units?: { path: string; name: string }[];
  text?: string;
  html?: string;
  encoding?: string;
  language?: string;
  lines?: number;
  entries?: ArchiveEntry[];
  truncated?: boolean;
  sheets?: WorkbookSheet[];
  slides?: { title: string; paragraphs: string[] }[];
  data?: Uint8Array;
  chapters?: { title: string; html: string }[];
  note?: string;
  drawing?: import('./cad').CadDrawing;
  positions?: Float32Array;
  points?: boolean;
  colors?: Float32Array;
  raster?: { width: number; height: number; pixels: Uint8Array; pages: number; page: number };
  image?: { pages: number; page: number; mime?: string };
  mail?: import('./mail').MailContent;
  webArchive?: import('./web-archive').WebArchive;
  metafile?: { width: number; height: number; records: number };
  animation?: { data: Record<string, unknown>; names: string[]; page: number };
}

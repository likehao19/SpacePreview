import {
  FileCode2,
  FileText,
  FileCog,
  Image,
  Music2,
  Film,
  Archive,
  Table2,
  Boxes,
  FileQuestion,
  Database,
  Type,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { detectKind, extension, engines } from '../lib/files';
import { systemFileIcon } from '../lib/bridge';

export function fileTypeLabel(name: string, folder = false): string {
  if (folder) return '文件夹';
  const ext = extension(name);
  if (ext === 'lnk') return '快捷方式';
  if (ext === 'url') return 'Internet 快捷方式';
  if (['exe', 'dll', 'sys', 'msi'].includes(ext)) return ext === 'exe' ? '应用程序' : '系统文件';
  if (['ttf', 'otf', 'woff', 'woff2', 'ttc'].includes(ext)) return '字体文件';
  if (ext === 'txt') return '文本文档';
  const kind = detectKind(name);
  if (kind === 'text') return `${ext.toUpperCase()} 源码 / 文本`;
  return engines.find((engine) => engine.kind === kind)?.label ?? `${ext.toUpperCase()} 文件`;
}

export default function FileIcon({
  name,
  folder = false,
  size = 30,
  path,
}: {
  name: string;
  folder?: boolean;
  size?: number;
  path?: string;
}) {
  const key = `${path ?? ''}\0${name}\0${folder}`;
  const [system, setSystem] = useState<{ key: string; url: string }>();
  useEffect(() => {
    let active = true;
    void systemFileIcon(name, path, folder).then((url) => {
      if (active) setSystem(url ? { key, url } : undefined);
    });
    return () => {
      active = false;
    };
  }, [name, path, folder, key]);
  const ext = extension(name),
    kind = detectKind(name);
  let color = '#7c65c2',
    Glyph = FileQuestion;
  if (kind === 'text' || kind === 'html') {
    color = ext === 'txt' ? '#4b91bb' : '#287fbc';
    Glyph = ext === 'txt' ? FileText : FileCode2;
  }
  if (
    [
      'docx',
      'legacy-doc',
      'odt',
      'markdown',
      'rtf',
      'epub',
      'fb2',
      'asciidoc',
      'mail',
      'web-archive',
    ].includes(kind)
  ) {
    color = '#367ed5';
    Glyph = FileText;
  }
  if (kind === 'pdf' || kind === 'ofd') {
    color = '#d25353';
    Glyph = FileText;
  }
  if (['xlsx', 'legacy-xlsx', 'ods', 'csv'].includes(kind)) {
    color = '#29976d';
    Glyph = Table2;
  }
  if (['pptx', 'legacy-ppt', 'odp'].includes(kind)) {
    color = '#d87945';
    Glyph = FileText;
  }
  if (
    ['image', 'tiff', 'metafile', 'decoded-image', 'diagram', 'animation', 'thumbnail'].includes(
      kind,
    )
  ) {
    color = '#a359b8';
    Glyph = Image;
  }
  if (kind === 'audio') {
    color = '#b861b0';
    Glyph = Music2;
  }
  if (kind === 'video') {
    color = '#6973ca';
    Glyph = Film;
  }
  if (kind === 'archive') {
    color = '#bd8934';
    Glyph = Archive;
  }
  if (['dxf', 'model'].includes(kind)) {
    color = '#208e98';
    Glyph = Boxes;
  }
  if (['exe', 'dll', 'sys', 'msi', 'lnk', 'url'].includes(ext)) {
    color = '#4b79bd';
    Glyph = FileCog;
  }
  if (kind === 'database') {
    color = '#588995';
    Glyph = Database;
  }
  if (kind === 'font') {
    color = '#9271b0';
    Glyph = Type;
  }
  if (system?.key === key)
    return (
      <img
        className={`file-type-icon system-file-icon${folder ? ' folder-type-icon' : ''}`}
        data-file-kind={kind}
        src={system.url}
        width={size}
        height={size}
        alt=""
        aria-hidden="true"
        onError={() => setSystem(undefined)}
      />
    );
  return folder ? (
    <svg
      className="file-type-icon folder-type-icon"
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 32 32"
    >
      <path d="M3 8a3 3 0 0 1 3-3h7l3 4h10a3 3 0 0 1 3 3v13H3Z" fill="#E7AF39" />
      <path d="M3 12h26v13a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Z" fill="#F8CA58" />
      <path d="M4 13h24" stroke="#FFE4A0" strokeWidth="2" />
    </svg>
  ) : (
    <span
      className="file-type-icon"
      data-file-kind={kind}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={size} height={size} viewBox="0 0 32 32">
        <path d="M8 2h11l7 7v18a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Z" fill={color} />
        <path d="M19 2v5a2 2 0 0 0 2 2h5Z" fill="#fff" fillOpacity=".45" />
      </svg>
      <Glyph className="file-glyph" size={size * 0.48} strokeWidth={1.7} />
    </span>
  );
}

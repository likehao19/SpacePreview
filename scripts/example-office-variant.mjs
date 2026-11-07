import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
const types = {
  docm: 'application/vnd.ms-word.document.macroEnabled.main+xml',
  dotx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml',
  dotm: 'application/vnd.ms-word.template.macroEnabledTemplate.main+xml',
  xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.main+xml',
  xltx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.template.main+xml',
  xltm: 'application/vnd.ms-excel.template.macroEnabled.main+xml',
  pptm: 'application/vnd.ms-powerpoint.presentation.macroEnabled.main+xml',
  potx: 'application/vnd.openxmlformats-officedocument.presentationml.template.main+xml',
  potm: 'application/vnd.ms-powerpoint.template.macroEnabled.main+xml',
  ppsx: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow.main+xml',
  ppsm: 'application/vnd.ms-powerpoint.slideshow.macroEnabled.main+xml',
};
export function officeVariant(bytes, ext) {
  if (!types[ext]) return bytes;
  const zip = unzipSync(bytes),
    part = ext.startsWith('do')
      ? '/word/document.xml'
      : ext.startsWith('xl')
        ? '/xl/workbook.xml'
        : '/ppt/presentation.xml';
  const original = strFromU8(zip['[Content_Types].xml']);
  const updated = original.replace(/<Override\b[^>]*>/g, (tag) =>
    tag.includes(`PartName="${part}"`)
      ? tag.replace(/ContentType="[^"]+"/, `ContentType="${types[ext]}"`)
      : tag,
  );
  if (updated === original) return bytes;
  zip['[Content_Types].xml'] = strToU8(updated);
  return Buffer.from(zipSync(zip));
}

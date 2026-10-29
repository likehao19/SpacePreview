export function documentError(format: 'PDF' | 'OFD' | 'Word' | 'RTF', reason: unknown): string {
  const error = reason as { name?: string; message?: string } | null;
  const detail = error?.message || String(reason ?? '未获得具体错误信息，请重新加载。');
  if (format === 'PDF' && error?.name === 'PasswordException')
    return '此 PDF 需要密码。请先用 PDF 阅读器解锁，再进行预览。';
  if (format === 'PDF' && error?.name === 'InvalidPDFException')
    return `PDF 内容无效或结构损坏：${detail}`;
  return `${format} 加载失败：${detail}`;
}

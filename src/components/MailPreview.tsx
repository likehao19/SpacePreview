import { usePreviewLoading } from './PreviewLoading';
import { useEffect, useState } from 'react';
import type { PreviewFile } from '../lib/files';
import { formatSize, previewMime } from '../lib/files';
import { readFullBytes } from '../lib/bridge';
import { parseInWorker } from '../lib/worker-client';
import type { MailContent } from '../lib/mail';
import HtmlPreview from './HtmlPreview';
import FileIcon from './FileIcon';
import { TextAppearanceControls } from './TextAppearance';

export default function MailPreview({
  file,
  onOpen,
}: {
  file: PreviewFile;
  onOpen: (file: PreviewFile) => void;
}) {
  const [mail, setMail] = useState<MailContent>();
  const [body, setBody] = useState<PreviewFile>();
  const [error, setError] = useState('');
  usePreviewLoading(!mail && !error, '正在读取邮件');
  useEffect(() => {
    const controller = new AbortController();
    void readFullBytes(file, controller.signal)
      .then((bytes) => parseInWorker({ kind: 'mail', name: file.name, bytes }, controller.signal))
      .then((result) => {
        if (controller.signal.aborted) return;
        const content = result.mail!;
        setMail(content);
        if (content.html) {
          const blob = new Blob([content.html], { type: 'text/html' });
          setBody({ ...file, path: undefined, blob, name: '邮件正文.html', size: blob.size });
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [file]);
  if (error)
    return (
      <p className="preview-message" role="alert">
        {error}
      </p>
    );
  if (!mail)
    return (
      <div className="preview-message" role="status">
        <span className="spinner" />
        正在读取邮件…
      </div>
    );
  return (
    <div className="mail-preview">
      {!body && <TextAppearanceControls />}
      <header className="mail-header">
        <h1>{mail.subject}</h1>
        <dl>
          <dt>发件人</dt>
          <dd>{mail.from || '—'}</dd>
          <dt>收件人</dt>
          <dd>{mail.to || '—'}</dd>
          <dt>时间</dt>
          <dd>{mail.date || '—'}</dd>
        </dl>
        {!!mail.attachments.length && (
          <div className="mail-attachments">
            {mail.attachments.map((attachment, i) => (
              <button
                key={i}
                title="预览附件"
                onClick={() => {
                  const mime = previewMime(attachment.name);
                  const blob = new Blob([attachment.data as Uint8Array<ArrayBuffer>], {
                    type: mime,
                  });
                  onOpen({
                    id: crypto.randomUUID(),
                    name: attachment.name,
                    size: blob.size,
                    modified: file.modified,
                    mime,
                    blob,
                  });
                }}
              >
                <FileIcon name={attachment.name} size={24} />
                <span>
                  {attachment.name}
                  <small>{formatSize(attachment.data.length)}</small>
                </span>
              </button>
            ))}
          </div>
        )}
      </header>
      {body ? (
        <HtmlPreview file={body} />
      ) : (
        <pre className="mail-text">{mail.text || '邮件没有正文。'}</pre>
      )}
    </div>
  );
}

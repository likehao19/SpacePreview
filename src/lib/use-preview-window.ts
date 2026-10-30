import { useEffect } from 'react';
import { currentMonitor, getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { previewWindowSize } from './preview-window';

// Resolve the initial canvas before revealing a Finder preview. Never measure text rows.
export function usePreviewWindow(
  enabled: boolean,
  identity: string,
  settingsOpen: boolean,
  kind: string,
  preserveSize = false,
) {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let finished = false;
    const win = getCurrentWindow();
    const resize = async (width = 1000, height = 716, proportional = false) => {
      if (finished || cancelled) return;
      finished = true;
      try {
        const monitor = await currentMonitor();
        if (cancelled) return;
        if (monitor && !(await win.isMaximized()) && !(await win.isFullscreen())) {
          const area = monitor.workArea.size.toLogical(monitor.scaleFactor);
          const size = previewWindowSize(width, height, area.width, area.height, proportional);
          if (!size || cancelled) return;
          await win.setSize(new LogicalSize(size.width, size.height));
          if (!cancelled) await win.center();
        }
      } catch (error) {
        console.warn('Preview window sizing failed', error);
      } finally {
        if (!cancelled && (identity || settingsOpen) && !(await win.isVisible())) {
          await win.show();
          await win.setFocus();
        }
      }
    };
    const measure = () => {
      if (preserveSize && identity && !settingsOpen) {
        if (finished || cancelled) return;
        finished = true;
        void win
          .isVisible()
          .then(async (visible) => {
            if (!cancelled && !visible) {
              await win.show();
              if (!cancelled) await win.setFocus();
            }
          })
          .catch((error) => console.warn('Preview window reveal failed', error));
        return;
      }
      if (finished || cancelled) return;
      if (!identity || settingsOpen) {
        void resize(settingsOpen ? 900 : 720, settingsOpen ? 616 : 436);
        return;
      }
      const root = document.querySelector('.preview-layer:not([hidden])');
      if (!root) return;
      const video = root.querySelector('video');
      if (video) {
        if (video.videoWidth) void resize(video.videoWidth, video.videoHeight, true);
        return;
      }
      if (kind === 'video') return;
      const image = root.querySelector<HTMLImageElement>('.preview-image');
      if (image) {
        if (image.naturalWidth) void resize(image.naturalWidth, image.naturalHeight, true);
        return;
      }
      if (kind === 'image') return;
      const pdf = root.querySelector<HTMLElement>('.pdf-preview');
      if (pdf) {
        if (pdf.dataset.pageWidth)
          void resize(
            Number(pdf.dataset.pageWidth) + 48,
            Number(pdf.dataset.pageHeight) + 48,
            true,
          );
        return;
      }
      // Reading formats have a fixed canvas: reveal their loading feedback immediately.
      if (kind === 'pdf' || kind === 'pptx') return;
      if (kind === 'audio') void resize(640, 480);
      else void resize();
    };
    const observer = new MutationObserver(measure);
    observer.observe(document.querySelector('.preview-container') ?? document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-page-width'],
    });
    document.addEventListener('load', measure, true);
    document.addEventListener('loadedmetadata', measure, true);
    measure();
    // Damaged/slow media must still reveal a usable preview; don't resize it again later.
    const timeout = setTimeout(() => void resize(), 3000);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      observer.disconnect();
      document.removeEventListener('load', measure, true);
      document.removeEventListener('loadedmetadata', measure, true);
    };
  }, [enabled, identity, settingsOpen, kind, preserveSize]);
}

import { usePreviewLoading } from './PreviewLoading';
import { useEffect, useRef, useState } from 'react';
import type { AnimationItem } from 'lottie-web';
import type { PreviewFile } from '../lib/files';
import { readFullBytes } from '../lib/bridge';
import { parseInWorker } from '../lib/worker-client';
import PreviewToolbar from './PreviewToolbar';

export default function AnimationPreview({ file }: { file: PreviewFile }) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<AnimationItem | null>(null);
  const [names, setNames] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  usePreviewLoading(!loaded && !error, '正在准备动画');
  useEffect(() => {
    const controller = new AbortController();
    setLoaded(false);
    setError('');
    setPlaying(true);
    void readFullBytes(file, controller.signal)
      .then((bytes) =>
        parseInWorker({ kind: 'animation', name: file.name, bytes, page }, controller.signal),
      )
      .then(async (result) => {
        const { default: lottie } = await import('lottie-web/build/player/lottie_light');
        if (controller.signal.aborted || !host.current) return;
        setNames(result.animation!.names);
        const animation = lottie.loadAnimation({
          container: host.current,
          renderer: 'svg',
          animationData: result.animation!.data,
          loop: true,
          autoplay: true,
        });
        player.current = animation;
        animation.addEventListener('DOMLoaded', () => {
          if (!controller.signal.aborted) setLoaded(true);
        });
        animation.addEventListener('data_failed', () => {
          if (!controller.signal.aborted) setError('动画数据无法渲染。');
        });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => {
      controller.abort();
      player.current?.destroy();
      player.current = null;
    };
  }, [file, page]);
  return (
    <div className="animation-preview checkerboard">
      <PreviewToolbar className="content-toolbar">
        <span>Lottie 动画</span>
        <button
          disabled={!loaded}
          onClick={() => {
            player.current?.togglePause();
            setPlaying((value) => !value);
          }}
        >
          {playing ? '暂停' : '播放'}
        </button>
        {names.length > 1 && (
          <select
            aria-label="动画"
            value={page}
            onChange={(event) => setPage(Number(event.target.value))}
          >
            {names.map((name, i) => (
              <option key={name} value={i}>
                {name}
              </option>
            ))}
          </select>
        )}
      </PreviewToolbar>
      <div className="animation-canvas" ref={host} aria-label="Lottie 动画预览" />
      {(error || !loaded) && (
        <div className="preview-message" role={error ? 'alert' : 'status'}>
          {error || (
            <>
              <span className="spinner" />
              正在加载动画…
            </>
          )}
        </div>
      )}
    </div>
  );
}

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type SetStateAction,
} from 'react';

type Position = { selector: string; index: number; top: number; left: number };
export interface SessionCache {
  values: Map<string, unknown>;
  scroll: Position[];
}
export const newSessionCache = (): SessionCache => ({ values: new Map(), scroll: [] });
const Session = createContext<SessionCache | null>(null);
export function usePreviewState<T>(key: string, initial: T | (() => T)) {
  const cache = useContext(Session);
  const [value, setValue] = useState<T>(() => {
    if (cache?.values.has(key)) return cache.values.get(key) as T;
    const first = typeof initial === 'function' ? (initial as () => T)() : initial;
    cache?.values.set(key, first);
    return first;
  });
  const update = useCallback(
    (next: SetStateAction<T>) =>
      setValue((current) => {
        const result = typeof next === 'function' ? (next as (value: T) => T)(current) : next;
        cache?.values.set(key, result);
        return result;
      }),
    [cache, key],
  );
  return [value, update] as const;
}
const selectors = [
  '.document-scroll',
  '.code-scroll',
  '.pdf-scroll',
  '.workbook-scroll',
  '.slide-scroll',
  '.reading-outline nav',
  '.directory-tree',
  '.directory-content',
  'iframe',
];
function scrollElement(element: Element): Element | null {
  return element.tagName === 'IFRAME'
    ? ((element as HTMLIFrameElement).contentDocument?.scrollingElement ?? null)
    : element;
}
export default function PreviewSession({
  cache,
  children,
}: {
  cache: SessionCache;
  children: ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = host.current!;
    let pending = [...cache.scroll];
    let frame: number | undefined;
    const documents = new Set<Document>();
    const schedule = () => {
      if (!pending.length || frame !== undefined) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        restore();
      });
    };
    const observer = new MutationObserver(schedule);
    const stop = () => {
      pending = [];
      if (frame !== undefined) cancelAnimationFrame(frame);
      observer.disconnect();
      root.removeEventListener('load', schedule, true);
      for (const doc of documents) {
        doc.removeEventListener('load', schedule, true);
        for (const type of ['pointerdown', 'wheel', 'keydown'])
          doc.removeEventListener(type, stop, true);
      }
      documents.clear();
    };
    const restore = () => {
      for (const iframe of root.querySelectorAll('iframe')) {
        const doc = iframe.contentDocument;
        if (!doc?.documentElement || documents.has(doc)) continue;
        documents.add(doc);
        observer.observe(doc.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['style'],
        });
        doc.addEventListener('load', schedule, true);
        for (const type of ['pointerdown', 'wheel', 'keydown'])
          doc.addEventListener(type, stop, { capture: true, passive: true });
      }
      pending = pending.filter((position) => {
        const node = root.querySelectorAll(position.selector)[position.index];
        const element = node && scrollElement(node);
        if (!element) return true;
        element.scrollTop = position.top;
        element.scrollLeft = position.left;
        return (
          Math.abs(element.scrollTop - position.top) > 2 ||
          Math.abs(element.scrollLeft - position.left) > 2
        );
      });
      if (!pending.length) stop();
    };
    if (pending.length) {
      observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style'],
      });
      root.addEventListener('load', schedule, true);
      restore();
    }
    for (const type of ['pointerdown', 'wheel', 'keydown'])
      root.addEventListener(type, stop, { capture: true, passive: true });
    return () => {
      const unfinished = [...pending];
      stop();
      for (const type of ['pointerdown', 'wheel', 'keydown'])
        root.removeEventListener(type, stop, true);
      const captured = selectors.flatMap((selector) =>
        [...root.querySelectorAll(selector)].flatMap((node, index) => {
          const element = scrollElement(node);
          return element && (element.scrollTop || element.scrollLeft)
            ? [{ selector, index, top: element.scrollTop, left: element.scrollLeft }]
            : [];
        }),
      );
      cache.scroll = [
        ...captured.filter(
          (position) =>
            !unfinished.some(
              (item) => item.selector === position.selector && item.index === position.index,
            ),
        ),
        ...unfinished,
      ];
    };
  }, [cache]);
  return (
    <Session.Provider value={cache}>
      <div ref={host} className="preview-session">
        {children}
      </div>
    </Session.Provider>
  );
}

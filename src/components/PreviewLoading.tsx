import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from 'react';
type Loading = { label: string; progress?: number };
const TasksContext = createContext(new Map<string, Loading>());
const UpdateContext = createContext<(id: string, status: Loading | null) => void>(() => {});
export function PreviewLoadingProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState(new Map<string, Loading>());
  const update = useCallback(
    (id: string, status: Loading | null) =>
      setTasks((current) => {
        if (!status && !current.has(id)) return current;
        const next = new Map(current);
        if (status) next.set(id, status);
        else next.delete(id);
        return next;
      }),
    [],
  );
  return (
    <UpdateContext.Provider value={update}>
      <TasksContext.Provider value={tasks}>{children}</TasksContext.Provider>
    </UpdateContext.Provider>
  );
}
export function usePreviewLoading(active: boolean, label: string, progress?: number) {
  const update = useContext(UpdateContext),
    id = useId();
  useEffect(() => {
    if (active) update(id, { label, progress });
    return () => update(id, null);
  }, [active, label, progress, id, update]);
}
export function PreviewLoadingIndicator() {
  const tasks = useContext(TasksContext),
    busy = tasks.size > 0;
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!busy) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), 250);
    return () => clearTimeout(timer);
  }, [busy]);
  if (!busy || !visible) return null;
  const status = [...tasks.values()].at(-1)!;
  const percent =
    status.progress === undefined || !Number.isFinite(status.progress)
      ? undefined
      : Math.max(0, Math.min(100, Math.round(status.progress)));
  return (
    <div className="preview-loading-toast" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <div>
        <span>
          {status.label}
          {percent === undefined ? '' : ` ${percent}%`}
        </span>
        <progress aria-label={status.label} max={100} value={percent} />
      </div>
    </div>
  );
}

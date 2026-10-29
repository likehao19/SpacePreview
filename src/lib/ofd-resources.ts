// Keep shared OFD resources only while a nearby page uses them. Releasing a
// pending load also disposes its eventual result, including after document close.
export function ofdResources<T>(load: (key: string) => Promise<T>, dispose: (value: T) => void) {
  type Entry = { value: Promise<T>; users: number; dispose: () => void };
  const entries = new Map<string, Entry>();
  return {
    acquire(key: string) {
      let entry = entries.get(key);
      if (!entry) {
        const value = Promise.resolve().then(() => load(key));
        let destroyed = false;
        entry = {
          value,
          users: 0,
          dispose() {
            if (destroyed) return;
            destroyed = true;
            void value.then(dispose, () => {});
          },
        };
        entries.set(key, entry);
      }
      const held = entry;
      held.users++;
      let released = false;
      return {
        value: held.value,
        release() {
          if (released) return;
          released = true;
          if (--held.users === 0) {
            if (entries.get(key) === held) entries.delete(key);
            held.dispose();
          }
        },
      };
    },
    clear() {
      for (const entry of entries.values()) entry.dispose();
      entries.clear();
    },
  };
}

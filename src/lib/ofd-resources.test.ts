import { expect, it, vi } from 'vitest';
import { ofdResources } from './ofd-resources';

it('shares a resource until its last nearby page leaves', async () => {
  const load = vi.fn(async () => 'blob:shared');
  const dispose = vi.fn();
  const pool = ofdResources(load, dispose);
  const first = pool.acquire('image'),
    second = pool.acquire('image');
  await Promise.all([first.value, second.value]);
  expect(load).toHaveBeenCalledTimes(1);
  first.release();
  await Promise.resolve();
  expect(dispose).not.toHaveBeenCalled();
  second.release();
  await Promise.resolve();
  expect(dispose).toHaveBeenCalledExactlyOnceWith('blob:shared');
  second.release();
  pool.clear();
  await Promise.resolve();
  expect(dispose).toHaveBeenCalledTimes(1);
  const reopened = pool.acquire('image');
  await reopened.value;
  expect(load).toHaveBeenCalledTimes(2);
  reopened.release();
});

it('disposes a late result after a page leaves during loading', async () => {
  let finish!: (value: string) => void;
  const dispose = vi.fn();
  const pool = ofdResources(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
    dispose,
  );
  const held = pool.acquire('image');
  await Promise.resolve();
  held.release();
  finish('blob:late');
  await held.value;
  expect(dispose).toHaveBeenCalledExactlyOnceWith('blob:late');
});

it('document close disposes all resources even while loading', async () => {
  let finish!: (value: string) => void;
  const dispose = vi.fn();
  const pool = ofdResources(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
    dispose,
  );
  const held = pool.acquire('font');
  await Promise.resolve();
  pool.clear();
  held.release();
  finish('font');
  await held.value;
  expect(dispose).toHaveBeenCalledExactlyOnceWith('font');
});

it('an old release cannot remove a new load for the same resource', async () => {
  const load = vi.fn(async () => ({})),
    dispose = vi.fn();
  const pool = ofdResources(load, dispose);
  const old = pool.acquire('image');
  await old.value;
  pool.clear();
  const current = pool.acquire('image');
  await current.value;
  old.release();
  const shared = pool.acquire('image');
  await shared.value;
  expect(load).toHaveBeenCalledTimes(2);
  current.release();
  shared.release();
  await Promise.resolve();
  expect(dispose).toHaveBeenCalledTimes(2);
});

it('failed loads can be released and retried without retaining an entry', async () => {
  const load = vi.fn().mockRejectedValueOnce(new Error('broken')).mockResolvedValueOnce('ok');
  const dispose = vi.fn();
  const pool = ofdResources(load, dispose);
  const failed = pool.acquire('image');
  await expect(failed.value).rejects.toThrow('broken');
  failed.release();
  const retry = pool.acquire('image');
  expect(await retry.value).toBe('ok');
  retry.release();
  await Promise.resolve();
  expect(dispose).toHaveBeenCalledExactlyOnceWith('ok');
});

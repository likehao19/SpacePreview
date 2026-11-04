import { expect, it } from 'vitest';
import { markdownImageUrl } from './markdown-images';

it('keeps public image URLs including query strings and protocol-relative links', () => {
  expect(markdownImageUrl('https://images.example.com/picture?purpose=inline&size=640')).toBe(
    'https://images.example.com/picture?purpose=inline&size=640',
  );
  expect(markdownImageUrl('//images.example.com/photo.png')).toBe(
    'https://images.example.com/photo.png',
  );
  expect(markdownImageUrl('http://images.example.com/photo.png')).toBe(
    'http://images.example.com/photo.png',
  );
});

it('rejects active schemes, credentials and unapproved file URLs', () => {
  for (const source of [
    'javascript:alert(1)',
    'data:text/html,hello',
    'file:///C:/private.png',
    'https://user:password@example.com/image.png',
    'blob:https://example.com/id',
    '../private.png',
  ])
    expect(markdownImageUrl(source)).toBeNull();
});

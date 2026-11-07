import { decodeText, extension } from './files';
import { Earcut } from 'three/src/extras/Earcut.js';
const MAX_TRIANGLES = 250000;
export function readModel(bytes: Uint8Array, name: string): Float32Array {
  const coordinates: number[] = [];
  const triangle = (points: number[][]) => {
    if (coordinates.length / 9 >= MAX_TRIANGLES) throw new Error('模型超过 250,000 个三角面。');
    const values = points.flat();
    if (values.length !== 9 || !values.every(Number.isFinite))
      throw new Error('模型包含无效顶点。');
    coordinates.push(...values);
  };
  if (extension(name) === 'stl') {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const count = bytes.length >= 84 ? view.getUint32(80, true) : 0;
    if (bytes.length >= 84 && 84 + count * 50 === bytes.length) {
      if (count > MAX_TRIANGLES) throw new Error('模型超过 250,000 个三角面。');
      const positions = new Float32Array(count * 9);
      for (let i = 0; i < count; i++) {
        const start = 84 + i * 50 + 12;
        for (let axis = 0; axis < 9; axis++) {
          const value = view.getFloat32(start + axis * 4, true);
          if (!Number.isFinite(value)) throw new Error('模型包含无效顶点。');
          positions[i * 9 + axis] = value;
        }
      }
      if (!count) throw new Error('模型没有可显示的三角面。');
      return positions;
    } else {
      const text = decodeText(bytes).text;
      if (!/^\s*solid\b/i.test(text) || !/endsolid\b/i.test(text))
        throw new Error('STL 文件无效或已截断。');
      for (const facet of text.matchAll(/facet\s+normal[\s\S]*?endfacet/gi)) {
        const points = [...facet[0].matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/gi)].map((m) =>
          m.slice(1).map(Number),
        );
        triangle(points);
      }
    }
  } else {
    const vertices: number[][] = [];
    for (const line of decodeText(bytes).text.split(/\r?\n/)) {
      const parts = line.trim().split('#')[0].trim().split(/\s+/);
      if (parts[0] === 'v') {
        if (vertices.length >= 500000) throw new Error('OBJ 超过 500,000 个顶点。');
        const p = parts.slice(1, 4).map(Number);
        if (p.length !== 3 || !p.every(Number.isFinite)) throw new Error('OBJ 顶点无效。');
        vertices.push(p);
      } else if (parts[0] === 'f') {
        if (parts.length < 4 || parts.length > 1001) throw new Error('OBJ 面参数无效。');
        const face = parts.slice(1).map((part) => {
          const i = Number(part.split('/')[0]);
          const p =
            Number.isInteger(i) && i !== 0
              ? vertices[i > 0 ? i - 1 : vertices.length + i]
              : undefined;
          if (!p) throw new Error('OBJ 面引用不存在的顶点。');
          return p;
        });
        if (face.length === 3) triangle(face);
        else {
          // Project onto the polygon's dominant plane before triangulating concave faces.
          const normal = [0, 0, 0];
          face.forEach((a, i) => {
            const b = face[(i + 1) % face.length];
            normal[0] += (a[1] - b[1]) * (a[2] + b[2]);
            normal[1] += (a[2] - b[2]) * (a[0] + b[0]);
            normal[2] += (a[0] - b[0]) * (a[1] + b[1]);
          });
          const axis = normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
          const indices = Earcut.triangulate(
            face.flatMap((p) => p.filter((_, i) => i !== axis)),
            [],
          );
          if (!indices.length) throw new Error('OBJ 多边形无法三角化。');
          for (let i = 0; i < indices.length; i += 3)
            triangle(indices.slice(i, i + 3).map((j) => face[j]));
        }
      }
    }
  }
  if (!coordinates.length) throw new Error('模型没有可显示的三角面。');
  const positions = Float32Array.from(coordinates);
  if (positions.some((value) => !Number.isFinite(value))) throw new Error('模型坐标超出显示范围。');
  return positions;
}

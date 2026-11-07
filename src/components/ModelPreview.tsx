import { usePreviewLoading } from './PreviewLoading';
import PreviewToolbar from './PreviewToolbar';
import { useEffect, useRef, useState } from 'react';
import type { PreviewFile } from '../lib/files';
import { readFullBytes } from '../lib/bridge';
import { parseInWorker } from '../lib/worker-client';

export default function ModelPreview({ file }: { file: PreviewFile }) {
  const host = useRef<HTMLDivElement>(null);
  const reset = useRef<() => void>(() => {});
  const [error, setError] = useState('');
  const [triangles, setTriangles] = useState(0);
  const [points, setPoints] = useState(false);
  const [progress, setProgress] = useState(0);
  usePreviewLoading(
    !triangles && !error,
    progress < 100 ? '正在读取三维模型' : '正在解析三维模型',
    progress > 0 && progress < 100 ? progress : undefined,
  );
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    setProgress(0);
    setTriangles(0);
    setPoints(false);
    let dispose = () => {};
    const load = async () => {
      const [result, THREE, { OrbitControls }] = await Promise.all([
        readFullBytes(file, controller.signal, setProgress).then((bytes) =>
          parseInWorker({ kind: 'model', bytes, name: file.name }, controller.signal),
        ),
        import('three'),
        import('three/addons/controls/OrbitControls.js'),
      ]);
      if (controller.signal.aborted || !host.current) return;
      const element = host.current,
        geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(result.positions!, 3));
      if (result.colors)
        geometry.setAttribute('color', new THREE.BufferAttribute(result.colors, 3));
      if (!result.points) geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      const sphere = geometry.boundingSphere!;
      if (!Number.isFinite(sphere.radius) || sphere.radius === 0) {
        geometry.dispose();
        throw new Error('模型坐标范围无效或没有面积。');
      }
      geometry.translate(-sphere.center.x, -sphere.center.y, -sphere.center.z);
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true });
      } catch {
        geometry.dispose();
        throw new Error('当前图形环境无法创建 WebGL 三维预览。');
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setClearColor(0x151b26);
      element.append(renderer.domElement);
      const scene = new THREE.Scene(),
        material = new THREE.MeshStandardMaterial({
          color: result.colors ? 0xffffff : 0xb8d4df,
          vertexColors: !!result.colors,
          metalness: 0.12,
          roughness: 0.65,
          flatShading: true,
          side: THREE.DoubleSide,
        });
      const pointMaterial = new THREE.PointsMaterial({
        color: result.colors ? 0xffffff : 0xb8d4df,
        vertexColors: !!result.colors,
        size: sphere.radius / 100,
      });
      scene.add(
        result.points
          ? new THREE.Points(geometry, pointMaterial)
          : new THREE.Mesh(geometry, material),
      );
      // Edge extraction hashes all triangles; keep it off the large-model first-paint path.
      const edges =
        !result.points && result.positions!.length / 9 <= 20000
          ? new THREE.EdgesGeometry(geometry)
          : undefined;
      const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x506879 });
      if (edges) scene.add(new THREE.LineSegments(edges, edgeMaterial));
      scene.add(new THREE.HemisphereLight(0xe9f2ff, 0x68727e, 1));
      const light = new THREE.DirectionalLight(0xffffff, 1.8);
      light.position.set(2, 3, 4);
      scene.add(light);
      const radius = sphere.radius,
        camera = new THREE.PerspectiveCamera(45, 1, radius / 1000, radius * 1000);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.minDistance = radius * 0.05;
      controls.maxDistance = radius * 100;
      const render = () => renderer.render(scene, camera);
      const fit = () => {
        const angle = Math.min(
          (camera.fov * Math.PI) / 360,
          Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect),
        );
        const distance = (radius / Math.sin(angle)) * 1.15;
        camera.position.set(distance * 0.7, distance * 0.45, distance * 0.7);
        controls.target.set(0, 0, 0);
        controls.update();
        render();
      };
      reset.current = fit;
      const resize = () => {
        const width = Math.max(element.clientWidth, 1),
          height = Math.max(element.clientHeight, 1);
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        render();
      };
      controls.addEventListener('change', render);
      const observer = new ResizeObserver(resize);
      observer.observe(element);
      resize();
      fit();
      setTriangles(result.positions!.length / (result.points ? 3 : 9));
      setPoints(!!result.points);
      dispose = () => {
        observer.disconnect();
        controls.dispose();
        geometry.dispose();
        edges?.dispose();
        edgeMaterial.dispose();
        material.dispose();
        pointMaterial.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
        reset.current = () => {};
      };
    };
    void load().catch((e) => {
      if (!controller.signal.aborted) setError(e.message);
    });
    return () => {
      controller.abort();
      dispose();
    };
  }, [file]);
  return (
    <div className="model-preview">
      <PreviewToolbar className="content-toolbar">
        <span>
          三维模型 · {triangles.toLocaleString()} {points ? '点' : '三角面'}
        </span>
        <button
          title="拖动旋转 · 右键平移 · 滚轮缩放；不加载外部材质与贴图"
          onClick={() => reset.current()}
        >
          适应模型
        </button>
      </PreviewToolbar>
      {error ? (
        <div className="preview-message" role="alert">
          {error}
        </div>
      ) : (
        <div className="model-canvas" ref={host} aria-label="三维模型预览">
          {!triangles && <span className="model-loading">正在读取模型…</span>}
        </div>
      )}
    </div>
  );
}

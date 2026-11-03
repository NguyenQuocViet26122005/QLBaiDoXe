import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Biểu đồ cột 3D: mỗi bãi xe là một khối kính cao theo sức chứa,
 * phần cam bên trong là số xe đang gửi. Chỉ đọc dữ liệu đã có, không gọi API.
 * areas: [{ id, name, used, capacity }]
 */
export default function OccupancyTowers3D({ areas = [] }) {
  const hostRef = useRef(null);
  const key = areas.map((a) => `${a.id}:${a.used}/${a.capacity}`).join('|');

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !areas.length) return undefined;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); }
    catch { host.dataset.fallback = 'true'; return undefined; }

    delete host.dataset.fallback;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    scene.add(new THREE.HemisphereLight('#ffffff', '#d8d3c8', 1.6));
    const sun = new THREE.DirectionalLight('#fff4e6', 2.2);
    sun.position.set(-4, 8, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
    scene.add(sun);

    const disposables = [];
    const track = (x) => { disposables.push(x); return x; };

    const maxCap = Math.max(...areas.map((a) => a.capacity || 0), 1);
    const gap = 1.7;
    const width = (areas.length - 1) * gap;

    const floor = new THREE.Mesh(track(new THREE.PlaneGeometry(40, 40)), track(new THREE.ShadowMaterial({ opacity: 0.12 })));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const plinthMat = track(new THREE.MeshStandardMaterial({ color: '#ebe7dc', roughness: 0.9 }));
    const glassMat = track(new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.15, transmission: 0.6, thickness: 0.4, transparent: true, opacity: 0.35 }));
    const edgeMat = track(new THREE.LineBasicMaterial({ color: '#121412', transparent: true, opacity: 0.25 }));
    const fillMat = track(new THREE.MeshStandardMaterial({ color: '#f05423', roughness: 0.45, emissive: '#f05423', emissiveIntensity: 0.12 }));
    const fullMat = track(new THREE.MeshStandardMaterial({ color: '#b9362d', roughness: 0.45, emissive: '#b9362d', emissiveIntensity: 0.15 }));

    const fills = [];
    areas.forEach((a, i) => {
      const x = i * gap - width / 2;
      const h = 0.6 + (a.capacity / maxCap) * 3;
      const ratio = a.capacity ? Math.min(1, a.used / a.capacity) : 0;

      const plinth = new THREE.Mesh(track(new THREE.BoxGeometry(1.25, 0.12, 1.25)), plinthMat);
      plinth.position.set(x, 0.06, 0);
      plinth.receiveShadow = true;
      scene.add(plinth);

      const glassGeo = track(new THREE.BoxGeometry(1, h, 1));
      const glass = new THREE.Mesh(glassGeo, glassMat);
      glass.position.set(x, 0.12 + h / 2, 0);
      scene.add(glass);
      const edges = new THREE.LineSegments(track(new THREE.EdgesGeometry(glassGeo)), edgeMat);
      edges.position.copy(glass.position);
      scene.add(edges);

      const fillGeo = track(new THREE.BoxGeometry(0.86, 1, 0.86));
      fillGeo.translate(0, 0.5, 0);
      const fill = new THREE.Mesh(fillGeo, ratio >= 0.9 ? fullMat : fillMat);
      fill.position.set(x, 0.13, 0);
      fill.castShadow = true;
      fill.scale.y = reduce ? Math.max(0.001, h * ratio - 0.02) : 0.001;
      scene.add(fill);
      fills.push({ mesh: fill, target: Math.max(0.001, h * ratio - 0.02), delay: i * 0.12 });
    });

    const resize = () => {
      const w = Math.max(1, host.clientWidth);
      const hh = Math.max(1, host.clientHeight);
      renderer.setSize(w, hh, false);
      camera.aspect = w / hh;
      // Lùi camera đủ xa để toàn bộ cụm cột (rộng `width`, cao tối đa ~3.7) nằm gọn trong khung.
      const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const fitH = 2.3 / tanHalf;
      const fitW = (width / 2 + 1.2) / (tanHalf * camera.aspect);
      const dist = Math.max(fitH, fitW) * 1.45;
      camera.position.copy(new THREE.Vector3(0.55, 0.42, 0.8).normalize().multiplyScalar(dist));
      camera.lookAt(0, 1.5, 0);
      camera.updateProjectionMatrix();
    };
    resize();

    const start = performance.now();
    let pointerX = 0;
    let px = 0;
    const frame = () => {
      if (reduce) {
        renderer.render(scene, camera);
        return;
      }
      const t = (performance.now() - start) / 1000;
      fills.forEach((f) => {
        const k = THREE.MathUtils.clamp((t - f.delay) / 1.1, 0, 1);
        const e = 1 - Math.pow(1 - k, 3);
        f.mesh.scale.y = Math.max(0.001, f.target * e);
      });
      px += (pointerX - px) * 0.06;
      scene.rotation.y = Math.sin(t * 0.25) * 0.06 + px * 0.18;
      renderer.render(scene, camera);
    };

    let running = false;
    let visible = true;
    const sync = () => {
      const run = !reduce && visible && document.visibilityState === 'visible';
      if (run === running) return;
      running = run;
      renderer.setAnimationLoop(run ? frame : null);
    };
    const ro = new ResizeObserver(() => { resize(); if (!running) frame(); });
    ro.observe(host);
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; sync(); });
    io.observe(host);
    const onVis = () => sync();
    document.addEventListener('visibilitychange', onVis);
    const onMove = (e) => { const r = host.getBoundingClientRect(); pointerX = THREE.MathUtils.clamp(((e.clientX - r.left) / r.width - 0.5) * 2, -1, 1); };
    const onLeave = () => { pointerX = 0; };
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);
    frame();
    sync();

    return () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
    // `key` gom toàn bộ dữ liệu cần vẽ, tránh dựng lại cảnh khi mảng mới nhưng giá trị không đổi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!areas.length) return null;
  return (
    <div className="towers-3d" ref={hostRef} aria-label="Mô hình sử dụng bãi xe" role="group">
      <p className="towers-fallback report-preview-note" role="status">Thiết bị không hỗ trợ hiển thị mô hình 3D.</p>
    </div>
  );
}

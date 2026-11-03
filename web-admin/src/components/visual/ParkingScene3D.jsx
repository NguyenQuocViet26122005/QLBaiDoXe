import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Cảnh 3D trang trí: một bãi xe nhiều tầng low-poly với xe ra vào qua barrier.
 * Thuần giao diện — không đọc hay ghi dữ liệu nghiệp vụ.
 *
 * - Tự dừng render khi canvas ra khỏi màn hình hoặc tab bị ẩn.
 * - prefers-reduced-motion: chỉ vẽ một khung hình tĩnh.
 * - Không có WebGL: gọi onFallback để component cha hiển thị ảnh tĩnh.
 */
const PALETTE = {
  ground: '#1b1e1b',
  slab: '#262a26',
  deck: '#2d322d',
  pillar: '#3a3f3a',
  line: '#e9e6dc',
  accent: '#f05423',
  cars: ['#f05423', '#f3f0e8', '#8a8f88', '#3b403b', '#d8d3c8', '#c9a46a', '#f3f0e8', '#5b625b']
};

const BAY_STEP = 1.15;
const BAYS_X = Array.from({ length: 9 }, (_, i) => (i - 4) * BAY_STEP);
// Một số ô cố ý để trống để bãi xe trông "thật".
const ROW_A_EMPTY = new Set([2, 6]);
const ROW_B_EMPTY = new Set([0, 4, 7]);
const ROW_C_EMPTY = new Set([3, 5]);

function makeCarParts() {
  const body = new THREE.BoxGeometry(0.5, 0.26, 0.92);
  body.translate(0, 0.19, 0);
  const cabin = new THREE.BoxGeometry(0.44, 0.22, 0.5);
  cabin.translate(0, 0.43, -0.04);
  return { body, cabin };
}

export default function ParkingScene3D({ background = '#111310', shiftX = 0, shiftY = 0, zoom = 1, className = '', onFallback }) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      onFallback?.();
      return undefined;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(background, 22, 44);

    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    const target = new THREE.Vector3(0, 0.7, 0);

    // ---------- Ánh sáng ----------
    scene.add(new THREE.HemisphereLight('#f4efe4', '#14130f', 1.25));
    const sun = new THREE.DirectionalLight('#fff3e2', 2.4);
    sun.position.set(-7, 12, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -10;
    sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 8;
    sun.shadow.camera.bottom = -8;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);
    const rim = new THREE.DirectionalLight('#f05423', 0.9);
    rim.position.set(8, 4, -8);
    scene.add(rim);

    const disposables = [];
    const mat = (params) => { const m = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.05, ...params }); disposables.push(m); return m; };
    const geo = (g) => { disposables.push(g); return g; };
    const mesh = (g, m, { cast = false, receive = true } = {}) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = receive; return o; };

    // ---------- Mặt đất & sàn ----------
    const ground = mesh(geo(new THREE.PlaneGeometry(80, 80)), mat({ color: PALETTE.ground, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.26;
    scene.add(ground);

    const slab = mesh(geo(new THREE.BoxGeometry(12.4, 0.26, 7.4)), mat({ color: PALETTE.slab }));
    slab.position.y = -0.13;
    scene.add(slab);

    // Đường dẫn xe ra vào chạy xuyên qua bãi.
    const road = mesh(geo(new THREE.BoxGeometry(30, 0.02, 1.5)), mat({ color: '#202420', roughness: 0.95 }));
    road.position.set(0, 0.01, 0);
    scene.add(road);

    const lineMat = mat({ color: PALETTE.line, roughness: 0.6, emissive: PALETTE.line, emissiveIntensity: 0.08 });
    const dashGeo = geo(new THREE.BoxGeometry(0.42, 0.012, 0.05));
    const dashes = new THREE.InstancedMesh(dashGeo, lineMat, 24);
    const tmp = new THREE.Object3D();
    for (let i = 0; i < 24; i += 1) { tmp.position.set(-13.5 + i * 1.18, 0.03, 0); tmp.rotation.set(0, 0, 0); tmp.updateMatrix(); dashes.setMatrixAt(i, tmp.matrix); }
    scene.add(dashes);

    // Vạch ô đỗ cho hai hàng mặt đất và tầng trên.
    const bayLineGeo = geo(new THREE.BoxGeometry(0.035, 0.012, 1.5));
    const bayLines = new THREE.InstancedMesh(bayLineGeo, lineMat, 40);
    let li = 0;
    const addBayLines = (z, y) => {
      for (let i = 0; i <= BAYS_X.length; i += 1) {
        tmp.position.set(BAYS_X[0] - BAY_STEP / 2 + i * BAY_STEP, y, z);
        tmp.updateMatrix();
        bayLines.setMatrixAt(li, tmp.matrix); li += 1;
      }
    };
    addBayLines(-2.35, 0.025);
    addBayLines(2.35, 0.025);
    addBayLines(-2.5, 2.215);
    bayLines.count = li;
    scene.add(bayLines);

    // ---------- Tầng trên & cột ----------
    const deck = mesh(geo(new THREE.BoxGeometry(11.2, 0.2, 2.9)), mat({ color: PALETTE.deck }), { cast: true });
    deck.position.set(0, 2.1, -2.5);
    scene.add(deck);
    const deckEdge = mesh(geo(new THREE.BoxGeometry(11.2, 0.05, 0.05)), mat({ color: PALETTE.accent, emissive: PALETTE.accent, emissiveIntensity: 0.9 }), { receive: false });
    deckEdge.position.set(0, 2.03, -1.03);
    scene.add(deckEdge);
    const railMat = mat({ color: '#5a605a', metalness: 0.4, roughness: 0.5 });
    const rail = mesh(geo(new THREE.BoxGeometry(11.2, 0.04, 0.04)), railMat, { receive: false });
    rail.position.set(0, 2.62, -1.08);
    scene.add(rail);
    const postGeo = geo(new THREE.BoxGeometry(0.04, 0.42, 0.04));
    const posts = new THREE.InstancedMesh(postGeo, railMat, 12);
    for (let i = 0; i < 12; i += 1) { tmp.position.set(-5.5 + i * 1, 2.41, -1.08); tmp.updateMatrix(); posts.setMatrixAt(i, tmp.matrix); }
    scene.add(posts);

    const pillarGeo = geo(new THREE.BoxGeometry(0.26, 2.0, 0.26));
    const pillars = new THREE.InstancedMesh(pillarGeo, mat({ color: PALETTE.pillar }), 8);
    pillars.castShadow = true;
    pillars.receiveShadow = true;
    [-5.4, -1.8, 1.8, 5.4].forEach((x, i) => {
      [-3.8, -1.2].forEach((z, j) => { tmp.position.set(x, 1, z); tmp.updateMatrix(); pillars.setMatrixAt(i * 2 + j, tmp.matrix); });
    });
    scene.add(pillars);

    // ---------- Xe đỗ (instanced) ----------
    const { body: carBodyGeo, cabin: carCabinGeo } = makeCarParts();
    disposables.push(carBodyGeo, carCabinGeo);
    const carBodyMat = mat({ color: '#ffffff', roughness: 0.45, metalness: 0.25 });
    const carGlassMat = mat({ color: '#171a17', roughness: 0.2, metalness: 0.6 });
    const parkedSpots = [];
    BAYS_X.forEach((x, i) => {
      if (!ROW_A_EMPTY.has(i)) parkedSpots.push([x, 0.02, -2.35, Math.PI]);
      if (!ROW_B_EMPTY.has(i)) parkedSpots.push([x, 0.02, 2.35, 0]);
      if (!ROW_C_EMPTY.has(i)) parkedSpots.push([x, 2.2, -2.5, Math.PI]);
    });
    const parkedBodies = new THREE.InstancedMesh(carBodyGeo, carBodyMat, parkedSpots.length);
    const parkedCabins = new THREE.InstancedMesh(carCabinGeo, carGlassMat, parkedSpots.length);
    parkedBodies.castShadow = true;
    parkedCabins.castShadow = true;
    const color = new THREE.Color();
    parkedSpots.forEach(([x, y, z, ry], i) => {
      tmp.position.set(x + (Math.sin(i * 12.9) * 0.05), y, z + Math.cos(i * 7.1) * 0.06);
      tmp.rotation.set(0, ry + Math.sin(i * 3.3) * 0.04, 0);
      tmp.updateMatrix();
      parkedBodies.setMatrixAt(i, tmp.matrix);
      parkedCabins.setMatrixAt(i, tmp.matrix);
      parkedBodies.setColorAt(i, color.set(PALETTE.cars[(i * 5) % PALETTE.cars.length]));
    });
    scene.add(parkedBodies, parkedCabins);

    // ---------- Barrier & đầu đọc vé ----------
    const gateX = -6.6;
    const gatePost = mesh(geo(new THREE.BoxGeometry(0.22, 0.85, 0.22)), mat({ color: '#e9e6dc' }), { cast: true });
    gatePost.position.set(gateX, 0.42, -0.95);
    scene.add(gatePost);
    const armPivot = new THREE.Group();
    armPivot.position.set(gateX, 0.74, -0.95);
    const armMat = mat({ color: PALETTE.accent, emissive: PALETTE.accent, emissiveIntensity: 0.35 });
    const arm = mesh(geo(new THREE.BoxGeometry(0.06, 0.06, 1.75)), armMat, { cast: true });
    arm.position.z = 0.88;
    armPivot.add(arm);
    scene.add(armPivot);
    const scanner = mesh(geo(new THREE.TorusGeometry(0.62, 0.025, 8, 48)), mat({ color: PALETTE.accent, emissive: PALETTE.accent, emissiveIntensity: 1.6, transparent: true, opacity: 0.9 }), { receive: false });
    scanner.rotation.x = -Math.PI / 2;
    scanner.position.set(gateX + 0.9, 0.04, 0);
    scene.add(scanner);
    const statusLight = mesh(geo(new THREE.SphereGeometry(0.07, 16, 12)), mat({ color: '#25714b', emissive: '#3ddc84', emissiveIntensity: 1.2 }), { receive: false });
    statusLight.position.set(gateX, 0.9, -0.95);
    scene.add(statusLight);

    // ---------- Xe đang di chuyển ----------
    const headMat = mat({ color: '#fff6d8', emissive: '#fff1c4', emissiveIntensity: 2.2 });
    const tailMat = mat({ color: '#ff3b1f', emissive: '#ff3b1f', emissiveIntensity: 1.6 });
    const lampGeo = geo(new THREE.BoxGeometry(0.1, 0.06, 0.03));
    const movers = [0, 0.5].map((phase, i) => {
      const group = new THREE.Group();
      const bodyM = mat({ color: i ? '#f3f0e8' : PALETTE.accent, roughness: 0.4, metalness: 0.3 });
      const b = mesh(carBodyGeo, bodyM, { cast: true });
      const c = mesh(carCabinGeo, carGlassMat, { cast: true });
      group.add(b, c);
      [-0.15, 0.15].forEach((x) => {
        const h = mesh(lampGeo, headMat, { receive: false }); h.position.set(x, 0.24, 0.47); group.add(h);
        const t = mesh(lampGeo, tailMat, { receive: false }); t.position.set(x, 0.24, -0.47); group.add(t);
      });
      group.rotation.y = Math.PI / 2; // hướng đầu xe theo trục +x
      group.position.set(0, 0.02, i ? 0.32 : -0.32);
      scene.add(group);
      return { group, phase, lane: i ? 0.32 : -0.32, dir: i ? -1 : 1 };
    });

    // ---------- Kích thước & camera ----------
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const resize = () => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Thu nhỏ cảnh trên khung hẹp để không bị cắt.
      const fit = Math.min(1, camera.aspect / 1.35);
      camera.zoom = zoom * (0.55 + 0.45 * fit);
      camera.setViewOffset(w, h, -w * shiftX, -h * shiftY, w, h);
      camera.updateProjectionMatrix();
    };
    resize();

    const LOOP = 16; // giây cho một lượt xe đi xuyên bãi
    const SPAN = 26;
    const placeScene = (t) => {
      const orbit = -0.72 + Math.sin(t * 0.07) * 0.16 + pointer.x * 0.12;
      const radius = 21;
      camera.position.set(Math.sin(orbit) * radius, 11.5 + pointer.y * 1.2, Math.cos(orbit) * radius);
      camera.lookAt(target);

      let gateOpen = 0;
      movers.forEach((m) => {
        const p = ((t / LOOP + m.phase) % 1 + 1) % 1;
        const x = m.dir * (-SPAN / 2 + p * SPAN);
        m.group.position.x = x;
        m.group.rotation.y = m.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        m.group.position.y = 0.02 + Math.sin(t * 9 + m.phase * 10) * 0.004;
        // Barrier mở khi có xe ở gần (theo cả hai chiều).
        const d = Math.abs(x - gateX);
        gateOpen = Math.max(gateOpen, THREE.MathUtils.clamp(1 - (d - 0.4) / 2.2, 0, 1));
      });
      const eased = gateOpen * gateOpen * (3 - 2 * gateOpen);
      armPivot.rotation.x = -eased * 1.35;
      const pulse = (Math.sin(t * 3.2) + 1) / 2;
      scanner.scale.setScalar(0.85 + pulse * 0.25);
      scanner.material.opacity = 0.35 + (1 - pulse) * 0.55;
      statusLight.material.emissive.set(eased > 0.2 ? '#3ddc84' : '#f05423');
    };

    let running = false;
    let visible = true;
    const start = performance.now() - 4000;
    const frame = () => {
      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;
      placeScene((performance.now() - start) / 1000);
      renderer.render(scene, camera);
    };
    const sync = () => {
      const shouldRun = !reduceMotion && visible && document.visibilityState === 'visible';
      if (shouldRun === running) return;
      running = shouldRun;
      renderer.setAnimationLoop(running ? frame : null);
    };

    const ro = new ResizeObserver(() => { resize(); if (!running) frame(); });
    ro.observe(host);
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: 0.01 });
    io.observe(host);
    const onVisibility = () => sync();
    document.addEventListener('visibilitychange', onVisibility);
    const onPointer = (e) => {
      const r = host.getBoundingClientRect();
      pointer.tx = THREE.MathUtils.clamp(((e.clientX - r.left) / r.width - 0.5) * 2, -1, 1);
      pointer.ty = THREE.MathUtils.clamp(((e.clientY - r.top) / r.height - 0.5) * 2, -1, 1);
    };
    if (!reduceMotion) window.addEventListener('pointermove', onPointer, { passive: true });

    frame();
    host.dataset.ready = 'true';
    sync();

    return () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointer);
      [dashes, bayLines, posts, pillars, parkedBodies, parkedCabins].forEach((im) => im.dispose());
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      delete host.dataset.ready;
    };
  }, [background, shiftX, shiftY, zoom, onFallback]);

  return <div ref={hostRef} className={`parking-scene-3d ${className}`} />;
}

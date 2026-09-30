// 3D stage: loads assets/body.glb, lights it like a studio, picks muscle groups,
// and eases colours and camera between states.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MUSCLE } from './muscles.js';

const C = hex => new THREE.Color(hex);
const COL = {
  base: C('#9E3129'), ctx: C('#86302A'), bone: C('#D6CAB6'), tendon: C('#CDBFA8'),
  select: C('#E8583F'), dim: C('#1C1111'), ctxDim: C('#170F0E'), boneDim: C('#3A3631'), tendonDim: C('#322E2A'),
  p: C('#E8583F'), s: C('#D08A45'), st: C('#8E8175'),
  recCtx: C('#2B2E33'), recBone: C('#4C4944'),
};
const EMI = { none: C('#000000'), select: C('#5A140C'), hover: C('#3A1008'), p: C('#4A1209'), pulse: C('#F0A060') };
const REC_STOPS = [[0, C('#56606E')], [0.3, C('#B8904E')], [0.65, C('#F08A3C')], [1, C('#F2472E')]];

function recColor(v, out) {
  for (let i = 1; i < REC_STOPS.length; i++) {
    const [b, cb] = REC_STOPS[i], [a, ca] = REC_STOPS[i - 1];
    if (v <= b) return out.copy(ca).lerp(cb, (v - a) / (b - a));
  }
  return out.copy(REC_STOPS[REC_STOPS.length - 1][1]);
}
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createViewer(container, { onPick, onHover, onProgress, onEmptyDoubleTap } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.rotateSpeed = 0.8;
  controls.minDistance = 0.45;
  controls.maxDistance = 16;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = Math.PI - 0.25;
  controls.autoRotate = !reduced;
  controls.autoRotateSpeed = 0.7;
  controls.addEventListener('start', () => { controls.autoRotate = false; cancelTween(); });

  // Studio lighting: warm key, cool rim from behind, soft fill, hemisphere ambience.
  scene.add(new THREE.HemisphereLight(0xcfd6e6, 0x2a1c18, 0.55));
  const key = new THREE.DirectionalLight(0xfff0e0, 2.1); key.position.set(-2.2, 3.4, 3.2); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffe6d8, 0.55); fill.position.set(2.6, 1.2, 2.2); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xbcd3ff, 1.6); rim.position.set(0.5, 2.4, -3.5); scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0xffd2b0, 0.7); rim2.position.set(-2.5, 1.0, -2.5); scene.add(rim2);

  // Soft contact shadow under the feet.
  const sh = document.createElement('canvas'); sh.width = sh.height = 128;
  const g2 = sh.getContext('2d');
  const grd = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)'); grd.addColorStop(0.6, 'rgba(0,0,0,0.18)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g2.fillStyle = grd; g2.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sh), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.002;
  scene.add(shadow);

  const groups = new Map();   // id -> [mesh, mesh]
  const pickables = [];       // every mesh (so hidden groups cannot be picked through bone)
  const all = [];             // { mesh, kind, group }
  let bodyBox = new THREE.Box3();
  let hovered = null, spec = {}, pulseT = new Map();

  // ------------------------------------------------------------ load
  function load(url) {
    return new Promise((resolve, reject) => {
      new GLTFLoader().load(url, gltf => {
        const root = gltf.scene;
        root.traverse(o => {
          if (!o.isMesh) return;
          o.geometry.computeVertexNormals();
          const name = o.name || o.parent?.name || '';
          const kind = name.startsWith('m|') ? 'group' : name;   // group | ctx|muscle | ctx|tendon | bone
          const group = kind === 'group' ? name.split('|')[1] : null;
          const base = kind === 'bone' ? COL.bone : kind === 'ctx|tendon' ? COL.tendon : kind === 'ctx|muscle' ? COL.ctx : COL.base;
          const mat = kind === 'bone' || kind === 'ctx|tendon'
            ? new THREE.MeshStandardMaterial({ color: base.clone(), roughness: 0.62, metalness: 0 })
            : new THREE.MeshPhysicalMaterial({
                color: base.clone(), roughness: 0.48, metalness: 0,
                sheen: 0.6, sheenRoughness: 0.45, sheenColor: new THREE.Color('#ff9c8a'),
                clearcoat: 0.18, clearcoatRoughness: 0.5,
              });
          mat.side = THREE.DoubleSide;   // gaps between parts show muscle behind, not the void
          mat.userData = { color: base.clone(), emissive: new THREE.Color(0, 0, 0), sheen: mat.sheen || 0, sheen0: mat.sheen || 0 };
          o.material = mat;
          o.userData = { kind, group };
          all.push(o);
          pickables.push(o);
          if (group) { if (!groups.has(group)) groups.set(group, []); groups.get(group).push(o); }
        });
        scene.add(root);
        root.updateMatrixWorld(true);
        bodyBox.setFromObject(root);
        frameBody(true);
        paint({});
        resolve([...groups.keys()]);
      }, e => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); }, reject);
    });
  }

  // ------------------------------------------------------------ sizing and insets
  // Insets let the sheet cover part of the canvas while the focused muscle stays centred
  // in what remains visible (implemented as a camera view offset).
  const inset = { bottom: 0, right: 0, tb: 0, tr: 0 };
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false);
    applyInsets();
  }
  function applyInsets() {
    const w = container.clientWidth, h = container.clientHeight;
    // Centre of projection moves to (cx, cy), the middle of the uncovered area. The virtual
    // full frame is grown so the real canvas is its bottom-right window.
    const cx = (w - inset.right) / 2, cy = (h - inset.bottom) / 2;
    if (inset.bottom < 1 && inset.right < 1) {
      camera.clearViewOffset();
      camera.aspect = w / h;
    } else {
      const FW = 2 * (w - cx), FH = 2 * (h - cy);
      camera.aspect = FW / FH;
      camera.setViewOffset(FW, FH, w - 2 * cx, h - 2 * cy, w, h);
    }
    camera.updateProjectionMatrix();
  }
  function setInsets({ bottom = 0, right = 0 }) { inset.tb = bottom; inset.tr = right; }
  new ResizeObserver(resize).observe(container);

  // ------------------------------------------------------------ camera
  let tween = null;
  function cancelTween() { tween = null; }
  function flyTo(pos, target, dur = 650) {
    if (reduced) dur = 0;
    tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos, t1: target, start: performance.now(), dur };
  }
  // Distance at which a box of `size` fills the part of the canvas the sheet leaves
  // uncovered (uses the target insets, since the camera flies while they animate).
  function fitDistance(size) {
    const w = container.clientWidth, h = container.clientHeight;
    const vw = Math.max(1, w - inset.tr), vh = Math.max(1, h - inset.tb);
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * vh / (2 * h - vh);
    return Math.max(size.y / 2 / t, size.x / 2 / (t * (vw / vh))) * 1.12;
  }
  function frameBody(instant, view) {
    const size = bodyBox.getSize(new THREE.Vector3()), c = bodyBox.getCenter(new THREE.Vector3());
    const d = fitDistance(new THREE.Vector3(Math.max(size.x, 0.9), size.y, 0));
    const dir = camera.position.clone().sub(controls.target);
    dir.y = 0;
    if (view === 'front') dir.set(0, 0, 1);
    else if (view === 'back') dir.set(0, 0, -1);
    if (instant || dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
    dir.normalize();
    const pos = c.clone().add(dir.multiplyScalar(d)).add(new THREE.Vector3(0, size.y * 0.06, 0));
    if (instant) { camera.position.copy(pos); controls.target.copy(c); controls.update(); }
    else flyTo(pos, c);
  }
  const VIEW = { front: new THREE.Vector3(0, 0.08, 1), back: new THREE.Vector3(0, 0.08, -1) };
  function focus(id) {
    const meshes = groups.get(id);
    if (!meshes) return;
    controls.autoRotate = false;
    const box = new THREE.Box3();
    meshes.forEach(m => box.expandByObject(m));
    const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const view = MUSCLE[id]?.view || 'front';
    let dir;
    if (view === 'side') {
      const side = Math.sign(camera.position.x - controls.target.x) || 1;
      dir = new THREE.Vector3(side, 0.1, 0.45).normalize();
      // Paired groups are far apart side to side; focus on the nearer one.
      const near = meshes.map(m => new THREE.Box3().setFromObject(m)).sort((a, b) =>
        side * (b.getCenter(new THREE.Vector3()).x - a.getCenter(new THREE.Vector3()).x))[0];
      near.getCenter(c); near.getSize(size);
    } else dir = VIEW[view].clone().normalize();
    const extent = Math.max(size.x, size.y * 0.9, 0.32);
    const d = Math.min(Math.max(fitDistance(new THREE.Vector3(extent * 1.5, extent * 1.5, 0)), 0.8), 6);
    flyTo(c.clone().add(dir.multiplyScalar(d)), c);
  }

  // Turn the camera around its target (keyboard arrows).
  function orbit(dTheta, dPhi) {
    controls.autoRotate = false;
    const off = camera.position.clone().sub(controls.target);
    const sph = new THREE.Spherical().setFromVector3(off);
    sph.theta += dTheta;
    sph.phi = THREE.MathUtils.clamp(sph.phi + dPhi, controls.minPolarAngle, controls.maxPolarAngle);
    flyTo(controls.target.clone().add(new THREE.Vector3().setFromSpherical(sph)), controls.target.clone(), 260);
  }

  // Frame several groups at once (an exercise's primary and secondary muscles).
  function focusMany(ids, view = 'front') {
    const box = new THREE.Box3();
    ids.forEach(id => (groups.get(id) || []).forEach(m => box.expandByObject(m)));
    if (box.isEmpty()) return frameBody(false, view);
    controls.autoRotate = false;
    const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const dir = (VIEW[view] || VIEW.front).clone().normalize();
    const d = Math.max(fitDistance(new THREE.Vector3(Math.max(size.x, 0.4) * 1.3, Math.max(size.y, 0.4) * 1.3, 0)), 0.9);
    flyTo(c.clone().add(dir.multiplyScalar(d)), c);
  }

  // ------------------------------------------------------------ colours
  // spec: { focus, roles: {id: 'p'|'s'|'st'}, recovery: {id: 0..1} }
  function paint(next) {
    spec = next || {};
    const tmp = new THREE.Color();
    const dimmed = !!(spec.focus || spec.roles);
    for (const m of all) {
      const u = m.material.userData, k = m.userData.kind, g = m.userData.group;
      let col, emi = EMI.none;
      if (k === 'bone') col = dimmed ? COL.boneDim : spec.recovery ? COL.recBone : COL.bone;
      else if (k === 'ctx|tendon') col = dimmed || spec.recovery ? COL.tendonDim : COL.tendon;
      else if (k === 'ctx|muscle') col = dimmed ? COL.ctxDim : spec.recovery ? COL.recCtx : COL.ctx;
      else if (spec.roles) {
        const r = spec.roles[g];
        col = r ? COL[r] : COL.dim;
        if (r === 'p') emi = EMI.p;
      } else if (spec.focus) {
        col = g === spec.focus ? COL.select : COL.dim;
        if (g === spec.focus) emi = EMI.select;
      } else if (spec.recovery) col = recColor(spec.recovery[g] || 0, tmp).clone();
      else col = COL.base;
      u.color.copy(col);
      u.emissive.copy(emi);
      u.sheen = col === COL.dim || col === COL.ctxDim ? u.sheen0 * 0.2 : u.sheen0;
    }
  }
  function pulse(ids) { const t = performance.now(); ids.forEach(id => pulseT.set(id, t)); }

  // ------------------------------------------------------------ picking
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function hit(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const h = ray.intersectObjects(pickables, false)[0];
    return h ? h.object.userData : null;
  }
  let down = null, lastEmptyTap = 0;
  const el = renderer.domElement;
  el.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  el.addEventListener('pointerup', e => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t;
    down = null;
    if (moved > 8 || dt > 700) return;
    const h = hit(e);
    if (h?.group) { onPick?.(h.group, e); return; }
    const now = performance.now();
    if (now - lastEmptyTap < 350) { onEmptyDoubleTap?.(); lastEmptyTap = 0; } else lastEmptyTap = now;
  });
  let hoverRaf = 0;
  el.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || e.buttons) return;
    cancelAnimationFrame(hoverRaf);
    hoverRaf = requestAnimationFrame(() => {
      const h = hit(e);
      const g = h?.group || null;
      if (g !== hovered) { hovered = g; el.style.cursor = g ? 'pointer' : ''; }
      onHover?.(g, e);
    });
  });
  el.addEventListener('pointerleave', () => { hovered = null; onHover?.(null); });

  // ------------------------------------------------------------ loop
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.25, (now - last) / 1000); last = now;   // real time, so easing keeps pace on slow GPUs
    const k = reduced ? 1 : 1 - Math.exp(-dt * 9);
    if (tween) {
      const t = tween.dur ? Math.min(1, (now - tween.start) / tween.dur) : 1, e = ease(t);
      camera.position.lerpVectors(tween.p0, tween.p1, e);
      controls.target.lerpVectors(tween.t0, tween.t1, e);
      if (t >= 1) tween = null;
    }
    if (Math.abs(inset.bottom - inset.tb) > 0.5 || Math.abs(inset.right - inset.tr) > 0.5) {
      inset.bottom += (inset.tb - inset.bottom) * (reduced ? 1 : 1 - Math.exp(-dt * 8));
      inset.right += (inset.tr - inset.right) * (reduced ? 1 : 1 - Math.exp(-dt * 8));
      applyInsets();
    }
    controls.update();
    for (const m of all) {
      const u = m.material.userData, mat = m.material, g = m.userData.group;
      mat.color.lerp(u.color, k);
      if (u.sheen0) mat.sheen += (u.sheen - mat.sheen) * k;
      let target = u.emissive;
      if (g && g === hovered && !spec.roles) target = target.equals(EMI.none) ? EMI.hover : target;
      const pt = g && pulseT.get(g);
      if (pt) {
        const a = (now - pt) / 900;
        if (a >= 1) pulseT.delete(g);
        else { mat.emissive.copy(target).lerp(EMI.pulse, Math.sin(Math.PI * a) * 0.8); continue; }
      }
      mat.emissive.lerp(target, k);
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  resize();
  requestAnimationFrame(frame);

  return {
    load, paint, focus, focusMany, orbit, frameBody: view => frameBody(false, view), pulse, setInsets,
    stopAutoRotate: () => { controls.autoRotate = false; },
    groupIds: () => [...groups.keys()],
    debug: { camera, controls, inset, groups, renderer, scene, get tween() { return tween; } },
  };
}

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch { return false; }
}

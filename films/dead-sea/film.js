// "למה אי אפשר לשקוע בים המלח?" — a 50-second film rendered entirely in code.
// Every frame is a pure function of time t (seconds), so it can be played live
// or rendered offline frame by frame (see tools/render.cjs).
import * as THREE from 'three';

const W = 1920, H = 1080, DUR = 50;
const RENDER = new URLSearchParams(location.search).has('render');

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const eio = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------- timeline
const T_DIVE = 12.8;      // camera is under the surface, macro -> tunnel
const T_TUN0 = 13.0, T_TUN1 = 19.6;   // zoom through 7.5 decades
const T_TUNR0 = 40.0, T_SURF = 42.4;  // reverse zoom, back above water
const T_BACK = 45.2;      // camera is back at the opening frame
const DEC = 7.5;

const easeLin = p => 0.45 * p + 0.55 * eio(p);
function decades(t) {
  if (t < 30) return DEC * easeLin(clamp((t - T_TUN0) / (T_TUN1 - T_TUN0)));
  return DEC * (1 - easeLin(clamp((t - T_TUNR0) / (T_SURF - T_TUNR0))));
}
// forward "macro time" – the way back replays the way in
function macroTau(t) { return t <= T_DIVE ? t : T_DIVE * (1 - sm(T_SURF, T_BACK, t)); }

// ---------------------------------------------------------------- renderer
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.autoClear = false;

const SUN = new THREE.Vector3(0.22, 0.125, -1).normalize();

const SKY_GLSL = /* glsl */`
uniform vec3 uSunDir;
vec3 sky(vec3 d, float disc){
  float h = max(d.y, 0.0);
  vec3 zen = vec3(0.07, 0.11, 0.27);
  vec3 mid = vec3(0.40, 0.36, 0.56);
  vec3 hor = vec3(1.00, 0.63, 0.40);
  vec3 c = mix(hor, mid, smoothstep(0.0, 0.20, h));
  c = mix(c, zen, smoothstep(0.12, 0.75, h));
  float sd = max(dot(normalize(d), uSunDir), 0.0);
  c += vec3(1.0, 0.50, 0.22) * pow(sd, 6.0) * 0.35;
  c += vec3(1.0, 0.78, 0.50) * pow(sd, 60.0) * 0.55;
  c += vec3(1.0, 0.95, 0.85) * smoothstep(0.99955, 0.99975, sd) * 2.0 * disc;
  return c;
}`;

// ---------------------------------------------------------------- macro scene (metres)
const macro = new THREE.Scene();
const macroCam = new THREE.PerspectiveCamera(36, W / H, 0.1, 120000);

const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthTest: false, depthWrite: false,
  uniforms: { uSunDir: { value: SUN } },
  vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `varying vec3 vW; ${SKY_GLSL}
    void main(){ vec3 d = normalize(vW - cameraPosition); gl_FragColor = vec4(sky(d, 1.0), 1.0); }`,
});
const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(100000, 48, 24), skyMat);
skyMesh.renderOrder = 0; skyMesh.frustumCulled = false; macro.add(skyMesh);

function ridge(z, height, seed, color, haze, order) {
  const r = rng(seed), N = 700, X = 70000;
  const oct = [];
  for (let o = 0; o < 6; o++) { const n = 6 * Math.pow(2, o) + 2; oct.push(Array.from({ length: n + 2 }, () => r())); }
  const hAt = u => {
    let h = 0, amp = 1, tot = 0;
    for (let o = 0; o < 6; o++) {
      const a = oct[o], x = u * (a.length - 2), i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f);
      h += amp * lerp(a[i], a[i + 1], s); tot += amp; amp *= 0.5;
    }
    return h / tot;
  };
  const pos = new Float32Array((N + 1) * 6), idx = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, x = lerp(-X, X, u);
    const h = height * (0.45 + 0.75 * hAt(u));
    pos.set([x, h, z, x, -80, z], i * 6);
    if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
  const m = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uCol: { value: new THREE.Color(...color) }, uHaze: { value: new THREE.Color(...haze) }, uH: { value: height } },
    vertexShader: `varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uCol; uniform vec3 uHaze; uniform float uH; varying float vY;
      void main(){ float k = exp(-max(vY,0.0)/(uH*0.45)); gl_FragColor = vec4(mix(uCol, uHaze, k*0.85), 1.0); }`,
  });
  m.uniforms.uCol.value.setRGB(...color); m.uniforms.uHaze.value.setRGB(...haze);
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = order; mesh.frustumCulled = false; macro.add(mesh);
}
ridge(-26000, 2100, 11, [0.62, 0.42, 0.47], [0.98, 0.62, 0.42], 1);
ridge(-19000, 1550, 23, [0.44, 0.29, 0.39], [0.93, 0.56, 0.40], 2);
ridge(-14000, 1050, 37, [0.29, 0.19, 0.30], [0.80, 0.47, 0.38], 3);

const waves = [], omegas = [];
{
  const r = rng(5), lams = [11, 7.3, 4.6, 3.1, 2.0, 1.3, 0.85, 0.55, 0.36, 0.23];
  for (const lam of lams) {
    const ang = 0.5 + (r() - 0.5) * 2.4, k = 2 * Math.PI / lam;
    waves.push(new THREE.Vector4(Math.cos(ang), Math.sin(ang), k, lam * 0.0052));
    omegas.push(Math.sqrt(9.8 * k) * 0.55);
  }
}
const waterMat = new THREE.ShaderMaterial({
  uniforms: { uSunDir: { value: SUN }, uTime: { value: 0 }, uWaves: { value: waves }, uOmega: { value: omegas },
    uInvProj: { value: macroCam.projectionMatrixInverse }, uCamWorld: { value: macroCam.matrixWorld } },
  vertexShader: `void main(){ gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform float uTime; uniform vec4 uWaves[10]; uniform float uOmega[10];
    uniform mat4 uInvProj; uniform mat4 uCamWorld; ${SKY_GLSL}
    void main(){
      vec2 ndc = gl_FragCoord.xy / vec2(${W}.0, ${H}.0) * 2.0 - 1.0;
      vec4 dv = uInvProj * vec4(ndc, 1.0, 1.0);
      vec3 dw = normalize(mat3(uCamWorld) * (dv.xyz / dv.w));
      vec3 vW = cameraPosition + dw * (-cameraPosition.y / min(dw.y, -1e-5));
      vec3 toCam = cameraPosition - vW; float dist = length(toCam); vec3 V = toCam / dist;
      vec2 g = vec2(0.0);
      for (int i = 0; i < 10; i++) {
        vec4 w = uWaves[i]; float lam = 6.2832 / w.z;
        float att = 1.0 / (1.0 + pow(dist / (lam * 70.0), 2.0));
        float ph = dot(w.xy, vW.xz) * w.z + uTime * uOmega[i] + float(i) * 1.7;
        ph += 0.9 * sin(dot(vec2(-w.y, w.x), vW.xz) * w.z * 0.37 + float(i) * 2.3 + uTime * 0.2);
        g += w.xy * (w.w * w.z * cos(ph)) * att;
      }
      float r = length(vW.xz);
      vec2 rd = vW.xz / max(r, 0.001);
      g += rd * 0.018 * cos(r * 9.0 - uTime * 2.2) * exp(-r * 0.55) * smoothstep(0.25, 0.9, r);
      vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
      vec3 R = reflect(-V, n); R.y = abs(R.y);
      vec3 refl = sky(R, 0.0);
      float az = atan(R.x, -R.z);
      float mh = 0.050 + 0.016 * sin(az * 9.0 + 1.0) + 0.008 * sin(az * 23.0);
      float m = (1.0 - smoothstep(mh - 0.014, mh + 0.014, R.y)) * step(0.0, -R.z);
      refl = mix(refl, vec3(0.42, 0.28, 0.36), m * 0.75);
      float F = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
      vec3 body = mix(vec3(0.010, 0.12, 0.16), vec3(0.03, 0.36, 0.37), pow(max(V.y, 0.0), 1.4) * 0.75);
      body += vec3(0.03, 0.20, 0.20) * clamp(dot(g, vec2(0.6, 0.8)) * 5.0, -0.5, 1.0) * max(V.y, 0.0);
      vec3 col = mix(body, refl, F);
      float sd = max(dot(normalize(R), uSunDir), 0.0);
      col += vec3(1.0, 0.80, 0.55) * pow(sd, 220.0) * 1.3;
      col = mix(col, sky(normalize(vec3(-V.x, 0.015, -V.z)), 0.0), 1.0 - exp(-dist / 36000.0));
      gl_FragColor = vec4(col, 1.0);
    }`,
});
const water = new THREE.Mesh(new THREE.PlaneGeometry(240000, 240000), waterMat);
water.rotation.x = -Math.PI / 2; water.renderOrder = 5; water.frustumCulled = false; macro.add(water);

// the floater: a simple mannequin on its back, about a fifth of it above the water
const floater = new THREE.Group();
{
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a27e, roughness: 0.62 });
  const trunks = new THREE.MeshStandardMaterial({ color: 0x1d3a66, roughness: 0.8 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.9 });
  const cap = (r, len, mat) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 10, 24), mat);
  const sph = (r, mat) => new THREE.Mesh(new THREE.SphereGeometry(r, 28, 20), mat);
  const add = (m, x, y, z) => { m.position.set(x, y, z); floater.add(m); return m; };
  const torso = add(cap(0.15, 0.40, skin), -0.13, -0.065, 0); torso.rotation.z = Math.PI / 2; torso.scale.set(1, 1, 1.32);
  const hips = add(cap(0.146, 0.14, trunks), 0.26, -0.075, 0); hips.rotation.z = Math.PI / 2; hips.scale.set(1, 1, 1.28);
  add(cap(0.052, 0.07, skin), -0.50, -0.03, 0).rotation.z = Math.PI / 2;
  add(sph(0.104, skin), -0.64, 0.0, 0);
  const hr = add(sph(0.108, hair), -0.682, -0.04, 0); hr.scale.set(0.78, 0.82, 0.94);
  for (const s of [-1, 1]) {
    const leg = add(cap(0.066, 0.80, skin), 0.84, -0.06, s * 0.115); leg.rotation.z = Math.PI / 2 + 0.035;
    add(cap(0.038, 0.10, skin), 1.31, 0.01, s * 0.12);
    const arm = add(cap(0.044, 0.60, skin), -0.30, -0.045, s * 0.56); arm.rotation.x = Math.PI / 2; arm.rotation.z = s * 0.5;
    add(sph(0.05, skin), -0.46, -0.03, s * 0.86);
  }
  floater.rotation.y = 0.35;
  floater.traverse(o => { o.renderOrder = 6; });
  macro.add(floater);
}
const sunLight = new THREE.DirectionalLight(0xffc48a, 2.4); sunLight.position.copy(SUN).multiplyScalar(100); macro.add(sunLight);
macro.add(new THREE.HemisphereLight(0x8f96d8, 0x1f6f78, 0.75));
const fill = new THREE.DirectionalLight(0xb9c6ff, 0.18); fill.position.set(-0.3, 0.8, 1); macro.add(fill);

const P0 = new THREE.Vector3(-2.0, 2.6, 13.5), C1 = new THREE.Vector3(-1.4, 2.3, 9),
      C2 = new THREE.Vector3(0.5, 1.5, 5.2), P3 = new THREE.Vector3(0.95, 0.17, 2.0);
const L0 = new THREE.Vector3(0, 2.25, 0), L1 = new THREE.Vector3(0.1, 0.05, 0), L2 = new THREE.Vector3(0.95, -0.42, 0.2);
const _v = new THREE.Vector3(), _l = new THREE.Vector3();
function setMacroCam(tau, extra) {
  const p = 0.12 * clamp(tau / 12.4) + 0.88 * eio(clamp((tau - 5.5) / 6.9));
  const q = 1 - p;
  _v.set(0, 0, 0).addScaledVector(P0, q * q * q).addScaledVector(C1, 3 * q * q * p).addScaledVector(C2, 3 * q * p * p).addScaledVector(P3, p * p * p);
  _v.y = lerp(_v.y, -0.25, sm(12.3, 12.8, tau));
  _l.lerpVectors(L0, L1, sm(0, 0.75, p)).lerp(L2, sm(0.86, 1, p));
  const e2 = extra * extra / (extra + 1.5);
  _v.z += 0.28 * e2; _v.y += 0.05 * e2;
  macroCam.position.copy(_v); macroCam.lookAt(_l);
  macroCam.near = clamp(_v.y * 0.2, 0.04, 1); macroCam.updateProjectionMatrix();
}

// ---------------------------------------------------------------- tunnel (the zoom through empty water)
const bgScene = new THREE.Scene();
const bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const tunnelMat = new THREE.ShaderMaterial({
  depthTest: false, depthWrite: false,
  uniforms: { uD: { value: 0 }, uTime: { value: 0 }, uAspect: { value: W / H } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `
    uniform float uD; uniform float uTime; uniform float uAspect; varying vec2 vUv;
    float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    void main(){
      vec2 uv = (vUv - 0.5) * vec2(uAspect, 1.0);
      float deep = smoothstep(0.0, 6.0, uD);
      vec3 top = mix(vec3(0.16, 0.66, 0.66), vec3(0.020, 0.060, 0.135), deep);
      vec3 bot = mix(vec3(0.01, 0.20, 0.29), vec3(0.004, 0.016, 0.050), deep);
      vec3 col = mix(bot, top, smoothstep(-0.65, 0.75, uv.y + 0.1));
      float ang = uv.x * 2.6 + uv.y * 0.9;
      float rays = pow(0.5 + 0.5 * sin(ang * 4.0 + uTime * 0.35) * sin(ang * 7.3 - uTime * 0.22), 3.0);
      col += vec3(0.55, 0.95, 0.88) * rays * (1.0 - smoothstep(0.0, 2.2, uD)) * 0.22 * smoothstep(-0.5, 0.6, uv.y);
      float acc = 0.0;
      for (int i = 0; i < 7; i++) {
        float fi = float(i);
        float z = fract(uD * 0.85 + fi / 7.0);
        float s = 13.0 * exp(-z * 3.4);
        vec2 p = uv * s + fi * 17.3;
        vec2 id = floor(p); vec2 f = fract(p) - 0.5;
        float h = hash(id + fi * 3.1);
        vec2 o = (vec2(hash(id + 1.3), hash(id + 7.1)) - 0.5) * 0.7;
        float d = length(f - o);
        float size = 0.025 + 0.06 * hash(id + 2.7);
        float a = (1.0 - smoothstep(size * 0.25, size, d)) * step(0.62, h);
        acc += a * smoothstep(0.0, 0.18, z) * (1.0 - smoothstep(0.72, 1.0, z)) * (0.4 + 0.6 * z);
      }
      col += vec3(0.62, 0.92, 0.96) * acc * 0.30 * (1.0 - smoothstep(4.2, 6.2, uD));
      // faint speed lines so the zoom still reads once nothing is left to see
      float a2 = atan(uv.y, uv.x); float rr = length(uv);
      float sl = pow(max(sin(a2 * 37.0 + hash(vec2(floor(a2 * 37.0 / 3.1416), 1.0)) * 6.28), 0.0), 24.0);
      col += vec3(0.25, 0.5, 0.7) * sl * smoothstep(0.15, 0.9, rr) * 0.10 * smoothstep(0.5, 2.0, uD) * (1.0 - smoothstep(6.6, 7.5, uD));
      gl_FragColor = vec4(col, 1.0);
    }`,
});
bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), tunnelMat));

// ---------------------------------------------------------------- nano scene (nanometres)
// Dead Sea brine, to scale: per nm^3 about 27 water molecules and 6.3 ions
// (Cl- 3.8, Mg2+ 1.1, Na+ 1.05, Ca2+ 0.26, K+ 0.11) -> roughly one ion per 4 waters.
const nano = new THREE.Scene();
const nanoCam = new THREE.PerspectiveCamera(48, W / H, 0.03, 60);
const AXIS = new THREE.Vector3(1, 1, 1).normalize();     // camera flies in along this line
const SHELL_O = new THREE.Vector3(0.21, 0, 0);            // an oxygen 0.21 nm from the central Mg2+
const VIS = 0.72;                                         // water drawn slightly slimmer than van der Waals
const SPEC = {
  O: { r: 0.140, draw: 0.140 * VIS, col: [0.90, 0.20, 0.17] },
  H: { r: 0.100, draw: 0.100 * VIS, col: [0.93, 0.95, 0.97] },
  Cl: { r: 0.181, draw: 0.170, col: [0.33, 0.83, 0.36], n: 243 },
  Mg: { r: 0.072, draw: 0.074, col: [1.00, 0.78, 0.22], n: 69 },
  Na: { r: 0.102, draw: 0.100, col: [0.63, 0.43, 0.98], n: 67 },
  Ca: { r: 0.100, draw: 0.100, col: [0.48, 0.78, 0.95], n: 17 },
  K: { r: 0.138, draw: 0.132, col: [0.98, 0.52, 0.76], n: 7 },
};
const N_WATER = 1754, BOX = 2.0;
const nanoMat = new THREE.ShaderMaterial({
  alphaToCoverage: true,
  uniforms: { uTime: { value: 0 }, uProj: { value: nanoCam.projectionMatrix }, uFog: { value: 0.42 }, uFogCol: { value: new THREE.Color() } },
  vertexShader: `
    attribute vec3 aCenter; attribute vec3 aOffset; attribute float aRadius; attribute vec3 aColor; attribute vec4 aSeed;
    uniform float uTime;
    varying vec3 vC; varying float vR; varying vec3 vColor; varying vec3 vP;
    void main(){
      vec3 ph = aSeed.xyz * 6.2832;
      vec3 jit = aSeed.w * (sin(uTime * vec3(1.9, 1.5, 2.3) + ph) + 0.6 * sin(uTime * vec3(3.1, 3.7, 2.9) + ph.yzx * 1.7));
      vec3 w = aSeed.w * 13.0 * sin(uTime * vec3(1.1, 1.4, 0.9) + ph.zxy);
      vec3 wc = aCenter + jit + aOffset + cross(w, aOffset);
      vec4 mv = modelViewMatrix * vec4(wc, 1.0);
      vC = mv.xyz; vR = aRadius; vColor = aColor;
      vec3 p = mv.xyz + vec3(position.xy * aRadius * 1.6, 0.0);
      vP = p;
      gl_Position = projectionMatrix * vec4(p, 1.0);
    }`,
  fragmentShader: `
    uniform mat4 uProj; uniform float uFog; uniform vec3 uFogCol;
    varying vec3 vC; varying float vR; varying vec3 vColor; varying vec3 vP;
    void main(){
      vec3 rd = normalize(vP);
      float b = dot(rd, vC); float c = dot(vC, vC) - vR * vR; float disc = b * b - c;
      if (disc < 0.0) discard;
      float tHit = b - sqrt(disc);
      vec3 P = rd * tHit; vec3 N = (P - vC) / vR;
      vec4 clip = uProj * vec4(P, 1.0);
      gl_FragDepth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);
      vec3 L = normalize(vec3(-0.45, 0.75, 0.5)); vec3 Vv = -rd;
      float nl = dot(N, L);
      float wrap = max(nl, 0.0) * 0.72 + 0.28 * (nl * 0.5 + 0.5);
      float ndv = max(dot(N, Vv), 0.0);
      float spec = pow(max(dot(N, normalize(L + Vv)), 0.0), 56.0) * 0.55;
      vec3 col = vColor * (0.20 + 0.98 * wrap) * mix(0.55, 1.0, ndv) + spec + pow(1.0 - ndv, 3.0) * vec3(0.22, 0.48, 0.70) * 0.38;
      col = mix(uFogCol, col, exp(-uFog * length(P)));
      float alpha = clamp(disc / max(fwidth(disc), 1e-6), 0.0, 1.0) * smoothstep(0.04, 0.16, tHit);
      gl_FragColor = vec4(col, alpha);
    }`,
});
{
  const r = rng(20241), items = [];   // items: {c:[x,y,z], off:[x,y,z], rad, col, amp, seed}
  const cells = new Map(), CELL = 0.45;
  const ck = (x, y, z) => Math.floor(x / CELL) + ',' + Math.floor(y / CELL) + ',' + Math.floor(z / CELL);
  const put = (p, rad) => { const k = ck(p[0], p[1], p[2]); (cells.get(k) || cells.set(k, []).get(k)).push([p[0], p[1], p[2], rad]); };
  const isFree = (p, rad) => {
    const cx = Math.floor(p[0] / CELL), cy = Math.floor(p[1] / CELL), cz = Math.floor(p[2] / CELL);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
      const a = cells.get((cx + i) + ',' + (cy + j) + ',' + (cz + k)); if (!a) continue;
      for (const o of a) { const dx = p[0] - o[0], dy = p[1] - o[1], dz = p[2] - o[2], m = (rad + o[3]) * 0.96; if (dx * dx + dy * dy + dz * dz < m * m) return false; }
    }
    return true;
  };
  const inBox = p => Math.abs(p[0]) < BOX && Math.abs(p[1]) < BOX && Math.abs(p[2]) < BOX;
  // keep the camera's flight line clear
  const inCorridor = p => { const s = p[0] * AXIS.x + p[1] * AXIS.y + p[2] * AXIS.z; if (s < 0.42) return false; const d2 = p[0] * p[0] + p[1] * p[1] + p[2] * p[2] - s * s; return d2 < 0.36 * 0.36; };
  const unit = () => { let x, y, z, l; do { x = r() * 2 - 1; y = r() * 2 - 1; z = r() * 2 - 1; l = x * x + y * y + z * z; } while (l > 1 || l < 1e-4); l = Math.sqrt(l); return [x / l, y / l, z / l]; };
  const perp = u => { let v; do { const a = unit(); const d = a[0] * u[0] + a[1] * u[1] + a[2] * u[2]; v = [a[0] - d * u[0], a[1] - d * u[1], a[2] - d * u[2]]; } while (Math.hypot(...v) < 0.2); const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l]; };
  const seed4 = amp => [r(), r(), r(), amp];
  const addIon = (kind, p, amp) => { put(p, SPEC[kind].r); items.push({ c: p, off: [0, 0, 0], rad: SPEC[kind].draw, col: SPEC[kind].col, seed: seed4(amp) }); };
  const BOND = 0.096, HALF = 52.25 * Math.PI / 180;
  const addWater = (o, h1, h2, amp) => {
    put(o, SPEC.O.r); const s = seed4(amp);
    items.push({ c: o, off: [0, 0, 0], rad: SPEC.O.draw, col: SPEC.O.col, seed: s });
    for (const h of [h1, h2]) items.push({ c: o, off: [h[0] * BOND, h[1] * BOND, h[2] * BOND], rad: SPEC.H.draw, col: SPEC.H.col, seed: s });
  };
  // water with its oxygen facing a cation at "from": both hydrogens point away
  const waterOut = (o, u, amp) => { const v = perp(u), c = Math.cos(HALF), s = Math.sin(HALF); addWater(o, [c * u[0] + s * v[0], c * u[1] + s * v[1], c * u[2] + s * v[2]], [c * u[0] - s * v[0], c * u[1] - s * v[1], c * u[2] - s * v[2]], amp); };
  // water donating one hydrogen towards an anion (u points from anion to oxygen)
  const waterIn = (o, u, amp) => { const v = perp(u), a = 104.5 * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); addWater(o, [-u[0], -u[1], -u[2]], [-c * u[0] + s * v[0], -c * u[1] + s * v[1], -c * u[2] + s * v[2]], amp); };
  const JIT = 0.013, ions = [];
  let nWater = 0;

  // the hero: Mg2+ at the origin with its six waters on the axes, held almost still
  addIon('Mg', [0, 0, 0], 0.0015); ions.push({ kind: 'Mg', p: [0, 0, 0], hero: true });
  for (const u of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { waterOut([u[0] * 0.21, u[1] * 0.21, u[2] * 0.21], u, 0.0015); nWater++; }

  const order = [];
  for (const k of ['Cl', 'Mg', 'Na', 'Ca', 'K']) for (let i = 0; i < SPEC[k].n - (k === 'Mg' ? 1 : 0); i++) order.push(k);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  for (const kind of order) {
    for (let tries = 0; tries < 400; tries++) {
      const p = [(r() * 2 - 1) * BOX, (r() * 2 - 1) * BOX, (r() * 2 - 1) * BOX];
      if (inCorridor(p) || Math.hypot(...p) < 0.62) continue;
      let ok = true;
      for (const o of ions) { const d = Math.hypot(p[0] - o.p[0], p[1] - o.p[1], p[2] - o.p[2]); if (d < 0.40) { ok = false; break; } }
      if (!ok || !isFree(p, SPEC[kind].r)) continue;
      addIon(kind, p, JIT); ions.push({ kind, p }); break;
    }
  }
  // hydration shells
  const OCT = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const q = new THREE.Quaternion(), e = new THREE.Vector3();
  for (const ion of ions) {
    if (ion.hero) continue;
    const anion = ion.kind === 'Cl';
    const dist = anion ? 0.32 : SPEC[ion.kind].r + SPEC.O.r;
    q.set(r() - .5, r() - .5, r() - .5, r() - .5).normalize();
    for (const d of OCT) {
      if (nWater >= N_WATER) break;
      e.set(d[0], d[1], d[2]).applyQuaternion(q);
      const u = [e.x, e.y, e.z], o = [ion.p[0] + u[0] * dist, ion.p[1] + u[1] * dist, ion.p[2] + u[2] * dist];
      if (!inBox(o) || inCorridor(o) || !isFree(o, SPEC.O.r)) continue;
      (anion ? waterIn : waterOut)(o, u, JIT); nWater++;
    }
  }
  // the remaining "free" water
  for (let tries = 0; tries < 500000 && nWater < N_WATER; tries++) {
    const o = [(r() * 2 - 1) * BOX, (r() * 2 - 1) * BOX, (r() * 2 - 1) * BOX];
    if (inCorridor(o) || !isFree(o, SPEC.O.r)) continue;
    const u = unit(); waterOut(o, u, JIT); nWater++;
  }
  window.__nanoStats = { ions: ions.length, waters: nWater };

  const n = items.length;
  const aC = new Float32Array(n * 3), aO = new Float32Array(n * 3), aR = new Float32Array(n), aCol = new Float32Array(n * 3), aS = new Float32Array(n * 4);
  items.forEach((it, i) => { aC.set(it.c, i * 3); aO.set(it.off, i * 3); aR[i] = it.rad; aCol.set(it.col, i * 3); aS.set(it.seed, i * 4); });
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.setAttribute('aCenter', new THREE.InstancedBufferAttribute(aC, 3));
  g.setAttribute('aOffset', new THREE.InstancedBufferAttribute(aO, 3));
  g.setAttribute('aRadius', new THREE.InstancedBufferAttribute(aR, 1));
  g.setAttribute('aColor', new THREE.InstancedBufferAttribute(aCol, 3));
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aS, 4));
  g.instanceCount = n;
  const mesh = new THREE.Mesh(g, nanoMat); mesh.frustumCulled = false; nano.add(mesh);
}

// camera distance from the hero ion along AXIS, as eased segments (no overshoot)
const NANO_KEYS = [[18.2, 3.35], [20.8, 3.0], [30.4, 2.3], [33.6, 1.02], [38.0, 0.93], [40.3, 3.35]];
function nanoDist(t) {
  if (t <= NANO_KEYS[0][0]) return NANO_KEYS[0][1];
  for (let i = 0; i < NANO_KEYS.length - 1; i++) {
    const [t0, d0] = NANO_KEYS[i], [t1, d1] = NANO_KEYS[i + 1];
    if (t <= t1) {
      const p = (t - t0) / (t1 - t0);
      const e = i === 0 ? 1 - Math.pow(1 - p, 2.2) : i === 1 ? p : i === 4 ? Math.pow(p, 2.6) : eio(p);
      return Math.exp(lerp(Math.log(d0), Math.log(d1), e));
    }
  }
  return NANO_KEYS[NANO_KEYS.length - 1][1];
}
const SIDE = new THREE.Vector3(1, -1, 0).normalize(), UP = new THREE.Vector3().crossVectors(AXIS, SIDE).normalize();
function setNanoCam(t) {
  const d = nanoDist(t);
  const sway = clamp(d / 6, 0, 1) * 0.0 + 0.11 * Math.min(d, 1.4);
  const a = 0.35 * (t - 20);
  nanoCam.position.copy(AXIS).multiplyScalar(d).addScaledVector(SIDE, Math.sin(a) * sway).addScaledVector(UP, Math.cos(a * 0.8) * sway * 0.7);
  nanoCam.up.copy(UP).applyAxisAngle(AXIS, 0.12 * (t - 26));
  nanoCam.lookAt(0, 0, 0);
  nanoCam.updateMatrixWorld();
}

// ---------------------------------------------------------------- captions
const hud = document.getElementById('hud'), svg = document.getElementById('lines');
const L = s => `<span class="ltr">${s}</span>`;
const CAPS = [
  { a: 0.9, b: 5.7, top: 44, cls: 'title', html: 'למה אי אפשר לשקוע<br><em>בים המלח?</em>' },
  { a: 6.4, b: 9.3, top: 880, cls: 'line', html: 'ליטר של גוף אדם שוקל <b>בערך קילו</b>' },
  { a: 9.3, b: 12.2, top: 880, cls: 'line', html: `ליטר של המים האלה שוקל <b>${L('1.24')} ק״ג</b>` },
  { a: 13.5, b: 16.4, top: 250, cls: 'line', html: 'מה יש בתוך המים האלה?' },
  { a: 20.4, b: 23.5, top: 800, cls: 'big', html: 'ננומטר אחד' },
  { a: 20.9, b: 23.5, top: 960, cls: 'sub', html: 'מיליונית המילימטר. כאן כבר רואים מולקולות.' },
  { a: 23.9, b: 27.0, top: 880, cls: 'line', html: 'בין מולקולות המים: <b>יוני מלח</b>' },
  { a: 27.2, b: 30.6, top: 850, cls: 'line', html: 'יון אחד על כל <b>4</b> מולקולות מים' },
  { a: 27.9, b: 30.6, top: 950, cls: 'sub', html: 'באוקיינוס: יון אחד על כל 50' },
  { a: 32.8, b: 35.5, top: 900, cls: 'line', html: '<b>שש</b> מולקולות מים נצמדות לכל יון מגנזיום' },
  { a: 35.6, b: 38.1, top: 850, cls: 'line', html: 'יותר מסה באותו נפח' },
  { a: 36.1, b: 38.1, top: 950, cls: 'sub', html: 'ולכן המים האלה צפופים ב־24% ממים רגילים' },
  { a: 45.5, b: 49.2, top: 44, cls: 'title', html: 'לא אתם קלים.<br><em>המים כבדים.</em>' },
  { a: 46.3, b: 49.2, top: 318, cls: 'kicker', html: 'נוזל צפוף יותר דוחף חזק יותר כלפי מעלה' },
];
// the kicker under the opening title
CAPS.splice(1, 0, { a: 1.7, b: 5.7, top: 318, cls: 'kicker', html: 'כ־430 מטר מתחת לפני הים · המקום הנמוך ביותר ביבשה' });
for (const c of CAPS) { const el = document.createElement('div'); el.className = 'cap ' + c.cls; el.style.top = c.top + 'px'; el.innerHTML = c.html; hud.appendChild(el); c.el = el; }

const ruler = document.createElement('div'); ruler.id = 'ruler';
ruler.innerHTML = '<div class="bar"></div><div class="len"></div><div class="ref"></div><div class="mag"></div>';
hud.appendChild(ruler);
const [rBar, rLen, rRef, rMag] = ruler.children;
const STEPS = [['1 ס״מ', 'רוחב ציפורן'], ['1 מ״מ', 'גרגר חול'], ['100 מיקרון', 'עובי שערה'], ['10 מיקרון', 'תא דם אדום'],
  ['1 מיקרון', 'חיידק'], ['100 ננומטר', 'נגיף'], ['10 ננומטר', 'חלבון'], ['1 ננומטר', 'מולקולות']];

const legend = document.createElement('div'); legend.id = 'legend';
const css = c => `rgb(${c.map(x => Math.round(Math.min(1, x) * 255)).join(',')})`;
legend.innerHTML = [
  ['O', 'מולקולת מים', 'H<sub>2</sub>O'], ['Cl', 'כלור', 'Cl<sup>−</sup>'], ['Mg', 'מגנזיום', 'Mg<sup>2+</sup>'],
  ['Na', 'נתרן', 'Na<sup>+</sup>'], ['Ca', 'סידן', 'Ca<sup>2+</sup>'], ['K', 'אשלגן', 'K<sup>+</sup>'],
].map(([k, name, f]) => `<div><i style="background:${css(SPEC[k].col)}"></i>${name}<span class="ltr">${f}</span></div>`).join('');
hud.appendChild(legend);

const mkTag = html => { const el = document.createElement('div'); el.className = 'tag'; el.innerHTML = html; hud.appendChild(el); return el; };
const tagMg = mkTag(`יון מגנזיום ${L('Mg<sup>2+</sup>')}`);
const tagDist = mkTag(`${L('0.21')} ננומטר<small>ממרכז היון למרכז החמצן</small>`);
const mkLine = () => { const l = document.createElementNS('http://www.w3.org/2000/svg', 'line'); svg.appendChild(l); return l; };
const lnMeasure = mkLine(), lnMg = mkLine();
const setLine = (l, x1, y1, x2, y2, op) => { l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2); l.style.opacity = op; };
const proj = (v, cam) => { const p = v.clone().project(cam); return [(p.x * 0.5 + 0.5) * W, (1 - (p.y * 0.5 + 0.5)) * H]; };
const ORIGIN = new THREE.Vector3();

const flash = document.getElementById('flash'), black = document.getElementById('black');
function updateHud(t, inMacro, tau) {
  for (const c of CAPS) {
    const op = sm(c.a, c.a + 0.55, t) * (1 - sm(c.b - 0.45, c.b, t));
    c.el.style.opacity = op.toFixed(3);
    c.el.style.transform = `translateY(${((1 - sm(c.a, c.a + 0.8, t)) * 22).toFixed(1)}px)`;
  }
  // scale ruler while zooming
  const d = decades(t);
  const rOp = t < 30 ? sm(13.2, 13.8, t) * (1 - sm(19.5, 20.1, t)) : sm(40.0, 40.4, t) * (1 - sm(41.9, 42.3, t));
  ruler.style.opacity = rOp.toFixed(3);
  if (rOp > 0) {
    const i = Math.min(7, Math.floor(d)), f = d - i;
    rBar.style.width = (40 * Math.pow(10, f)).toFixed(1) + 'px';
    rLen.textContent = STEPS[i][0]; rRef.textContent = STEPS[i][1];
    rMag.textContent = i ? 'הגדלה פי ' + Math.pow(10, i).toLocaleString('en-US') : '\u00a0';
  }
  legend.style.opacity = (sm(23.6, 24.3, t) * (1 - sm(37.6, 38.2, t))).toFixed(3);
  // labels pinned to the hero ion
  const tOp = sm(33.2, 33.9, t) * (1 - sm(37.5, 38.0, t));
  tagMg.style.opacity = tagDist.style.opacity = tOp.toFixed(3);
  if (tOp > 0) {
    const [mx, my] = proj(ORIGIN, nanoCam), [ox, oy] = proj(SHELL_O, nanoCam);
    setLine(lnMeasure, mx, my, ox, oy, tOp);
    const ax = mx - 330, ay = my - 250;
    setLine(lnMg, mx - 16, my - 12, ax + 150, ay + 62, tOp * 0.9);
    tagMg.style.left = (ax - 170) + 'px'; tagMg.style.top = ay + 'px';
    tagDist.style.left = (Math.max(mx, ox) + 60) + 'px'; tagDist.style.top = ((my + oy) / 2 - 10) + 'px';
  } else { lnMeasure.style.opacity = 0; lnMg.style.opacity = 0; }

  const fl = inMacro ? sm(12.25, 12.5, tau) : (t < 30 ? 1 - sm(12.9, 13.7, t) : sm(41.8, 42.35, t));
  flash.style.opacity = fl.toFixed(3);
  black.style.opacity = Math.max(1 - sm(0, 0.9, t), sm(49.2, 49.95, t)).toFixed(3);
}

// ---------------------------------------------------------------- frame
function frame(t) {
  t = clamp(t, 0, DUR);
  const inMacro = t < T_DIVE || t >= T_SURF;
  const tau = macroTau(t);
  renderer.clear();
  if (inMacro) {
    setMacroCam(tau, Math.max(0, t - T_BACK));
    waterMat.uniforms.uTime.value = t;
    floater.position.y = -0.008 + 0.012 * Math.sin(t * 1.3);
    floater.rotation.z = 0.01 * Math.sin(t * 0.9);
    skyMesh.position.copy(macroCam.position);
    renderer.render(macro, macroCam);
  } else {
    const d = decades(t);
    tunnelMat.uniforms.uD.value = d; tunnelMat.uniforms.uTime.value = t;
    renderer.render(bgScene, bgCam);
    if (t > 18.2 && t < 40.3) {
      renderer.clearDepth();
      setNanoCam(t);
      nanoMat.uniforms.uTime.value = t;
      nanoMat.uniforms.uFog.value = 0.40 + 8.0 * Math.pow(Math.max(1 - sm(19.2, 21.4, t), sm(38.5, 40.2, t)), 1.6);
      nanoMat.uniforms.uFogCol.value.setRGB(0.010, 0.034, 0.085);
      renderer.render(nano, nanoCam);
    }
  }
  updateHud(t, inMacro, tau);
}

// ---------------------------------------------------------------- run
window.__frame = frame;
window.__ready = document.fonts.ready.then(() => Promise.all(['400', '700', '900'].map(w => document.fonts.load(`${w} 40px Heebo`, 'אב12')))).then(() => { frame(0); return true; });

if (RENDER) {
  document.body.classList.add('render');
} else {
  const stage = document.getElementById('stage'), btn = document.getElementById('play'), audio = document.getElementById('score');
  const fit = () => { const s = Math.min(innerWidth / W, innerHeight / H); stage.style.transform = `translate(${(innerWidth - W * s) / 2}px,${(innerHeight - H * s) / 2}px) scale(${s})`; };
  addEventListener('resize', fit); fit();
  let t0 = 0, playing = false;
  const loop = () => {
    if (!playing) return;
    const t = (!audio.paused && audio.currentTime > 0) ? audio.currentTime : (performance.now() - t0) / 1000;
    frame(t);
    if (t < DUR) requestAnimationFrame(loop); else { playing = false; btn.style.display = ''; }
  };
  btn.onclick = () => { btn.style.display = 'none'; audio.currentTime = 0; audio.play().catch(() => {}); t0 = performance.now(); playing = true; loop(); };
  const q = new URLSearchParams(location.search).get('t');
  if (q !== null) window.__ready.then(() => frame(parseFloat(q)));
}

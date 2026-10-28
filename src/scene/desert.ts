import * as THREE from 'three';
import { fbm, rng } from './noise';
import { pathZ } from './path';

/** Low dusk sun. Arrakis orbits Canopus; this is it, setting. */
export const SUN_DIR = new THREE.Vector3(-0.55, 0.16, -0.82).normalize();
export const FOG_COLOR = new THREE.Color('#4a3140');

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/**
 * Transverse dunes: a gentle windward rise and a steeper slip face, domain-warped so crests wander,
 * riding on a larger erg undulation. A valley is carved under the path so it never clips.
 */
export function duneHeight(x: number, z: number): number {
  const warp = fbm(x * 0.0021, z * 0.0021, 3) * 5.5;
  const c = (x * 0.55 + z * 0.84) * 0.0145 + warp;
  const p = c - Math.floor(c);
  const crest = p < 0.7 ? smoothstep(0, 0.7, p) : 1 - smoothstep(0.7, 1, p);
  const erg = fbm(x * 0.0011 + 17.3, z * 0.0011 - 4.1, 4);
  let h = Math.pow(crest, 1.35) * (5 + 15 * erg) + erg * 22 - 9;
  const d = Math.abs(z - pathZ(x));
  const valley = smoothstep(14, 120, d);
  h = h * (0.22 + 0.78 * valley) - (1 - valley) * 3;
  return h;
}

/**
 * Grid coordinate warp: dense near the path, stretched toward the horizon, so the desert reaches
 * past the fog line without spending vertices where nobody looks closely.
 */
const warp = (u: number) => 0.3 * u + 0.7 * u * u * u * u * u;

function buildTerrain(): THREE.Mesh {
  const X_MAX = 7000;
  const Z_MAX = 6000;
  const geo = new THREE.PlaneGeometry(2, 2, 420, 280);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, warp(pos.getX(i)) * X_MAX);
    pos.setZ(i, warp(pos.getZ(i)) * Z_MAX);
  }
  const colors = new Float32Array(pos.count * 3);
  const trough = new THREE.Color('#7a4526');
  const flank = new THREE.Color('#b9733d');
  const crest = new THREE.Color('#e3a463');
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = duneHeight(x, z);
    pos.setY(i, h);
    const k = smoothstep(-8, 26, h);
    tmp.copy(trough).lerp(flank, Math.min(k * 1.6, 1));
    if (k > 0.6) tmp.lerp(crest, (k - 0.6) / 0.4);
    const n = fbm(x * 0.02, z * 0.02, 2) * 0.16 - 0.08;
    tmp.offsetHSL(n * 0.08, 0, n);
    tmp.toArray(colors, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'desert';
  return mesh;
}

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vDir = normalize(wp.xyz - cameraPosition);
    gl_Position = projectionMatrix * viewMatrix * wp;
    gl_Position.z = gl_Position.w; // pin to far plane
  }
`;

const skyFragment = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uZenith;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  uniform vec3 uSunGlow;
  uniform vec3 uBelow;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float y = d.y;
    float sunAmt = max(dot(d, uSunDir), 0.0);
    vec3 col;
    if (y >= 0.0) {
      col = mix(uHorizon, uMid, smoothstep(0.0, 0.22, y));
      col = mix(col, uZenith, smoothstep(0.18, 0.75, y));
    } else {
      col = mix(uHorizon, uBelow, smoothstep(0.0, 0.12, -y));
    }
    // Warm the horizon toward the sun, then the disc and halo.
    col += uSunGlow * pow(sunAmt, 6.0) * 0.55 * (1.0 - smoothstep(0.0, 0.5, y));
    col += uSunGlow * pow(sunAmt, 90.0) * 1.6;
    col += vec3(1.0, 0.85, 0.6) * smoothstep(0.9993, 0.9997, sunAmt) * 4.0;
    gl_FragColor = vec4(col, 1.0);
  }
`;

function buildSky(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uSunDir: { value: SUN_DIR.clone() },
      uZenith: { value: new THREE.Color('#07060f') },
      uMid: { value: new THREE.Color('#2a1d38') },
      uHorizon: { value: new THREE.Color('#8a4d45') },
      uSunGlow: { value: new THREE.Color('#ff9a52') },
      uBelow: { value: FOG_COLOR.clone() },
    },
    vertexShader: skyVertex,
    fragmentShader: skyFragment,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(6000, 48, 24), mat);
  mesh.name = 'sky';
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}

function buildStars(): THREE.Points {
  const rand = rng(10191);
  const N = 2600;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const c = new THREE.Color();
  let n = 0;
  while (n < N) {
    const u = rand() * 2 - 1;
    const th = rand() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    const v = new THREE.Vector3(r * Math.cos(th), u, r * Math.sin(th));
    if (v.y < 0.04) continue;
    v.multiplyScalar(5200);
    v.toArray(pos, n * 3);
    const fade = smoothstep(0.04, 0.4, u);
    const b = (0.35 + rand() * 0.9) * fade;
    c.setHSL(0.08 + rand() * 0.55, 0.35, 0.75).multiplyScalar(b);
    c.toArray(col, n * 3);
    n++;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 1.6,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.name = 'stars';
  return pts;
}

/**
 * Moon disc on a canvas. The second moon carries the shadow Fremen read as Muad'Dib,
 * the desert mouse — "the one who points the way".
 */
function moonTexture(withMouse: boolean, seed: number): THREE.CanvasTexture {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  const rand = rng(seed);
  const grad = g.createRadialGradient(S * 0.42, S * 0.4, S * 0.05, S / 2, S / 2, S * 0.48);
  grad.addColorStop(0, '#fff7ea');
  grad.addColorStop(0.7, '#e9dcc6');
  grad.addColorStop(1, '#bfae97');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(S / 2, S / 2, S * 0.47, 0, Math.PI * 2);
  g.fill();
  g.save();
  g.clip();
  for (let i = 0; i < 26; i++) {
    const x = S * (0.15 + rand() * 0.7);
    const y = S * (0.15 + rand() * 0.7);
    const r = S * (0.015 + rand() * 0.06);
    g.fillStyle = `rgba(120, 100, 85, ${0.12 + rand() * 0.18})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  if (withMouse) {
    g.fillStyle = 'rgba(96, 78, 66, 0.42)';
    g.beginPath();
    g.ellipse(S * 0.5, S * 0.56, S * 0.17, S * 0.1, -0.25, 0, Math.PI * 2); // body
    g.fill();
    g.beginPath();
    g.ellipse(S * 0.33, S * 0.47, S * 0.075, S * 0.06, -0.4, 0, Math.PI * 2); // head
    g.fill();
    g.beginPath();
    g.arc(S * 0.34, S * 0.39, S * 0.045, 0, Math.PI * 2); // ear
    g.fill();
    g.strokeStyle = 'rgba(96, 78, 66, 0.4)';
    g.lineWidth = S * 0.02;
    g.beginPath(); // tail
    g.moveTo(S * 0.66, S * 0.6);
    g.quadraticCurveTo(S * 0.82, S * 0.72, S * 0.76, S * 0.84);
    g.stroke();
  }
  g.restore();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildMoon(dir: THREE.Vector3, size: number, withMouse: boolean, seed: number): THREE.Sprite {
  const mat = new THREE.SpriteMaterial({
    map: moonTexture(withMouse, seed),
    fog: false,
    depthWrite: false,
    transparent: true,
  });
  mat.color.setScalar(1.15);
  const s = new THREE.Sprite(mat);
  s.position.copy(dir.clone().normalize().multiplyScalar(5000));
  s.scale.setScalar(size);
  s.renderOrder = -9;
  return s;
}

const sandVertex = /* glsl */ `
  uniform float uTime;
  uniform vec3 uCenter;
  uniform vec3 uBox;
  uniform float uPixelRatio;
  attribute float aSeed;
  varying float vAlpha;
  void main() {
    vec3 wind = vec3(9.0, 0.6, 3.5) * (0.6 + aSeed);
    vec3 p = position + wind * uTime;
    p.y += sin(uTime * 0.7 + aSeed * 40.0) * 1.5;
    vec3 rel = mod(p - uCenter + uBox * 0.5, uBox) - uBox * 0.5;
    vec4 mv = modelViewMatrix * vec4(uCenter + rel, 1.0);
    gl_Position = projectionMatrix * mv;
    float dist = -mv.z;
    gl_PointSize = clamp(90.0 / dist, 0.6, 3.0) * uPixelRatio;
    vAlpha = (1.0 - smoothstep(60.0, 220.0, dist)) * (0.3 + 0.5 * aSeed);
  }
`;

const sandFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.1, length(c)) * vAlpha;
    gl_FragColor = vec4(vec3(1.0, 0.72, 0.42) * 0.9, a);
  }
`;

function buildSand(): { points: THREE.Points; uniforms: Record<string, THREE.IUniform> } {
  const N = 2400;
  const rand = rng(2024);
  const box = new THREE.Vector3(420, 50, 420);
  const pos = new Float32Array(N * 3);
  const seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (rand() - 0.5) * box.x;
    pos[i * 3 + 1] = rand() * box.y;
    pos[i * 3 + 2] = (rand() - 0.5) * box.z;
    seed[i] = rand();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const uniforms = {
    uTime: { value: 0 },
    uCenter: { value: new THREE.Vector3() },
    uBox: { value: box },
    uPixelRatio: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: sandVertex,
    fragmentShader: sandFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.name = 'sand';
  return { points, uniforms };
}

export interface Desert {
  group: THREE.Group;
  tick: (time: number, focus: THREE.Vector3, eye: THREE.Vector3, pixelRatio: number) => void;
  setWind: (on: boolean) => void;
}

export function createDesert(): Desert {
  const group = new THREE.Group();
  group.add(buildTerrain());
  // Sky, stars and moons ride with the camera so they show no parallax.
  const celestial = new THREE.Group();
  celestial.add(buildSky());
  celestial.add(buildStars());
  celestial.add(buildMoon(new THREE.Vector3(0.5, 0.42, 0.75), 300, false, 7));
  celestial.add(buildMoon(new THREE.Vector3(0.82, 0.26, 0.5), 170, true, 11));
  group.add(celestial);

  const hemi = new THREE.HemisphereLight('#8c7bb3', '#4a2a1c', 1.1);
  group.add(hemi);
  const sun = new THREE.DirectionalLight('#ffad70', 2.6);
  sun.position.copy(SUN_DIR).multiplyScalar(1000);
  group.add(sun);
  // Cool fill from the moons' side so slip faces are not black.
  const moonFill = new THREE.DirectionalLight('#7f8fd6', 0.45);
  moonFill.position.set(0.6, 0.5, 0.7).multiplyScalar(1000);
  group.add(moonFill);

  const sand = buildSand();
  group.add(sand.points);
  let wind = true;
  let windTime = 0;
  let last = 0;

  return {
    group,
    tick(time, focus, eye, pixelRatio) {
      celestial.position.copy(eye);
      const dt = Math.min(time - last, 0.1);
      last = time;
      if (wind) windTime += dt;
      sand.uniforms.uTime.value = windTime;
      (sand.uniforms.uCenter.value as THREE.Vector3).set(focus.x, 0, focus.z);
      sand.uniforms.uPixelRatio.value = pixelRatio;
    },
    setWind(on) {
      wind = on;
    },
  };
}

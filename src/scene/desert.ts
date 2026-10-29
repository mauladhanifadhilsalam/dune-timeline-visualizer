import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fbm, rng } from './noise';
import { GoldenPath, PATH_HALF_X, pathZ } from './path';

/** Low dusk sun. Arrakis orbits Canopus; this is it, setting. */
export const SUN_DIR = new THREE.Vector3(-0.55, 0.16, -0.82).normalize();
export const FOG_COLOR = new THREE.Color('#6a3f45');

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

/** How many flattened pads the terrain shader supports at once. */
export const MAX_PADS = 4;
/** Points in the river course the terrain carves (a polyline sampled from a smooth curve). */
export const RIVER_POINTS = 16;
/**
 * The river's plain: how far beyond its banks the dunes are levelled, and how far above the water
 * they are left. A river through Leto II's green has a flood plain; and without one, the dunes
 * between the path and the water hide the river from the low camera.
 */
export const RIVER_PLAIN = 110;
const PLAIN_RISE = 2.5;

/** A river channel cut into the terrain, in world coordinates. */
export interface RiverCourse {
  points: THREE.Vector2[];
  halfWidth: number;
  bank: number;
  /** Water surface height; the bed is cut below it. */
  level: number;
  /** 0..1: how much of the channel is cut (eased with the river's visibility). */
  amount: number;
}

/** A t-range on the path [rampIn0, rampIn1, rampOut0, rampOut1]; t outside [0, 1] disables it. */
export type Band = [number, number, number, number];
const OFF: Band = [2, 2, 3, 3];

/** Distance from (x, z) to a polyline. */
function polylineDistance(x: number, z: number, pts: readonly THREE.Vector2[]): number {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i].x;
    const az = pts[i].y;
    const bx = pts[i + 1].x - ax;
    const bz = pts[i + 1].y - az;
    const h = Math.min(Math.max(((x - ax) * bx + (z - az) * bz) / Math.max(bx * bx + bz * bz, 1e-4), 0), 1);
    d = Math.min(d, Math.hypot(x - ax - bx * h, z - az - bz * h));
  }
  return d;
}

/**
 * The ground at (x, z) with a river's plain levelled and its channel cut, as the terrain shader
 * does them (at full strength): for things that must stand on that ground, like a road.
 */
export function riverGround(x: number, z: number, r: Omit<RiverCourse, 'amount'>): number {
  const h = duneHeight(x, z);
  const d = polylineDistance(x, z, r.points);
  const bank = r.halfWidth + r.bank;
  const plain = 1 - smoothstep(bank, bank + RIVER_PLAIN, d);
  let y = h + (Math.min(h, r.level + PLAIN_RISE) - h) * plain;
  const rm = 1 - smoothstep(r.halfWidth, bank, d);
  y += (Math.min(y, r.level - 5) - y) * rm;
  return y;
}

/** A flattened, tinted disc of ground for a city or a spice field. */
export interface Pad {
  x: number;
  z: number;
  radius: number;
  y: number;
  tint: THREE.Color;
  amount: number;
}

/**
 * Uniforms shared by the terrain and the trees. The ground knows, per vertex, which moment of the
 * timeline it lies beside (aPathT), so eras can colour it: green under Leto II, scorched glass
 * where the Honored Matres burned Rakis.
 */
const eco = {
  uGreen: { value: new THREE.Vector4(...OFF) },
  uGreenVis: { value: 0 },
  uScorchVis: { value: 0 },
  uScorch: { value: new THREE.Vector4(...OFF) },
  uPads: { value: Array.from({ length: MAX_PADS }, () => new THREE.Vector4()) },
  uPadTint: { value: Array.from({ length: MAX_PADS }, () => new THREE.Vector4()) },
  /** A circle kept as desert whatever the era (x, z, radius, amount): Leto II's Sareer. */
  uDesert: { value: new THREE.Vector4() },
  /** River course points (world x, z) and (half width, level, amount, bank). */
  uRiverPts: { value: Array.from({ length: RIVER_POINTS }, () => new THREE.Vector2()) },
  uRiver: { value: new THREE.Vector4() },
  /** Bounding circle of the course (x, z, radius), so far-off vertices skip the distance loop. */
  uRiverBounds: { value: new THREE.Vector3() },
  uRoad: { value: new THREE.Vector4() },
  uRoadOn: { value: 0 },
};

const ECO_COMMON = /* glsl */ `
  uniform vec4 uGreen;
  uniform float uGreenVis;
  uniform vec4 uScorch;
  uniform float uScorchVis;
  uniform vec4 uDesert;
  uniform vec2 uRiverPts[${RIVER_POINTS}];
  uniform vec4 uRiver;
  uniform vec3 uRiverBounds;
  uniform vec4 uRoad;
  uniform float uRoadOn;
  // Distance to the road a procession walks (very large when there is none).
  float roadDist(vec2 p) {
    vec2 ba = uRoad.zw - uRoad.xy;
    if (dot(ba, ba) < 1.0) return 1e9;
    vec2 pa = p - uRoad.xy;
    return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
  }
  float ecoBand(vec4 r, float t) { return smoothstep(r.x, r.y, t) * (1.0 - smoothstep(r.z, r.w, t)); }
  // Distance to the river's centre line (very large when there is no river, or far from it).
  float riverDist(vec2 p, float margin) {
    if (uRiver.z <= 0.0 || length(p - uRiverBounds.xy) > uRiverBounds.z + margin) return 1e9;
    float d = 1e9;
    for (int i = 0; i < ${RIVER_POINTS - 1}; i++) {
      vec2 a = uRiverPts[i];
      vec2 ba = uRiverPts[i + 1] - a;
      vec2 pa = p - a;
      float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
      d = min(d, length(pa - ba * h));
    }
    return d;
  }
  // 1 in the river channel, falling to 0 across the banks.
  float riverMask(vec2 p) {
    return uRiver.z * (1.0 - smoothstep(uRiver.x, uRiver.x + uRiver.w, riverDist(p, 0.0)));
  }
  // 1 on the river's plain, falling to 0 a little way beyond it.
  float riverPlain(vec2 p) {
    float bank = uRiver.x + uRiver.w;
    return uRiver.z * (1.0 - smoothstep(bank, bank + ${RIVER_PLAIN.toFixed(1)}, riverDist(p, ${RIVER_PLAIN.toFixed(1)})));
  }
  float desertMask(vec2 xz) {
    if (uDesert.z <= 0.0) return 0.0;
    return uDesert.w * (1.0 - smoothstep(uDesert.z - 14.0, uDesert.z + 4.0, length(xz - uDesert.xy)));
  }
`;

function terrainShader(shader: THREE.WebGLProgramParametersWithUniforms): void {
  Object.assign(shader.uniforms, eco);
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      /* glsl */ `#include <common>
      ${ECO_COMMON}
      attribute float aPathT;
      attribute float aPathDist;
      uniform vec4 uPads[${MAX_PADS}];
      uniform vec4 uPadTint[${MAX_PADS}];
      varying float vGreen;
      varying float vScorch;
      varying vec3 vPadCol;
      varying float vPadA;
      varying vec2 vXZ;
      varying float vRiver;
      float padMask(vec2 xz, vec4 p) {
        if (p.z <= 0.0) return 0.0;
        return 1.0 - smoothstep(p.z * 0.72, p.z, length(xz - p.xy));
      }`,
    )
    .replace(
      '#include <beginnormal_vertex>',
      /* glsl */ `#include <beginnormal_vertex>
      float pms[${MAX_PADS}];
      float pmMax = 0.0;
      for (int i = 0; i < ${MAX_PADS}; i++) {
        pms[i] = padMask(position.xz, uPads[i]);
        pmMax = max(pmMax, pms[i]);
      }
      float rm = riverMask(position.xz);
      float rp = riverPlain(position.xz);
      objectNormal = normalize(mix(objectNormal, vec3(0.0, 1.0, 0.0), max(max(pmMax, rm * 0.6), rp * 0.8)));`,
    )
    .replace(
      '#include <begin_vertex>',
      /* glsl */ `#include <begin_vertex>
      vPadA = 0.0;
      vPadCol = vec3(0.0);
      for (int i = 0; i < ${MAX_PADS}; i++) {
        transformed.y = mix(transformed.y, uPads[i].w, pms[i]);
        vPadA += uPadTint[i].a * pms[i];
        vPadCol += uPadTint[i].rgb * uPadTint[i].a * pms[i];
      }
      vPadA = min(vPadA, 1.0);
      // The river levels its plain, then cuts its bed below the water line; ground already lower is
      // left alone. riverGround() in JS does the same, for things that stand on it.
      transformed.y = mix(transformed.y, min(transformed.y, uRiver.y + ${PLAIN_RISE.toFixed(1)}), rp);
      transformed.y = mix(transformed.y, min(transformed.y, uRiver.y - 5.0), rm);
      vRiver = rm;
      vGreen = uGreenVis * ecoBand(uGreen, aPathT) * (1.0 - smoothstep(380.0, 720.0, aPathDist));
      vGreen *= (1.0 - desertMask(position.xz)) * (1.0 - rm * 0.85);
      vScorch = uScorchVis * ecoBand(uScorch, aPathT) * (1.0 - smoothstep(180.0, 480.0, aPathDist));
      vXZ = position.xz;`,
    );
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      /* glsl */ `#include <common>
      varying float vGreen;
      varying float vScorch;
      varying vec3 vPadCol;
      varying float vPadA;
      varying vec2 vXZ;
      varying float vRiver;`,
    )
    .replace(
      '#include <color_fragment>',
      /* glsl */ `#include <color_fragment>
      float lumV = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
      diffuseColor.rgb = diffuseColor.rgb * (1.0 - vPadA) + vPadCol * (0.7 + 0.9 * lumV);
      vec3 grass = mix(vec3(0.09, 0.2, 0.05), vec3(0.26, 0.38, 0.1), smoothstep(0.08, 0.3, lumV));
      diffuseColor.rgb = mix(diffuseColor.rgb, grass, vGreen);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.06, 0.045, 0.04), vScorch);
      // Wet mud on the banks.
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.11, 0.07), vRiver * 0.75);`,
    )
    .replace(
      '#include <roughnessmap_fragment>',
      /* glsl */ `#include <roughnessmap_fragment>
      roughnessFactor = mix(roughnessFactor, 0.32, vScorch);`,
    )
    .replace(
      '#include <emissivemap_fragment>',
      /* glsl */ `#include <emissivemap_fragment>
      // Sparse embers still glowing in the fused sand.
      float ember = 0.5 + 0.5 * sin(vXZ.x * 0.13) * sin(vXZ.y * 0.11 + sin(vXZ.x * 0.05) * 3.0);
      totalEmissiveRadiance += vec3(1.0, 0.3, 0.06) * vScorch * pow(ember, 14.0) * 0.9;`,
    );
}

function buildTerrain(path: GoldenPath): THREE.Mesh {
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
  const pathT = new Float32Array(pos.count);
  const pathDist = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const cx = Math.min(Math.max(x, -PATH_HALF_X), PATH_HALF_X);
    pathT[i] = path.tAtX(x);
    pathDist[i] = Math.abs(pos.getZ(i) - pathZ(cx)) + Math.abs(x - cx);
  }
  geo.setAttribute('aPathT', new THREE.BufferAttribute(pathT, 1));
  geo.setAttribute('aPathDist', new THREE.BufferAttribute(pathDist, 1));
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    metalness: 0,
  });
  mat.onBeforeCompile = terrainShader;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'desert';
  return mesh;
}

/**
 * Leto II's forests. Planted once along the stretch of path any reckoning or scale could give the
 * God Emperor; each tree grows or shrinks to nothing in the vertex shader as the green band moves.
 */
function buildTrees(path: GoldenPath): THREE.InstancedMesh {
  const rand = rng(13725);
  const trunk = new THREE.CylinderGeometry(0.28, 0.42, 3.2, 6).translate(0, 1.6, 0);
  const crown = new THREE.ConeGeometry(2.3, 6.5, 7).translate(0, 6.2, 0);
  const top = new THREE.ConeGeometry(1.5, 4.2, 7).translate(0, 9.2, 0);
  const paint = (g: THREE.BufferGeometry, hex: string) => {
    const c = new THREE.Color(hex);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.toArray(arr, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g;
  };
  const geo = mergeGeometries([paint(trunk, '#5a3d27'), paint(crown, '#4b6e33'), paint(top, '#62873f')]);
  const N = 2200;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  const aT = new Float32Array(N);
  const aD = new Float32Array(N);
  const aSeed = new Float32Array(N);
  const x0 = -PATH_HALF_X + PATH_HALF_X * 2 * 0.45;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < N; i++) {
    const x = x0 + rand() * (PATH_HALF_X - x0);
    const r = Math.pow(rand(), 0.9);
    // +z is the camera's side of the path (CAMERA_SIDE in app.ts): the forest there starts beyond
    // where the camera rides, so no tree stands between it and the scenes behind the path.
    const side = rand() < 0.5 ? -1 : 1;
    const d = side > 0 ? 140 + r * 200 : 18 + r * 320;
    const z = pathZ(x) + side * d;
    const s = 1.1 + rand() * 1.8;
    q.setFromAxisAngle(up, rand() * Math.PI * 2);
    m.compose(new THREE.Vector3(x, duneHeight(x, z) - 0.6, z), q, new THREE.Vector3(s, s * (0.8 + rand() * 0.5), s));
    mesh.setMatrixAt(i, m);
    aT[i] = path.tAtX(x);
    aD[i] = d;
    aSeed[i] = rand();
  }
  mesh.geometry.setAttribute('aPathT', new THREE.InstancedBufferAttribute(aT, 1));
  mesh.geometry.setAttribute('aPathDist', new THREE.InstancedBufferAttribute(aD, 1));
  mesh.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(aSeed, 1));
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, eco);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        ${ECO_COMMON}
        attribute float aPathT;
        attribute float aPathDist;
        attribute float aSeed;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float g = uGreenVis * ecoBand(uGreen, aPathT) * (1.0 - smoothstep(200.0, 330.0, aPathDist));
        // No forest inside the Sareer.
        vec2 treeXZ = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;
        g *= 1.0 - desertMask(treeXZ);
        // Nor on the river's plain: meadow either side of it, so the water shows from the path, and
        // no tree stands on ground the plain has levelled from under it.
        float meadow = uRiver.x + uRiver.w + ${RIVER_PLAIN.toFixed(1)};
        g *= mix(1.0, smoothstep(meadow - 40.0, meadow, riverDist(treeXZ, meadow)), uRiver.z);
        // Nor on a road through the forest.
        g *= mix(1.0, smoothstep(22.0, 36.0, roadDist(treeXZ)), uRoadOn);
        transformed *= clamp(g * 1.5 - aSeed * 0.5, 0.0, 1.0);`,
      );
  };
  mesh.frustumCulled = false;
  mesh.name = 'forest';
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
  // Additive, so a faint star fades into a bright dusk sky instead of showing as a dark speck.
  const mat = new THREE.PointsMaterial({
    size: 1.6,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
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
  uniform float uSize;
  uniform float uIntensity;
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
    gl_PointSize = clamp(90.0 * uSize / dist, 0.6, 3.0 * uSize) * uPixelRatio;
    vAlpha = uIntensity * (1.0 - smoothstep(60.0, 220.0, dist)) * (0.3 + 0.5 * aSeed);
  }
`;

const sandFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.1, length(c)) * vAlpha;
    gl_FragColor = vec4(uColor, a);
  }
`;

function buildSand(
  N = 2400,
  color = new THREE.Color(1, 0.72, 0.42).multiplyScalar(0.9),
  size = 1,
  seedValue = 2024,
): { points: THREE.Points; uniforms: Record<string, THREE.IUniform> } {
  const rand = rng(seedValue);
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
    uSize: { value: size },
    uIntensity: { value: 1 },
    uColor: { value: color },
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
  /** Where on the path (t) the ground is green and where it is scorched. */
  setEcology: (green: Band | null, scorch: Band | null) => void;
  /** Up to MAX_PADS flattened pads (city, spice field, launch apron…). */
  setPads: (pads: Pad[]) => void;
  /** A circle of ground kept as open desert, even where the era has turned it green. */
  setDesertPatch: (patch: { x: number; z: number; radius: number; amount: number } | null) => void;
  /** A river channel cut through the terrain (and its forest). */
  setRiver: (river: RiverCourse | null) => void;
  /** A straight road the forest is cleared along, from one end to the other, faded in by `amount`. */
  setRoad: (road: [THREE.Vector2, THREE.Vector2] | null, amount: number) => void;
  /** 0..1: how thick the glowing spice motes hang in the air around the camera. */
  setSpice: (level: number) => void;
  /** 0..1 each: how much of the green and scorched bands show, given where the camera is in time. */
  setEcologyVisibility: (green: number, scorch: number) => void;
}

export function createDesert(path: GoldenPath): Desert {
  const group = new THREE.Group();
  group.add(buildTerrain(path));
  group.add(buildTrees(path));
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
  // Melange in the air: fewer, larger, cinnamon-bright motes that feed the bloom.
  const spice = buildSand(900, new THREE.Color(1.0, 0.42, 0.12).multiplyScalar(2.2), 1.6, 10191);
  spice.points.name = 'spice';
  group.add(spice.points);
  let spiceLevel = 0;
  let spiceTarget = 0;
  let greenTarget = 0;
  let scorchTarget = 0;
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
      for (const f of [sand, spice]) {
        f.uniforms.uTime.value = windTime;
        (f.uniforms.uCenter.value as THREE.Vector3).set(focus.x, 0, focus.z);
        f.uniforms.uPixelRatio.value = pixelRatio;
      }
      spiceLevel += (spiceTarget - spiceLevel) * Math.min(dt * 1.5, 1);
      spice.uniforms.uIntensity.value = spiceLevel;
      spice.points.visible = spiceLevel > 0.01;
      eco.uGreenVis.value += (greenTarget - eco.uGreenVis.value) * Math.min(dt * 1.2, 1);
      eco.uScorchVis.value += (scorchTarget - eco.uScorchVis.value) * Math.min(dt * 1.2, 1);
    },
    setWind(on) {
      wind = on;
    },
    setEcology(green, scorch) {
      eco.uGreen.value.set(...(green ?? OFF));
      eco.uScorch.value.set(...(scorch ?? OFF));
    },
    setPads(pads) {
      for (let i = 0; i < MAX_PADS; i++) {
        const p = pads[i];
        if (p) {
          eco.uPads.value[i].set(p.x, p.z, p.radius, p.y);
          eco.uPadTint.value[i].set(p.tint.r, p.tint.g, p.tint.b, p.amount);
        } else {
          eco.uPads.value[i].set(0, 0, 0, 0);
          eco.uPadTint.value[i].set(0, 0, 0, 0);
        }
      }
    },
    setRiver(r) {
      if (!r || r.amount <= 0.001) {
        eco.uRiver.value.set(0, 0, 0, 0);
        return;
      }
      let cx = 0;
      let cz = 0;
      for (const p of r.points) {
        cx += p.x / r.points.length;
        cz += p.y / r.points.length;
      }
      let rad = 0;
      for (let i = 0; i < RIVER_POINTS; i++) {
        const p = r.points[Math.min(i, r.points.length - 1)];
        eco.uRiverPts.value[i].copy(p);
        rad = Math.max(rad, Math.hypot(p.x - cx, p.y - cz));
      }
      eco.uRiver.value.set(r.halfWidth, r.level, r.amount, r.bank);
      eco.uRiverBounds.value.set(cx, cz, rad + r.halfWidth + r.bank + 10);
    },
    setRoad(road, amount) {
      if (road) eco.uRoad.value.set(road[0].x, road[0].y, road[1].x, road[1].y);
      eco.uRoadOn.value = road ? amount : 0;
    },
    setDesertPatch(p) {
      if (p) eco.uDesert.value.set(p.x, p.z, p.radius, p.amount);
      else eco.uDesert.value.set(0, 0, 0, 0);
    },
    setSpice(level) {
      spiceTarget = level;
    },
    setEcologyVisibility(green, scorch) {
      // Eased, so stepping across an era boundary grows the forest rather than switching it on.
      greenTarget = green;
      scorchTarget = scorch;
    },
  };
}

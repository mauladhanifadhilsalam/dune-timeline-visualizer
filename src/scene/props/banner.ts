import * as THREE from 'three';

/**
 * The Atreides banner. Dune gives its colours, "the green and black Atreides banner" at the head of
 * Paul's legions, and puts a hawk on the ducal crest; nothing more. This is our own reading of that:
 * black over green, with the hawk of the crest displayed across the division in gold, inside a gold
 * edge. (It is deliberately not the 2021 film's banner, which is that studio's design.)
 */

/** Shared clock for every banner's flutter; WorldProps advances it each frame. */
export const bannerClock: THREE.IUniform<number> = { value: 0 };

const BLACK = '#121311';
const GREEN = '#1f5d3b';
const GOLD = '#d9b467';
const EDGE = '#8a6a35';

type Pt = [number, number];

/**
 * The hawk displayed, as heraldry draws a bird: wings raised and spread with fingered primaries,
 * tail fanned, head in profile to the left with a hooked beak. In a 200 x 200 box centred on
 * (100, 100); the left wing is the right one mirrored.
 */
const HAWK: { parts: Pt[][]; eye: [number, number, number] } = (() => {
  const wing: Pt[] = [
    [110, 78], [128, 60], [150, 42], [172, 26], [192, 16], [194, 30],
    [182, 36], [196, 46], [182, 52], [194, 64], [178, 68], [188, 82],
    [170, 84], [176, 100], [158, 96], [160, 112], [142, 104], [138, 116], [118, 108],
  ];
  const body: Pt[] = [[100, 70], [114, 82], [118, 104], [112, 132], [100, 144], [88, 132], [82, 104], [86, 82]];
  const tail: Pt[] = [[90, 136], [78, 176], [90, 170], [96, 184], [100, 172], [104, 184], [110, 170], [122, 176], [110, 136]];
  const head: Pt[] = [
    [106, 74], [99, 74], [94, 64], [92, 58], [84, 57], [79, 61], [76, 56], [80, 50],
    [89, 46], [94, 41], [102, 38], [110, 40], [115, 47], [113, 57], [109, 65],
  ];
  const legs: Pt[][] = [
    [[92, 136], [86, 150], [80, 152], [84, 154], [88, 152], [92, 154], [94, 140]],
    [[108, 136], [114, 150], [120, 152], [116, 154], [112, 152], [108, 154], [106, 140]],
  ];
  const mirror = (p: Pt[]): Pt[] => p.map(([x, y]) => [200 - x, y]);
  return { parts: [wing, mirror(wing), tail, ...legs, body, head], eye: [101, 49, 2.2] };
})();

/** Draws the hawk centred on (cx, cy), `scale` times its 200-unit box. */
function hawk(g: CanvasRenderingContext2D, cx: number, cy: number, scale: number): void {
  g.save();
  g.translate(cx, cy);
  g.scale(scale, scale);
  g.translate(-100, -100);
  const trace = (poly: Pt[]) => {
    g.beginPath();
    poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
  };
  // Outline every part first and fill them all on top, so only the outer silhouette keeps an edge.
  g.strokeStyle = EDGE;
  g.lineWidth = 2.4;
  g.lineJoin = 'round';
  for (const p of HAWK.parts) {
    trace(p);
    g.stroke();
  }
  g.fillStyle = GOLD;
  for (const p of HAWK.parts) {
    trace(p);
    g.fill();
  }
  const [ex, ey, er] = HAWK.eye;
  g.fillStyle = BLACK;
  g.beginPath();
  g.arc(ex, ey, er, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** Black over green, split at `split` of the height, inside a gold edge. */
function field(g: CanvasRenderingContext2D, w: number, h: number, split: number): void {
  g.fillStyle = BLACK;
  g.fillRect(0, 0, w, h * split);
  g.fillStyle = GREEN;
  g.fillRect(0, h * split, w, h - h * split);
  const u = Math.min(w, h);
  g.strokeStyle = GOLD;
  g.lineWidth = Math.max(2, u * 0.02);
  g.strokeRect(u * 0.06, u * 0.06, w - u * 0.12, h - u * 0.12);
}

function canvasTexture(cv: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** The flag: the hawk spread across the middle, over the division. */
function flagTexture(): THREE.CanvasTexture {
  const W = 1024;
  const H = 536;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d')!;
  field(g, W, H, 0.5);
  hawk(g, W / 2, H / 2, (H * 0.88) / 200);
  return canvasTexture(cv);
}

/** A long hanging: black above, green below, the hawk on the division near the top, a swallowtail. */
function hangingTexture(): THREE.CanvasTexture {
  const W = 160;
  const H = 1280;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d')!;
  field(g, W, H, 0.16);
  hawk(g, W / 2, H * 0.165, (W * 0.85) / 200);
  // Swallowtail: cut a notch out of the bottom edge (alpha-tested away).
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  g.moveTo(0, H);
  g.lineTo(W / 2, H * 0.92);
  g.lineTo(W, H);
  g.closePath();
  g.fill();
  return canvasTexture(cv);
}

let textures: { flag: THREE.CanvasTexture; hanging: THREE.CanvasTexture } | null = null;

/**
 * Cloth that ripples in the wind. 'flag' hangs from a pole at its left edge and streams to +X;
 * 'hanging' hangs from its top edge down -Y. The ripple grows away from the fixed edge, and the
 * normal follows it so the folds catch the low sun.
 */
export function createBanner(kind: 'flag' | 'hanging', width: number, height: number, phase = Math.random() * 10): THREE.Mesh {
  textures ??= { flag: flagTexture(), hanging: hangingTexture() };
  const map = kind === 'flag' ? textures.flag : textures.hanging;
  const geo =
    kind === 'flag'
      ? new THREE.PlaneGeometry(width, height, 24, 6).translate(width / 2, -height / 2, 0)
      : new THREE.PlaneGeometry(width, height, 6, 24).translate(0, -height / 2, 0);
  const mat = new THREE.MeshStandardMaterial({
    map,
    // A little self-light so the green still reads as green in the dusk.
    emissive: '#ffffff',
    emissiveMap: map,
    emissiveIntensity: 0.32,
    roughness: 0.9,
    side: THREE.DoubleSide,
    alphaTest: 0.5,
  });
  const span = kind === 'flag' ? width : height;
  const amp = kind === 'flag' ? height * 0.16 : width * 0.12;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = bannerClock;
    shader.uniforms.uPhase = { value: phase };
    const common = /* glsl */ `
      uniform float uTime;
      uniform float uPhase;
      // Distance from the fixed edge, along the cloth.
      float clothCoord(vec3 p) { return ${kind === 'flag' ? 'p.x' : '-p.y'}; }
      float clothWave(float c) {
        float w = uTime * ${kind === 'flag' ? '4.2' : '1.6'} + uPhase;
        float k = ${(6.0 / span).toFixed(5)};
        return sin(c * k - w) + 0.35 * sin(c * k * 2.3 - w * 1.7);
      }
      float clothSlope(float c) {
        float w = uTime * ${kind === 'flag' ? '4.2' : '1.6'} + uPhase;
        float k = ${(6.0 / span).toFixed(5)};
        return k * (cos(c * k - w) + 0.805 * cos(c * k * 2.3 - w * 1.7));
      }
    `;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${common}`)
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        {
          float c = clothCoord(position);
          float a = ${amp.toFixed(3)} * clamp(c / ${span.toFixed(3)}, 0.0, 1.0);
          float dz = a * clothSlope(c);
          objectNormal = normalize(${kind === 'flag' ? 'vec3(-dz, 0.0, 1.0)' : 'vec3(0.0, dz, 1.0)'});
        }`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          float c = clothCoord(position);
          transformed.z += ${amp.toFixed(3)} * clamp(c / ${span.toFixed(3)}, 0.0, 1.0) * clothWave(c);
        }`,
      );
  };
  // Every banner compiles to its own program because the constants differ; keep the key distinct.
  mat.customProgramCacheKey = () => `banner-${kind}-${width}-${height}`;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

/** A pole with a banner flying from its top. */
export function createBannerPole(height: number, flagW: number, flagH: number): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.6, height, 8).translate(0, height / 2, 0),
    new THREE.MeshStandardMaterial({ color: '#3b3530', metalness: 0.6, roughness: 0.5 }),
  );
  const finial = new THREE.Mesh(
    new THREE.SphereGeometry(1, 10, 8),
    new THREE.MeshStandardMaterial({ color: '#c9a66b', metalness: 0.8, roughness: 0.3 }),
  );
  finial.position.y = height + 0.6;
  const flag = createBanner('flag', flagW, flagH);
  flag.name = 'flag';
  flag.position.y = height - 0.5;
  g.add(pole, finial, flag);
  return g;
}

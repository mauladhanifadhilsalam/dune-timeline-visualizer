import * as THREE from 'three';

/**
 * The Atreides banner, in the design of the 2021 film: charcoal outer panels and a deep green
 * centre, divided by gold stripes, with the gold hawk across them. The books give only the
 * colours ("the green and black Atreides banner" at the head of Paul's legions) and put the hawk
 * on the ducal crest, so the emblem is the film's reading, not Herbert's.
 */

/** Shared clock for every banner's flutter; WorldProps advances it each frame. */
export const bannerClock: THREE.IUniform<number> = { value: 0 };

const GOLD = '#d6ac68';
const DARK = '#18252a';
const GREEN = '#00534b';
const EDGE = '#a8844c';

/** The stripes across the cloth, as fractions of its width, and their colours. */
const STRIPES: [number, number, string][] = [
  [0, 0.0425, GOLD],
  [0.0425, 0.271, DARK],
  [0.271, 0.3135, GOLD],
  [0.3135, 0.6775, GREEN],
  [0.6775, 0.72, GOLD],
  [0.72, 0.9585, DARK],
  [0.9585, 1, GOLD],
];

/**
 * The hawk, traced on a 2000 x 1047 banner: the wings swept up into a V that narrows to a tail,
 * the head in the fork, and a feather below each wing. Centred on (990, 527) there.
 */
const HAWK: [number, number][][] = (() => {
  const wings: [number, number][] = [
    [489, 95], [990, 596], [1492, 93], [1492, 262], [1055, 699], [1055, 895],
    [990, 962], [922, 895], [922, 698], [489, 265],
  ];
  const head: [number, number][] = [
    [909, 492], [990, 412], [1068, 412], [1076, 418], [1076, 436], [1068, 441],
    [1057, 433], [1036, 455], [1071, 492], [990, 574],
  ];
  const feather: [number, number][] = [[542, 347], [907, 712], [907, 868], [900, 873], [815, 788], [815, 703], [542, 430]];
  const mirrored = feather.map(([x, y]): [number, number] => [1980 - x, y]);
  return [wings, head, feather, mirrored];
})();

/** Fills a w x h area with the stripes. */
function stripes(g: CanvasRenderingContext2D, w: number, h: number): void {
  for (const [a, b, colour] of STRIPES) {
    g.fillStyle = colour;
    g.fillRect(Math.floor(a * w), 0, Math.ceil((b - a) * w), h);
  }
}

/** Draws the hawk centred on (cx, cy), `scale` times its size on the 2000-wide reference. */
function hawk(g: CanvasRenderingContext2D, cx: number, cy: number, scale: number): void {
  g.save();
  g.translate(cx, cy);
  g.scale(scale, scale);
  g.translate(-990, -527);
  g.fillStyle = GOLD;
  g.strokeStyle = EDGE;
  // A thin darker edge, so the hawk still parts from the gold stripes it crosses.
  g.lineWidth = 4;
  g.lineJoin = 'round';
  for (const poly of HAWK) {
    g.beginPath();
    poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fill();
    g.stroke();
  }
  g.restore();
}

function canvasTexture(cv: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** The flag, in the reference's proportions (about 1.9 : 1). */
function flagTexture(): THREE.CanvasTexture {
  const W = 1024;
  const H = 536;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d')!;
  stripes(g, W, H);
  hawk(g, W * 0.495, H * 0.503, W / 2000);
  return canvasTexture(cv);
}

/** A long hanging: the same stripes run its length, the hawk near the top, a swallowtail below. */
function hangingTexture(): THREE.CanvasTexture {
  const W = 160;
  const H = 1280;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d')!;
  stripes(g, W, H);
  // A gold band where it hangs from its rod.
  g.fillStyle = GOLD;
  g.fillRect(0, 0, W, H * 0.018);
  hawk(g, W * 0.495, H * 0.15, (W * 0.92) / 1003);
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
  flag.position.y = height - 0.5;
  g.add(pole, finial, flag);
  return g;
}

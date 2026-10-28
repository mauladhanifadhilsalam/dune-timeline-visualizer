import * as THREE from 'three';

/**
 * The Atreides banner. Dune gives it only two colours, green and black ("the green and black
 * Atreides banner" Paul sees at the head of his jihad's legions), and no emblem; the hawk is the
 * ducal crest on the signet, not something Herbert puts on the flag. So: a plain two-colour cloth.
 */

/** Shared clock for every banner's flutter; WorldProps advances it each frame. */
export const bannerClock: THREE.IUniform<number> = { value: 0 };

const GREEN = '#1f6b3a';
const BLACK = '#0d0d0b';

function flagTexture(): THREE.CanvasTexture {
  const W = 256;
  const H = 160;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d')!;
  g.fillStyle = GREEN;
  g.fillRect(0, 0, W, H);
  // Black band across the middle and a black hoist edge by the pole.
  g.fillStyle = BLACK;
  g.fillRect(0, H * 0.38, W, H * 0.24);
  g.fillRect(0, 0, W * 0.07, H);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function hangingTexture(): THREE.CanvasTexture {
  const W = 128;
  const H = 512;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d')!;
  g.fillStyle = BLACK;
  g.fillRect(0, 0, W, H);
  g.fillStyle = GREEN;
  g.fillRect(W * 0.14, H * 0.06, W * 0.72, H * 0.84);
  g.fillStyle = BLACK;
  g.fillRect(W * 0.14, H * 0.42, W * 0.72, H * 0.1);
  // Swallowtail: cut a notch out of the bottom edge (alpha-tested away).
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  g.moveTo(0, H);
  g.lineTo(W / 2, H * 0.9);
  g.lineTo(W, H);
  g.closePath();
  g.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
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

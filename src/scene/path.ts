import * as THREE from 'three';

/** Half-length of the path along world X. */
export const PATH_HALF_X = 1000;
/** Height the path floats at above the valley floor. */
export const PATH_Y = 16;

/** Ground-plane centreline of the path. The desert carves a valley along it. */
export function pathZ(x: number): number {
  return 150 * Math.sin((x / 720) * Math.PI * 2) + 46 * Math.sin((x / 255) * Math.PI * 2 + 1.3);
}

function pathY(x: number): number {
  return PATH_Y + 3.5 * Math.sin((x / 410) * Math.PI * 2 + 0.6);
}

export interface PathFrame {
  pos: THREE.Vector3;
  tangent: THREE.Vector3;
  /** Horizontal unit vector perpendicular to the tangent, pointing to the path's left. */
  side: THREE.Vector3;
}

const UP = new THREE.Vector3(0, 1, 0);
const LUT_SIZE = 4096;

/**
 * The Golden Path: one arc-length-parameterised curve that every dated thing hangs off.
 * t = 0 is the oldest moment on the timeline, t = 1 the newest.
 */
export class GoldenPath {
  readonly curve: THREE.CatmullRomCurve3;
  readonly length: number;
  private readonly lutPos: Float32Array;
  private readonly lutTan: Float32Array;

  constructor() {
    const pts: THREE.Vector3[] = [];
    const N = 220;
    for (let i = 0; i <= N; i++) {
      const x = -PATH_HALF_X + (2 * PATH_HALF_X * i) / N;
      pts.push(new THREE.Vector3(x, pathY(x), pathZ(x)));
    }
    this.curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    this.curve.arcLengthDivisions = 2000;
    this.length = this.curve.getLength();

    this.lutPos = new Float32Array((LUT_SIZE + 1) * 3);
    this.lutTan = new Float32Array((LUT_SIZE + 1) * 3);
    const p = new THREE.Vector3();
    const tg = new THREE.Vector3();
    for (let i = 0; i <= LUT_SIZE; i++) {
      const u = i / LUT_SIZE;
      this.curve.getPointAt(u, p);
      this.curve.getTangentAt(u, tg);
      p.toArray(this.lutPos, i * 3);
      tg.toArray(this.lutTan, i * 3);
    }
  }

  /** Interpolated frame at t in [0, 1]. Writes into `out` to avoid allocation in the render loop. */
  frameAt(t: number, out: PathFrame = makeFrame()): PathFrame {
    const f = Math.min(Math.max(t, 0), 1) * LUT_SIZE;
    const i = Math.min(Math.floor(f), LUT_SIZE - 1);
    const a = f - i;
    const o = i * 3;
    out.pos.set(
      this.lutPos[o] + (this.lutPos[o + 3] - this.lutPos[o]) * a,
      this.lutPos[o + 1] + (this.lutPos[o + 4] - this.lutPos[o + 1]) * a,
      this.lutPos[o + 2] + (this.lutPos[o + 5] - this.lutPos[o + 2]) * a,
    );
    out.tangent
      .set(
        this.lutTan[o] + (this.lutTan[o + 3] - this.lutTan[o]) * a,
        this.lutTan[o + 1] + (this.lutTan[o + 4] - this.lutTan[o + 1]) * a,
        this.lutTan[o + 2] + (this.lutTan[o + 5] - this.lutTan[o + 2]) * a,
      )
      .normalize();
    out.side.crossVectors(UP, out.tangent).normalize();
    return out;
  }

  /** t of the LUT sample nearest to a world point (used for the scrubber playhead). */
  nearestT(point: THREE.Vector3): number {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i <= LUT_SIZE; i += 2) {
      const o = i * 3;
      const dx = this.lutPos[o] - point.x;
      const dy = this.lutPos[o + 1] - point.y;
      const dz = this.lutPos[o + 2] - point.z;
      const d = dx * dx + dy * dy * 0.25 + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best / LUT_SIZE;
  }
}

export function makeFrame(): PathFrame {
  return { pos: new THREE.Vector3(), tangent: new THREE.Vector3(), side: new THREE.Vector3() };
}

const MAX_ERAS = 12;

const pathVertex = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec2 vUv;
  varying vec3 vNormalW;
  void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const pathFragment = /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform float uFlow;
  uniform float uLength;
  uniform int uCount;
  uniform float uBounds[${MAX_ERAS}];
  uniform vec3 uColors[${MAX_ERAS}];
  varying vec2 vUv;
  varying vec3 vNormalW;
  void main() {
    float t = vUv.x;
    vec3 col = uColors[0];
    for (int i = 1; i < ${MAX_ERAS}; i++) {
      if (i < uCount && t >= uBounds[i]) col = uColors[i];
    }
    // Spice flowing forward through time: soft pulses every ~14 world units.
    float d = t * uLength / 14.0 - uTime * 0.55 * uFlow;
    float pulse = pow(0.5 + 0.5 * sin(d * 6.2831853), 14.0);
    float top = 0.55 + 0.45 * max(vNormalW.y, 0.0);
    vec3 c = col * (0.72 * top + 0.95 * pulse);
    gl_FragColor = vec4(c, 1.0);
    #include <fog_fragment>
  }
`;

export interface EraBand {
  t: number;
  color: THREE.Color;
}

export function createPathMesh(path: GoldenPath): {
  mesh: THREE.Mesh;
  setBands: (bands: EraBand[]) => void;
  tick: (time: number) => void;
  setFlow: (on: boolean) => void;
} {
  const geo = new THREE.TubeGeometry(path.curve, 2400, 0.6, 10, false);
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uFlow: { value: 1 },
      uLength: { value: path.length },
      uCount: { value: 1 },
      uBounds: { value: new Array<number>(MAX_ERAS).fill(2) },
      uColors: { value: Array.from({ length: MAX_ERAS }, () => new THREE.Color(1, 0.7, 0.3)) },
    },
  ]);
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: pathVertex,
    fragmentShader: pathFragment,
    fog: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'golden-path';
  return {
    mesh,
    setBands(bands) {
      const n = Math.min(bands.length, MAX_ERAS);
      mat.uniforms.uCount.value = n;
      for (let i = 0; i < MAX_ERAS; i++) {
        mat.uniforms.uBounds.value[i] = i < n ? bands[i].t : 2;
        if (i < n) (mat.uniforms.uColors.value[i] as THREE.Color).copy(bands[i].color);
      }
    },
    tick(time) {
      mat.uniforms.uTime.value = time;
    },
    setFlow(on) {
      mat.uniforms.uFlow.value = on ? 1 : 0;
    },
  };
}

import * as THREE from 'three';

export interface ParticleOptions {
  capacity: number;
  color: THREE.ColorRepresentation;
  /** Multiplier on the colour; > 1 makes particles feed the bloom pass. */
  intensity?: number;
  additive?: boolean;
  gravity?: number;
  /** Fraction of velocity lost per second. */
  drag?: number;
}

const vertex = /* glsl */ `
  attribute float aLife;
  attribute float aSize;
  uniform float uScale;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    // aLife: 0 just born .. 1 dead; < 0 unused slot.
    float alive = step(0.0, aLife) * step(aLife, 1.0);
    gl_PointSize = alive * aSize * uScale / max(-mv.z, 1.0);
    vAlpha = alive * smoothstep(0.0, 0.08, aLife) * pow(1.0 - clamp(aLife, 0.0, 1.0), 1.4);
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vAlpha * uOpacity;
    if (a < 0.003) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

/**
 * A ring buffer of CPU-integrated particles drawn as one Points call. Emitters push into it;
 * the oldest particle is overwritten when it is full, so cost is fixed whatever the scene does.
 */
export class Particles {
  readonly points: THREE.Points;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private readonly span: Float32Array;
  private readonly size: Float32Array;
  private readonly uniforms: { uScale: THREE.IUniform<number>; uColor: THREE.IUniform; uOpacity: THREE.IUniform<number> };
  private head = 0;
  private readonly gravity: number;
  private readonly drag: number;

  constructor(private readonly opts: ParticleOptions) {
    const n = opts.capacity;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n).fill(-1);
    this.span = new Float32Array(n).fill(1);
    this.size = new Float32Array(n);
    this.gravity = opts.gravity ?? 0;
    this.drag = opts.drag ?? 0.2;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.uniforms = {
      uScale: { value: 400 },
      uColor: { value: new THREE.Color(opts.color).multiplyScalar(opts.intensity ?? 1) },
      uOpacity: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number): void {
    const i = this.head;
    this.head = (this.head + 1) % this.opts.capacity;
    const o = i * 3;
    this.pos[o] = x;
    this.pos[o + 1] = y;
    this.pos[o + 2] = z;
    this.vel[o] = vx;
    this.vel[o + 1] = vy;
    this.vel[o + 2] = vz;
    this.life[i] = 0;
    this.span[i] = life;
    this.size[i] = size;
    (this.points.geometry.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
  }

  /** Scale point sizes with the viewport so puffs look the same on every screen. */
  setViewportHeight(px: number, pixelRatio: number): void {
    this.uniforms.uScale.value = px * pixelRatio * 0.9;
  }

  setOpacity(a: number): void {
    this.uniforms.uOpacity.value = a;
  }

  update(dt: number): void {
    const keep = Math.max(1 - this.drag * dt, 0);
    let any = false;
    for (let i = 0; i < this.opts.capacity; i++) {
      if (this.life[i] < 0) continue;
      any = true;
      this.life[i] += dt / this.span[i];
      if (this.life[i] > 1) {
        this.life[i] = -1;
        continue;
      }
      const o = i * 3;
      this.vel[o] *= keep;
      this.vel[o + 1] = this.vel[o + 1] * keep - this.gravity * dt;
      this.vel[o + 2] *= keep;
      this.pos[o] += this.vel[o] * dt;
      this.pos[o + 1] += this.vel[o + 1] * dt;
      this.pos[o + 2] += this.vel[o + 2] * dt;
    }
    if (any) {
      (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (this.points.geometry.attributes.aLife as THREE.BufferAttribute).needsUpdate = true;
    }
  }
}

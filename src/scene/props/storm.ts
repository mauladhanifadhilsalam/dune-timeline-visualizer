import * as THREE from 'three';
import { FOG_COLOR, SUN_DIR } from '../desert';
import type { Particles } from './particles';
import { Thopter } from './thopter';

const vertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying float vDepth;
  void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uHaze;
  uniform float uTime;
  uniform float uSpin;
  uniform float uSeed;
  uniform float uOpacity;
  uniform vec3 uDark;
  uniform vec3 uLit;
  uniform vec3 uSunDir;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying float vDepth;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.07; a *= 0.5; }
    return s;
  }
  void main() {
    // u wraps around the storm: scrolling it is the rotation. Streaks are stretched sideways,
    // the way wind-driven sand smears along its path; they tilt upward with height.
    float u = vUv.x * 14.0 + uTime * uSpin;
    float h = vUv.y;
    float body = fbm(vec2(u, h * 3.2 - uTime * 0.04));
    float streak = fbm(vec2(u * 3.0 + h * 4.0, h * 9.0));
    float density = smoothstep(0.26, 0.66, body * 0.75 + streak * 0.35);
    // A solid wall for most of its height, thinning to wisps only near the top: from the path
    // the foot is usually hidden behind dunes or the Shield Wall, and the wall is what shows.
    float profile = smoothstep(0.0, 0.03, h) * (1.0 - smoothstep(0.6, 1.0, h));
    float a = clamp(density * profile * 1.6 + (1.0 - smoothstep(0.1, 0.62, h)) * 0.8, 0.0, 1.0) * uOpacity;
    if (a < 0.01) discard;
    // Light the face the camera sees: through the near wall, the far wall shows its inside,
    // which faces away from a sun behind the storm and so must be dark too.
    vec3 n = normalize(vNormalW) * (gl_FrontFacing ? 1.0 : -1.0);
    float lit = 0.3 + 0.7 * max(dot(n, uSunDir), 0.0);
    vec3 col = mix(uDark, uLit, lit * (0.6 + 0.4 * density));
    // The scene's ground fog would wash a storm this far off to nothing; a storm is its own
    // weather, so it takes only a light haze with distance.
    col = mix(col, uHaze, 0.3 * (1.0 - exp(-vDepth * 0.0012)));
    gl_FragColor = vec4(col, a);
  }
`;

/**
 * A Coriolis storm: Arrakis's great sandstorms, which Herbert has scouring flesh off bone at
 * hundreds of kilometres an hour. Three nested shells of sand turn at different speeds; an
 * ornithopter flies into the wall on a loop, as Paul and Jessica escape the Harkonnens by flying
 * into the storm. Local frame as other pieces; the storm is centred on the origin.
 */
export class CoriolisStorm {
  readonly group = new THREE.Group();
  static readonly RADIUS = 320;
  private readonly materials: THREE.ShaderMaterial[] = [];
  private readonly thopter = new Thopter();
  private readonly tmp = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  private dustDebt = 0;

  constructor() {
    const shells: [number, number, number][] = [
      // radius, height, spin
      [CoriolisStorm.RADIUS, 420, 0.05],
      [CoriolisStorm.RADIUS + 26, 470, 0.032],
      [CoriolisStorm.RADIUS + 54, 520, 0.021],
    ];
    shells.forEach(([r, h, spin], i) => {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uSpin: { value: spin },
          uSeed: { value: i * 17.3 },
          uOpacity: { value: 1 - i * 0.15 },
          uDark: { value: new THREE.Color('#3b2118') },
          uLit: { value: new THREE.Color('#b8703c') },
          uSunDir: { value: SUN_DIR.clone() },
          uHaze: { value: FOG_COLOR.clone() },
        },
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.materials.push(mat);
      // Slightly narrower at the top, so the wall leans back from its own foot.
      const geo = new THREE.CylinderGeometry(r * 0.86, r, h, 72, 8, true).translate(0, h / 2 - 12, 0);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 2 + i;
      this.group.add(mesh);
    });

    this.thopter.group.scale.setScalar(2.6);
    this.group.add(this.thopter.group);
  }

  update(time: number, dt: number, dust: Particles): void {
    if (!this.group.visible) return;
    for (const m of this.materials) m.uniforms.uTime.value = time;

    // The ornithopter: from the open desert nearer the path, low and fast, straight into the wall.
    const CYCLE = 13;
    const u = (time % CYCLE) / CYCLE;
    const R = CoriolisStorm.RADIUS;
    const from = this.tmp.set(-160, 80, R + 300);
    const x = from.x + (40 - from.x) * u;
    const z = from.z + (R * 0.55 - from.z) * u;
    const y = from.y - 25 * u + Math.sin(time * 1.3) * 2;
    this.thopter.group.position.set(x, y, z);
    this.thopter.group.rotation.set(0, Math.atan2(-(R * 0.55 - from.z), 40 - from.x), 0.12);
    // Swallowed by the sand as it crosses into the wall.
    const inside = THREE.MathUtils.smoothstep(Math.hypot(x, z), R + 20, R - 30);
    this.thopter.group.scale.setScalar(2.6 * (1 - inside));
    this.thopter.group.visible = inside < 0.99;
    this.thopter.update(time);

    // Sand ripping along the foot of the storm, tangential to its spin.
    this.dustDebt += dt * 30;
    while (this.dustDebt >= 1) {
      this.dustDebt -= 1;
      const a = Math.random() * Math.PI * 2;
      const r = R * (0.95 + Math.random() * 0.15);
      const p = this.group.localToWorld(this.tmp.set(Math.cos(a) * r, 2 + Math.random() * 10, Math.sin(a) * r));
      const tangent = this.dir
        .set(-Math.sin(a), 0, Math.cos(a))
        .applyQuaternion(this.group.quaternion)
        .multiplyScalar(30 + Math.random() * 25);
      dust.emit(p.x, p.y, p.z, tangent.x, 4 + Math.random() * 8, tangent.z, 3.5, 26 + Math.random() * 20);
    }
  }
}

import * as THREE from 'three';

/** Seconds after the camera arrives: the shield holds, then flickers… */
const HOLD = 2.5;
const FLICKER = 3;
/** …and goes out. */
const FAIL = 1;
/** Seconds from the camera's arrival until it is down. */
export const SHIELD_SEEN = HOLD + FLICKER + FAIL + 1;

const vertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vLocal;
  void main() {
    vLocal = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  uniform float uTime;
  uniform float uPower;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vLocal;
  void main() {
    // Brightest at the rim, where the eye looks through most of it, with bands of shimmer
    // crawling over it, as a Holtzman shield wavers.
    float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.4);
    float bands = 0.5 + 0.5 * sin(vLocal.y * 0.8 - uTime * 2.6 + sin(vLocal.x * 0.12 + uTime * 0.9) * 2.2);
    vec3 col = vec3(0.55, 0.76, 1.0) * (rim * 1.5 + 0.06 + 0.1 * bands);
    gl_FragColor = vec4(col * uPower, (rim * 0.8 + 0.05 + 0.05 * bands) * uPower);
  }
`;

/**
 * The house shield over the Residency in Arrakeen, the night Yueh betrays the Duke: a shimmering
 * dome that holds when the camera arrives, then flickers and goes out as he brings it down. Stands
 * in Arrakeen's frame, over the Residency.
 */
export class ShieldDome {
  readonly group = new THREE.Group();
  private readonly mat: THREE.ShaderMaterial;
  private clock = 0;
  private started = false;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPower: { value: 1 } },
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(48, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2), this.mat);
    dome.position.y = -6;
    this.group.add(dome);
  }

  update(time: number, dt: number, arrived: boolean): void {
    if (!this.group.visible) {
      this.started = false;
      return;
    }
    if (!this.started) {
      this.clock = 0;
      this.started = arrived;
    } else {
      this.clock += dt;
    }
    const u = this.clock - HOLD;
    let power = 1;
    if (this.started && u > 0) {
      if (u < FLICKER) {
        // Out more often than on as it fails.
        const on = Math.sin(time * 37) * Math.sin(time * 13.3) > (u / FLICKER) * 1.4 - 0.7;
        power = on ? 1 : 0.08;
      } else {
        // A last swell, then nothing.
        const f = (u - FLICKER) / FAIL;
        power = f < 1 ? 1.6 * (1 - f) : 0;
      }
    }
    this.mat.uniforms.uTime.value = time;
    this.mat.uniforms.uPower.value = power;
    this.group.children[0].visible = power > 0.001;
  }
}

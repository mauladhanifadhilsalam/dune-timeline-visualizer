import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { MAP_CENTER, MAP_RADIUS, PLACES, type Place, type PlaceKind } from '../../data/arrakis';
import { rng } from '../noise';
import { altitudeAt, ergAt } from './relief';

/** World units per unit of the polar map (the radius of its 60° line, some 840 km). */
const SCALE = 1000;
/** World units per metre of height: about twelve times what the map's own scale would give. */
const HEIGHT = 0.014;
const R = MAP_RADIUS * SCALE;
const [CU, CV] = MAP_CENTER;
/** Whether a point of the polar map is on the model, `pad` map units beyond its rim allowed. */
const onModel = (u: number, v: number, pad = 0) => Math.hypot(u - CU, v - CV) < MAP_RADIUS + pad;
const SEGMENTS = 256;
/** How far below the Bled the model's plinth goes, in world units. */
const BASE = -90;

/** Where a point of the polar map lies in the model, on the ground. */
function toWorld(u: number, v: number, out = new THREE.Vector3()): THREE.Vector3 {
  return out.set(u * SCALE, altitudeAt(u, v) * HEIGHT, -v * SCALE);
}

const COLORS = {
  uSalt: '#d6cdbd',
  uSand: '#c79e68',
  uFlat: '#b8a07f',
  uDune: '#d49752',
  uOchre: '#ad7142',
  uRust: '#7b4830',
  uBasalt: '#4d3a32',
  uStone: '#b6a998',
  uLine: '#3a281e',
  uGrid: '#f2cd8a',
};

function buildTerrain(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(2 * R, 2 * R, SEGMENTS, SEGMENTS);
  geo.rotateX(-Math.PI / 2).translate(CU * SCALE, 0, -CV * SCALE);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const alt = new Float32Array(pos.count);
  const erg = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / SCALE;
    const v = -pos.getZ(i) / SCALE;
    // Beyond the rim nothing is drawn, so there is nothing to work out.
    if (!onModel(u, v, 0.03)) continue;
    alt[i] = altitudeAt(u, v);
    erg[i] = ergAt(u, v);
    pos.setY(i, alt[i] * HEIGHT);
  }
  geo.setAttribute('aAlt', new THREE.BufferAttribute(alt, 1));
  geo.setAttribute('aErg', new THREE.BufferAttribute(erg, 1));
  geo.computeVertexNormals();

  const obs = PLACES.find((p) => p.id === 'observatory-mt')!.at;
  const uniforms: Record<string, THREE.IUniform> = {
    uRadius: { value: MAP_RADIUS },
    uCenter: { value: new THREE.Vector2(CU, CV) },
    // The zero meridian runs through Observatory Mountain.
    uZero: { value: Math.atan2(obs[0], obs[1]) },
  };
  for (const [k, c] of Object.entries(COLORS)) uniforms[k] = { value: new THREE.Color(c) };
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.93, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aAlt;
        attribute float aErg;
        varying float vAlt;
        varying float vErg;
        varying vec2 vMap;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vAlt = aAlt;
        vErg = aErg;
        vMap = vec2(position.x, -position.z) / ${SCALE.toFixed(1)};`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying float vAlt;
        varying float vErg;
        varying vec2 vMap;
        uniform float uRadius;
        uniform vec2 uCenter;
        uniform float uZero;
        uniform vec3 uSalt, uSand, uFlat, uDune, uOchre, uRust, uBasalt, uStone, uLine, uGrid;
        // 1 on the lines where x is a whole number, a pixel or so wide whatever the zoom.
        float lines(float x, float w) {
          return 1.0 - smoothstep(0.0, w * 1.2, abs(fract(x + 0.5) - 0.5));
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float r = length(vMap);
          float edge = length(vMap - uCenter);
          if (edge > uRadius) discard;
          // Tinted by height, like a printed relief map: salt flats, sand, ochre and rust rock,
          // dark basalt in the high wall, pale stone on the summits.
          vec3 c = mix(uSalt, uSand, smoothstep(-450.0, -40.0, vAlt));
          // The open desert mottled as it rolls, the Great Flat's rock a little greyer and paler.
          c *= 0.95 + 0.09 * smoothstep(0.0, 60.0, vAlt);
          c = mix(c, uFlat, smoothstep(70.0, 110.0, vAlt) * (1.0 - smoothstep(260.0, 420.0, vAlt)) * 0.4);
          c = mix(c, uOchre, smoothstep(250.0, 1300.0, vAlt));
          c = mix(c, uRust, smoothstep(1300.0, 2900.0, vAlt));
          c = mix(c, uBasalt, smoothstep(2900.0, 4600.0, vAlt));
          c = mix(c, uStone, smoothstep(5600.0, 7800.0, vAlt));
          // Seas of dunes, as long ripples across the wind.
          float ripple = sin(dot(vMap, vec2(0.8, 0.6)) * 430.0 + sin(vMap.y * 55.0 + vMap.x * 21.0) * 2.5);
          c = mix(c, uDune * (0.88 + 0.12 * ripple), vErg * 0.85);
          // The polar cap.
          c = mix(c, vec3(0.9, 0.89, 0.86), 1.0 - smoothstep(0.018, 0.035, r));
          // Contours every 500 m, every 2000 m bolder; none at the Bled itself, which only wanders.
          float k = vAlt / 500.0;
          float contour = max(lines(k, fwidth(k)) * 0.22, lines(k / 4.0, fwidth(k / 4.0)) * 0.42);
          // Nor on flat ground that happens to lie at a contour's height, like the Polar Sink's floor.
          c = mix(c, uLine, contour * smoothstep(120.0, 260.0, abs(vAlt)) * smoothstep(0.5, 4.0, fwidth(vAlt)));
          // The graticule: latitude every ten degrees (the 60° line bolder), meridians every thirty
          // from the zero. Each angle is measured from two sides so neither seam draws a line.
          float lat = lines(r * 3.0, fwidth(r * 3.0)) * smoothstep(0.04, 0.08, r);
          float a1 = (atan(vMap.x, vMap.y) - uZero) / (PI / 6.0);
          float a2 = (atan(-vMap.x, -vMap.y) - uZero) / (PI / 6.0);
          float meridian = lines(a1, min(fwidth(a1), fwidth(a2))) * smoothstep(0.1, 0.2, r);
          float sixty = 1.0 - smoothstep(0.0, fwidth(r) * 2.5, abs(r - 1.0));
          c = mix(c, uGrid, max(max(lat, meridian) * 0.32, sixty * 0.55));
          // A little darker toward the rim, as a model's edge catches less light.
          c *= 1.0 - 0.18 * smoothstep(uRadius * 0.93, uRadius, edge);
          diffuseColor.rgb = c;
        }`,
      );
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'arrakis-relief';
  return mesh;
}

/** The model's plinth: a wall round the rim down to a base, and a gold line along its edge. */
function buildPlinth(): THREE.Group {
  const n = 512;
  const pos = new Float32Array((n + 1) * 6);
  const rim: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const p = toWorld(CU + Math.cos(a) * MAP_RADIUS, CV + Math.sin(a) * MAP_RADIUS);
    rim.push(p.clone().setY(p.y + 0.6));
    pos.set([p.x, p.y, p.z, p.x, BASE, p.z], i * 6);
  }
  const index: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const wallGeo = new THREE.BufferGeometry();
  wallGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  wallGeo.setIndex(index);
  wallGeo.computeVertexNormals();
  const stone = new THREE.MeshStandardMaterial({ color: '#2c211b', roughness: 1, side: THREE.DoubleSide });
  const base = new THREE.Mesh(new THREE.CircleGeometry(R, 128).rotateX(-Math.PI / 2), stone);
  base.position.set(CU * SCALE, BASE, -CV * SCALE);
  const edge = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(rim),
    new THREE.LineBasicMaterial({ color: '#c9a15c', transparent: true, opacity: 0.8 }),
  );
  return new THREE.Group().add(new THREE.Mesh(wallGeo, stone), base, edge);
}

/** Small markers on the model, by kind: a city's roofs, a sietch's dark mouth, a village. */
function buildMarkers(): THREE.Group {
  const g = new THREE.Group();
  const ball = new THREE.SphereGeometry(1, 12, 8);
  const mats: Partial<Record<PlaceKind, THREE.Material>> = {
    sietch: new THREE.MeshStandardMaterial({ color: '#21150f', roughness: 0.8 }),
    cave: new THREE.MeshStandardMaterial({ color: '#21150f', roughness: 0.8 }),
    village: new THREE.MeshStandardMaterial({ color: '#d9b467', roughness: 0.6 }),
    shrine: new THREE.MeshStandardMaterial({ color: '#efe3c8', roughness: 0.6 }),
  };
  const roofs = new THREE.MeshStandardMaterial({ color: '#ddd0b8', roughness: 0.85 });
  const rand = rng(8840);
  for (const p of PLACES) {
    const at = toWorld(p.at[0], p.at[1]);
    if (p.kind === 'city') {
      for (let i = 0; i < 11; i++) {
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * 20;
        const h = 4 + rand() * 12;
        const box = new THREE.Mesh(new THREE.BoxGeometry(5 + rand() * 6, h, 5 + rand() * 6), roofs);
        box.position.set(at.x + Math.cos(a) * r, at.y + h / 2, at.z + Math.sin(a) * r);
        g.add(box);
      }
    } else if (p.kind === 'shrine') {
      const spire = new THREE.Mesh(new THREE.ConeGeometry(3.2, 13, 6), mats.shrine);
      spire.position.copy(at).setY(at.y + 6.5);
      g.add(spire);
    } else if (mats[p.kind]) {
      const m = new THREE.Mesh(ball, mats[p.kind]);
      m.scale.setScalar(p.kind === 'village' ? 5 : 6);
      m.position.copy(at).setY(at.y + 2);
      g.add(m);
    }
  }
  return g;
}

/** A dim, warm pool of light behind the model, falling off to the page's own dark. */
function backdrop(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 110, 10, 128, 128, 190);
  grad.addColorStop(0, '#33242c');
  grad.addColorStop(1, '#0d0a12');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const PRIORITY: Record<PlaceKind, number> = {
  city: 1000,
  peak: 760,
  region: 700,
  sietch: 650,
  pass: 560,
  shrine: 540,
  depression: 520,
  basin: 480,
  ridge: 470,
  cave: 440,
  village: 400,
  rock: 360,
  pointer: 330,
  pole: 320,
};
/** How far off the camera can be and still show a name, by kind. */
const RANGE: Record<PlaceKind, number> = {
  city: 7000,
  peak: 6000,
  region: 9000,
  sietch: 4800,
  pass: 4200,
  shrine: 3800,
  depression: 4800,
  basin: 4000,
  ridge: 4800,
  cave: 3400,
  village: 3400,
  rock: 3200,
  pointer: 9000,
  pole: 4500,
};

interface MapLabel {
  place: Place;
  obj: CSS2DObject;
  el: HTMLElement;
  w: number;
  h: number;
  shown: boolean;
}

function formatAlt(p: Place): string | null {
  if (p.alt === undefined) return null;
  const n = Math.abs(p.alt).toLocaleString('en');
  return `${p.altNote ? `${p.altNote} ` : ''}${p.alt < 0 ? '−' : ''}${n} m`;
}

export interface ArrakisMapOptions {
  /** A place's name was chosen. */
  onPick: (id: string) => void;
  /** How many of the timeline's events happen at a place. */
  eventsAt: (id: string) => number;
}

/**
 * A relief model of Arrakis's north polar regions after the map in *Dune*: the Shield Wall round
 * the Imperial Basin, Arrakeen at its rim, the Polar Sink, the false walls and the open erg, with
 * every place the book names. Its own scene, shown in place of the timeline's.
 */
export class ArrakisMap {
  readonly scene = new THREE.Scene();
  private readonly labels: MapLabel[] = [];
  private readonly marker: THREE.Group;
  private selected: string | null = null;
  private frame = 0;
  private readonly v = new THREE.Vector3();

  constructor(private readonly o: ArrakisMapOptions) {
    this.scene.background = backdrop();
    // Lit from the north-west of the page, as relief maps are, with a cool fill opposite.
    const sun = new THREE.DirectionalLight('#fff1dc', 2.3);
    sun.position.set(-1, 1.25, -0.9).multiplyScalar(4000);
    const fill = new THREE.DirectionalLight('#8fa0d8', 0.35);
    fill.position.set(1, 0.6, 1).multiplyScalar(4000);
    this.scene.add(new THREE.HemisphereLight('#f2e6d2', '#3a2a22', 0.75), sun, fill);
    this.scene.add(buildTerrain(), buildPlinth(), buildMarkers());

    // A ring and a beam that stand at the chosen place.
    const gold = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffcf7a').multiplyScalar(1.4), side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(26, 31, 48).rotateX(-Math.PI / 2), gold);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 70, 8).translate(0, 35, 0), gold);
    this.marker = new THREE.Group().add(ring, beam);
    this.marker.visible = false;
    this.scene.add(this.marker);

    for (const place of PLACES) this.addLabel(place);
  }

  private addLabel(place: Place): void {
    const el = document.createElement('div');
    el.className = `map-lbl kind-${place.kind}`;
    const name = document.createElement('span');
    name.className = 'map-lbl-name';
    name.textContent = place.name;
    el.append(name);
    const events = this.o.eventsAt(place.id);
    const sub = [formatAlt(place), events ? `${events} event${events > 1 ? 's' : ''}` : null].filter(Boolean).join(' · ');
    if (sub) {
      const s = document.createElement('span');
      s.className = 'map-lbl-sub';
      s.textContent = sub;
      el.append(s);
    }
    el.dataset.place = place.id;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.o.onPick(place.id);
    });
    const obj = new CSS2DObject(el);
    const region = place.kind === 'region' || place.kind === 'pointer';
    obj.center.set(0.5, region ? 0.5 : 1);
    toWorld(place.at[0], place.at[1], obj.position);
    obj.position.y += region ? 4 : place.kind === 'city' ? 26 : 12;
    this.scene.add(obj);
    this.labels.push({ place, obj, el, w: 0, h: 0, shown: false });
  }

  /** Height of the model's ground under a point, for keeping the camera above it. */
  groundAt = (x: number, z: number): number => {
    const u = x / SCALE;
    const v = -z / SCALE;
    return onModel(u, v) ? altitudeAt(u, v) * HEIGHT : BASE;
  };

  /** Mark a place (or none) with the ring and beam, and keep its name showing. */
  select(id: string | null): void {
    this.selected = id;
    const p = PLACES.find((x) => x.id === id);
    this.marker.visible = !!p;
    if (p) toWorld(p.at[0], p.at[1], this.marker.position);
  }

  /**
   * Where the camera stands to see the whole model, or one place up close. A portrait screen's
   * view is narrow, so it stands further back.
   */
  pose(id: string | null, aspect: number): { eye: THREE.Vector3; target: THREE.Vector3 } {
    const k = aspect < 1 ? Math.min(1 / aspect, 2.2) : 1;
    const p = PLACES.find((x) => x.id === id);
    if (!p) {
      const target = new THREE.Vector3(CU * SCALE, 0, -CV * SCALE);
      return { target, eye: target.clone().add(new THREE.Vector3(0, 2700, 1650).multiplyScalar(k)) };
    }
    const target = toWorld(p.at[0], p.at[1]);
    return { target, eye: target.clone().add(new THREE.Vector3(0, 560, 640).multiplyScalar(k)) };
  }

  /**
   * Show the names that fit, most important first, never one over another or under the page's
   * panels (`blocked`, screen rects [x0, y0, x1, y1]).
   */
  update(camera: THREE.PerspectiveCamera, width: number, height: number, blocked: number[]): void {
    if (this.frame++ % 2) return;
    const placed = [...blocked];
    const cands: { l: MapLabel; pri: number; x: number; y: number }[] = [];
    for (const l of this.labels) {
      const d = l.obj.position.distanceTo(camera.position);
      const chosen = l.place.id === this.selected;
      const v = this.v.copy(l.obj.position).project(camera);
      if ((!chosen && d > RANGE[l.place.kind]) || v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) {
        this.show(l, false);
        continue;
      }
      const pri = chosen ? 1e6 : PRIORITY[l.place.kind] + (this.o.eventsAt(l.place.id) ? 150 : 0) - d * 0.05;
      cands.push({ l, pri, x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height });
    }
    cands.sort((a, b) => b.pri - a.pri);
    for (const { l, x, y } of cands) {
      if (!l.w && l.el.isConnected && l.el.offsetWidth) {
        l.w = l.el.offsetWidth;
        l.h = l.el.offsetHeight;
      }
      const w = l.w || 120;
      const h = l.h || 28;
      const x0 = x - w * l.obj.center.x - 3;
      const y0 = y - h * l.obj.center.y - 3;
      const x1 = x0 + w + 6;
      const y1 = y0 + h + 6;
      let clash = x0 < 4 || y0 < 4 || x1 > width - 4 || y1 > height - 4;
      for (let i = 0; !clash && i < placed.length; i += 4) {
        clash = x0 < placed[i + 2] && x1 > placed[i] && y0 < placed[i + 3] && y1 > placed[i + 1];
      }
      this.show(l, !clash);
      if (!clash) placed.push(x0, y0, x1, y1);
    }
  }

  private show(l: MapLabel, on: boolean): void {
    if (l.shown === on) return;
    l.shown = on;
    l.el.classList.toggle('on', on);
  }
}

import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

// --- 1. KONFIGURACJA ---
const config = {
  dotColor: 'grey',
  dotSize: 0.015,
  totalPoints: 10000,
  influenceRadius: 2.0, // Zasięg magnesu
  magnetStrength: 0.8, // Siła odpychania
  returnSpeed: 0.1,
  scale: 1,
};

// --- 2. BAZA RÓWNAŃ ---
const EQUATIONS = {
  sphere: (dx, dy, dz) => ({ x: dx, y: dy, z: dz }),

  quartic: (dx, dy, dz) => {
    const dir4 = 0.5 * (Math.pow(dx, 4) + Math.pow(dy, 4) + Math.pow(dz, 4));
    const A = dir4,
      B = -8,
      C = 60;
    const delta = B * B - 4 * A * C;
    if (delta >= 0) {
      const r2 = (-B + Math.sqrt(delta)) / (2 * A);
      if (r2 > 0) {
        const r = Math.sqrt(r2);
        return { x: r * dx, y: r * dy, z: r * dz };
      }
    }
    return null;
  },

  blob: (dx, dy, dz) => {
    const a = 1.5;
    let r = Math.sqrt(a);
    for (let i = 0; i < 5; i++) {
      const x = r * dx,
        y = r * dy,
        z = r * dz;
      const f =
        x * x +
        y * y +
        z * z +
        Math.sin(4 * x) +
        Math.sin(4 * y) +
        Math.sin(4 * z) -
        a;
      const df =
        2 * r +
        4 *
          (Math.cos(4 * x) * dx + Math.cos(4 * y) * dy + Math.cos(4 * z) * dz);
      r = r - f / df;
    }
    return { x: r * dx, y: r * dy, z: r * dz };
  },
};

// WYBIERZ FIGURĘ TUTAJ:
const currentEquation = EQUATIONS.blob;

// --- 3. SCENA I RENDERER ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById("sphereCanvas"),
  alpha: true,
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);

// --- 4. GENEROWANIE GEOMETRII (FIBONACCI) ---
function createGeometry() {
  const pts = [];
  const n = config.totalPoints;
  const phi = Math.PI * (Math.sqrt(5) - 1);

  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = phi * i;

    const dx = Math.cos(theta) * radiusAtY;
    const dy = y;
    const dz = Math.sin(theta) * radiusAtY;

    const pos = currentEquation(dx, dy, dz);
    if (pos) {
      pts.push(
        pos.x * config.scale,
        pos.y * config.scale,
        pos.z * config.scale
      );
    }
  }

  const vertices = new Float32Array(pts);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  return { geometry: geo, baseData: new Float32Array(pts) };
}

const { geometry, baseData } = createGeometry();
const targets = baseData;
const positions = new Float32Array(baseData);

// --- 5. OBIEKTY W SCENIE ---
const group = new THREE.Group();
scene.add(group);

// Kropki
const circleCanvas = document.createElement("canvas");
circleCanvas.width = 64;
circleCanvas.height = 64;
const ctx = circleCanvas.getContext("2d");
ctx.beginPath();
ctx.arc(32, 32, 30, 0, Math.PI * 2);
ctx.fillStyle = "#ffffff";
ctx.fill();

const dotMaterial = new THREE.PointsMaterial({
  size: config.dotSize,
  color: config.dotColor,
  map: new THREE.CanvasTexture(circleCanvas),
  transparent: true,
  alphaTest: 0.5,
});

const dots = new THREE.Points(geometry, dotMaterial);
group.add(dots);

// Kolider ( GhostSphere ) - dopasowanie rozmiaru do figury
// Jeśli używasz 'quartic', promień 8 jest ok. Dla 'blob' zmień na 2.
const colliderSize = currentEquation === EQUATIONS.quartic ? 8 : 2;
const ghostSphere = new THREE.Mesh(
  new THREE.SphereGeometry(colliderSize, 32, 32),
  new THREE.MeshBasicMaterial({ visible: false })
);
group.add(ghostSphere);

// Pozycja kamery - dostosowana do wielkości figury
camera.position.z = 3;

// --- 6. INTERAKCJA I ANIMACJA ---
const mouse = new THREE.Vector2(-999, -999);
const raycaster = new THREE.Raycaster();

window.addEventListener("mousemove", (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

function animate() {
  requestAnimationFrame(animate);

  const t = Date.now() * 0.0005;
  group.rotation.y += 0.002;
  group.rotation.x = Math.sin(t * 0.5) * 0.15;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(ghostSphere);
  const intersectPoint =
    intersects.length > 0
      ? ghostSphere.worldToLocal(intersects[0].point.clone())
      : null;

  const posArray = dots.geometry.attributes.position.array;

  for (let i = 0; i < posArray.length; i += 3) {
    const tx = targets[i],
      ty = targets[i + 1],
      tz = targets[i + 2];

    if (intersectPoint) {
      const dx = tx - intersectPoint.x;
      const dy = ty - intersectPoint.y;
      const dz = tz - intersectPoint.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < config.influenceRadius) {
        const force = (config.influenceRadius - dist) / config.influenceRadius;
        const power = force * force * config.magnetStrength;
        posArray[i] = tx + (dx / dist) * power;
        posArray[i + 1] = ty + (dy / dist) * power;
        posArray[i + 2] = tz + (dz / dist) * power;
      } else {
        applyReturn(i, posArray, tx, ty, tz);
      }
    } else {
      applyReturn(i, posArray, tx, ty, tz);
    }
  }

  dots.geometry.attributes.position.needsUpdate = true;
  renderer.render(scene, camera);
}

function applyReturn(i, arr, tx, ty, tz) {
  arr[i] += (tx - arr[i]) * config.returnSpeed;
  arr[i + 1] += (ty - arr[i + 1]) * config.returnSpeed;
  arr[i + 2] += (tz - arr[i + 2]) * config.returnSpeed;
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();

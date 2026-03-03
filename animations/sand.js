import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

// --- 1. KONFIGURACJA "CIĘCIA WODY" ---
const config = {
  dotColor: `#9999a1`,
  dotSize: 0.01,
  totalPoints: 10000,
  influenceRadius: 0.1, // Zasięg "cięcia" (dla bloba ok. 0.8 jest idealne)
  friction: 0.94, // Lepkość wody (im bliżej 1, tym dłużej płyną)
  mousePower: 0.4, // Siła pędu przekazywana z myszki
  springStrength: 0.0007, // Bardzo słaby powrót (efekt piasku)
  scale: 1,
};

const EQUATIONS = {
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

// --- 2. SETUP SCENY ---
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

function createGeometry() {
  const pts = [];
  const n = config.totalPoints;
  const phi = Math.PI * (Math.sqrt(5) - 1);
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = phi * i;
    const pos = EQUATIONS.blob(
      Math.cos(theta) * radiusAtY,
      y,
      Math.sin(theta) * radiusAtY
    );
    if (pos) pts.push(pos.x, pos.y, pos.z);
  }
  return new Float32Array(pts);
}

const pts = createGeometry();
const targets = new Float32Array(pts);
const positions = new Float32Array(pts);
const velocities = new Float32Array(pts.length).fill(0);

const geometry = new THREE.BufferGeometry();
geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

const dotMaterial = new THREE.PointsMaterial({
  size: config.dotSize,
  color: config.dotColor,
  map: createCircleTexture(), // To sprawi, że kwadraty staną się kółkami
  transparent: true, // Konieczne, by tło kółka było niewidoczne
  alphaTest: 0.5, // Zapobiega "wycinaniu" kółek przez inne kółka
  sizeAttenuation: true, // Sprawia, że kropki są mniejsze, gdy są dalej
});
const dots = new THREE.Points(geometry, dotMaterial);
const group = new THREE.Group();
group.add(dots);
scene.add(group);

// Kolider dopasowany do Bloba (r=1.6)
const ghostSphere = new THREE.Mesh(
  new THREE.SphereGeometry(1.5, 32, 32),
  new THREE.MeshBasicMaterial({ visible: false })
);
group.add(ghostSphere);

camera.position.z = 3;

// --- 3. INTERAKCJA "CIĘCIA" ---
const mouse = new THREE.Vector2(-999, -999);
const raycaster = new THREE.Raycaster();
let prevMousePos = new THREE.Vector3();
let mouseVel = new THREE.Vector3();

window.addEventListener("mousemove", (e) => {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
});

function animate() {
  requestAnimationFrame(animate);
  group.rotation.y += 0.001;
  group.rotation.x += 0.0001;
  group.rotation.z += 0.0001;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(ghostSphere);
  const currentIntersect =
    intersects.length > 0
      ? ghostSphere.worldToLocal(intersects[0].point.clone())
      : null;

  // Obliczamy prędkość myszki
  if (currentIntersect) {
    mouseVel.subVectors(currentIntersect, prevMousePos);
    prevMousePos.copy(currentIntersect);
  }

  const pos = dots.geometry.attributes.position.array;

  for (let i = 0; i < pos.length; i += 3) {
    const tx = targets[i],
      ty = targets[i + 1],
      tz = targets[i + 2];
    const px = pos[i],
      py = pos[i + 1],
      pz = pos[i + 2];

    if (currentIntersect) {
      const dx = px - currentIntersect.x;
      const dy = py - currentIntersect.y;
      const dz = pz - currentIntersect.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < config.influenceRadius) {
        const influence = 1 - dist / config.influenceRadius;

        // TRANSFER PĘDU (Mysz pcha kropki w swoją stronę)
        velocities[i] += mouseVel.x * config.mousePower * influence;
        velocities[i + 1] += mouseVel.y * config.mousePower * influence;
        velocities[i + 2] += mouseVel.z * config.mousePower * influence;

        // EFEKT ROZCINANIA (Kropki uciekają też lekko na boki od środka myszki)
        const push = influence * 0.02;
        velocities[i] += (dx / dist) * push;
        velocities[i + 1] += (dy / dist) * push;
        velocities[i + 2] += (dz / dist) * push;
      }
    }

    // FIZYKA PŁYWANIA
    // 1. Tarcie wody
    velocities[i] *= config.friction;
    velocities[i + 1] *= config.friction;
    velocities[i + 2] *= config.friction;

    // 2. Bardzo słaby powrót na miejsce (jak opadający piasek)
    velocities[i] += (tx - px) * config.springStrength;
    velocities[i + 1] += (ty - py) * config.springStrength;
    velocities[i + 2] += (tz - pz) * config.springStrength;

    // 3. Aktualizacja pozycji
    pos[i] += velocities[i];
    pos[i + 1] += velocities[i + 1];
    pos[i + 2] += velocities[i + 2];
  }

  dots.geometry.attributes.position.needsUpdate = true;
  renderer.render(scene, camera);
}


function createCircleTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");

  // Rysujemy białe koło na czarnym/przezroczystym tle
  ctx.beginPath();
  ctx.arc(32, 32, 30, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}
animate();
window.addEventListener('resize', () => {
  // 1. Pobieramy nowe wymiary
  const width = window.innerWidth;
  const height = window.innerHeight;

  // 2. Aktualizujemy kamerę
  camera.aspect = width / height;
  camera.updateProjectionMatrix(); // To jest kluczowe, by obraz nie był rozciągnięty

  // 3. Aktualizujemy renderer
  renderer.setSize(width, height);
  
  // Opcjonalnie: obsługa ekranów Retina/High-DPI
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});
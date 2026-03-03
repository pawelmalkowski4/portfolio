import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

// --- 1. KONFIGURACJA "WYBUCHU" ---
const config = {
  dotColor: `#9999a1`,
  dotSize: 0.05,        
  totalPoints: 2000,    
  explosionForce: 0.5,  
  friction: 0.94,
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

// --- 3. TWORZENIE CZĄSTECZEK (BIG BANG) ---
const positions = new Float32Array(config.totalPoints * 3);
const velocities = new Float32Array(config.totalPoints * 3);

for (let i = 0; i < config.totalPoints; i++) {
  const i3 = i * 3;

  // Start ze środka
  positions[i3] = (Math.random() - 0.5) * 0.01;
  positions[i3 + 1] = (Math.random() - 0.5) * 0.01;
  positions[i3 + 2] = (Math.random() - 0.5) * 0.01;

  // Losowy wektor kierunku wybuchu
  const theta = Math.random() * Math.PI * 2; 
  const phi = Math.acos((Math.random() * 2) - 1); 
  const speed = Math.random() * config.explosionForce; 

  velocities[i3] = Math.sin(phi) * Math.cos(theta) * speed;
  velocities[i3 + 1] = Math.sin(phi) * Math.sin(theta) * speed;
  velocities[i3 + 2] = Math.cos(phi) * speed;
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

// Funkcja rysująca kółko
function createCircleTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.beginPath();
  ctx.arc(32, 32, 30, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}

const dotMaterial = new THREE.PointsMaterial({
  size: config.dotSize,
  color: config.dotColor,
  map: createCircleTexture(),
  transparent: true,
  alphaTest: 0.5,
  sizeAttenuation: true,
});

const dots = new THREE.Points(geometry, dotMaterial);
scene.add(dots); // Dodajemy od razu do sceny, bez żadnych grup (Group)

camera.position.z = 15; 

// --- 4. ANIMACJA I FIZYKA (PEŁNE ZAMROŻENIE) ---
let isMoving = true; 

function animate() {
  // Nawet jeśli isMoving jest false, musimy wywoływać requestAnimationFrame, 
  // aby strona poprawnie się odświeżała przy np. zmianie rozmiaru okna.
  requestAnimationFrame(animate);

  if (isMoving) {
    let particlesStillMoving = false;
    const pos = dots.geometry.attributes.position.array;

    for (let i = 0; i < pos.length; i += 3) {
      // Zwalnianie (tarcie)
      velocities[i] *= config.friction;
      velocities[i + 1] *= config.friction;
      velocities[i + 2] *= config.friction;

      // Aktualizacja pozycji
      pos[i] += velocities[i];
      pos[i + 1] += velocities[i + 1];
      pos[i + 2] += velocities[i + 2];

      // Jeśli chociaż jedna cząsteczka ma jeszcze sensowną prędkość, kręcimy pętlą dalej
      if (Math.abs(velocities[i]) > 0.001) {
        particlesStillMoving = true;
      }
    }

    dots.geometry.attributes.position.needsUpdate = true;
    
    // Jeśli wszystkie cząsteczki zwolniły poniżej progu, wyłączamy obliczanie fizyki
    if (!particlesStillMoving) {
      isMoving = false;
      console.log("Wybuch zakończony - tło zamrożone");
    }
  }

  renderer.render(scene, camera);
}
animate();

// --- 5. RESIZE OKNA ---
window.addEventListener('resize', () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});
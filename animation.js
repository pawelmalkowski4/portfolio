import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// --- KONFIGURACJA ---
const config = {
    dotColor: 0x888888,      
    dotSize: 0.05,           
    sphereRadius: 2.5,       
    density: 4,              // Wyższa gęstość dla lepszego efektu "ściany"
    influenceRadius: 0.01,    // Zasięg magnesu na powierzchni
    magnetStrength: 0.01,     // Siła odpychania
    returnSpeed: 0.1         
};

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ 
    canvas: document.getElementById('sphereCanvas'), 
    alpha: true, 
    antialias: true 
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// 1. TEKSTURA OKRĄGŁEJ KROPKI
const circleCanvas = document.createElement('canvas');
circleCanvas.width = 64; circleCanvas.height = 64;
const ctx = circleCanvas.getContext('2d');
ctx.beginPath(); ctx.arc(32, 32, 30, 0, Math.PI * 2);
ctx.fillStyle = '#ffffff'; ctx.fill();
const circleTexture = new THREE.CanvasTexture(circleCanvas);

// 2. GEOMETRIA I OBIEKTY
const geometry = new THREE.IcosahedronGeometry(config.sphereRadius, config.density);
const baseVertices = geometry.attributes.position.array;

const positions = new Float32Array(baseVertices.length);
const targets = new Float32Array(baseVertices.length);
for (let i = 0; i < baseVertices.length; i++) {
    positions[i] = targets[i] = baseVertices[i];
}

const dotGeometry = new THREE.BufferGeometry();
dotGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

const dotMaterial = new THREE.PointsMaterial({
    size: config.dotSize,
    color: config.dotColor,
    map: circleTexture,
    transparent: true,
    alphaTest: 0.5,
    sizeAttenuation: true
});

const dots = new THREE.Points(dotGeometry, dotMaterial);
const group = new THREE.Group();
group.add(dots);
scene.add(group);

// Niewidzialna sfera pomocnicza do obliczania punktu styku myszy
const ghostSphere = new THREE.Mesh(
    new THREE.SphereGeometry(config.sphereRadius, 32, 32),
    new THREE.MeshBasicMaterial({ visible: false })
);
group.add(ghostSphere);

camera.position.z = 10;

// 3. INTERAKCJA (RAYCASTING)
const mouse = new THREE.Vector2(-999, -999);
const raycaster = new THREE.Raycaster();
let intersectPoint = null;

window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

const tempPos = new THREE.Vector3();
const dir = new THREE.Vector3();

// 4. ANIMACJA
function animate() {
    requestAnimationFrame(animate);

    // Powolny obrót
    group.rotation.y += 0.001;
    group.rotation.x += 0.0005;

    // Sprawdzamy, gdzie mysz celuje w sferę
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(ghostSphere);

    if (intersects.length > 0) {
        // Punkt styku w lokalnym układzie sfery
        intersectPoint = ghostSphere.worldToLocal(intersects[0].point.clone());
    } else {
        intersectPoint = null;
    }

    const posArray = dots.geometry.attributes.position.array;

    for (let i = 0; i < posArray.length; i += 3) {
        tempPos.set(targets[i], targets[i+1], targets[i+2]);

        if (intersectPoint) {
            const dist = tempPos.distanceTo(intersectPoint);

            if (dist < config.influenceRadius) {
                // Obliczamy odpychanie jak dwa magnesy
                dir.subVectors(tempPos, intersectPoint).normalize();
                const ratio = (config.influenceRadius - dist) / config.influenceRadius;
                const power = Math.pow(ratio, 2) * config.magnetStrength;

                posArray[i]     = targets[i]   + dir.x * power;
                posArray[i+1]   = targets[i+1] + dir.y * power;
                posArray[i+2]   = targets[i+2] + dir.z * power;
            } else {
                applyReturn(i);
            }
        } else {
            applyReturn(i);
        }
    }

    function applyReturn(i) {
        posArray[i]   += (targets[i]   - posArray[i])   * config.returnSpeed;
        posArray[i+1] += (targets[i+1] - posArray[i+1]) * config.returnSpeed;
        posArray[i+2] += (targets[i+2] - posArray[i+2]) * config.returnSpeed;
    }

    dots.geometry.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
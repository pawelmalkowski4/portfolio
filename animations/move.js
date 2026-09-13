let timeout;
let animationFrameId;
let element = document.getElementById("pikachu");

const sprites = {
  right: ["../sprites/right_1.png", "../sprites/right_2.png"],
  left: ["../sprites/left_1.png", "../sprites/left_2.png"],
  front: ["../sprites/back_1.png", "../sprites/back_2.png", "../sprites/back_3.png"],
  back: ["../sprites/front_1.png", "../sprites/front_2.png", "../sprites/front_3.png"],
};


Object.values(sprites).flat().forEach(src => {
    const img = new Image();
    img.src = src;
});

document.addEventListener('mousemove', (e) => {
    clearTimeout(timeout);
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    timeout = setTimeout(() => {
        if (!element) {
            element = document.getElementById("pikachu");
        }
        
        if (element) {
            moveTo(mouseX, mouseY);
        }
    }, 100);
});

function moveTo(mouseX, mouseY) {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }

    var rect = element.getBoundingClientRect();

    let finalX = mouseX;
    let finalY = mouseY;

    let curX = rect.left;
    let curY = rect.top;

    let dirX = finalX - curX;
    let dirY = finalY - curY;
    let distance = Math.sqrt(dirX * dirX + dirY * dirY);

    if (distance === 0) return;

    let direction = "front";
    if (Math.abs(dirX) > Math.abs(dirY)) {
        direction = dirX > 0 ? "right" : "left";
    } else {
        direction = dirY > 0 ? "back" : "front";
    }

    let speed = 2;
    let stepX = (dirX / distance) * speed;
    let stepY = (dirY / distance) * speed;

    let frameIndex = 0;
    let animationCounter = 0;
    const frameDuration = 10;

    function step(nextX, nextY) {
        if (Math.abs(nextX - finalX) < Math.abs(stepX)) nextX = finalX;
        if (Math.abs(nextY - finalY) < Math.abs(stepY)) nextY = finalY;

        if (animationCounter % frameDuration === 0) {
            const currentSprite = sprites[direction][frameIndex % sprites[direction].length];
            element.style.backgroundImage = `url('${currentSprite}')`;
            frameIndex++;
        }
        animationCounter++;

        element.style.left = nextX + "px";
        element.style.top = nextY + "px";

        if (nextX !== finalX || nextY !== finalY) {
            animationFrameId = requestAnimationFrame(function() { 
                step(nextX + stepX, nextY + stepY); 
            });
        }
    }

    step(curX, curY);
}
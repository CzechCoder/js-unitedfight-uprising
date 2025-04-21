const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const VIRTUAL_WIDTH = 1280;
const VIRTUAL_HEIGHT = 720;

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// Game variables
let cameraX = 0;
const keys = {};

// Player setup
const player = {
  x: VIRTUAL_WIDTH / 2,
  y: VIRTUAL_HEIGHT - 150,
  width: 94,
  height: 206,
  speed: 4,
  vx: 0,
  vy: 0,
  action: "idle",
  facing: "right",
  frame: 0,
  frameTimer: 0,
  frameInterval: 0.15,
};

// Stage
const backgroundImages = [];
const totalSegments = 4; // number of bg images
const backgroundWidth = 1280; // width of each background image

for (let i = 1; i <= totalSegments; i++) {
  const img = new Image();
  img.src = `image/bg_street_0${i}.jpg`;
  backgroundImages.push(img);
}

const brianSprites = {
  idle: new Image(),
  walk: new Image(),
  punch: new Image(),
};

brianSprites.idle.src = "image/brian_stand.png";
brianSprites.walk.src = "image/brian_walk.png";
brianSprites.punch.src = "image/brian_punch.png";

// Game loop
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// Update logic
function update() {
  cameraX = player.x - VIRTUAL_WIDTH / 2;

  // Clamp camera so it doesn't go beyond level bounds
  const maxCameraX = totalSegments * backgroundWidth - VIRTUAL_WIDTH;
  cameraX = Math.max(0, Math.min(maxCameraX, cameraX));

  player.vx = 0;
  player.vy = 0;

  if (keys["ArrowLeft"] || keys["a"]) player.vx = -player.speed;
  if (keys["ArrowRight"] || keys["d"]) player.vx = player.speed;
  if (keys["ArrowUp"] || keys["w"]) player.vy = -player.speed;
  if (keys["ArrowDown"] || keys["s"]) player.vy = player.speed;

  let isMoving = player.vx !== 0 || player.vy !== 0;

  if (keys[" "]) {
    player.action = "punch";
  } else if (isMoving) {
    player.action = "walk";
  } else {
    player.action = "idle";
  }

  if (player.vx < 0) player.facing = "left";
  if (player.vx > 0) player.facing = "right";

  player.x += player.vx;
  player.y += player.vy;

  const minY = 458; // top limit of movement (adjust as needed)
  const maxY = VIRTUAL_HEIGHT - player.height - 10; // bottom limit
  const levelWidth = totalSegments * backgroundWidth;

  // Optional: clamp to screen
  player.x = Math.max(0, Math.min(levelWidth - player.width, player.x));
  player.y = Math.max(minY, Math.min(maxY, player.y));
}

// Draw logic
function draw() {
  ctx.clearRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);

  // Draw scrolling background
  for (let i = 0; i < totalSegments; i++) {
    const img = backgroundImages[i];
    const drawX = i * backgroundWidth - cameraX;

    // Only draw images that are at least partially on-screen
    if (drawX + backgroundWidth > 0 && drawX < VIRTUAL_WIDTH) {
      ctx.drawImage(img, drawX, 0, backgroundWidth, VIRTUAL_HEIGHT);
    }
  }

  // Draw player
  let sprite;
  let spriteWidth = player.width;
  let spriteHeight = player.height;

  switch (player.action) {
    case "walk":
      sprite = brianSprites.walk;
      spriteWidth = 129;
      spriteHeight = 201;
      break;
    case "punch":
      sprite = brianSprites.punch;
      spriteWidth = 143;
      spriteHeight = 205;
      break;
    default:
      sprite = brianSprites.idle;
  }

  const drawX = player.x - cameraX;
  const drawY = player.y;

  ctx.save();
  if (player.facing === "left") {
    ctx.translate(drawX + player.width / 2, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(sprite, -player.width / 2, drawY, spriteWidth, spriteHeight);
  } else {
    ctx.drawImage(sprite, drawX, drawY, spriteWidth, spriteHeight);
  }
  ctx.restore();
}

// Input handling
window.addEventListener("keydown", (e) => {
  keys[e.key] = true;
});

window.addEventListener("keyup", (e) => {
  keys[e.key] = false;
});

let lastTime = performance.now();

function gameLoop(currentTime) {
  const delta = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  update(delta);
  draw();

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);

function resizeCanvas() {
  const aspect = 16 / 9;
  let width = window.innerWidth;
  let height = window.innerHeight;

  if (width / height > aspect) {
    width = height * aspect;
  } else {
    height = width / aspect;
  }

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  canvas.width = VIRTUAL_WIDTH;
  canvas.height = VIRTUAL_HEIGHT;
}

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const VIRTUAL_WIDTH = 1280;
const VIRTUAL_HEIGHT = 720;

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// Game variables
let cameraX = 0;
let punchCooldown = 0;
let punchDuration = 0.3; // seconds
let punchPressed = false;
let punchHasHit = false;
const keys = {};
const powEffects = [];

// Player setup
const player = {
  x: VIRTUAL_WIDTH / 2 - 400,
  y: VIRTUAL_HEIGHT - 350,
  width: 94,
  height: 206,
  speed: 5,
  vx: 0,
  vy: 0,
  health: 100,
  maxHealth: 100,
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

brianSprites.idle.src = "image/brian_idle.png";
brianSprites.walk.src = "image/brian_walk.png";
brianSprites.punch.src = "image/brian_punch.png";

const enemyImage = new Image();
enemyImage.src = "image/enemy_idle.png";

const enemyBossImage = new Image();
enemyBossImage.src = "image/enemy_boss_idle.png";

enemyTypes = {
  basicThug: {
    width: 114,
    height: 210,
    health: 1,
    alive: true,
    characterType: "thug",
  },
  boss: {
    width: 129,
    height: 230,
    health: 5,
    alive: true,
    characterType: "boss",
  },
};

// Arrays
const enemies = [
  { x: 800, y: 420, ...enemyTypes.basicThug },
  { x: 1100, y: 500, ...enemyTypes.basicThug },
  { x: 1500, y: 350, ...enemyTypes.basicThug },
  { x: 2000, y: 450, ...enemyTypes.basicThug },
  { x: 2400, y: 480, ...enemyTypes.basicThug },
  { x: 2800, y: 350, ...enemyTypes.basicThug },
  { x: 3100, y: 400, ...enemyTypes.basicThug },
  { x: 3500, y: 480, ...enemyTypes.basicThug },
  { x: 3800, y: 350, ...enemyTypes.basicThug },
  { x: 4600, y: 420, ...enemyTypes.boss },
];

// Game loop
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// Help functions
function checkPunchHits() {
  const punchRange = 100;
  const punchHeight = 50;

  for (const enemy of enemies) {
    if (!enemy.alive || enemy.flashTimer !== undefined) continue;

    const facing = player.facing === "right" ? 1 : -1;
    const punchX = player.x + facing * punchRange;
    const punchY = player.y + player.height / 2;

    const enemyCenterX = enemy.x + enemy.width / 2;
    const enemyCenterY = enemy.y + enemy.height / 2;

    const dx = Math.abs(punchX - enemyCenterX);
    const dy = Math.abs(punchY - enemyCenterY);

    if (
      dx < enemy.width / 2 + punchRange / 2 &&
      dy < enemy.height / 2 + punchHeight / 2
    ) {
      enemy.health -= 1;
      powEffects.push({
        x: enemy.x + enemy.width / 2,
        y: enemy.y - 20,
        timer: 0.3, // seconds
      });
      if (enemy.health <= 0) {
        enemy.flashTimer = 0.5;
      }
    }
  }
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

  const minY = 335; // top limit of movement (adjust as needed)
  const maxY = VIRTUAL_HEIGHT - player.height - 5; // bottom limit
  const levelWidth = totalSegments * backgroundWidth;

  // Optional: clamp to screen
  player.x = Math.max(0, Math.min(levelWidth - player.width, player.x));
  player.y = Math.max(minY, Math.min(maxY, player.y));

  if (player.action === "punch") {
    punchCooldown -= 1 / 60; // assuming 60fps
    if (punchCooldown <= 0) {
      player.action = "idle";
      punchCooldown = 0;
    }
  } else {
    let isMoving = player.vx !== 0 || player.vy !== 0;
    if (isMoving) {
      player.action = "walk";
    } else {
      player.action = "idle";
    }
  }

  if (player.action === "punch" && !punchHasHit) {
    checkPunchHits();
    punchHasHit = true; // make sure it only hits once per punch
  }

  for (const enemy of enemies) {
    if (enemy.flashTimer !== undefined) {
      enemy.flashTimer -= 1 / 60;
      if (enemy.flashTimer <= 0) {
        enemy.alive = false;
      }
    }
  }

  // Update POW effects
  for (let i = powEffects.length - 1; i >= 0; i--) {
    powEffects[i].timer -= 1 / 60;
    if (powEffects[i].timer <= 0) {
      powEffects.splice(i, 1); // Remove expired effect
    }
  }

  // Enemies move (basic AI)
  for (const enemy of enemies) {
    if (!enemy.alive || enemy.flashTimer !== undefined) continue;

    const screenX = enemy.x - cameraX;
    if (screenX + enemy.width < 0 || screenX > VIRTUAL_WIDTH) {
      // Offscreen: skip movement
      continue;
    }

    // Face the player
    enemy.facing = player.x < enemy.x ? "left" : "right";

    // Movement toward player
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const stopDistance = 60;
    const speed = 1.5;

    if (distance > stopDistance) {
      enemy.vx = (dx / distance) * speed;
      enemy.vy = (dy / distance) * speed;

      enemy.x += enemy.vx;
      enemy.y += enemy.vy;
    } else {
      enemy.vx = 0;
      enemy.vy = 0;
    }

    // Clamp vertical movement
    enemy.y = Math.max(
      335,
      Math.min(VIRTUAL_HEIGHT - enemy.height - 5, enemy.y)
    );
  }
}

//Drawing helpers
function drawHealthBar() {
  const barX = 30;
  const barY = 50;
  const barWidth = 450;
  const barHeight = 25;

  const healthPercent = player.health / player.maxHealth;
  const filledWidth = Math.max(0, barWidth * healthPercent); // no negative width

  // Draw red background
  ctx.fillStyle = "red";
  ctx.fillRect(barX, barY, barWidth, barHeight);

  // Draw yellow foreground
  ctx.fillStyle = "yellow";
  ctx.fillRect(barX, barY, filledWidth, barHeight);

  // Optional: Border and label
  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  ctx.strokeRect(barX, barY, barWidth, barHeight);

  ctx.font = "20px Arial";
  ctx.textAlign = "left";
  const nameGradient = ctx.createLinearGradient(0, barY - 20, 0, barY - 1); // Adjust 60 if name is wider/narrower
  nameGradient.addColorStop(0, "red");
  nameGradient.addColorStop(1, "white");
  ctx.fillStyle = nameGradient;

  // Add shadow for readability
  ctx.shadowColor = "black";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  ctx.fillText("BRIAN", barX, 45);

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
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

  // Merge all entities into a list for z-sorting
  const actors = [
    ...enemies
      .filter((e) => e.alive)
      .map((e) => ({ ...e, renderType: "enemy" })),
    { ...player, renderType: "player" },
  ];

  // Sort by y position (actors further down appear in front)
  actors.sort((a, b) => a.y - b.y);

  // Draw each actor in order
  for (const actor of actors) {
    const drawX = actor.x - cameraX;
    const drawY = actor.y;

    if (actor.renderType === "enemy") {
      // Flashing logic
      if (actor.flashTimer && Math.floor(actor.flashTimer * 10) % 2 === 0) {
        ctx.globalAlpha = 0.3;
      }

      // Pick correct sprite
      let imageToDraw;
      if (actor.characterType === "boss") {
        imageToDraw = enemyBossImage;
      } else {
        imageToDraw = enemyImage;
      }

      ctx.save();
      if (actor.facing === "right") {
        ctx.translate(drawX + actor.width / 2, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(
          imageToDraw,
          -actor.width / 2,
          drawY,
          actor.width,
          actor.height
        );
      } else {
        ctx.drawImage(imageToDraw, drawX, drawY, actor.width, actor.height);
      }
      ctx.restore();

      ctx.globalAlpha = 1;
    } else {
      let sprite = brianSprites.idle;
      let spriteWidth = actor.width;
      let spriteHeight = actor.height;

      switch (actor.action) {
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
      }

      ctx.font = "bold 32px Arial";
      ctx.fillStyle = "red";
      ctx.textAlign = "center";

      for (const pow of powEffects) {
        const screenX = pow.x - cameraX;
        ctx.fillText("POW!", screenX, pow.y);
      }

      ctx.save();
      if (actor.facing === "left") {
        ctx.translate(drawX + actor.width / 2, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(
          sprite,
          -actor.width / 2,
          drawY,
          spriteWidth,
          spriteHeight
        );
      } else {
        ctx.drawImage(sprite, drawX, drawY, spriteWidth, spriteHeight);
      }
      ctx.restore();
    }
  }

  drawHealthBar();
}

// Input handling
window.addEventListener("keydown", (e) => {
  if (!keys[e.key]) {
    keys[e.key] = true;

    if (e.key === " " && punchCooldown <= 0) {
      player.action = "punch";
      punchCooldown = punchDuration;
      punchHasHit = false;
    }
  }
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

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
let gameOver = false;
let stageClear = false;
let paused = false;
const topBoundary = 335; // sidewalk top limit
const keys = {};
const powEffects = [];

// Tweakables
const CONFIG = {
  punchRange: 100,
  punchHeight: 60,
  enemy: {
    stopDistance: 60,
    thugSpeed: 1.5,
    bossSpeed: 1.2,
    attackChance: 0.1,
    bossAttackChance: 0.2,
    cooldown: 1.2,
    bossCooldown: 0.8,
    damage: 10,
    bossDamage: 20,
  },
  item: {
    pizzaHeal: 0.5,
  },
};

// Player setup
const player = {
  x: VIRTUAL_WIDTH / 2 - 400,
  y: VIRTUAL_HEIGHT - 350,
  width: 94,
  height: 206,
  speed: 290,
  hitRange: 60,
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

const enemySprites = {
  thug: {
    idle: new Image(),
    punch: new Image(),
  },
  boss: {
    idle: new Image(),
    punch: new Image(),
  },
};

enemySprites.thug.idle.src = "image/enemy_idle.png";
enemySprites.thug.punch.src = "image/enemy_punch.png";
enemySprites.boss.idle.src = "image/enemy_boss_idle.png";
enemySprites.boss.punch.src = "image/enemy_boss_punch.png";

const pizzaImage = new Image();
pizzaImage.src = "image/item_pizza.png";

const commonEnemyProperties = {
  alive: true,
  attackCooldown: 0,
  isAttacking: false,
  attackFlashTimer: 0,
};

enemyTypes = {
  basicThug: {
    width: 114,
    height: 210,
    health: 1,
    characterType: "thug",
    ...commonEnemyProperties,
  },
  boss: {
    width: 129,
    height: 230,
    health: 5,
    characterType: "boss",
    ...commonEnemyProperties,
  },
};

const commonItemProperties = {
  pizza: {
    width: 88,
    height: 80,
    collected: false,
  },
};

// Arrays
const enemies = [
  { x: 1450, y: 420, ...enemyTypes.basicThug },
  { x: 1500, y: 500, ...enemyTypes.basicThug },
  { x: 1700, y: 350, ...enemyTypes.basicThug },
  { x: 2500, y: 450, ...enemyTypes.basicThug },
  { x: 2700, y: 480, ...enemyTypes.basicThug },
  { x: 2900, y: 350, ...enemyTypes.basicThug },
  { x: 3200, y: 400, ...enemyTypes.basicThug },
  { x: 3600, y: 480, ...enemyTypes.basicThug },
  { x: 3900, y: 350, ...enemyTypes.basicThug },
  { x: 4600, y: 420, ...enemyTypes.boss },
];

const pizzas = [
  { x: 1600, y: 500, ...commonItemProperties.pizza },
  { x: 3600, y: 500, ...commonItemProperties.pizza },
];

// Save enemies state for reset
const initialEnemies = enemies.map((e) => ({ ...e }));

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// Help functions
function checkPunchHits() {
  for (const enemy of enemies) {
    if (!enemy.alive || enemy.flashTimer !== undefined) continue;

    const facing = player.facing === "right" ? 1 : -1;
    const punchX = player.x + facing * CONFIG.punchRange;
    const punchY = player.y + player.height / 2;

    const enemyCenterX = enemy.x + enemy.width / 2;
    const enemyCenterY = enemy.y + enemy.height / 2;

    const dx = Math.abs(punchX - enemyCenterX);
    const dy = Math.abs(punchY - enemyCenterY);

    if (
      dx < enemy.width / 2 + CONFIG.punchRange / 2 &&
      dy < CONFIG.punchHeight
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resetGame() {
  // Reset player
  player.x = VIRTUAL_WIDTH / 2 - 400;
  player.y = VIRTUAL_HEIGHT - 350;
  player.health = player.maxHealth;
  player.facing = "right";

  // Reset enemies
  enemies.length = 0;
  initialEnemies.forEach((original) => {
    enemies.push({ ...original });
  });

  // Reset power-ups (pizza items)
  pizzas.forEach((pizza) => (pizza.collected = false));

  // Reset level and camera
  cameraX = 0;

  // Reset the game over and stage clear flags
  gameOver = false;
  stageClear = false;
}

function update(deltaTime = 1 / 60) {
  // Game over check (if player health reaches 0)
  if (player.health <= 0 && !gameOver) {
    gameOver = true;
    return;
  }

  // Stage clear check (if boss is defeated)
  if (
    !enemies.some((enemy) => enemy.characterType === "boss" && enemy.alive) &&
    !stageClear
  ) {
    stageClear = true;
    return;
  }

  if (!gameOver && !stageClear) {
    cameraX = player.x - VIRTUAL_WIDTH / 2;

    // Clamp camera movement so it doesn't go beyond level bounds
    const maxCameraX = totalSegments * backgroundWidth - VIRTUAL_WIDTH;
    cameraX = clamp(cameraX, 0, maxCameraX);

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

    player.x += player.vx * deltaTime;
    player.y += player.vy * deltaTime;

    const minY = topBoundary; // top limit of movement (can't go above sidewalk)
    const maxY = VIRTUAL_HEIGHT - player.height - 5;
    const levelWidth = totalSegments * backgroundWidth;

    player.x = clamp(player.x, 0, levelWidth - player.width);
    player.y = clamp(player.y, minY, maxY);

    if (player.action === "punch") {
      punchCooldown -= deltaTime;
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
      punchHasHit = true; // making sure it only hits once per punch
    }

    for (const enemy of enemies) {
      if (enemy.flashTimer !== undefined) {
        enemy.flashTimer -= deltaTime;
        if (enemy.flashTimer <= 0) {
          enemy.alive = false;
        }
      }
    }
  }

  // Update POW effects
  for (let i = powEffects.length - 1; i >= 0; i--) {
    powEffects[i].timer -= deltaTime;
    if (powEffects[i].timer <= 0) {
      powEffects.splice(i, 1); // Remove expired effect
    }
  }

  // Enemies move (basic AI)
  for (const enemy of enemies) {
    if (!enemy.alive || enemy.flashTimer !== undefined) continue;

    const screenX = enemy.x - cameraX;
    // Don't move when off-screen
    if (screenX + enemy.width < 0 || screenX > VIRTUAL_WIDTH) {
      continue;
    }

    // Face the player
    enemy.facing = player.x < enemy.x ? "left" : "right";

    // Movement toward player
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const speed = 1.5;

    if (distance > CONFIG.enemy.stopDistance) {
      enemy.vx = (dx / distance) * speed;
      enemy.vy = (dy / distance) * speed;

      enemy.x += enemy.vx;
      enemy.y += enemy.vy;
    } else {
      enemy.vx = 0;
      enemy.vy = 0;
    }

    // Clamp vertical movement
    enemy.y = clamp(enemy.y, topBoundary, VIRTUAL_HEIGHT - enemy.height - 5);

    const isBoss = enemy.characterType === "boss";
    const attackChance = isBoss
      ? CONFIG.enemy.bossAttackChance
      : CONFIG.enemy.attackChance;
    const cooldown = isBoss ? CONFIG.enemy.bossCooldown : CONFIG.enemy.cooldown;
    const damage = isBoss ? CONFIG.enemy.bossDamage : CONFIG.enemy.damage;

    // Only attempt to punch if close
    if (distance < CONFIG.enemy.stopDistance + 10 && !enemy.isAttacking) {
      if (enemy.attackCooldown <= 0 && Math.random() < attackChance) {
        enemy.isAttacking = true;
        enemy.attackFlashTimer = 0.3; // seconds
        enemy.attackCooldown = cooldown;

        // Damage the player
        const playerHitRange = player.hitRange;
        const dxHit = Math.abs(player.x - enemy.x);
        const dyHit = Math.abs(player.y - enemy.y);
        if (dxHit < playerHitRange && dyHit < player.height) {
          player.health = Math.max(0, player.health - damage); // reduce health
        }
      }
    }

    if (enemy.attackCooldown > 0) {
      enemy.attackCooldown -= deltaTime;
    }

    if (enemy.attackFlashTimer > 0) {
      enemy.attackFlashTimer -= deltaTime;
    } else {
      enemy.isAttacking = false;
    }
  }

  for (const pizza of pizzas) {
    if (!pizza.collected) {
      const dx = Math.abs(
        player.x + player.width / 2 - (pizza.x + pizza.width / 2)
      );
      const dy = Math.abs(player.y + player.height - (pizza.y + pizza.height)); // feet-to-feet

      const maxXRange = 40;
      const maxYRange = 20;

      if (dx < maxXRange && dy < maxYRange) {
        pizza.collected = true;
        const healAmount = player.maxHealth * CONFIG.item.pizzaHeal;
        player.health = Math.min(player.health + healAmount, player.maxHealth);
      }
    }
  }
}

//Drawing functions
function drawHealthBar() {
  const barX = 30;
  const barY = 50;
  const barWidth = 450;
  const barHeight = 25;

  const healthPercent = player.health / player.maxHealth;
  const filledWidth = Math.max(0, barWidth * healthPercent); // health can't go negative

  ctx.fillStyle = "red";
  ctx.fillRect(barX, barY, barWidth, barHeight);

  ctx.fillStyle = "yellow";
  ctx.fillRect(barX, barY, filledWidth, barHeight);

  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  ctx.strokeRect(barX, barY, barWidth, barHeight);

  ctx.font = "20px Arial";
  ctx.textAlign = "left";
  const nameGradient = ctx.createLinearGradient(0, barY - 20, 0, barY - 1);
  nameGradient.addColorStop(0, "red");
  nameGradient.addColorStop(1, "white");
  ctx.fillStyle = nameGradient;

  // Shadow for readability
  ctx.shadowColor = "black";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  ctx.fillText("BRIAN", barX, 45);

  // Reset shadow
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

function displayMessage(message, x, y, color = "white") {
  ctx.font = "48px Arial";
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.fillText(message, x, y);
}

function drawBossHealthBar() {
  const boss = enemies.find((e) => e.characterType === "boss" && e.alive);
  if (!boss) return;

  // Check if boss is on screen and display health bar accordingly
  const screenX = boss.x - cameraX;
  const isOnScreen = screenX + boss.width > 0 && screenX < VIRTUAL_WIDTH;

  if (!isOnScreen) return;

  const barWidth = 600;
  const barHeight = 20;
  const barX = VIRTUAL_WIDTH / 2 - barWidth / 2;
  const barY = VIRTUAL_HEIGHT - 60;

  const healthPercent = boss.health / 5;
  const filledWidth = Math.max(0, barWidth * healthPercent);

  ctx.fillStyle = "#550000";
  ctx.fillRect(barX, barY, barWidth, barHeight);

  ctx.fillStyle = "#ff4444";
  ctx.fillRect(barX, barY, filledWidth, barHeight);

  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  ctx.strokeRect(barX, barY, barWidth, barHeight);

  ctx.font = "bold 18px Arial";
  ctx.textAlign = "center";
  ctx.fillStyle = "yellow";
  ctx.shadowColor = "black";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.fillText("HECTOR - THE FINAL BOSS", VIRTUAL_WIDTH / 2, barY - 5);
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
      ctx.drawImage(img, Math.floor(drawX), 0, backgroundWidth, VIRTUAL_HEIGHT);
    }
  }

  for (const pizza of pizzas) {
    if (!pizza.collected) {
      const drawX = pizza.x - cameraX;
      const drawY = pizza.y;
      ctx.drawImage(pizzaImage, drawX, drawY, pizza.width, pizza.height);
    }
  }

  // Merge all entities into a list for z-sorting
  const actors = [
    ...enemies
      .filter((e) => e.alive)
      .map((e) => ({ ...e, renderType: "enemy" })),
    { ...player, renderType: "player" },
  ];

  // Sort by y position (characters further down appear in front)
  actors.sort((a, b) => a.y - b.y);

  // Draw each characters in order
  for (const actor of actors) {
    const drawX = actor.x - cameraX;
    const drawY = actor.y;

    if (actor.renderType === "enemy") {
      // Flicker on death: skip drawing every other frame
      const flicker =
        actor.flashTimer && Math.floor(actor.flashTimer * 10) % 2 === 0;

      if (!flicker) {
        // Pick correct sprite for enemies
        let enemySprite;
        if (actor.characterType === "boss") {
          enemySprite = actor.isAttacking
            ? enemySprites.boss.punch
            : enemySprites.boss.idle;
        } else {
          enemySprite = actor.isAttacking
            ? enemySprites.thug.punch
            : enemySprites.thug.idle;
        }

        ctx.save();
        if (actor.facing === "right") {
          ctx.translate(drawX + actor.width / 2, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(
            enemySprite,
            -actor.width / 2,
            drawY,
            actor.width,
            actor.height
          );
        } else {
          ctx.drawImage(enemySprite, drawX, drawY, actor.width, actor.height);
        }
        ctx.restore();
      }

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
  drawBossHealthBar();

  if (paused && !gameOver && !stageClear) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    displayMessage("PAUSED", VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2, "white");
    ctx.font = "24px sans-serif";
    ctx.fillText(
      "Press 'P' to resume",
      canvas.width / 2,
      canvas.height / 2 + 40
    );
  }

  if (gameOver || stageClear) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
  }

  if (gameOver) {
    displayMessage("GAME OVER", VIRTUAL_WIDTH / 2, VIRTUAL_HEIGHT / 2, "red");
    displayMessage(
      "Press 'R' to Restart",
      VIRTUAL_WIDTH / 2,
      VIRTUAL_HEIGHT / 2 + 60,
      "yellow"
    );
  } else if (stageClear) {
    displayMessage(
      "STAGE CLEAR!",
      VIRTUAL_WIDTH / 2,
      VIRTUAL_HEIGHT / 2,
      "green"
    );
    displayMessage(
      "Press 'R' to Restart",
      VIRTUAL_WIDTH / 2,
      VIRTUAL_HEIGHT / 2 + 60,
      "yellow"
    );
  }
}

// Input handling
window.addEventListener("keydown", (e) => {
  if (!keys[e.key]) {
    if (e.key === " " && punchCooldown <= 0) {
      player.action = "punch";
      punchCooldown = punchDuration;
      punchHasHit = false;
    }

    if (e.key === "r") {
      if (gameOver || stageClear) {
        resetGame();
      }
    }

    if (e.key === "p") {
      paused = !paused;
    }

    keys[e.key] = true;
  }
});

window.addEventListener("keyup", (e) => {
  keys[e.key] = false;
});

let lastTime = performance.now();

function gameLoop(time = performance.now()) {
  const deltaTime = (time - lastTime) / 1000;
  lastTime = time;

  if (!paused) {
    update(deltaTime);
  }

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

/**
 * ============================================================================
 * SCHEDULER ARCADE - ui.js
 * ============================================================================
 * Procedural pixel-art graphics renderer, tilemap engine, parallax backgrounds,
 * sprite animations, in-game HUD, Gantt timeline strip, and visual FX.
 *
 * All sprites are procedurally generated on offscreen canvases using 16-bit
 * pixel palettes with imageSmoothingEnabled = false for crisp retro aesthetics.
 * ============================================================================
 */

import { CHARACTERS } from './levels.js';

export const PALETTE = {
  bgDark: '#0d1117',
  bgSky: '#161b22',
  rackDark: '#21262d',
  rackLight: '#30363d',
  goldTrace: '#d29922',
  cyanLed: '#58a6ff',
  greenLed: '#3fb950',
  redLed: '#f85149',
  cpuBound: '#ff5555',
  ioBound: '#50fa7b',
  knightArmor: '#8be9fd',
  speedsterTrail: '#f1fa8c',
  guardCrown: '#ffb86c',
  jugglerClock: '#bd93f9',
  groundTop: '#38444d',
  groundBody: '#22272e',
  ganttBorder: '#484f58',
  white: '#ffffff',
  black: '#000000'
};

export class PixelRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    // Viewport dimensions
    this.width = canvas.width;
    this.height = canvas.height;

    // Tile metrics
    this.tileSize = 48; // 1 time unit = 48 pixels
    this.groundY = this.height - 120;

    // Camera
    this.cameraX = 0;
    this.targetCameraX = 0;
    this.isManualCamera = false;

    // Screen Shake
    this.shakeIntensity = 0;
    this.shakeDuration = 0;

    // Particles
    this.particles = [];

    // Clickable / Inspectable Cards Cache
    this.renderedCards = [];

    // Offscreen Sprite Cache
    this.sprites = {};
    this.buildProceduralSprites();
  }

  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
    this.width = w;
    this.height = h;
    this.ctx.imageSmoothingEnabled = false;
    this.groundY = this.height - 120;
  }

  triggerShake(intensity = 8, duration = 15) {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
  }

  addParticle(x, y, vx, vy, color, life, size = 3) {
    this.particles.push({ x, y, vx, vy, color, life, maxLife: life, size });
  }

  createBurst(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1.5;
      this.addParticle(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - 1.5,
        color,
        Math.floor(Math.random() * 20) + 15,
        Math.random() * 3 + 2
      );
    }
  }

  /**
   * Procedural Pixel Art Generator.
   * Creates 16x16 and 24x24 pixel sprites on dedicated offscreen canvases.
   */
  buildProceduralSprites() {
    const makeCanvas = (w, h) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      return { canvas: c, ctx };
    };

    // Helper to paint a pixel grid
    const drawGrid = (ctx, grid, colorMap, scale = 2) => {
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
          const char = grid[r][c];
          if (char !== '.' && colorMap[char]) {
            ctx.fillStyle = colorMap[char];
            ctx.fillRect(c * scale, r * scale, scale, scale);
          }
        }
      }
    };

    // 1. Queue Knight (FCFS) Sprite Frames
    const knightIdle = [
      '....BBBB........',
      '..BBSSSSBB......',
      '..BSSSSSSB......',
      '..BWWSSWWB..GG..',
      '..BSSSSSSB..GG..',
      '..BBSSSSBB.GGGG.',
      '.BBAAAABB..GGGG.',
      '.BAAAAAAB...GG..',
      '.BAAAIAAB...GG..',
      '.BAAAIAAB.......',
      '..BBAABBB.......',
      '..BBAABB........',
      '..LL..LL........',
      '..LL..LL........',
      '.LLL..LLL.......',
      '................'
    ];
    const knightRun = [
      '....BBBB........',
      '..BBSSSSBB......',
      '..BSSSSSSB......',
      '..BWWSSWWB......',
      '..BSSSSSSB.GG...',
      '..BBSSSSBB.GGGG.',
      '.BBAAAABB..GGGG.',
      '.BAAAAAAB...GG..',
      '.BAAAIAAB...GG..',
      '.BAAAIAAB.......',
      '..BBAABBB.......',
      '..LL..LL........',
      '.LL....LL.......',
      '.LL.....LL......',
      '................',
      '................'
    ];
    const knightColors = {
      B: '#1a252f', // Outline
      S: '#bdc3c7', // Steel helmet
      W: '#ecf0f1', // Visor shine
      A: '#3498db', // Blue breastplate
      I: '#2980b9', // Crest
      G: '#f1c40f', // Golden sword
      L: '#7f8c8d'  // Greaves
    };
    const cKnightIdle = makeCanvas(32, 32);
    drawGrid(cKnightIdle.ctx, knightIdle, knightColors);
    const cKnightRun = makeCanvas(32, 32);
    drawGrid(cKnightRun.ctx, knightRun, knightColors);
    this.sprites.knight_idle = cKnightIdle.canvas;
    this.sprites.knight_run = cKnightRun.canvas;

    // 2. Speedster (SJF) Sprites
    const speedIdle = [
      '....GGGG........',
      '..GGYYYYGG......',
      '..GYYYYYYG......',
      '..GWWYYWWG......',
      '..GYYYYYYG......',
      '..GGYYYYGG......',
      '..CCGGGGCC......',
      '..CGGGGGGC......',
      '..CGGGGGGC......',
      '..CGGGGGGC......',
      '...CGGGGC.......',
      '...LL..LL.......',
      '...LL..LL.......',
      '...LL..LL.......',
      '..LLL..LLL......',
      '................'
    ];
    const speedRun = [
      '......GGGG......',
      '....GGYYYYGG....',
      '....GYYYYYYG....',
      '....GWWYYWWG....',
      '....GGYYYYGG....',
      '...CCGGGGCC.....',
      '..CGGGGGGC......',
      '..CGGGGGGC......',
      '..CGGGGGGC......',
      '...CGGGGC.......',
      '....LL..........',
      '...LL...LL......',
      '..LL.....LL.....',
      '..LL......LL....',
      '................',
      '................'
    ];
    const speedColors = {
      G: '#1e8449',
      Y: '#2ecc71',
      W: '#ffffff',
      C: '#27ae60',
      L: '#f1fa8c'
    };
    const cSpeedIdle = makeCanvas(32, 32);
    drawGrid(cSpeedIdle.ctx, speedIdle, speedColors);
    const cSpeedRun = makeCanvas(32, 32);
    drawGrid(cSpeedRun.ctx, speedRun, speedColors);
    this.sprites.speedster_idle = cSpeedIdle.canvas;
    this.sprites.speedster_run = cSpeedRun.canvas;

    // 3. Royal Guard (Priority) Sprites
    const guardIdle = [
      '..YYYYYYYY......',
      '..YRYRYRYR......',
      '..GGGGGGGG......',
      '..GWWGGWWG..SS..',
      '..GGGGGGGG..SS..',
      '..RRRRRRRR.SSSS.',
      '.RRROOOORR.SSSS.',
      '.RROOOOOOR..SS..',
      '.RROOOOOOR..SS..',
      '.RROOOOOOR..SS..',
      '..RRRRRRRR......',
      '...LL..LL.......',
      '...LL..LL.......',
      '...LL..LL.......',
      '..LLL..LLL......',
      '................'
    ];
    const guardRun = [
      '..YYYYYYYY......',
      '..YRYRYRYR......',
      '..GGGGGGGG......',
      '..GWWGGWWG......',
      '..GGGGGGGG..SS..',
      '..RRRRRRRR.SSSS.',
      '.RRROOOORR.SSSS.',
      '.RROOOOOOR..SS..',
      '.RROOOOOOR..SS..',
      '..RRRRRRRR..SS..',
      '....LL..........',
      '...LL..LL.......',
      '..LL....LL......',
      '.LL......LL.....',
      '................',
      '................'
    ];
    const guardColors = {
      Y: '#f39c12', // Gold crown
      R: '#c0392b', // Crimson cape
      G: '#f1c40f', // Helmet
      W: '#ffffff',
      O: '#d35400',
      S: '#f1c40f', // Scepter
      L: '#2c3e50'
    };
    const cGuardIdle = makeCanvas(32, 32);
    drawGrid(cGuardIdle.ctx, guardIdle, guardColors);
    const cGuardRun = makeCanvas(32, 32);
    drawGrid(cGuardRun.ctx, guardRun, guardColors);
    this.sprites.guard_idle = cGuardIdle.canvas;
    this.sprites.guard_run = cGuardRun.canvas;

    // 4. Time Juggler (Round Robin) Sprites
    const jugglerIdle = [
      '....PPPP........',
      '..PPPPPPPP......',
      '..PWWPPWWP..CC..',
      '..PPPPPPPP.CCCC.',
      '..VVPPPPVV..CC..',
      '.VVVVVVVVVV.....',
      '.VVVVVVVVVV.....',
      '.VVVVVVVVVV.CC..',
      '..VVVVVVVV.CCCC.',
      '..VVVVVVVV..CC..',
      '...LL..LL.......',
      '...LL..LL.......',
      '...LL..LL.......',
      '..LLL..LLL......',
      '................',
      '................'
    ];
    const jugglerColors = {
      P: '#8e44ad',
      W: '#ffffff',
      V: '#9b59b6',
      C: '#f1c40f', // Orbiting clock
      L: '#34495e'
    };
    const cJugglerIdle = makeCanvas(32, 32);
    drawGrid(cJugglerIdle.ctx, jugglerIdle, jugglerColors);
    this.sprites.juggler_idle = cJugglerIdle.canvas;
    this.sprites.juggler_run = cJugglerIdle.canvas;

    // 5. CPU-Bound Process Sprite (Red Golem)
    const cpuBoundGrid = [
      '..RRRRRRRR......',
      '.RRRRRRRRRR.....',
      '.RRWWWRRWWWR....',
      '.RRWWWRRWWWR....',
      '.RRRRRRRRRR.....',
      '.RRRROOOORRR....',
      '.RROOOOOOOOR....',
      '.RROOOOOOOOR....',
      '.RROOOOOOOOR....',
      '.RRRRRRRRRR.....',
      '..RR....RR......',
      '..RR....RR......',
      '.RRR....RRR.....',
      '................',
      '................',
      '................'
    ];
    const cpuColors = {
      R: '#c0392b',
      W: '#f39c12',
      O: '#e74c3c'
    };
    const cCpu = makeCanvas(32, 32);
    drawGrid(cCpu.ctx, cpuBoundGrid, cpuColors);
    this.sprites.cpu_bound = cCpu.canvas;

    // 6. I/O-Bound Process Sprite (Cyan Drone)
    const ioBoundGrid = [
      '.....BB.........',
      '....BBBB........',
      '..BBCCCCBB......',
      '..BCCWWCCB......',
      '..BCCWWCCB......',
      '..BBCCCCBB......',
      '....BBBB........',
      '..BB....BB......',
      '.BB......BB.....',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................'
    ];
    const ioColors = {
      B: '#16a085',
      C: '#1abc9c',
      W: '#ffffff'
    };
    const cIo = makeCanvas(32, 32);
    drawGrid(cIo.ctx, ioBoundGrid, ioColors);
    this.sprites.io_bound = cIo.canvas;

    // 7. Boss Sprite: Memory Hog (Huge Armored Cyber-Boar)
    const hogCanvas = makeCanvas(48, 48);
    const hctx = hogCanvas.ctx;
    hctx.fillStyle = '#78281f';
    hctx.fillRect(4, 8, 40, 32);
    hctx.fillStyle = '#b03a2e';
    hctx.fillRect(8, 12, 32, 24);
    // Glowing red eyes
    hctx.fillStyle = '#f4d03f';
    hctx.fillRect(10, 16, 6, 6);
    hctx.fillRect(32, 16, 6, 6);
    // Tusks
    hctx.fillStyle = '#ecf0f1';
    hctx.fillRect(6, 28, 4, 10);
    hctx.fillRect(38, 28, 4, 10);
    // Exhaust Pipes
    hctx.fillStyle = '#34495e';
    hctx.fillRect(12, 0, 6, 8);
    hctx.fillRect(30, 0, 6, 8);
    this.sprites.memory_hog = hogCanvas.canvas;
  }

  /**
   * Main rendering pass.
   */
  render(engine, frameCount = 0) {
    const ctx = this.ctx;
    this.renderedCards = [];

    // Handle screen shake
    ctx.save();
    if (this.shakeDuration > 0) {
      const offsetX = (Math.random() - 0.5) * this.shakeIntensity;
      const offsetY = (Math.random() - 0.5) * this.shakeIntensity;
      ctx.translate(offsetX, offsetY);
      this.shakeDuration--;
    }

    // Camera follow logic
    if (!this.isManualCamera) {
      const activeCharX = engine.simTime * this.tileSize;
      this.targetCameraX = Math.max(0, activeCharX - this.width * 0.35);
    }
    this.cameraX += (this.targetCameraX - this.cameraX) * 0.15;

    // 1. Clear & Background Parallax
    this.renderParallaxBackground(frameCount);

    // 2. Tile World & Gantt Strip Ground
    this.renderGanttGround(engine, frameCount);

    // 3. Characters & Entities
    this.renderEntities(engine, frameCount);

    // 4. Particle FX
    this.renderParticles();

    // 5. In-Game HUD & Resources
    this.renderHUD(engine);

    ctx.restore();
  }

  /**
   * Dual Render for Split-Screen Versus Mode!
   */
  renderVersus(engine1, engine2, frameCount = 0) {
    const ctx = this.ctx;
    const halfH = Math.floor(this.height / 2);

    // Top Viewport (Player 1)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, this.width, halfH - 2);
    ctx.clip();
    this.groundY = halfH - 60;
    this.render(engine1, frameCount);
    // Label
    ctx.fillStyle = '#f1c40f';
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.fillText(`LANE 1: ${engine1.algoKey.toUpperCase()}`, 20, 30);
    ctx.restore();

    // Divider Line
    ctx.fillStyle = '#58a6ff';
    ctx.fillRect(0, halfH - 2, this.width, 4);

    // Bottom Viewport (Player 2)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, halfH + 2, this.width, halfH - 2);
    ctx.clip();
    ctx.translate(0, halfH);
    this.groundY = halfH - 60;
    this.render(engine2, frameCount);
    // Label
    ctx.fillStyle = '#2ecc71';
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.fillText(`LANE 2: ${engine2.algoKey.toUpperCase()}`, 20, 30);
    ctx.restore();

    // Reset groundY
    this.groundY = this.height - 120;
  }

  renderParallaxBackground(frameCount) {
    const ctx = this.ctx;

    // Deep Circuit Sky
    ctx.fillStyle = PALETTE.bgDark;
    ctx.fillRect(0, 0, this.width, this.height);

    // Layer 1: Circuit Board Traces (Slow scroll)
    const layer1X = -(this.cameraX * 0.2) % 120;
    ctx.strokeStyle = PALETTE.rackDark;
    ctx.lineWidth = 2;
    for (let x = layer1X; x < this.width + 120; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 30, this.height * 0.4);
      ctx.lineTo(x + 30, this.height * 0.7);
      ctx.stroke();

      // Blinking PCB Nodes
      const blink = Math.sin(frameCount * 0.05 + x) > 0;
      ctx.fillStyle = blink ? PALETTE.cyanLed : PALETTE.rackLight;
      ctx.fillRect(x + 28, this.height * 0.4 - 2, 5, 5);
    }

    // Layer 2: Server Racks (Medium scroll)
    const layer2X = -(this.cameraX * 0.5) % 160;
    for (let x = layer2X; x < this.width + 160; x += 80) {
      ctx.fillStyle = PALETTE.rackDark;
      ctx.fillRect(x, this.groundY - 140, 70, 140);
      ctx.fillStyle = PALETTE.rackLight;
      ctx.fillRect(x + 4, this.groundY - 136, 62, 132);

      // Server rack LED rows
      for (let slot = 0; slot < 5; slot++) {
        const slotY = this.groundY - 130 + slot * 24;
        ctx.fillStyle = PALETTE.bgDark;
        ctx.fillRect(x + 8, slotY, 54, 18);

        // Blinking LEDs
        const isGreen = (x + slot + Math.floor(frameCount / 15)) % 3 === 0;
        ctx.fillStyle = isGreen ? PALETTE.greenLed : PALETTE.redLed;
        ctx.fillRect(x + 12, slotY + 7, 4, 4);
        ctx.fillStyle = PALETTE.cyanLed;
        ctx.fillRect(x + 20, slotY + 7, 4, 4);
      }
    }
  }

  /**
   * One Tile Column = One Time Unit Gantt Ground!
   */
  renderGanttGround(engine, frameCount) {
    const ctx = this.ctx;
    const startTick = Math.max(0, Math.floor(this.cameraX / this.tileSize));
    const endTick = startTick + Math.ceil(this.width / this.tileSize) + 2;

    // Ground Bed
    ctx.fillStyle = PALETTE.groundBody;
    ctx.fillRect(0, this.groundY, this.width, this.height - this.groundY);

    // Timeline Blocks & Ticks
    for (let tick = startTick; tick < endTick; tick++) {
      const worldX = tick * this.tileSize;
      const screenX = worldX - this.cameraX;

      // Find timeline slice covering this tick
      let sliceOwner = null;
      for (const slice of engine.timeline) {
        if (tick >= slice.start && tick < slice.end) {
          sliceOwner = slice.pid;
          break;
        }
      }

      // If active current tick is running
      if (tick === engine.simTime && engine.runningProcess) {
        sliceOwner = engine.runningProcess.pid;
      }

      // Draw Gantt Tile Strip
      if (sliceOwner === 'IDLE' || sliceOwner === null) {
        ctx.fillStyle = '#2c3e50';
      } else if (sliceOwner === 'CS') {
        ctx.fillStyle = '#e74c3c'; // Context switch tax tile
      } else {
        // Color hash based on PID string
        ctx.fillStyle = this.getColorForPid(sliceOwner);
      }

      ctx.fillRect(screenX, this.groundY, this.tileSize, 28);

      // Border & Grid Lines
      ctx.strokeStyle = PALETTE.ganttBorder;
      ctx.lineWidth = 1;
      ctx.strokeRect(screenX, this.groundY, this.tileSize, 28);

      // Tick Label & Owner text
      ctx.fillStyle = '#ffffff';
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      if (sliceOwner && sliceOwner !== 'IDLE') {
        ctx.fillText(sliceOwner.length > 5 ? sliceOwner.substring(0, 4) : sliceOwner, screenX + this.tileSize / 2, this.groundY + 16);
      } else {
        ctx.fillStyle = '#7f8c8d';
        ctx.fillText('-', screenX + this.tileSize / 2, this.groundY + 16);
      }

      // Time Unit Numbering under tile
      ctx.fillStyle = '#95a5a6';
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillText(`${tick}`, screenX + this.tileSize / 2, this.groundY + 44);

      // Silicon Traces beneath Gantt
      ctx.fillStyle = PALETTE.goldTrace;
      ctx.fillRect(screenX + 10, this.groundY + 54, this.tileSize - 20, 2);
    }
  }

  getColorForPid(pid) {
    if (!pid) return '#34495e';
    let hash = 0;
    for (let i = 0; i < pid.length; i++) {
      hash = pid.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = ['#2980b9', '#27ae60', '#8e44ad', '#d35400', '#16a085', '#c0392b', '#f39c12'];
    return colors[Math.abs(hash) % colors.length];
  }

  renderEntities(engine, frameCount) {
    const ctx = this.ctx;

    // 1. Render Active Algorithm Character
    const charMeta = CHARACTERS[engine.algoKey] || CHARACTERS.fcfs;
    const charWorldX = engine.simTime * this.tileSize;
    const charScreenX = charWorldX - this.cameraX;
    const charScreenY = this.groundY - 42;

    const isRunning = engine.runningProcess !== null;
    const spriteKey = `${charMeta.spriteKey}_${isRunning && (Math.floor(frameCount / 8) % 2 === 0) ? 'run' : 'idle'}`;
    const charSprite = this.sprites[spriteKey] || this.sprites.knight_idle;

    // Speedster Lightning Trail
    if (engine.algoKey === 'sjf' && isRunning) {
      ctx.fillStyle = 'rgba(241, 250, 140, 0.35)';
      ctx.fillRect(charScreenX - 20, charScreenY + 10, 24, 18);
    }

    // Time Juggler Orbiting Clocks
    if (engine.algoKey === 'rr' && isRunning) {
      const angle = frameCount * 0.12;
      const orbitX = charScreenX + 16 + Math.cos(angle) * 22;
      const orbitY = charScreenY + 8 + Math.sin(angle) * 14;
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(orbitX, orbitY, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Character Sprite
    if (charSprite) {
      ctx.drawImage(charSprite, charScreenX, charScreenY, 36, 36);
    }

    // Character Name Tag
    ctx.fillStyle = '#ffffff';
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(charMeta.name, charScreenX + 18, charScreenY - 8);

    // 2. Render Hardware CPU Socket with Bus Lines & Flow Arrows
    const socketX = charScreenX + 46;
    const socketY = this.groundY - 46;
    const socketW = 50;
    const socketH = 42;
    this.renderCpuSocket(socketX, socketY, socketW, socketH, engine, frameCount);

    // Data Flow Indicator: READY QUEUE ---> CPU SOCKET
    ctx.fillStyle = '#8b949e';
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('[READY] ->', charScreenX - 10, this.groundY - 48);

    // 3. Render Running Process inside the CPU Core Socket
    if (engine.runningProcess) {
      const proc = engine.runningProcess;
      const procX = socketX + (socketW - (proc.pid.includes('BOSS') ? 48 : 32)) / 2;
      const procY = this.groundY - 40;
      this.renderProcessCard(proc, procX, procY, true, frameCount, { state: 'running' });
    }

    // Pre-calculate Decision Overlays for Ready Queue
    let minBurstProc = null;
    let highestPrioProc = null;
    if (engine.readyQueue.length > 0) {
      if (engine.algoKey === 'sjf') {
        minBurstProc = engine.readyQueue.reduce((min, p) => (p.remaining < min.remaining ? p : min), engine.readyQueue[0]);
      } else if (engine.algoKey === 'priority') {
        highestPrioProc = engine.readyQueue.reduce((best, p) => (p.effectivePriority < best.effectivePriority ? p : best), engine.readyQueue[0]);
      }
    }

    // 4. Render Ready Queue Waiting Processes with Algorithm Overlays
    let queueOffset = 0;
    for (const proc of engine.readyQueue) {
      const qX = charScreenX - 60 - queueOffset * 52;
      const qY = this.groundY - 40;

      const overlayMeta = {
        state: 'ready',
        queueIndex: queueOffset
      };

      if (engine.algoKey === 'fcfs') {
        overlayMeta.rank = queueOffset + 1;
      } else if (engine.algoKey === 'sjf' && proc === minBurstProc) {
        overlayMeta.minBadge = true;
      } else if (engine.algoKey === 'priority') {
        if (proc === highestPrioProc) overlayMeta.prioBadge = true;
        if (proc.waitTicks > 0 && proc.effectivePriority < proc.priority) overlayMeta.aged = true;
      } else if (engine.algoKey === 'mlfq') {
        overlayMeta.tier = 'Q' + (proc.queueLevel ?? 0);
      }

      this.renderProcessCard(proc, qX, qY, false, frameCount, overlayMeta);
      queueOffset++;
    }

    // Convoy Effect Traffic Jam Animation (Warning banner & exhaust smoke)
    const isConvoyActive = engine.runningProcess && 
                           engine.runningProcess.type === 'cpu' && 
                           engine.runningProcess.remaining >= 3 && 
                           engine.readyQueue.length >= 2;

    if (isConvoyActive) {
      const jamX = charScreenX - 55 - (engine.readyQueue.length * 24);
      const jamY = this.groundY - 76;
      
      ctx.fillStyle = 'rgba(231, 76, 60, 0.9)';
      ctx.fillRect(jamX - 75, jamY, 150, 18);
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 1;
      ctx.strokeRect(jamX - 75, jamY, 150, 18);

      ctx.fillStyle = '#ffffff';
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      const blink = Math.floor(frameCount / 15) % 2 === 0;
      ctx.fillText(blink ? '⚠ CONVOY TRAFFIC JAM ⚠' : '⚡ JOBS BLOCKED ⚡', jamX, jamY + 12);

      // Puffs of smoke from the stalled line
      if (frameCount % 6 === 0) {
        this.addParticle(
          charWorldX + 30,
          this.groundY - 25,
          -1.5 - Math.random(),
          -0.5 - Math.random() * 0.5,
          '#7f8c8d',
          25,
          4
        );
      }
    }

    // 5. Render Unarrived Incoming Processes Ahead on Timeline
    for (const proc of engine.incomingPool) {
      const pWorldX = proc.arrival * this.tileSize;
      const pScreenX = pWorldX - this.cameraX;
      if (pScreenX > -50 && pScreenX < this.width + 50) {
        this.renderProcessCard(proc, pScreenX, this.groundY - 40, false, frameCount, { state: 'incoming' });
      }
    }
  }

  renderCpuSocket(x, y, w, h, engine, frameCount) {
    const ctx = this.ctx;
    const isBusy = engine.runningProcess !== null;
    const isCs = engine.contextSwitchFreeze > 0;

    // Outer Socket Base Plate
    ctx.fillStyle = '#161b22';
    ctx.fillRect(x - 6, y - 8, w + 12, h + 16);

    // Glowing border (Green if computing, Red if CS, Blue/Dark if idle)
    let borderColor = '#30363d';
    if (isCs) borderColor = '#e74c3c';
    else if (isBusy) borderColor = (Math.floor(frameCount / 10) % 2 === 0) ? '#3fb950' : '#2ea043';

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 6, y - 8, w + 12, h + 16);

    // Gold Corner Screws / Pins
    ctx.fillStyle = '#d29922';
    ctx.fillRect(x - 4, y - 6, 3, 3);
    ctx.fillRect(x + w + 1, y - 6, 3, 3);
    ctx.fillRect(x - 4, y + h + 5, 3, 3);
    ctx.fillRect(x + w + 1, y + h + 5, 3, 3);

    // Electronic Circuit Pins at bottom
    for (let p = 0; p < 5; p++) {
      ctx.fillStyle = (isBusy && (frameCount + p) % 3 === 0) ? '#58a6ff' : '#21262d';
      ctx.fillRect(x + p * 10 + 4, y + h + 8, 4, 3);
    }

    // Socket Top Header Label
    ctx.fillStyle = isBusy ? '#58a6ff' : '#8b949e';
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('[CPU CORE]', x + w / 2, y - 12);

    // Status under socket
    ctx.fillStyle = isCs ? '#e74c3c' : (isBusy ? '#3fb950' : '#484f58');
    ctx.font = '6px "Press Start 2P", monospace';
    const statusText = isCs ? 'CS OVERHEAD' : (isBusy ? 'COMPUTING' : 'IDLE');
    ctx.fillText(statusText, x + w / 2, y + h + 18);

    // If RR or MLFQ: Render Quantum Slice Progress Bar
    if ((engine.algoKey === 'rr' || engine.algoKey === 'mlfq') && isBusy) {
      const qRem = engine.quantumRemaining ?? engine.quantum;
      const qTotal = engine.quantum || 3;
      const qW = w + 12;
      const qH = 5;
      const qY = y - 22;

      ctx.fillStyle = '#0d1117';
      ctx.fillRect(x - 6, qY, qW, qH);
      ctx.strokeStyle = '#bd93f9';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 6, qY, qW, qH);

      const fillW = Math.max(0, Math.floor((qRem / qTotal) * qW));
      ctx.fillStyle = qRem <= 1 ? '#ff7b72' : '#bd93f9';
      ctx.fillRect(x - 6, qY, fillW, qH);

      ctx.fillStyle = '#ffffff';
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillText(`SLICE ${qRem}/${qTotal}`, x + w / 2, qY - 3);
    }
  }

  renderProcessCard(proc, x, y, isExecuting, frameCount, overlayMeta = {}) {
    const ctx = this.ctx;
    const isBoss = proc.pid.includes('BOSS') || proc.burst > 20;

    // Sprite
    let sprite = proc.type === 'io' ? this.sprites.io_bound : this.sprites.cpu_bound;
    if (isBoss) sprite = this.sprites.memory_hog;

    const size = isBoss ? 48 : 32;
    const drawY = isBoss ? y - 16 : y;

    // Register clickable bounding box for interactive inspection
    this.renderedCards.push({
      proc,
      x,
      y: drawY,
      width: size,
      height: size,
      isExecuting,
      overlayMeta
    });

    if (sprite) {
      // Bobbing animation
      const bob = isExecuting ? Math.sin(frameCount * 0.2) * 3 : 0;
      ctx.drawImage(sprite, x, drawY + bob, size, size);
    }

    // Process Info Badge (PID, Rem, Priority)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(x - 6, drawY - 22, size + 12, 18);
    ctx.strokeStyle = proc.type === 'io' ? '#1abc9c' : '#e74c3c';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 6, drawY - 22, size + 12, 18);

    ctx.fillStyle = '#ffffff';
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${proc.pid}`, x + size / 2, drawY - 12);
    ctx.fillStyle = '#f1c40f';
    ctx.fillText(`R:${proc.remaining} P:${proc.effectivePriority ?? proc.priority}`, x + size / 2, drawY - 4);

    // Algorithm Decision Overlays (Visual Indicators)
    if (overlayMeta.rank) {
      // FCFS Queue Rank
      ctx.fillStyle = overlayMeta.rank === 1 ? '#388bfd' : '#21262d';
      ctx.fillRect(x - 6, drawY - 34, size + 12, 10);
      ctx.strokeStyle = overlayMeta.rank === 1 ? '#58a6ff' : '#484f58';
      ctx.strokeRect(x - 6, drawY - 34, size + 12, 10);
      ctx.fillStyle = '#ffffff';
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillText(overlayMeta.rank === 1 ? '#1 NEXT' : `#${overlayMeta.rank}`, x + size / 2, drawY - 26);
    } else if (overlayMeta.minBadge) {
      // SJF Shortest Job Highlight
      const pulse = Math.floor(frameCount / 8) % 2 === 0;
      ctx.fillStyle = pulse ? '#d29922' : '#9e6a03';
      ctx.fillRect(x - 8, drawY - 35, size + 16, 11);
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 8, drawY - 35, size + 16, 11);
      ctx.fillStyle = '#000000';
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillText('★ MIN', x + size / 2, drawY - 27);
    } else if (overlayMeta.prioBadge) {
      // Priority VIP Crown Highlight
      ctx.fillStyle = '#f39c12';
      ctx.fillRect(x - 6, drawY - 34, size + 12, 10);
      ctx.strokeStyle = '#f1c40f';
      ctx.strokeRect(x - 6, drawY - 34, size + 12, 10);
      ctx.fillStyle = '#000000';
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillText('👑 VIP', x + size / 2, drawY - 26);
    } else if (overlayMeta.tier) {
      // MLFQ Tier Badge
      ctx.fillStyle = '#6f42c1';
      ctx.fillRect(x - 6, drawY - 34, size + 12, 10);
      ctx.strokeStyle = '#d2a8ff';
      ctx.strokeRect(x - 6, drawY - 34, size + 12, 10);
      ctx.fillStyle = '#ffffff';
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillText(overlayMeta.tier, x + size / 2, drawY - 26);
    }

    if (overlayMeta.aged) {
      // Aging Promotion indicator
      ctx.fillStyle = '#238636';
      ctx.fillRect(x - 6, drawY + size + 2, size + 12, 9);
      ctx.fillStyle = '#3fb950';
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillText('▲ AGED', x + size / 2, drawY + size + 9);
    }

    // Starvation Hunger Meter (above badge)
    if (!isExecuting && proc.waitTicks !== undefined) {
      const maxWait = 14;
      const hungerRatio = Math.min(1, proc.waitTicks / maxWait);
      const barW = size + 10;
      ctx.fillStyle = '#111111';
      ctx.fillRect(x - 5, drawY - 28, barW, 4);

      // Turns blazing red as starvation nears SLA violation
      ctx.fillStyle = hungerRatio > 0.7 ? '#ff0033' : '#f39c12';
      ctx.fillRect(x - 5, drawY - 28, barW * hungerRatio, 4);
    }
  }

  getProcessAt(screenX, screenY) {
    for (let i = this.renderedCards.length - 1; i >= 0; i--) {
      const card = this.renderedCards[i];
      if (
        screenX >= card.x - 8 &&
        screenX <= card.x + card.width + 8 &&
        screenY >= card.y - 36 &&
        screenY <= card.y + card.height + 14
      ) {
        return card;
      }
    }
    return null;
  }

  renderParticles() {
    const ctx = this.ctx;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      const alpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.fillRect(p.x - this.cameraX, p.y, p.size, p.size);
      ctx.globalAlpha = 1.0;
    }
  }

  /**
   * Comprehensive In-Game Top HUD.
   */
  renderHUD(engine) {
    const ctx = this.ctx;
    const metrics = engine.getLiveMetrics();

    // Top Bar Background with Chunky Retro Border
    ctx.fillStyle = 'rgba(13, 17, 23, 0.92)';
    ctx.fillRect(0, 0, this.width, 48);
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, this.width, 48);

    // 1. Lives / Hearts (Allowed SLA Violations)
    ctx.textAlign = 'left';
    ctx.font = '9px "Press Start 2P", monospace';
    ctx.fillStyle = engine.hearts > 1 ? '#ff5555' : '#ff0033';
    let heartBlocks = '';
    for (let h = 0; h < engine.maxHearts; h++) {
      heartBlocks += h < engine.hearts ? '■ ' : '□ ';
    }
    ctx.fillText(`SLA: [${heartBlocks.trim()}]`, 16, 20);

    // 2. Score
    ctx.fillStyle = '#f1fa8c';
    ctx.font = '9px "Press Start 2P", monospace';
    ctx.fillText(`SCORE:${engine.score}`, 16, 38);

    // 3. Sim Clock (Timer)
    ctx.fillStyle = '#58a6ff';
    ctx.fillText(`TICK:${engine.simTime}`, 160, 20);

    // 4. Ready Queue Size
    ctx.fillStyle = '#a371f7';
    ctx.fillText(`QUEUE:${engine.readyQueue.length}`, 160, 38);

    // 5. Context Switch Counter & Tax
    ctx.fillStyle = '#ff7b72';
    ctx.fillText(`CS:${metrics.contextSwitches}`, 280, 20);

    // 6. Live Avg Waiting Time
    ctx.fillStyle = '#7ee787';
    ctx.fillText(`WT:${metrics.avgWT}`, 280, 38);

    // 7. CPU Utilization Bar Gauge
    const barX = Math.min(this.width - 220, 390);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`CPU UTIL: ${metrics.cpuUtil}%`, barX, 20);

    ctx.fillStyle = '#21262d';
    ctx.fillRect(barX, 28, 140, 10);
    ctx.fillStyle = metrics.cpuUtil > 80 ? '#3fb950' : (metrics.cpuUtil > 40 ? '#d29922' : '#f85149');
    ctx.fillRect(barX, 28, Math.floor((metrics.cpuUtil / 100) * 140), 10);
    ctx.strokeStyle = '#484f58';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, 28, 140, 10);

    // Algorithm & Power Mode Tag
    const charMeta = CHARACTERS[engine.algoKey] || CHARACTERS.fcfs;
    ctx.textAlign = 'right';
    ctx.fillStyle = charMeta.color;
    ctx.fillText(`[${charMeta.algoName.toUpperCase()}]`, this.width - 20, 20);
    ctx.fillStyle = '#8b949e';
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillText(`PWR: ${charMeta.powerName}`, this.width - 20, 36);
  }
}

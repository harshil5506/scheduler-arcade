/**
 * ============================================================================
 * SCHEDULER ARCADE - main.js
 * ============================================================================
 * Main bootstrap, game loop, input controller, and UI orchestrator.
 * Connects SimulationEngine, PixelRenderer, SoundEngine, and DOM overlays.
 * ============================================================================
 */

import { SimulationEngine, GAME_STATES, GAME_MODES } from './engine.js';
import { PixelRenderer } from './ui.js';
import { audio } from './audio.js';
import { CHARACTERS, PUZZLE_LEVELS, DRAFT_SCENARIOS, BOSS_ENCOUNTER, SURVIVAL_CONFIG } from './levels.js';
import { roundRobin, cloneProcesses } from './scheduler.js';

class GameController {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new PixelRenderer(this.canvas);
    this.engine1 = new SimulationEngine({ name: 'LANE_1' });
    this.engine2 = new SimulationEngine({ name: 'LANE_2' }); // For Versus

    // Current Game Context
    this.currentMode = GAME_MODES.SANDBOX;
    this.selectedChar = 'fcfs';
    this.currentLevelIndex = 0;
    this.unlockedLevels = 1;
    this.levelStars = {};
    this.activeDraftScenario = null;
    this.enableScreenShake = true;

    // Simulation Timing
    this.lastTime = performance.now();
    this.simAccumulator = 0;
    this.simTickInterval = 600; // ms per tick at 1x speed
    this.speedMultiplier = 1.0;
    this.isPaused = true;
    this.frameCount = 0;

    // Sandbox state
    this.sandboxProcesses = [
      { pid: 'P1', arrival: 0, burst: 5, priority: 2, type: 'cpu' },
      { pid: 'P2', arrival: 1, burst: 3, priority: 1, type: 'io' },
      { pid: 'P3', arrival: 2, burst: 6, priority: 3, type: 'cpu' }
    ];

    this.loadPersistedData();
    this.setupEventListeners();
    this.setupEngineHooks();
    this.setupSandboxUI();
    this.setupTunerMinigame();

    // Start in Sandbox or Menu
    this.engine1.loadWorkload(this.sandboxProcesses, GAME_MODES.SANDBOX, this.selectedChar);
    this.updateControlsBarState();

    // Launch RAF game loop
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  loadPersistedData() {
    try {
      const savedStars = localStorage.getItem('scheduler_arcade_stars');
      if (savedStars) this.levelStars = JSON.parse(savedStars);
      const savedUnlocked = localStorage.getItem('scheduler_arcade_unlocked');
      if (savedUnlocked) this.unlockedLevels = parseInt(savedUnlocked, 10) || 1;
    } catch (e) {
      // LocalStorage unavailable, proceed with defaults
    }
  }

  savePersistedData() {
    try {
      localStorage.setItem('scheduler_arcade_stars', JSON.stringify(this.levelStars));
      localStorage.setItem('scheduler_arcade_unlocked', String(this.unlockedLevels));
    } catch (e) {
      // Ignore
    }
  }

  setupEngineHooks() {
    // Engine 1 Sound & Shake hooks
    this.engine1.on((type, data) => {
      switch (type) {
        case 'dispatch':
          audio.playAttack();
          break;
        case 'context_switch':
          audio.playContextSwitch();
          if (this.enableScreenShake) this.renderer.triggerShake(7, 14);
          this.renderer.createBurst(
            this.engine1.simTime * this.renderer.tileSize,
            this.renderer.groundY - 20,
            '#e74c3c',
            10
          );
          break;
        case 'complete':
          audio.playComplete();
          this.renderer.createBurst(
            this.engine1.simTime * this.renderer.tileSize,
            this.renderer.groundY - 30,
            '#2ecc71',
            15
          );
          break;
        case 'preempt':
          audio.playPreempt();
          break;
        case 'starvation_warning':
          audio.playStarvationAlert();
          break;
        case 'sla_violation':
          audio.playHurt();
          if (this.enableScreenShake) this.renderer.triggerShake(12, 20);
          break;
        case 'victory':
          audio.playVictory();
          this.handleVictory(this.engine1);
          break;
        case 'defeat':
          audio.playDefeat();
          this.handleDefeat(this.engine1);
          break;
        case 'kernel_log':
          this.appendKernelLog(data);
          break;
      }
    });

    // Engine 2 hooks (for Versus mode)
    this.engine2.on((type) => {
      if (type === 'victory' && this.currentMode === GAME_MODES.VERSUS) {
        // Handled when both or one finish
      }
    });
  }

  setupEventListeners() {
    // Canvas click to activate audio context
    window.addEventListener('click', () => audio.resume(), { once: true });

    // Play / Pause
    const btnPlayPause = document.getElementById('btn-play-pause');
    btnPlayPause.addEventListener('click', () => {
      audio.playSelect();
      this.togglePlayPause();
    });

    // Single Step
    document.getElementById('btn-step').addEventListener('click', () => {
      audio.playSelect();
      this.stepSingleTick();
    });

    // Reset
    document.getElementById('btn-reset').addEventListener('click', () => {
      audio.playSelect();
      this.resetCurrentMode();
    });

    // Speed toggle
    const btnSpeed = document.getElementById('btn-speed');
    btnSpeed.addEventListener('click', () => {
      audio.playSelect();
      if (this.speedMultiplier === 1.0) this.speedMultiplier = 2.0;
      else if (this.speedMultiplier === 2.0) this.speedMultiplier = 4.0;
      else if (this.speedMultiplier === 4.0) this.speedMultiplier = 0.5;
      else this.speedMultiplier = 1.0;
      btnSpeed.textContent = `SPEED: ${this.speedMultiplier}x`;
    });

    // Preempt / Signature Power button
    document.getElementById('btn-preempt').addEventListener('click', () => {
      audio.playPowerUp();
      this.triggerActivePower();
    });

    // Bottom bar menu button
    document.getElementById('btn-pause-menu').addEventListener('click', () => {
      audio.playSelect();
      this.openOverlay('menu-overlay');
      this.isPaused = true;
      this.updateControlsBarState();
    });

    // Sandbox open button
    document.getElementById('btn-sandbox-open').addEventListener('click', () => {
      audio.playSelect();
      this.openOverlay('sandbox-overlay');
    });

    // Close buttons for modals
    document.querySelectorAll('.close-modal').forEach(btn => {
      btn.addEventListener('click', () => {
        audio.playSelect();
        const targetId = btn.getAttribute('data-target');
        this.closeOverlay(targetId);
      });
    });

    // Main Menu Navigation
    document.getElementById('menu-btn-play').addEventListener('click', () => {
      audio.playSelect();
      this.openLevelSelect();
    });

    document.getElementById('menu-btn-characters').addEventListener('click', () => {
      audio.playSelect();
      this.openOverlay('char-select-overlay');
    });

    document.getElementById('menu-btn-sandbox').addEventListener('click', () => {
      audio.playSelect();
      this.currentMode = GAME_MODES.SANDBOX;
      this.closeOverlay('menu-overlay');
      this.openOverlay('sandbox-overlay');
    });

    document.getElementById('menu-btn-draft').addEventListener('click', () => {
      audio.playSelect();
      this.openDraftMode();
    });

    document.getElementById('menu-btn-versus').addEventListener('click', () => {
      audio.playSelect();
      this.openOverlay('versus-overlay');
    });

    document.getElementById('menu-btn-survival').addEventListener('click', () => {
      audio.playSelect();
      this.startSurvivalMode();
    });

    document.getElementById('menu-btn-boss').addEventListener('click', () => {
      audio.playSelect();
      this.startBossBattle();
    });

    document.getElementById('menu-btn-tuner').addEventListener('click', () => {
      audio.playSelect();
      this.openOverlay('tuner-overlay');
      this.renderTunerGraph();
    });

    document.getElementById('menu-btn-guide').addEventListener('click', () => {
      audio.playSelect();
      this.openOverlay('guide-overlay');
    });

    document.getElementById('menu-btn-settings').addEventListener('click', () => {
      audio.playSelect();
      this.openOverlay('settings-overlay');
    });

    document.getElementById('menu-btn-privacy').addEventListener('click', () => {
      audio.playSelect();
      this.openOverlay('privacy-overlay');
    });

    document.getElementById('menu-btn-terms').addEventListener('click', () => {
      audio.playSelect();
      this.openOverlay('terms-overlay');
    });

    // Character Select Cards
    document.querySelectorAll('.char-card').forEach(card => {
      card.addEventListener('click', () => {
        audio.playSelect();
        document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedChar = card.getAttribute('data-char');
      });
    });

    document.getElementById('btn-confirm-char').addEventListener('click', () => {
      audio.playSelect();
      this.closeOverlay('char-select-overlay');
      this.engine1.algoKey = this.selectedChar;
      this.resetCurrentMode();
    });

    // Start Level Button in Tip Briefing
    document.getElementById('btn-start-level').addEventListener('click', () => {
      audio.playSelect();
      this.closeOverlay('level-tip-overlay');
      this.startLevel(this.currentLevelIndex);
    });

    // Versus Start Button
    document.getElementById('btn-start-versus').addEventListener('click', () => {
      audio.playSelect();
      this.startVersusMode();
    });

    // Settings
    const btnToggleSound = document.getElementById('btn-toggle-sound');
    btnToggleSound.addEventListener('click', () => {
      audio.setMuted(!audio.enabled);
      btnToggleSound.textContent = audio.enabled ? 'ENABLED [ON]' : 'MUTED [OFF]';
      btnToggleSound.className = audio.enabled ? 'arcade-btn btn-success' : 'arcade-btn btn-danger';
    });

    const volSlider = document.getElementById('settings-volume');
    volSlider.addEventListener('input', () => {
      audio.setVolume(parseFloat(volSlider.value));
    });

    const btnToggleShake = document.getElementById('btn-toggle-shake');
    btnToggleShake.addEventListener('click', () => {
      this.enableScreenShake = !this.enableScreenShake;
      btnToggleShake.textContent = this.enableScreenShake ? 'ENABLED [ON]' : 'DISABLED [OFF]';
      btnToggleShake.className = this.enableScreenShake ? 'arcade-btn btn-success' : 'arcade-btn btn-danger';
    });

    // Report card buttons
    document.getElementById('rep-btn-retry').addEventListener('click', () => {
      audio.playSelect();
      this.closeOverlay('report-overlay');
      this.resetCurrentMode();
    });

    document.getElementById('rep-btn-next').addEventListener('click', () => {
      audio.playSelect();
      this.closeOverlay('report-overlay');
      if (this.currentMode === GAME_MODES.LEVEL && this.currentLevelIndex < PUZZLE_LEVELS.length - 1) {
        this.showLevelBriefing(this.currentLevelIndex + 1);
      } else {
        this.openLevelSelect();
      }
    });

    // Kernel Log Terminal Controls
    const btnToggleLog = document.getElementById('btn-toggle-log');
    if (btnToggleLog) {
      btnToggleLog.addEventListener('click', () => {
        audio.playSelect();
        this.toggleKernelLog();
      });
    }

    const btnCloseLog = document.getElementById('btn-close-log');
    if (btnCloseLog) {
      btnCloseLog.addEventListener('click', () => {
        audio.playSelect();
        document.getElementById('kernel-log-panel').classList.add('hidden');
      });
    }

    const btnClearLog = document.getElementById('btn-clear-log');
    if (btnClearLog) {
      btnClearLog.addEventListener('click', () => {
        audio.playSelect();
        document.getElementById('kernel-log-entries').innerHTML = '';
      });
    }

    // Canvas Interactive Hover & Click Process Inspector
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;

      const card = this.renderer.getProcessAt(mouseX, mouseY);
      if (card) {
        this.canvas.classList.add('interactive-cursor');
      } else {
        this.canvas.classList.remove('interactive-cursor');
      }
    });

    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      const card = this.renderer.getProcessAt(clickX, clickY);
      if (card) {
        audio.playSelect();
        this.showProcessInspector(card);
      }
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          this.togglePlayPause();
          break;
        case 'ArrowRight':
        case 'KeyD':
          this.stepSingleTick();
          break;
        case 'KeyR':
          this.resetCurrentMode();
          break;
        case 'KeyP':
          this.triggerActivePower();
          break;
        case 'KeyL':
          this.toggleKernelLog();
          break;
        case 'Escape':
          this.togglePauseMenu();
          break;
      }
    });
  }

  toggleKernelLog() {
    const logPanel = document.getElementById('kernel-log-panel');
    if (logPanel) logPanel.classList.toggle('hidden');
  }

  appendKernelLog(entry) {
    const container = document.getElementById('kernel-log-entries');
    if (!container) return;

    const div = document.createElement('div');
    div.className = `log-entry log-${entry.type}`;
    div.textContent = entry.message;
    container.appendChild(div);

    while (container.childNodes.length > 60) {
      container.removeChild(container.firstChild);
    }
    container.scrollTop = container.scrollHeight;
  }

  showProcessInspector(card) {
    const proc = card.proc;
    const isRunning = card.isExecuting;
    const overlayMeta = card.overlayMeta || {};

    document.getElementById('inspect-title').textContent = `PROCESS INSPECTOR: ${proc.pid}`;
    document.getElementById('inspect-state').textContent = isRunning ? 'RUNNING ON CPU' : (overlayMeta.state === 'ready' ? 'READY IN QUEUE' : 'UNARRIVED POOL');
    document.getElementById('inspect-state').style.color = isRunning ? '#3fb950' : (overlayMeta.state === 'ready' ? '#58a6ff' : '#8b949e');
    document.getElementById('inspect-type').textContent = proc.type === 'io' ? 'I/O-BOUND (SHORT)' : 'CPU-BOUND (HEAVY)';
    document.getElementById('inspect-type').style.color = proc.type === 'io' ? '#1abc9c' : '#e74c3c';
    document.getElementById('inspect-arrival').textContent = `${proc.arrival} ticks`;
    document.getElementById('inspect-burst').textContent = `${proc.burst} ticks`;
    document.getElementById('inspect-remaining').textContent = `${proc.remaining} ticks`;
    document.getElementById('inspect-priority').textContent = `${proc.effectivePriority ?? proc.priority}${proc.effectivePriority !== undefined && proc.effectivePriority < proc.priority ? ' (AGED +' + (proc.priority - proc.effectivePriority) + ')' : ''}`;
    document.getElementById('inspect-wait').textContent = `${proc.waitingTime ?? (proc.waitTicks || 0)} ticks`;
    document.getElementById('inspect-response').textContent = proc.responseTime !== undefined ? `${proc.responseTime} ticks` : (isRunning ? '0 ticks' : 'Pending');

    let rationale = '';
    const algo = this.engine1.algoKey;
    if (isRunning) {
      if (algo === 'fcfs') {
        rationale = `${proc.pid} holds the CPU because it was the earliest arrival among all ready tasks. Non-preemptive FIFO means it runs uninterrupted until completion.`;
      } else if (algo === 'sjf') {
        rationale = `${proc.pid} holds the CPU because its burst requirement (${proc.remaining} remaining) was the minimum among all ready tasks.`;
      } else if (algo === 'priority') {
        rationale = `${proc.pid} was granted CPU execution due to holding the highest priority rank (Priority ${proc.effectivePriority ?? proc.priority}).`;
      } else if (algo === 'rr') {
        rationale = `${proc.pid} is executing its assigned time slice. It will yield after quantum expiration or job termination.`;
      } else if (algo === 'mlfq') {
        rationale = `${proc.pid} was dispatched from Multi-Level tier Q${proc.queueLevel ?? 0}. Heavy CPU bursts get demoted to lower tiers to protect interactive jobs.`;
      }
    } else if (overlayMeta.state === 'ready') {
      if (algo === 'fcfs') {
        rationale = `${proc.pid} is queued at position #${(overlayMeta.queueIndex ?? 0) + 1}. Under FCFS, it must wait for all prior tasks in the queue to finish execution.`;
      } else if (algo === 'sjf') {
        rationale = overlayMeta.minBadge
          ? `${proc.pid} has the shortest remaining burst (${proc.remaining} ticks) and is scheduled to be dispatched as soon as the CPU frees up!`
          : `${proc.pid} has ${proc.remaining} ticks remaining, waiting behind shorter jobs. In pure SJF, arriving short jobs can cause starvation for longer tasks.`;
      } else if (algo === 'priority') {
        rationale = overlayMeta.prioBadge
          ? `${proc.pid} currently holds the highest priority in queue (Priority ${proc.effectivePriority ?? proc.priority}) and will preempt or be dispatched next!`
          : `${proc.pid} has lower priority (${proc.effectivePriority ?? proc.priority}). Waiting will gradually trigger aging promotions if aging is enabled.`;
      } else if (algo === 'rr') {
        rationale = `${proc.pid} is rotating in the round-robin queue. It will receive its time quantum in strict rotation order.`;
      } else {
        rationale = `${proc.pid} is waiting in the ready queue for CPU allocation.`;
      }
    } else {
      rationale = `${proc.pid} has not yet arrived into the operating system. Scheduled arrival tick: ${proc.arrival}.`;
    }

    document.getElementById('inspect-rationale').textContent = rationale;
    this.openOverlay('inspect-modal');
  }

  togglePlayPause() {
    this.isPaused = !this.isPaused;
    if (!this.isPaused) {
      this.simAccumulator = 0;
      this.lastTime = performance.now();
    }
    this.updateControlsBarState();
  }

  stepSingleTick() {
    this.isPaused = true;
    this.updateControlsBarState();
    this.engine1.stepTick();
    if (this.currentMode === GAME_MODES.VERSUS) {
      this.engine2.stepTick();
    }
  }

  updateControlsBarState() {
    const btn = document.getElementById('btn-play-pause');
    if (this.isPaused) {
      btn.textContent = 'PLAY [>]';
      btn.className = 'arcade-btn btn-primary';
    } else {
      btn.textContent = 'PAUSE [||]';
      btn.className = 'arcade-btn btn-warning';
    }
  }

  togglePauseMenu() {
    const menu = document.getElementById('menu-overlay');
    if (menu.classList.contains('hidden')) {
      this.openOverlay('menu-overlay');
      this.isPaused = true;
    } else {
      this.closeOverlay('menu-overlay');
      this.isPaused = false;
    }
    this.updateControlsBarState();
  }

  openOverlay(id) {
    document.getElementById(id).classList.remove('hidden');
  }

  closeOverlay(id) {
    document.getElementById(id).classList.add('hidden');
  }

  triggerActivePower() {
    // Signature Character Power
    if (this.engine1.algoKey === 'sjf') {
      // Toggle SRTF preemption dash
      this.engine1.preemptive = !this.engine1.preemptive;
      this.renderer.createBurst(
        this.engine1.simTime * this.renderer.tileSize,
        this.renderer.groundY - 20,
        '#f1fa8c',
        20
      );
    } else if (this.engine1.algoKey === 'priority') {
      // Royal Decree Aging Boost: immediately reduce waiting priorities by 1
      for (const p of this.engine1.readyQueue) {
        p.effectivePriority = Math.max(0, p.effectivePriority - 1);
      }
      this.renderer.createBurst(
        this.engine1.simTime * this.renderer.tileSize,
        this.renderer.groundY - 20,
        '#f39c12',
        20
      );
    } else if (this.engine1.algoKey === 'rr') {
      // Quick slice boost
      this.engine1.quantumRemaining = 1;
    } else if (this.engine1.algoKey === 'mlfq') {
      // MLFQ Boost: reset all jobs to top Q0
      for (const p of this.engine1.readyQueue) {
        p.queueLevel = 0;
      }
      this.renderer.createBurst(
        this.engine1.simTime * this.renderer.tileSize,
        this.renderer.groundY - 20,
        '#e056fd',
        25
      );
    } else {
      // FCFS Shield rally
      this.renderer.createBurst(
        this.engine1.simTime * this.renderer.tileSize,
        this.renderer.groundY - 20,
        '#3498db',
        15
      );
    }
  }

  // --------------------------------------------------------------------------
  // GAME MODES IMPLEMENTATION
  // --------------------------------------------------------------------------

  // 1. Sandbox Mode
  setupSandboxUI() {
    const tbody = document.getElementById('sb-process-tbody');
    const renderTable = () => {
      tbody.innerHTML = '';
      this.sandboxProcesses.forEach((p, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${p.pid}</td>
          <td>${p.arrival}</td>
          <td>${p.burst}</td>
          <td>${p.priority}</td>
          <td style="color:${p.type === 'io' ? '#1abc9c' : '#e74c3c'};">${p.type.toUpperCase()}</td>
          <td>
            <button class="arcade-btn btn-warning" style="font-size:7px; padding:3px 6px; margin-right:4px;" data-edit="${idx}">EDIT</button>
            <button class="arcade-btn btn-danger" style="font-size:7px; padding:3px 6px;" data-del="${idx}">DEL</button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      tbody.querySelectorAll('[data-edit]').forEach(btn => {
        btn.addEventListener('click', () => {
          audio.playSelect();
          const i = parseInt(btn.getAttribute('data-edit'), 10);
          const p = this.sandboxProcesses[i];
          document.getElementById('proc-edit-index').value = i;
          document.getElementById('proc-pid').value = p.pid;
          document.getElementById('proc-arrival').value = p.arrival;
          document.getElementById('proc-burst').value = p.burst;
          document.getElementById('proc-priority').value = p.priority;
          document.getElementById('proc-type').value = p.type;
          document.getElementById('btn-add-process').textContent = 'SAVE CHANGES';
          document.getElementById('btn-cancel-edit').style.display = 'inline-block';
        });
      });

      tbody.querySelectorAll('[data-del]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          audio.playSelect();
          const i = parseInt(btn.getAttribute('data-del'), 10);
          this.sandboxProcesses.splice(i, 1);
          renderTable();
        });
      });
    };
    renderTable();

    document.getElementById('btn-add-process').addEventListener('click', () => {
      audio.playSelect();
      const editIdx = parseInt(document.getElementById('proc-edit-index').value, 10);
      const pid = document.getElementById('proc-pid').value || `P${this.sandboxProcesses.length + 1}`;
      const arr = parseInt(document.getElementById('proc-arrival').value, 10) || 0;
      const burst = parseInt(document.getElementById('proc-burst').value, 10) || 3;
      const prio = parseInt(document.getElementById('proc-priority').value, 10) || 1;
      const type = document.getElementById('proc-type').value;

      if (editIdx >= 0 && editIdx < this.sandboxProcesses.length) {
        this.sandboxProcesses[editIdx] = { pid, arrival: arr, burst, priority: prio, type };
      } else {
        this.sandboxProcesses.push({ pid, arrival: arr, burst, priority: prio, type });
      }

      // Reset form
      document.getElementById('proc-edit-index').value = '-1';
      document.getElementById('proc-pid').value = `P${this.sandboxProcesses.length + 1}`;
      document.getElementById('btn-add-process').textContent = '+ ADD / SAVE';
      document.getElementById('btn-cancel-edit').style.display = 'none';
      renderTable();
    });

    document.getElementById('btn-cancel-edit').addEventListener('click', () => {
      audio.playSelect();
      document.getElementById('proc-edit-index').value = '-1';
      document.getElementById('proc-pid').value = `P${this.sandboxProcesses.length + 1}`;
      document.getElementById('btn-add-process').textContent = '+ ADD / SAVE';
      document.getElementById('btn-cancel-edit').style.display = 'none';
    });

    // Presets
    document.getElementById('sb-preset-convoy').addEventListener('click', () => {
      audio.playSelect();
      this.sandboxProcesses = [
        { pid: 'HOG', arrival: 0, burst: 15, priority: 3, type: 'cpu' },
        { pid: 'IO1', arrival: 1, burst: 2,  priority: 2, type: 'io' },
        { pid: 'IO2', arrival: 2, burst: 2,  priority: 2, type: 'io' },
        { pid: 'IO3', arrival: 3, burst: 1,  priority: 1, type: 'io' }
      ];
      renderTable();
    });

    document.getElementById('sb-preset-starve').addEventListener('click', () => {
      audio.playSelect();
      this.sandboxProcesses = [
        { pid: 'VIP_1', arrival: 0, burst: 4, priority: 1, type: 'cpu' },
        { pid: 'PEASANT', arrival: 0, burst: 6, priority: 8, type: 'cpu' },
        { pid: 'VIP_2', arrival: 2, burst: 3, priority: 1, type: 'cpu' },
        { pid: 'VIP_3', arrival: 5, burst: 3, priority: 1, type: 'cpu' }
      ];
      renderTable();
    });

    document.getElementById('sb-preset-textbook').addEventListener('click', () => {
      audio.playSelect();
      this.sandboxProcesses = [
        { pid: 'P1', arrival: 0, burst: 8, priority: 1, type: 'cpu' },
        { pid: 'P2', arrival: 1, burst: 4, priority: 1, type: 'cpu' },
        { pid: 'P3', arrival: 2, burst: 9, priority: 1, type: 'cpu' },
        { pid: 'P4', arrival: 3, burst: 5, priority: 1, type: 'cpu' }
      ];
      renderTable();
    });

    document.getElementById('btn-run-sandbox').addEventListener('click', () => {
      audio.playSelect();
      this.closeOverlay('sandbox-overlay');
      this.currentMode = GAME_MODES.SANDBOX;
      const algo = document.getElementById('sb-algo-select').value;
      const q = parseInt(document.getElementById('sb-quantum').value, 10) || 3;
      const cs = parseInt(document.getElementById('sb-cs-cost').value, 10) || 1;
      const aging = parseInt(document.getElementById('sb-aging').value, 10) || 0;

      this.engine1.loadWorkload(this.sandboxProcesses, GAME_MODES.SANDBOX, algo, {
        quantum: q,
        contextSwitchCost: cs,
        agingInterval: aging,
        preemptive: algo === 'srtf' || algo === 'priority-preemptive'
      });
      this.isPaused = false;
      this.updateControlsBarState();
    });
  }

  // 2. Puzzle Campaign Levels
  openLevelSelect() {
    this.closeOverlay('menu-overlay');
    this.openOverlay('level-select-overlay');
    const container = document.getElementById('levels-container');
    container.innerHTML = '';

    PUZZLE_LEVELS.forEach((lvl, idx) => {
      const isLocked = lvl.id > this.unlockedLevels;
      const card = document.createElement('div');
      card.className = 'level-card';
      const starsEarned = this.levelStars[lvl.id] || 0;
      let starStr = '';
      for (let s = 0; s < 3; s++) starStr += s < starsEarned ? '[*]' : '[-]';

      card.innerHTML = `
        <span class="level-num">${isLocked ? '[LOCK]' : `0${lvl.id}`}</span>
        <h4 class="level-title">${lvl.title}</h4>
        <span class="level-stars">${isLocked ? 'LOCKED' : starStr}</span>
      `;

      if (!isLocked) {
        card.addEventListener('click', () => {
          audio.playSelect();
          this.closeOverlay('level-select-overlay');
          this.showLevelBriefing(idx);
        });
      } else {
        card.style.opacity = '0.5';
        card.style.cursor = 'not-allowed';
      }
      container.appendChild(card);
    });
  }

  showLevelBriefing(levelIndex) {
    this.currentLevelIndex = levelIndex;
    const lvl = PUZZLE_LEVELS[levelIndex];
    document.getElementById('tip-level-title').textContent = `MISSION ${lvl.id}: ${lvl.title.toUpperCase()}`;
    document.getElementById('tip-level-concept').textContent = `OS CONCEPT: ${lvl.concept}`;
    document.getElementById('tip-level-text').textContent = lvl.tip;
    document.getElementById('tip-level-goals').textContent = `Target Avg Waiting Time ≤ ${lvl.goals.maxAvgWT} ticks | Target TAT ≤ ${lvl.goals.maxTAT}`;
    this.openOverlay('level-tip-overlay');
  }

  startLevel(levelIndex) {
    this.currentLevelIndex = levelIndex;
    this.currentMode = GAME_MODES.LEVEL;
    const lvl = PUZZLE_LEVELS[levelIndex];
    const char = lvl.recommendedChar || this.selectedChar;

    this.engine1.loadWorkload(lvl.processes, GAME_MODES.LEVEL, char, {
      goals: lvl.goals,
      quantum: lvl.options?.quantum || 3,
      contextSwitchCost: lvl.options?.contextSwitchCost ?? 1,
      agingInterval: lvl.options?.agingInterval || 0,
      preemptive: char === 'sjf' && lvl.id >= 3
    });

    this.simAccumulator = 0;
    this.lastTime = performance.now();
    this.isPaused = false;
    this.updateControlsBarState();
  }

  // 3. Scheduler Draft Mode
  openDraftMode() {
    this.closeOverlay('menu-overlay');
    this.openOverlay('draft-overlay');
    this.activeDraftScenario = DRAFT_SCENARIOS[Math.floor(Math.random() * DRAFT_SCENARIOS.length)];

    document.getElementById('draft-scenario-name').textContent = this.activeDraftScenario.name;
    document.getElementById('draft-scenario-desc').textContent = this.activeDraftScenario.desc;

    const tbody = document.getElementById('draft-tbody');
    tbody.innerHTML = '';
    this.activeDraftScenario.procs.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.pid}</td><td>${p.arrival}</td><td>${p.burst}</td><td>${p.priority}</td>
        <td style="color:${p.type === 'io' ? '#1abc9c' : '#e74c3c'}">${p.type.toUpperCase()}</td>
      `;
      tbody.appendChild(tr);
    });

    document.querySelectorAll('.draft-pick-btn').forEach(btn => {
      btn.onclick = () => {
        audio.playSelect();
        const pick = btn.getAttribute('data-pick');
        this.closeOverlay('draft-overlay');
        this.currentMode = GAME_MODES.DRAFT;
        this.engine1.loadWorkload(this.activeDraftScenario.procs, GAME_MODES.DRAFT, pick);
        this.simAccumulator = 0;
        this.lastTime = performance.now();
        this.isPaused = false;
        this.updateControlsBarState();
      };
    });
  }

  // 4. Split-Screen Versus Mode
  startVersusMode() {
    this.closeOverlay('versus-overlay');
    this.currentMode = GAME_MODES.VERSUS;
    const algo1 = document.getElementById('vs-lane1-select').value;
    const algo2 = document.getElementById('vs-lane2-select').value;

    const sharedWorkload = [
      { pid: 'TASK_A', arrival: 0, burst: 7, priority: 3, type: 'cpu' },
      { pid: 'TASK_B', arrival: 1, burst: 2, priority: 1, type: 'io' },
      { pid: 'TASK_C', arrival: 2, burst: 4, priority: 2, type: 'cpu' },
      { pid: 'TASK_D', arrival: 3, burst: 1, priority: 1, type: 'io' }
    ];

    this.engine1.loadWorkload(sharedWorkload, GAME_MODES.VERSUS, algo1);
    this.engine2.loadWorkload(sharedWorkload, GAME_MODES.VERSUS, algo2);
    this.simAccumulator = 0;
    this.lastTime = performance.now();
    this.isPaused = false;
    this.updateControlsBarState();
  }

  // 5. Endless Survival Mode
  startSurvivalMode() {
    this.closeOverlay('menu-overlay');
    this.currentMode = GAME_MODES.SURVIVAL;
    const initProcs = [
      { pid: 'W0_A', arrival: 0, burst: 3, priority: 1, type: 'io' },
      { pid: 'W0_B', arrival: 1, burst: 5, priority: 2, type: 'cpu' }
    ];
    this.engine1.loadWorkload(initProcs, GAME_MODES.SURVIVAL, this.selectedChar, {
      initialHearts: SURVIVAL_CONFIG.initialHearts
    });
    this.simAccumulator = 0;
    this.lastTime = performance.now();
    this.isPaused = false;
    this.updateControlsBarState();
  }

  // 6. Boss Battle ("Memory Hog")
  startBossBattle() {
    this.closeOverlay('menu-overlay');
    this.currentMode = GAME_MODES.BOSS;
    const procs = BOSS_ENCOUNTER.generateProcesses();
    this.engine1.loadWorkload(procs, GAME_MODES.BOSS, this.selectedChar);
    this.simAccumulator = 0;
    this.lastTime = performance.now();
    this.isPaused = false;
    this.updateControlsBarState();
  }

  // 7. Quantum Tuner Minigame Graph
  setupTunerMinigame() {
    const qSlider = document.getElementById('tuner-quantum-slider');
    const csSlider = document.getElementById('tuner-cs-slider');
    const qVal = document.getElementById('tuner-q-val');
    const csVal = document.getElementById('tuner-cs-val');

    const update = () => {
      qVal.textContent = qSlider.value;
      csVal.textContent = csSlider.value;
      this.renderTunerGraph(parseInt(qSlider.value, 10), parseInt(csSlider.value, 10));
    };

    qSlider.addEventListener('input', update);
    csSlider.addEventListener('input', update);
  }

  renderTunerGraph(selectedQ = 3, csCost = 1) {
    const canvas = document.getElementById('tuner-graph-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Benchmark workload
    const testProcs = [
      { pid: 'P1', arrival: 0, burst: 12, priority: 1, type: 'cpu' },
      { pid: 'P2', arrival: 0, burst: 4,  priority: 1, type: 'cpu' },
      { pid: 'P3', arrival: 1, burst: 6,  priority: 1, type: 'cpu' },
      { pid: 'P4', arrival: 2, burst: 2,  priority: 1, type: 'io' }
    ];

    const dataPoints = [];
    for (let q = 1; q <= 12; q++) {
      const res = roundRobin(testProcs, { quantum: q, contextSwitchCost: csCost });
      dataPoints.push({
        q,
        tat: res.metrics.avgTAT,
        cs: res.metrics.contextSwitches
      });
    }

    // Draw Axes
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, 20);
    ctx.lineTo(50, h - 30);
    ctx.lineTo(w - 20, h - 30);
    ctx.stroke();

    // Plot curves
    const maxTAT = Math.max(...dataPoints.map(d => d.tat)) * 1.1;
    const maxCS = Math.max(...dataPoints.map(d => d.cs)) * 1.2;

    const getX = q => 50 + ((q - 1) / 11) * (w - 90);
    const getYTAT = tat => (h - 30) - (tat / maxTAT) * (h - 60);
    const getYCS = cs => (h - 30) - (cs / maxCS) * (h - 60);

    // Turnaround Time Curve (Cyan)
    ctx.strokeStyle = '#58a6ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    dataPoints.forEach((d, i) => {
      const x = getX(d.q);
      const y = getYTAT(d.tat);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Context Switch Curve (Red)
    ctx.strokeStyle = '#f85149';
    ctx.lineWidth = 2;
    ctx.beginPath();
    dataPoints.forEach((d, i) => {
      const x = getX(d.q);
      const y = getYCS(d.cs);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Current selection indicator line
    const selX = getX(selectedQ);
    ctx.strokeStyle = '#f1c40f';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(selX, 20);
    ctx.lineTo(selX, h - 30);
    ctx.stroke();
    ctx.setLineDash([]);

    // Legend
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillStyle = '#58a6ff';
    ctx.fillText('■ AVG TURNAROUND TIME', 70, 30);
    ctx.fillStyle = '#f85149';
    ctx.fillText('■ CONTEXT SWITCHES', 260, 30);
    ctx.fillStyle = '#f1c40f';
    ctx.fillText(`CURRENT q = ${selectedQ}`, 470, 30);

    // Lesson Recommendation
    const curData = dataPoints.find(d => d.q === selectedQ) || dataPoints[2];
    const rec = document.getElementById('tuner-recommendation');
    if (selectedQ <= 2) {
      rec.innerHTML = `<strong>WARNING:</strong> Tiny quantum (${selectedQ}) causes ${curData.cs} context switches, wasting massive CPU cycles on scheduling overhead!`;
      rec.style.borderLeftColor = '#f85149';
    } else if (selectedQ >= 8) {
      rec.innerHTML = `<strong>WARNING:</strong> Huge quantum (${selectedQ}) degenerates into FCFS, degrading responsiveness for interactive requests!`;
      rec.style.borderLeftColor = '#d29922';
    } else {
      rec.innerHTML = `<strong>OPTIMAL SWEET SPOT:</strong> Quantum ${selectedQ} strikes the ideal balance between low context switch overhead (${curData.cs} switches) and fair turnaround time (${curData.tat} ticks).`;
      rec.style.borderLeftColor = '#2ecc71';
    }
  }

  // --------------------------------------------------------------------------
  // RESULTS & REPORT CARD HANDLERS
  // --------------------------------------------------------------------------

  handleVictory(engine) {
    this.isPaused = true;
    this.updateControlsBarState();
    const metrics = engine.getLiveMetrics();

    document.getElementById('report-title').textContent = 'MISSION ACCOMPLISHED!';
    document.getElementById('report-title').style.color = 'var(--green-win)';
    document.getElementById('rep-avg-wt').textContent = metrics.avgWT.toFixed(2);
    document.getElementById('rep-avg-tat').textContent = metrics.avgTAT.toFixed(2);
    document.getElementById('rep-avg-rt').textContent = metrics.avgRT.toFixed(2);
    document.getElementById('rep-cpu-util').textContent = `${metrics.cpuUtil}%`;
    document.getElementById('rep-throughput').textContent = metrics.throughput.toFixed(3);
    document.getElementById('rep-cs-count').textContent = metrics.contextSwitches;

    let starCount = 3;
    let lessonText = '';

    if (this.currentMode === GAME_MODES.LEVEL) {
      const lvl = PUZZLE_LEVELS[this.currentLevelIndex];
      if (metrics.avgWT <= lvl.stars.three) starCount = 3;
      else if (metrics.avgWT <= lvl.stars.two) starCount = 2;
      else starCount = 1;

      this.levelStars[lvl.id] = Math.max(this.levelStars[lvl.id] || 0, starCount);
      if (this.currentLevelIndex + 2 > this.unlockedLevels) {
        this.unlockedLevels = Math.min(PUZZLE_LEVELS.length, this.currentLevelIndex + 2);
      }
      this.savePersistedData();
      lessonText = `OS LESSON: ${lvl.tip}`;
    } else if (this.currentMode === GAME_MODES.DRAFT) {
      const isOptimal = engine.algoKey === this.activeDraftScenario.optimal;
      starCount = isOptimal ? 3 : 1;
      lessonText = isOptimal 
        ? `PERFECT DRAFT PICK! ${this.activeDraftScenario.lesson}` 
        : `SUBOPTIMAL PICK: The optimal algorithm was ${this.activeDraftScenario.optimal.toUpperCase()}. ${this.activeDraftScenario.lesson}`;
    } else if (this.currentMode === GAME_MODES.BOSS) {
      lessonText = 'BOSS SLAIN: By preempting or rotating around the massive Memory Hog, short processes avoided catastrophic Convoy Effect blocking!';
    } else {
      lessonText = 'SIMULATION FINISHED: All processes cleared the ready queue with zero SLA violations.';
    }

    let rankBadge = '[RANK S: OPTIMAL]';
    if (starCount === 2) rankBadge = '[RANK A: SOLID]';
    else if (starCount === 1) rankBadge = '[RANK B: PASSED]';

    let starDisplay = '';
    for (let s = 0; s < 3; s++) starDisplay += s < starCount ? '[*] ' : '[-] ';
    document.getElementById('report-stars').textContent = `${rankBadge} ${starDisplay.trim()}`;
    document.getElementById('report-score-banner').textContent = `FINAL SCORE: ${engine.score} PTS`;
    document.getElementById('report-lesson-box').textContent = lessonText;

    this.openOverlay('report-overlay');
  }

  handleDefeat(engine) {
    this.isPaused = true;
    this.updateControlsBarState();
    const metrics = engine.getLiveMetrics();

    document.getElementById('report-title').textContent = 'SLA VIOLATION: CPU CRASH';
    document.getElementById('report-title').style.color = 'var(--red-loss)';
    document.getElementById('report-stars').textContent = '[SYSTEM FAILED: SLA EXCEEDED]';
    document.getElementById('report-score-banner').textContent = `SURVIVED ${engine.simTime} TICKS | SCORE: ${engine.score}`;

    document.getElementById('rep-avg-wt').textContent = metrics.avgWT.toFixed(2);
    document.getElementById('rep-avg-tat').textContent = metrics.avgTAT.toFixed(2);
    document.getElementById('rep-avg-rt').textContent = metrics.avgRT.toFixed(2);
    document.getElementById('rep-cpu-util').textContent = `${metrics.cpuUtil}%`;
    document.getElementById('rep-throughput').textContent = metrics.throughput.toFixed(3);
    document.getElementById('rep-cs-count').textContent = metrics.contextSwitches;

    document.getElementById('report-lesson-box').textContent = 
      'OS LESSON: In real-time and mission-critical operating systems, allowing processes to starve past their SLA deadline causes system collapse. Enable Aging or choose preemptive scheduling to prevent starvation!';

    this.openOverlay('report-overlay');
  }

  resetCurrentMode() {
    this.isPaused = true;
    this.updateControlsBarState();

    if (this.currentMode === GAME_MODES.LEVEL) {
      this.startLevel(this.currentLevelIndex);
    } else if (this.currentMode === GAME_MODES.BOSS) {
      this.startBossBattle();
    } else if (this.currentMode === GAME_MODES.SURVIVAL) {
      this.startSurvivalMode();
    } else {
      this.engine1.loadWorkload(this.sandboxProcesses, GAME_MODES.SANDBOX, this.engine1.algoKey);
    }
  }

  // --------------------------------------------------------------------------
  // 60 FPS MAIN LOOP
  // --------------------------------------------------------------------------
  gameLoop(timestamp) {
    const delta = timestamp - this.lastTime;
    this.lastTime = timestamp;
    this.frameCount++;

    if (!this.isPaused) {
      this.simAccumulator += delta * this.speedMultiplier;
      while (this.simAccumulator >= this.simTickInterval) {
        this.engine1.stepTick();
        if (this.currentMode === GAME_MODES.VERSUS) {
          this.engine2.stepTick();
        }
        this.simAccumulator -= this.simTickInterval;
      }
    }

    // Render pass
    if (this.currentMode === GAME_MODES.VERSUS) {
      this.renderer.renderVersus(this.engine1, this.engine2, this.frameCount);
    } else {
      this.renderer.render(this.engine1, this.frameCount);
    }

    requestAnimationFrame(this.gameLoop.bind(this));
  }
}

// Bootstrap on DOM Ready
window.addEventListener('DOMContentLoaded', () => {
  window.game = new GameController();
});

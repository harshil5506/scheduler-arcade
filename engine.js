/**
 * ============================================================================
 * SCHEDULER ARCADE - engine.js
 * ============================================================================
 * Real-time simulation engine and state machine.
 * Manages discrete time stepping, job arrivals, ready queue transitions,
 * preemption triggers, context-switch freeze states, SLA violation tracking,
 * and live metrics calculation.
 * ============================================================================
 */

import { cloneProcesses } from './scheduler.js';

export const GAME_STATES = {
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  VICTORY: 'VICTORY',
  DEFEAT: 'DEFEAT'
};

export const GAME_MODES = {
  SANDBOX: 'SANDBOX',
  LEVEL: 'LEVEL',
  DRAFT: 'DRAFT',
  VERSUS: 'VERSUS',
  SURVIVAL: 'SURVIVAL',
  BOSS: 'BOSS',
  TUNER: 'TUNER'
};

export class SimulationEngine {
  constructor(options = {}) {
    this.name = options.name || 'CPU_1';
    this.algoKey = options.algoKey || 'fcfs';
    this.quantum = options.quantum || 3;
    this.contextSwitchCost = options.contextSwitchCost ?? 1;
    this.agingInterval = options.agingInterval || 0; // 0 = disabled
    this.preemptive = Boolean(options.preemptive);

    // Simulation Clock
    this.simTime = 0;
    this.subTick = 0; // 0..1 for rendering interpolation
    this.speed = 1.0; // Playback speed multiplier
    this.state = GAME_STATES.MENU;
    this.mode = GAME_MODES.SANDBOX;

    // Process Queues & State
    this.incomingPool = [];
    this.readyQueue = [];
    this.runningProcess = null;
    this.completedList = [];
    this.timeline = []; // [{ pid, start, end }]

    // Execution Tracking
    this.lastDispatchedPid = null;
    this.currentSliceStart = 0;
    this.quantumRemaining = 0;
    this.contextSwitchFreeze = 0; // Ticks remaining in context switch
    this.contextSwitchesCount = 0;
    this.totalBusyTime = 0;

    // Hearts, SLA, & Score
    this.hearts = 3;
    this.maxHearts = 3;
    this.maxAllowedWait = 15; // Starvation SLA limit
    this.score = 0;
    this.levelGoals = null;
    this.survivalWaveCounter = 0;

    // Kernel Decision Log (Educational Explainability)
    this.kernelLogs = [];

    // Event listeners
    this.eventListeners = [];
  }

  logDecision(message, type = 'info') {
    const entry = {
      tick: this.simTime,
      message,
      type,
      timestamp: Date.now()
    };
    this.kernelLogs.push(entry);
    if (this.kernelLogs.length > 50) this.kernelLogs.shift();
    this.emit('kernel_log', entry);
  }

  on(listener) {
    this.eventListeners.push(listener);
  }

  emit(type, data = {}) {
    for (const listener of this.eventListeners) {
      try {
        listener(type, { ...data, engine: this });
      } catch (e) {
        console.error('Error in engine listener:', e);
      }
    }
  }

  /**
   * Initializes or resets the simulation with a process workload.
   */
  loadWorkload(processes, mode = GAME_MODES.SANDBOX, algoKey = 'fcfs', options = {}) {
    this.mode = mode;
    this.algoKey = algoKey;
    if (options.quantum !== undefined) this.quantum = options.quantum;
    if (options.contextSwitchCost !== undefined) this.contextSwitchCost = options.contextSwitchCost;
    if (options.agingInterval !== undefined) this.agingInterval = options.agingInterval;
    if (options.preemptive !== undefined) this.preemptive = options.preemptive;
    if (options.goals) this.levelGoals = options.goals;

    this.simTime = 0;
    this.subTick = 0;
    this.state = GAME_STATES.PLAYING;
    this.incomingPool = cloneProcesses(processes);
    this.readyQueue = [];
    this.runningProcess = null;
    this.completedList = [];
    this.timeline = [];
    this.lastDispatchedPid = null;
    this.currentSliceStart = 0;
    this.quantumRemaining = 0;
    this.contextSwitchFreeze = 0;
    this.contextSwitchesCount = 0;
    this.totalBusyTime = 0;
    this.hearts = options.initialHearts || 3;
    this.maxHearts = this.hearts;
    this.score = 0;
    this.survivalWaveCounter = 0;
    this.kernelLogs = [];

    this.logDecision(`Simulation initialized: [${this.algoKey.toUpperCase()}] mode loaded with ${processes.length} jobs.`, 'info');

    // Initial check for jobs arriving at time 0
    this.checkArrivals();
    this.emit('reset');
  }

  /**
   * Transfers newly arrived jobs from incomingPool to readyQueue.
   */
  checkArrivals() {
    let arrivedAny = false;
    for (let i = this.incomingPool.length - 1; i >= 0; i--) {
      const proc = this.incomingPool[i];
      if (proc.arrival <= this.simTime) {
        this.incomingPool.splice(i, 1);
        proc.waitTicks = 0;
        this.readyQueue.push(proc);
        arrivedAny = true;
        this.logDecision(`TICK ${this.simTime}: Arrival -> ${proc.pid} entered Ready Queue (Burst: ${proc.burst}, Prio: ${proc.priority}, ${proc.type.toUpperCase()}).`, 'arrival');
        this.emit('arrival', { proc });
      }
    }
    return arrivedAny;
  }

  /**
   * Performs one discrete time unit step.
   */
  stepTick() {
    if (this.state !== GAME_STATES.PLAYING) return;

    // Handle context switch freeze period
    if (this.contextSwitchFreeze > 0) {
      this.contextSwitchFreeze--;
      this.simTime++;
      this.logDecision(`TICK ${this.simTime}: Context switch overhead in progress (CPU saving/restoring registers).`, 'cs');
      this.checkArrivals();
      this.updateWaitAndAging();
      return;
    }

    // 1. If currently running a process, advance its execution
    if (this.runningProcess) {
      this.runningProcess.remaining--;
      this.totalBusyTime++;
      if (this.algoKey === 'rr' || this.algoKey === 'mlfq') {
        this.quantumRemaining--;
      }

      // Check if finished
      if (this.runningProcess.remaining <= 0) {
        this.runningProcess.completionTime = this.simTime + 1;
        this.runningProcess.turnaroundTime = this.runningProcess.completionTime - this.runningProcess.arrival;
        this.runningProcess.waitingTime = Math.max(0, this.runningProcess.turnaroundTime - this.runningProcess.burst);
        this.completedList.push(this.runningProcess);
        this.recordSlice(this.runningProcess.pid, this.currentSliceStart, this.simTime + 1);

        this.logDecision(`TICK ${this.simTime + 1}: COMPLETED -> ${this.runningProcess.pid} finished execution! (TAT: ${this.runningProcess.turnaroundTime}, Wait: ${this.runningProcess.waitingTime}, Resp: ${this.runningProcess.responseTime}).`, 'complete');

        // Add score
        this.score += 100 + Math.max(0, 50 - this.runningProcess.waitingTime * 3);
        this.emit('complete', { proc: this.runningProcess });
        this.runningProcess = null;
      } else if ((this.algoKey === 'rr' || this.algoKey === 'mlfq') && this.quantumRemaining <= 0) {
        // Quantum expired! Re-enqueue process
        this.recordSlice(this.runningProcess.pid, this.currentSliceStart, this.simTime + 1);
        const expiredProc = this.runningProcess;
        if (this.algoKey === 'mlfq') {
          // Demote to next lower priority tier
          expiredProc.queueLevel = Math.min(2, (expiredProc.queueLevel ?? 0) + 1);
        }
        this.runningProcess = null;

        this.logDecision(`TICK ${this.simTime + 1}: TIME SLICE EXPIRED -> ${expiredProc.pid} exhausted quantum slice (q=${this.quantum}). Moved to queue tail${this.algoKey === 'mlfq' ? ' (Demoted to tier Q' + expiredProc.queueLevel + ')' : ''}.`, 'preempt');

        // Advance time and collect arrivals BEFORE re-enqueueing the preempted job
        this.simTime++;
        this.checkArrivals();
        this.readyQueue.push(expiredProc);
        this.updateWaitAndAging();

        // Dispatch next job
        this.dispatchNext();
        this.checkEndCondition();
        return;
      }
    } else {
      // CPU was idle
      this.recordSlice('IDLE', this.currentSliceStart, this.simTime + 1);
    }

    // Advance clock
    this.simTime++;

    // 2. Check for new arrivals
    const arrivedAny = this.checkArrivals();

    // 3. Update waiting time, hunger, and aging for ready queue processes
    this.updateWaitAndAging();

    // 4. Preemption check if something is currently running
    if (this.runningProcess && (this.preemptive || this.algoKey === 'sjf' || this.algoKey === 'priority')) {
      if (this.shouldPreempt()) {
        this.preemptRunningProcess();
      }
    }

    // 5. If CPU is idle, dispatch next ready process
    if (!this.runningProcess) {
      this.dispatchNext();
    }

    // In Survival mode, spawn waves periodically
    if (this.mode === GAME_MODES.SURVIVAL && this.simTime % 10 === 0 && this.incomingPool.length < 5) {
      this.spawnSurvivalWave();
    }

    // 6. Check end conditions (victory, defeat, SLA violation)
    this.checkEndCondition();
  }

  /**
   * Decides if an arriving or ready process should preempt the running one.
   */
  shouldPreempt() {
    if (!this.runningProcess || this.readyQueue.length === 0) return false;

    if (this.algoKey === 'sjf' && this.preemptive) {
      // SRTF check: any ready process has strictly shorter remaining burst
      const minReadyRemaining = Math.min(...this.readyQueue.map(p => p.remaining));
      return minReadyRemaining < this.runningProcess.remaining;
    }

    if (this.algoKey === 'priority' && this.preemptive) {
      // Priority check: any ready process has strictly higher priority (lower integer)
      const minReadyPrio = Math.min(...this.readyQueue.map(p => p.effectivePriority));
      return minReadyPrio < this.runningProcess.effectivePriority;
    }

    return false;
  }

  preemptRunningProcess() {
    this.recordSlice(this.runningProcess.pid, this.currentSliceStart, this.simTime);
    this.readyQueue.push(this.runningProcess);
    this.logDecision(`TICK ${this.simTime}: PREEMPTION -> ${this.runningProcess.pid} yielded CPU (arriving job has higher priority / shorter burst).`, 'preempt');
    this.emit('preempt', { proc: this.runningProcess });
    this.runningProcess = null;
    this.dispatchNext();
  }

  /**
   * Selects the next process from the ready queue according to the active algorithm.
   */
  dispatchNext() {
    if (this.readyQueue.length === 0) {
      this.runningProcess = null;
      this.currentSliceStart = this.simTime;
      this.logDecision(`TICK ${this.simTime}: Ready queue is empty -> CPU is IDLE waiting for arrivals.`, 'info');
      return;
    }

    let selectedIndex = 0;
    let rationale = '';

    switch (this.algoKey) {
      case 'fcfs':
        // FIFO: index 0 (earliest arrival in queue)
        selectedIndex = 0;
        rationale = `[FCFS] First-in queue (arrived at tick ${this.readyQueue[0].arrival})`;
        break;

      case 'sjf':
        // Smallest remaining or total burst
        selectedIndex = 0;
        for (let i = 1; i < this.readyQueue.length; i++) {
          const cand = this.readyQueue[i];
          const best = this.readyQueue[selectedIndex];
          const candVal = this.preemptive ? cand.remaining : cand.burst;
          const bestVal = this.preemptive ? best.remaining : best.burst;
          if (candVal < bestVal || (candVal === bestVal && cand.arrival < best.arrival)) {
            selectedIndex = i;
          }
        }
        const minVal = this.preemptive ? this.readyQueue[selectedIndex].remaining : this.readyQueue[selectedIndex].burst;
        rationale = `[SJF] Shortest burst in queue (${minVal} ticks ${this.preemptive ? 'remaining' : 'burst'})`;
        break;

      case 'priority':
        // Highest effective priority (lowest integer value)
        selectedIndex = 0;
        for (let i = 1; i < this.readyQueue.length; i++) {
          const cand = this.readyQueue[i];
          const best = this.readyQueue[selectedIndex];
          if (cand.effectivePriority < best.effectivePriority || 
             (cand.effectivePriority === best.effectivePriority && cand.arrival < best.arrival)) {
            selectedIndex = i;
          }
        }
        rationale = `[PRIORITY] Highest priority rank (Priority ${this.readyQueue[selectedIndex].effectivePriority})`;
        break;

      case 'rr':
        // Front of FIFO queue
        selectedIndex = 0;
        rationale = `[ROUND ROBIN] Head of rotation queue (Allocated quantum q=${this.quantum})`;
        break;

      case 'mlfq':
        // Highest priority queue level (0 > 1 > 2), tie-break arrival
        selectedIndex = 0;
        for (let i = 1; i < this.readyQueue.length; i++) {
          const cand = this.readyQueue[i];
          const best = this.readyQueue[selectedIndex];
          const candQ = cand.queueLevel ?? 0;
          const bestQ = best.queueLevel ?? 0;
          if (candQ < bestQ || (candQ === bestQ && cand.arrival < best.arrival)) {
            selectedIndex = i;
          }
        }
        rationale = `[MLFQ] Selected from Queue Tier Q${this.readyQueue[selectedIndex].queueLevel ?? 0}`;
        break;
    }

    const nextProc = this.readyQueue.splice(selectedIndex, 1)[0];

    // Trigger Context Switch if switching between different processes
    if (this.lastDispatchedPid !== null && this.lastDispatchedPid !== nextProc.pid) {
      this.contextSwitchesCount++;
      this.score = Math.max(0, this.score - 5);
      if (this.contextSwitchCost > 0) {
        this.contextSwitchFreeze = this.contextSwitchCost;
        this.recordSlice('CS', this.simTime, this.simTime + this.contextSwitchCost);
        this.logDecision(`TICK ${this.simTime}: CONTEXT SWITCH -> Switching from ${this.lastDispatchedPid} to ${nextProc.pid} (${this.contextSwitchCost} tick overhead penalty).`, 'cs');
      }
      this.emit('context_switch', { from: this.lastDispatchedPid, to: nextProc.pid });
    }

    if (nextProc.firstStartTime === -1) {
      nextProc.firstStartTime = this.simTime + (this.contextSwitchFreeze > 0 ? this.contextSwitchCost : 0);
      nextProc.responseTime = nextProc.firstStartTime - nextProc.arrival;
    }

    this.runningProcess = nextProc;
    this.lastDispatchedPid = nextProc.pid;
    this.currentSliceStart = this.simTime + (this.contextSwitchFreeze > 0 ? this.contextSwitchCost : 0);
    
    // Assign quantum based on algorithm
    if (this.algoKey === 'mlfq') {
      const qLevel = nextProc.queueLevel ?? 0;
      this.quantumRemaining = qLevel === 0 ? 2 : (qLevel === 1 ? 4 : 8);
    } else {
      this.quantumRemaining = this.quantum;
    }

    this.logDecision(`TICK ${this.simTime}: DISPATCH -> ${nextProc.pid} allocated CPU. Reason: ${rationale}.`, 'dispatch');
    this.emit('dispatch', { proc: nextProc });
  }

  /**
   * Updates waiting time, starvation alerts, and aging mechanics for ready queue.
   */
  updateWaitAndAging() {
    for (const proc of this.readyQueue) {
      proc.waitTicks = (proc.waitTicks || 0) + 1;
      proc.timeInQueue = (proc.timeInQueue || 0) + 1;

      // Check starvation threshold
      if (proc.waitTicks >= this.maxAllowedWait) {
        if (!proc.slaViolated) {
          proc.slaViolated = true;
          this.hearts = Math.max(0, this.hearts - 1);
          this.score = Math.max(0, this.score - 30);
          this.logDecision(`TICK ${this.simTime}: SLA VIOLATION -> ${proc.pid} starved for ${proc.waitTicks} ticks! Lost 1 Heart!`, 'cs');
          this.emit('sla_violation', { proc, remainingHearts: this.hearts });
        }
      } else if (proc.waitTicks >= Math.floor(this.maxAllowedWait * 0.7)) {
        proc.isStarving = true;
        this.emit('starvation_warning', { proc });
      }

      // Aging boost
      if (this.agingInterval > 0 && proc.timeInQueue >= this.agingInterval) {
        if (proc.effectivePriority > 0) {
          proc.effectivePriority--;
          this.logDecision(`TICK ${this.simTime}: AGING BOOST -> ${proc.pid} waited ${proc.waitTicks} ticks. Priority promoted to ${proc.effectivePriority}!`, 'info');
          this.emit('aging_boost', { proc, newPrio: proc.effectivePriority });
        }
        proc.timeInQueue = 0;
      }
    }
  }

  recordSlice(pid, start, end) {
    if (start >= end) return;
    const last = this.timeline[this.timeline.length - 1];
    if (last && last.pid === pid && last.end === start) {
      last.end = end;
    } else {
      this.timeline.push({ pid, start, end });
    }
  }

  spawnSurvivalWave() {
    this.survivalWaveCounter++;
    const burst = Math.floor(Math.random() * 5) + 2;
    const isIo = Math.random() < 0.4;
    const proc = {
      pid: `W${this.survivalWaveCounter}`,
      arrival: this.simTime,
      burst,
      priority: Math.floor(Math.random() * 4) + 1,
      type: isIo ? 'io' : 'cpu',
      remaining: burst,
      firstStartTime: -1,
      completionTime: -1,
      effectivePriority: Math.floor(Math.random() * 4) + 1,
      waitTicks: 0,
      timeInQueue: 0
    };
    this.readyQueue.push(proc);
    this.emit('arrival', { proc });
  }

  checkEndCondition() {
    // Check Defeat: out of hearts
    if (this.hearts <= 0) {
      this.state = GAME_STATES.DEFEAT;
      this.emit('defeat');
      return;
    }

    // Check Victory: all incoming and ready queue empty and no running job
    if (this.mode !== GAME_MODES.SURVIVAL) {
      if (this.incomingPool.length === 0 && this.readyQueue.length === 0 && !this.runningProcess) {
        this.state = GAME_STATES.VICTORY;
        this.emit('victory', { metrics: this.getLiveMetrics() });
      }
    }
  }

  /**
   * Computes live performance metrics at any instant in time.
   */
  getLiveMetrics() {
    const totalFinished = this.completedList.length;
    const allProcs = [...this.completedList];
    if (this.runningProcess) allProcs.push(this.runningProcess);

    const sumWT = this.completedList.reduce((acc, p) => acc + p.waitingTime, 0);
    const sumTAT = this.completedList.reduce((acc, p) => acc + p.turnaroundTime, 0);
    const sumRT = this.completedList.reduce((acc, p) => acc + (p.responseTime || 0), 0);

    const avgWT = totalFinished > 0 ? Number((sumWT / totalFinished).toFixed(2)) : 0;
    const avgTAT = totalFinished > 0 ? Number((sumTAT / totalFinished).toFixed(2)) : 0;
    const avgRT = totalFinished > 0 ? Number((sumRT / totalFinished).toFixed(2)) : 0;

    const makespan = Math.max(1, this.simTime);
    const cpuUtil = Number(((this.totalBusyTime / makespan) * 100).toFixed(1));
    const throughput = Number((totalFinished / makespan).toFixed(3));

    return {
      avgWT,
      avgTAT,
      avgRT,
      cpuUtil,
      throughput,
      contextSwitches: this.contextSwitchesCount,
      completedCount: totalFinished,
      remainingCount: this.incomingPool.length + this.readyQueue.length + (this.runningProcess ? 1 : 0),
      makespan
    };
  }
}

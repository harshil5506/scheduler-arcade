/**
 * ============================================================================
 * SCHEDULER ARCADE - scheduler.js
 * ============================================================================
 * Pure scheduling logic and metrics computation module.
 * No DOM or Canvas dependencies. Fully testable across Node.js and Browser environments.
 *
 * Implemented Algorithms:
 * 1. First-Come, First-Served (FCFS) - Non-preemptive
 * 2. Shortest Job First (SJF) & Shortest Remaining Time First (SRTF) - Preemptive toggle
 * 3. Priority Scheduling (Non-preemptive & Preemptive) with Aging mechanism
 * 4. Round Robin (RR) with configurable Quantum & Context Switch overhead
 *
 * Process Shape:
 * {
 *   pid: string | number,
 *   arrival: number,
 *   burst: number,
 *   priority: number,   // Convention: Lower integer = Higher priority (Silberschatz)
 *   type: 'cpu' | 'io', // 'cpu' (heavy burst) or 'io' (frequent short bursts)
 *   remaining?: number
 * }
 *
 * Return Shape:
 * {
 *   timeline: [{ pid, start, end }],
 *   metrics: { avgWT, avgTAT, avgRT, cpuUtil, throughput, contextSwitches },
 *   perProcess: [{ pid, arrival, burst, priority, type, completionTime, turnaroundTime, waitingTime, responseTime }]
 * }
 * ============================================================================
 */

/**
 * Normalizes input processes into clean clones with numeric validation.
 * @param {Array<Object>} processes
 * @returns {Array<Object>}
 */
export function cloneProcesses(processes) {
  return (processes || []).map(p => ({
    pid: String(p.pid),
    arrival: Math.max(0, Number(p.arrival) || 0),
    burst: Math.max(1, Number(p.burst) || 1),
    priority: Number(p.priority ?? 1),
    type: p.type === 'io' ? 'io' : 'cpu',
    remaining: Math.max(1, Number(p.burst) || 1),
    firstStartTime: -1,
    completionTime: -1,
    waitingTime: 0,
    turnaroundTime: 0,
    responseTime: 0,
    effectivePriority: Number(p.priority ?? 1),
    timeInQueue: 0
  }));
}

/**
 * Calculates standard operating system metrics from completed execution records.
 * 
 * Metric Formulas:
 * - Turnaround Time (TAT) = Completion Time - Arrival Time
 * - Waiting Time (WT)     = TAT - Burst Time
 * - Response Time (RT)    = First CPU Allocation Time - Arrival Time
 * - CPU Utilization       = (Total Busy Time / Makespan) * 100%
 * - Throughput            = Completed Processes / Makespan
 * - Context Switches      = Number of switches between distinct process dispatches
 *
 * @param {Array<Object>} originalProcs Cloned original processes
 * @param {Array<Object>} rawSlices List of { pid, start, end }
 * @param {number} totalContextSwitches
 * @param {number} totalTime Makespan
 * @returns {Object}
 */
export function calculateMetrics(originalProcs, rawSlices, totalContextSwitches, totalTime) {
  if (originalProcs.length === 0) {
    return {
      timeline: [],
      metrics: {
        avgWT: 0,
        avgTAT: 0,
        avgRT: 0,
        cpuUtil: 0,
        throughput: 0,
        contextSwitches: 0
      },
      perProcess: []
    };
  }

  // Merge contiguous slices of the same process for clean timeline visualization
  const timeline = [];
  for (const slice of rawSlices) {
    if (slice.start >= slice.end) continue;
    const last = timeline[timeline.length - 1];
    if (last && last.pid === slice.pid && last.end === slice.start) {
      last.end = slice.end;
    } else {
      timeline.push({ ...slice });
    }
  }

  const makespan = Math.max(totalTime, timeline.length > 0 ? timeline[timeline.length - 1].end : 0);
  let totalBusyTime = 0;

  for (const slice of timeline) {
    if (slice.pid !== 'IDLE' && slice.pid !== 'CS' && slice.pid !== null) {
      totalBusyTime += (slice.end - slice.start);
    }
  }

  const perProcess = originalProcs.map(proc => {
    const tat = Math.max(0, proc.completionTime - proc.arrival);
    const wt = Math.max(0, tat - proc.burst);
    const rt = Math.max(0, proc.firstStartTime - proc.arrival);

    return {
      pid: proc.pid,
      arrival: proc.arrival,
      burst: proc.burst,
      priority: proc.priority,
      type: proc.type,
      completionTime: proc.completionTime,
      turnaroundTime: tat,
      waitingTime: wt,
      responseTime: rt
    };
  });

  const n = perProcess.length;
  const sumWT = perProcess.reduce((acc, p) => acc + p.waitingTime, 0);
  const sumTAT = perProcess.reduce((acc, p) => acc + p.turnaroundTime, 0);
  const sumRT = perProcess.reduce((acc, p) => acc + p.responseTime, 0);

  const avgWT = Number((sumWT / n).toFixed(2));
  const avgTAT = Number((sumTAT / n).toFixed(2));
  const avgRT = Number((sumRT / n).toFixed(2));
  const cpuUtil = makespan > 0 ? Number(((totalBusyTime / makespan) * 100).toFixed(2)) : 100;
  const throughput = makespan > 0 ? Number((n / makespan).toFixed(3)) : 0;

  return {
    timeline,
    metrics: {
      avgWT,
      avgTAT,
      avgRT,
      cpuUtil,
      throughput,
      contextSwitches: totalContextSwitches
    },
    perProcess
  };
}

/**
 * ============================================================================
 * 1. FIRST-COME, FIRST-SERVED (FCFS) SCHEDULING
 * ============================================================================
 * How it works:
 * - Non-preemptive algorithm that manages the ready queue as a strict FIFO line.
 * - Processes are dispatched in the exact chronological order of their arrival.
 * - When CPU bursts tie, secondary tie-break is lexical PID order.
 *
 * Algorithmic Complexity:
 * - O(N log N) sorting time where N is the number of processes.
 *
 * Weakness:
 * - The Convoy Effect: A long, CPU-bound process at the front of the queue
 *   forces all subsequent short, I/O-bound processes to wait extensively,
 *   drastically degrading average waiting time and overall device utilization.
 * ============================================================================
 * @param {Array<Object>} inputProcesses
 * @param {Object} options
 * @returns {Object}
 */
export function fcfs(inputProcesses, options = {}) {
  const procs = cloneProcesses(inputProcesses);
  if (procs.length === 0) return calculateMetrics([], [], 0, 0);

  // Sort strictly by arrival time, tie-break by PID
  procs.sort((a, b) => a.arrival - b.arrival || a.pid.localeCompare(b.pid));

  const slices = [];
  let currentTime = 0;
  let contextSwitches = 0;
  let lastPid = null;

  for (const proc of procs) {
    if (currentTime < proc.arrival) {
      slices.push({ pid: 'IDLE', start: currentTime, end: proc.arrival });
      currentTime = proc.arrival;
    }

    if (lastPid !== null && lastPid !== proc.pid) {
      contextSwitches++;
    }

    proc.firstStartTime = currentTime;
    const startTime = currentTime;
    currentTime += proc.burst;
    proc.completionTime = currentTime;
    proc.remaining = 0;

    slices.push({ pid: proc.pid, start: startTime, end: currentTime });
    lastPid = proc.pid;
  }

  return calculateMetrics(procs, slices, contextSwitches, currentTime);
}

/**
 * ============================================================================
 * 2. SHORTEST JOB FIRST (SJF) & SHORTEST REMAINING TIME FIRST (SRTF)
 * ============================================================================
 * How it works:
 * - Non-preemptive (SJF): Among all currently arrived processes, the one with
 *   the shortest total CPU burst is chosen and executed to completion.
 * - Preemptive (SRTF): At every time tick or new arrival, the process with the
 *   shortest remaining burst time is allocated the CPU. If an arriving job has
 *   remaining burst strictly lower than the currently running job, preemption occurs.
 *
 * Algorithmic Complexity:
 * - Non-preemptive: O(N log N) using a priority queue.
 * - Preemptive: O(TotalBurst * log N) event simulation.
 *
 * Weakness:
 * - Starvation: Long CPU bursts can starve indefinitely if shorter bursts keep
 *   arriving in the ready queue.
 * - Theoretical limitation: In real operating systems, future CPU burst length
 *   cannot be known in advance and must be predicted using exponential averaging.
 * ============================================================================
 * @param {Array<Object>} inputProcesses
 * @param {Object} options { preemptive: boolean }
 * @returns {Object}
 */
export function sjf(inputProcesses, options = {}) {
  const preemptive = Boolean(options.preemptive);
  const procs = cloneProcesses(inputProcesses);
  if (procs.length === 0) return calculateMetrics([], [], 0, 0);

  const procMap = new Map(procs.map(p => [p.pid, p]));
  const slices = [];
  let currentTime = 0;
  let completedCount = 0;
  let contextSwitches = 0;
  let runningProc = null;
  const n = procs.length;

  while (completedCount < n) {
    // Find all arrived and incomplete processes
    const ready = procs.filter(p => p.arrival <= currentTime && p.remaining > 0);

    if (ready.length === 0) {
      // Find the next arrival time
      const unarrived = procs.filter(p => p.remaining > 0);
      const nextArrival = Math.min(...unarrived.map(p => p.arrival));
      slices.push({ pid: 'IDLE', start: currentTime, end: nextArrival });
      currentTime = nextArrival;
      runningProc = null;
      continue;
    }

    if (!preemptive) {
      // Non-preemptive SJF: select candidate with shortest total burst
      ready.sort((a, b) => a.burst - b.burst || a.arrival - b.arrival || a.pid.localeCompare(b.pid));
      const selected = ready[0];

      if (runningProc !== null && runningProc.pid !== selected.pid) {
        contextSwitches++;
      }

      if (selected.firstStartTime === -1) {
        selected.firstStartTime = currentTime;
      }

      const start = currentTime;
      currentTime += selected.remaining;
      selected.remaining = 0;
      selected.completionTime = currentTime;
      completedCount++;

      slices.push({ pid: selected.pid, start, end: currentTime });
      runningProc = selected;
    } else {
      // Preemptive SJF (SRTF): select candidate with shortest remaining burst
      ready.sort((a, b) => a.remaining - b.remaining || a.arrival - b.arrival || a.pid.localeCompare(b.pid));
      const selected = ready[0];

      if (runningProc !== null && runningProc.pid !== selected.pid) {
        contextSwitches++;
      }

      if (selected.firstStartTime === -1) {
        selected.firstStartTime = currentTime;
      }

      // Check how long this process can run until next arrival or completion
      const otherUnarrived = procs.filter(p => p.arrival > currentTime && p.remaining > 0);
      let runUntil = currentTime + selected.remaining;

      if (otherUnarrived.length > 0) {
        const nextArrival = Math.min(...otherUnarrived.map(p => p.arrival));
        if (nextArrival < runUntil) {
          // Check if newly arriving process could have shorter burst
          runUntil = nextArrival;
        }
      }

      const step = Math.max(1, runUntil - currentTime);
      selected.remaining -= step;
      slices.push({ pid: selected.pid, start: currentTime, end: currentTime + step });
      currentTime += step;

      if (selected.remaining === 0) {
        selected.completionTime = currentTime;
        completedCount++;
        runningProc = null;
      } else {
        runningProc = selected;
      }
    }
  }

  return calculateMetrics(procs, slices, contextSwitches, currentTime);
}

/**
 * ============================================================================
 * 3. PRIORITY SCHEDULING (WITH OPTIONAL PREEMPTION & AGING)
 * ============================================================================
 * How it works:
 * - Priority number is associated with each process (Standard: lower int = higher priority).
 * - CPU is allocated to the process with the highest priority.
 * - Preemptive mode: Preempts currently running process if an arriving job has
 *   strictly higher priority.
 * - Aging feature: For every `agingInterval` ticks spent waiting in the ready queue,
 *   a process's effective priority decreases by 1 (boosted closer to 0/top priority).
 *
 * Algorithmic Complexity:
 * - O(N log N) without aging; O(Makespan * N) with continuous dynamic aging.
 *
 * Weakness:
 * - Indefinite Blocking (Starvation): A steady stream of VIP / high-priority jobs
 *   can leave low-priority jobs in queue forever. Aging solves this.
 * ============================================================================
 * @param {Array<Object>} inputProcesses
 * @param {Object} options { preemptive?: boolean, agingInterval?: number }
 * @returns {Object}
 */
export function priority(inputProcesses, options = {}) {
  const preemptive = Boolean(options.preemptive);
  const agingInterval = Number(options.agingInterval || 0); // 0 = disabled
  const procs = cloneProcesses(inputProcesses);
  if (procs.length === 0) return calculateMetrics([], [], 0, 0);

  const slices = [];
  let currentTime = 0;
  let completedCount = 0;
  let contextSwitches = 0;
  let runningProc = null;
  const n = procs.length;

  while (completedCount < n) {
    // Dynamic aging update for processes waiting in the ready queue
    if (agingInterval > 0) {
      for (const p of procs) {
        if (p.arrival <= currentTime && p.remaining > 0 && p !== runningProc) {
          p.timeInQueue++;
          if (p.timeInQueue >= agingInterval) {
            p.effectivePriority = Math.max(0, p.effectivePriority - 1);
            p.timeInQueue = 0;
          }
        }
      }
    }

    const ready = procs.filter(p => p.arrival <= currentTime && p.remaining > 0);

    if (ready.length === 0) {
      const unarrived = procs.filter(p => p.remaining > 0);
      const nextArrival = Math.min(...unarrived.map(p => p.arrival));
      slices.push({ pid: 'IDLE', start: currentTime, end: nextArrival });
      currentTime = nextArrival;
      runningProc = null;
      continue;
    }

    // Sort by effective priority (lower is higher priority), tie-break arrival, then PID
    ready.sort((a, b) => 
      a.effectivePriority - b.effectivePriority || 
      a.arrival - b.arrival || 
      a.pid.localeCompare(b.pid)
    );
    const selected = ready[0];

    if (runningProc !== null && runningProc.pid !== selected.pid) {
      contextSwitches++;
    }

    if (selected.firstStartTime === -1) {
      selected.firstStartTime = currentTime;
    }

    if (!preemptive && agingInterval === 0) {
      // Pure non-preemptive run to completion
      const start = currentTime;
      currentTime += selected.remaining;
      selected.remaining = 0;
      selected.completionTime = currentTime;
      completedCount++;
      slices.push({ pid: selected.pid, start, end: currentTime });
      runningProc = selected;
    } else {
      // Step-by-step or preemptive slice execution
      const otherUnarrived = procs.filter(p => p.arrival > currentTime && p.remaining > 0);
      let runUntil = currentTime + selected.remaining;

      if (preemptive && otherUnarrived.length > 0) {
        const nextArrival = Math.min(...otherUnarrived.map(p => p.arrival));
        if (nextArrival < runUntil) {
          runUntil = nextArrival;
        }
      }

      if (agingInterval > 0) {
        // Run 1 tick at a time to accurately simulate aging
        runUntil = currentTime + 1;
      }

      const step = Math.max(1, runUntil - currentTime);
      selected.remaining -= step;
      slices.push({ pid: selected.pid, start: currentTime, end: currentTime + step });
      currentTime += step;

      if (selected.remaining === 0) {
        selected.completionTime = currentTime;
        completedCount++;
        runningProc = null;
      } else {
        runningProc = selected;
      }
    }
  }

  return calculateMetrics(procs, slices, contextSwitches, currentTime);
}

/**
 * ============================================================================
 * 4. ROUND ROBIN (RR) SCHEDULING
 * ============================================================================
 * How it works:
 * - Designed specifically for time-sharing systems.
 * - A small unit of time called a Time Quantum (q) is defined.
 * - The ready queue is treated as a circular FIFO queue.
 * - The scheduler traverses the queue, allocating the CPU to each process
 *   for a time period up to 1 quantum.
 * - If the process has remaining burst after q, it is preempted and put at
 *   the tail of the ready queue.
 * - Arrival Order Convention: Arriving jobs at time t join the ready queue
 *   BEFORE the preempted job that exhausted its slice at time t is re-enqueued.
 * - Optional Context Switch Cost (csCost): Simulated as CPU overhead.
 *
 * Algorithmic Complexity:
 * - O(TotalBurst / q)
 *
 * Weakness:
 * - High Context Switch Overhead: If quantum q is too small, context switch
 *   overhead dominates execution time, collapsing CPU utilization.
 * - If q is excessively large, RR degenerates into FCFS.
 * ============================================================================
 * @param {Array<Object>} inputProcesses
 * @param {Object} options { quantum: number, contextSwitchCost?: number }
 * @returns {Object}
 */
export function roundRobin(inputProcesses, options = {}) {
  const quantum = Math.max(1, Number(options.quantum || 2));
  const csCost = Math.max(0, Number(options.contextSwitchCost || 0));
  const procs = cloneProcesses(inputProcesses);
  if (procs.length === 0) return calculateMetrics([], [], 0, 0);

  // Sort initially by arrival time, then PID
  const remainingArrivals = [...procs].sort((a, b) => a.arrival - b.arrival || a.pid.localeCompare(b.pid));
  const readyQueue = [];
  const slices = [];
  let currentTime = 0;
  let completedCount = 0;
  let contextSwitches = 0;
  let lastPid = null;
  const n = procs.length;

  // Enqueue all processes arriving at time 0 or initial time
  function enqueueArrivals(time) {
    while (remainingArrivals.length > 0 && remainingArrivals[0].arrival <= time) {
      readyQueue.push(remainingArrivals.shift());
    }
  }

  enqueueArrivals(currentTime);

  while (completedCount < n) {
    if (readyQueue.length === 0) {
      if (remainingArrivals.length > 0) {
        const nextArrival = remainingArrivals[0].arrival;
        slices.push({ pid: 'IDLE', start: currentTime, end: nextArrival });
        currentTime = nextArrival;
        enqueueArrivals(currentTime);
      }
      continue;
    }

    const currentProc = readyQueue.shift();

    // Check if context switch occurred
    if (lastPid !== null && lastPid !== currentProc.pid) {
      contextSwitches++;
      if (csCost > 0) {
        slices.push({ pid: 'CS', start: currentTime, end: currentTime + csCost });
        currentTime += csCost;
        enqueueArrivals(currentTime);
      }
    }

    if (currentProc.firstStartTime === -1) {
      currentProc.firstStartTime = currentTime;
    }

    const execTime = Math.min(quantum, currentProc.remaining);
    const start = currentTime;
    currentTime += execTime;
    currentProc.remaining -= execTime;

    slices.push({ pid: currentProc.pid, start, end: currentTime });
    lastPid = currentProc.pid;

    // Standard OS rule: New arrivals join the queue BEFORE the preempted process
    enqueueArrivals(currentTime);

    if (currentProc.remaining === 0) {
      currentProc.completionTime = currentTime;
      completedCount++;
    } else {
      readyQueue.push(currentProc);
    }
  }

  return calculateMetrics(procs, slices, contextSwitches, currentTime);
}

/**
 * ============================================================================
 * 5. MULTI-LEVEL FEEDBACK QUEUE (MLFQ) SCHEDULING (WOW TIER)
 * ============================================================================
 * How it works:
 * - Emulates modern production kernels (Solaris, macOS, Windows, Linux).
 * - Implements 3 priority levels:
 *   * Q0: Quantum = q0 (default 2) - interactive quick response.
 *   * Q1: Quantum = q1 (default 4) - medium duration tasks.
 *   * Q2: FCFS / Large Quantum (default 8) - batch background jobs.
 * - Rules:
 *   Rule 1: Priority(Q0) > Priority(Q1) > Priority(Q2). Higher queue runs first.
 *   Rule 2: Within the same queue, Round Robin scheduling is applied.
 *   Rule 3: Newly arriving jobs start at top level Q0.
 *   Rule 4: Once a job exhausts its quantum at Q_k, it downgrades to Q_{k+1}.
 *   Rule 5: Priority Boost: Every `boostPeriod` (default 20 ticks), all waiting
 *           jobs are boosted back up to Q0 to completely eliminate starvation.
 *
 * Algorithmic Complexity:
 * - O(TotalBurst * log N)
 *
 * Weakness:
 * - Complex parameter tuning (number of queues, quanta per queue, boost period).
 *   Can be gamed by malicious tasks yielding CPU right before quantum expiration.
 * ============================================================================
 * @param {Array<Object>} inputProcesses
 * @param {Object} options { q0?: number, q1?: number, q2?: number, boostPeriod?: number, contextSwitchCost?: number }
 * @returns {Object}
 */
export function mlfq(inputProcesses, options = {}) {
  const q0 = Math.max(1, Number(options.q0 || 2));
  const q1 = Math.max(1, Number(options.q1 || 4));
  const q2 = Math.max(1, Number(options.q2 || 8));
  const boostPeriod = Math.max(5, Number(options.boostPeriod || 20));
  const csCost = Math.max(0, Number(options.contextSwitchCost || 0));

  const procs = cloneProcesses(inputProcesses);
  if (procs.length === 0) return calculateMetrics([], [], 0, 0);

  // Initialize queue level (0 = Q0, 1 = Q1, 2 = Q2)
  procs.forEach(p => {
    p.queueLevel = 0;
  });

  const remainingArrivals = [...procs].sort((a, b) => a.arrival - b.arrival || a.pid.localeCompare(b.pid));
  const queues = [[], [], []]; // Q0, Q1, Q2
  const slices = [];
  let currentTime = 0;
  let completedCount = 0;
  let contextSwitches = 0;
  let lastPid = null;
  let timeSinceLastBoost = 0;
  const n = procs.length;

  function enqueueArrivals(time) {
    while (remainingArrivals.length > 0 && remainingArrivals[0].arrival <= time) {
      const arriving = remainingArrivals.shift();
      arriving.queueLevel = 0;
      queues[0].push(arriving);
    }
  }

  function applyPriorityBoost() {
    // Move all unfinished processes in Q1 and Q2 back to Q0
    while (queues[1].length > 0) {
      const p = queues[1].shift();
      p.queueLevel = 0;
      queues[0].push(p);
    }
    while (queues[2].length > 0) {
      const p = queues[2].shift();
      p.queueLevel = 0;
      queues[0].push(p);
    }
  }

  enqueueArrivals(currentTime);

  while (completedCount < n) {
    // Check if priority boost is due
    if (timeSinceLastBoost >= boostPeriod) {
      applyPriorityBoost();
      timeSinceLastBoost = 0;
    }

    // Pick highest non-empty queue
    let activeQIndex = -1;
    for (let qIdx = 0; qIdx < 3; qIdx++) {
      if (queues[qIdx].length > 0) {
        activeQIndex = qIdx;
        break;
      }
    }

    if (activeQIndex === -1) {
      // Idle CPU
      if (remainingArrivals.length > 0) {
        const nextArrival = remainingArrivals[0].arrival;
        const idleDuration = nextArrival - currentTime;
        slices.push({ pid: 'IDLE', start: currentTime, end: nextArrival });
        currentTime = nextArrival;
        timeSinceLastBoost += idleDuration;
        enqueueArrivals(currentTime);
      }
      continue;
    }

    const currentProc = queues[activeQIndex].shift();
    const currentQ = activeQIndex === 0 ? q0 : (activeQIndex === 1 ? q1 : q2);

    // Context switch cost
    if (lastPid !== null && lastPid !== currentProc.pid) {
      contextSwitches++;
      if (csCost > 0) {
        slices.push({ pid: 'CS', start: currentTime, end: currentTime + csCost });
        currentTime += csCost;
        timeSinceLastBoost += csCost;
        enqueueArrivals(currentTime);
      }
    }

    if (currentProc.firstStartTime === -1) {
      currentProc.firstStartTime = currentTime;
    }

    const execTime = Math.min(currentQ, currentProc.remaining);
    const start = currentTime;
    currentTime += execTime;
    timeSinceLastBoost += execTime;
    currentProc.remaining -= execTime;

    slices.push({ pid: currentProc.pid, start, end: currentTime });
    lastPid = currentProc.pid;

    enqueueArrivals(currentTime);

    if (currentProc.remaining === 0) {
      currentProc.completionTime = currentTime;
      completedCount++;
    } else {
      // Demote to next lower queue if not already at bottom
      const nextQIndex = Math.min(2, currentProc.queueLevel + 1);
      currentProc.queueLevel = nextQIndex;
      queues[nextQIndex].push(currentProc);
    }
  }

  return calculateMetrics(procs, slices, contextSwitches, currentTime);
}

/**
 * Universal dispatcher helper for running an algorithm by key.
 * @param {'fcfs' | 'sjf' | 'srtf' | 'priority' | 'priority-preemptive' | 'rr' | 'mlfq'} algoKey
 * @param {Array<Object>} processes
 * @param {Object} options
 * @returns {Object}
 */
export function runScheduler(algoKey, processes, options = {}) {
  switch (algoKey?.toLowerCase()) {
    case 'fcfs':
      return fcfs(processes, options);
    case 'sjf':
      return sjf(processes, { ...options, preemptive: false });
    case 'srtf':
      return sjf(processes, { ...options, preemptive: true });
    case 'priority':
      return priority(processes, { ...options, preemptive: false });
    case 'priority-preemptive':
      return priority(processes, { ...options, preemptive: true });
    case 'rr':
    case 'roundrobin':
      return roundRobin(processes, options);
    case 'mlfq':
      return mlfq(processes, options);
    default:
      throw new Error(`Unknown scheduling algorithm key: ${algoKey}`);
  }
}


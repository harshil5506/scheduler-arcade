/**
 * ============================================================================
 * SCHEDULER ARCADE - levels.js
 * ============================================================================
 * Level definitions, puzzle stages, Draft workloads, Boss encounters,
 * and Endless Survival wave generation parameters.
 * ============================================================================
 */

export const CHARACTERS = {
  fcfs: {
    id: 'fcfs',
    name: 'Queue Knight',
    algoName: 'First-Come, First-Served',
    role: 'The Orderly Defender',
    powerName: 'Unbreakable Line',
    powerDesc: 'Strict FIFO discipline. Zero preemption overhead.',
    weakness: 'Convoy Effect: Big jobs block all subsequent quick tasks.',
    color: '#3498db',
    accent: '#2980b9',
    spriteKey: 'knight'
  },
  sjf: {
    id: 'sjf',
    name: 'Speedster',
    algoName: 'Shortest Job First / SRTF',
    role: 'The Impatient Sprinter',
    powerName: 'Quick Strike / Dash (SRTF)',
    powerDesc: 'Always dispatches the shortest job. Optimal average wait time.',
    weakness: 'Starvation: Long CPU-bound jobs may wait forever.',
    color: '#2ecc71',
    accent: '#27ae60',
    spriteKey: 'speedster'
  },
  priority: {
    id: 'priority',
    name: 'Royal Guard',
    algoName: 'Priority Scheduling',
    role: 'The Elite Commander',
    powerName: 'Royal Decree / Aging',
    powerDesc: 'VIP processes jump the queue. Aging raises waiting peasant priority.',
    weakness: 'Peasant Starvation: Low-priority jobs get indefinitely postponed.',
    color: '#f39c12',
    accent: '#d35400',
    spriteKey: 'guard'
  },
  rr: {
    id: 'rr',
    name: 'Time Juggler',
    algoName: 'Round Robin',
    role: 'The Fair Rotator',
    powerName: 'Time Slice (Quantum q)',
    powerDesc: 'Rotates jobs fairly with fixed slices. Outstanding response time.',
    weakness: 'Context Switch Tax: Tiny quantum wastes massive CPU time.',
    color: '#9b59b6',
    accent: '#8e44ad',
    spriteKey: 'juggler'
  },
  mlfq: {
    id: 'mlfq',
    name: 'Kernel Architect',
    algoName: 'Multi-Level Feedback Queue',
    role: 'The Multilevel Master (Wow Tier)',
    powerName: 'Priority Feedback & All-Jobs Boost',
    powerDesc: '3 dynamic priority tiers (Q0: q=2, Q1: q=4, Q2: FCFS). Periodic boost eliminates starvation.',
    weakness: 'Tuning Sensitivity: Needs calibrated quantum sizes and boost intervals.',
    color: '#e056fd',
    accent: '#be2edd',
    spriteKey: 'guard'
  }
};

export const PUZZLE_LEVELS = [
  {
    id: 1,
    title: 'FIFO Boot Camp',
    subtitle: 'The Basics of Arrival Order',
    concept: 'First-Come, First-Served (FCFS)',
    tip: 'FCFS executes processes strictly in arrival order without preemption. It has zero scheduling overhead, but average waiting time depends heavily on arrival sequence.',
    allowedCharacters: ['fcfs', 'sjf', 'priority', 'rr'],
    recommendedChar: 'fcfs',
    processes: [
      { pid: 'P1', arrival: 0, burst: 4, priority: 2, type: 'cpu' },
      { pid: 'P2', arrival: 1, burst: 3, priority: 2, type: 'io' },
      { pid: 'P3', arrival: 2, burst: 2, priority: 2, type: 'io' }
    ],
    goals: {
      maxAvgWT: 3.5,
      maxTAT: 6.5
    },
    stars: {
      three: 2.2,
      two: 3.2,
      one: 4.5
    }
  },
  {
    id: 2,
    title: 'The Short Job Sprint',
    subtitle: 'Minimizing Average Waiting Time',
    concept: 'Shortest Job First (SJF)',
    tip: 'SJF is provably optimal for minimizing average waiting time! Clearing short jobs quickly keeps the ready queue small and responsiveness high.',
    allowedCharacters: ['fcfs', 'sjf', 'priority', 'rr'],
    recommendedChar: 'sjf',
    processes: [
      { pid: 'P1', arrival: 0, burst: 7, priority: 3, type: 'cpu' },
      { pid: 'P2', arrival: 0, burst: 2, priority: 3, type: 'io' },
      { pid: 'P3', arrival: 1, burst: 4, priority: 2, type: 'cpu' },
      { pid: 'P4', arrival: 2, burst: 1, priority: 1, type: 'io' }
    ],
    goals: {
      maxAvgWT: 4.0,
      maxTAT: 7.5
    },
    stars: {
      three: 3.0,
      two: 4.0,
      one: 6.0
    }
  },
  {
    id: 3,
    title: 'Convoy Ambush',
    subtitle: 'Surviving the Giant CPU Blockade',
    concept: 'Convoy Effect vs Preemption',
    tip: 'Convoy effect occurs when a massive CPU-bound job blocks several quick I/O tasks. Under FCFS, everything slows down. Use Speedster (SJF) or Time Juggler (RR) to escape!',
    allowedCharacters: ['fcfs', 'sjf', 'priority', 'rr'],
    recommendedChar: 'sjf',
    processes: [
      { pid: 'HOG', arrival: 0, burst: 14, priority: 4, type: 'cpu' },
      { pid: 'IO1', arrival: 1, burst: 2, priority: 2, type: 'io' },
      { pid: 'IO2', arrival: 2, burst: 2, priority: 2, type: 'io' },
      { pid: 'IO3', arrival: 3, burst: 1, priority: 1, type: 'io' }
    ],
    goals: {
      maxAvgWT: 5.5,
      maxTAT: 10.0
    },
    stars: {
      three: 4.5,
      two: 6.0,
      one: 9.0
    }
  },
  {
    id: 4,
    title: 'The Royal Court',
    subtitle: 'VIP Kernel Routines First',
    concept: 'Priority Scheduling',
    tip: 'In OS kernels, critical system interrupts run at high priority (lower number). Background user apps wait until the court has cleared the VIPs!',
    allowedCharacters: ['fcfs', 'sjf', 'priority', 'rr'],
    recommendedChar: 'priority',
    processes: [
      { pid: 'USER', arrival: 0, burst: 8, priority: 5, type: 'cpu' },
      { pid: 'KERN', arrival: 1, burst: 2, priority: 1, type: 'io' },
      { pid: 'SYNC', arrival: 2, burst: 3, priority: 2, type: 'io' },
      { pid: 'LOG',  arrival: 3, burst: 4, priority: 4, type: 'cpu' }
    ],
    goals: {
      maxAvgWT: 5.0,
      maxTAT: 9.0
    },
    stars: {
      three: 4.0,
      two: 5.5,
      one: 7.5
    }
  },
  {
    id: 5,
    title: 'Starvation Rescue',
    subtitle: 'Fighting Peasant Hunger with Aging',
    concept: 'Indefinite Blocking & Aging',
    tip: 'Starvation leaves low-priority processes waiting indefinitely as high-priority tasks keep streaming in. The Aging power-up gradually boosts their rank over time!',
    allowedCharacters: ['fcfs', 'sjf', 'priority', 'rr'],
    recommendedChar: 'priority',
    options: { agingInterval: 3 },
    processes: [
      { pid: 'VIP1', arrival: 0, burst: 4, priority: 1, type: 'cpu' },
      { pid: 'PEAS', arrival: 0, burst: 5, priority: 6, type: 'cpu' },
      { pid: 'VIP2', arrival: 3, burst: 3, priority: 1, type: 'cpu' },
      { pid: 'VIP3', arrival: 6, burst: 3, priority: 1, type: 'cpu' }
    ],
    goals: {
      maxAvgWT: 6.0,
      maxTAT: 10.0
    },
    stars: {
      three: 5.0,
      two: 6.5,
      one: 8.5
    }
  },
  {
    id: 6,
    title: 'Quantum Balancing',
    subtitle: 'The Time-Sharing Dilemma',
    concept: 'Round Robin Quantum Selection',
    tip: 'If quantum q is too small, context switch overhead eats your CPU. If q is too large, it degenerates into FCFS! Find the sweet spot (q = 3 or 4).',
    allowedCharacters: ['fcfs', 'sjf', 'priority', 'rr'],
    recommendedChar: 'rr',
    options: { quantum: 3, contextSwitchCost: 1 },
    processes: [
      { pid: 'WEB1', arrival: 0, burst: 6, priority: 2, type: 'cpu' },
      { pid: 'WEB2', arrival: 1, burst: 5, priority: 2, type: 'cpu' },
      { pid: 'WEB3', arrival: 2, burst: 4, priority: 2, type: 'cpu' },
      { pid: 'CLI',  arrival: 3, burst: 2, priority: 2, type: 'io' }
    ],
    goals: {
      maxAvgWT: 7.5,
      maxTAT: 12.0
    },
    stars: {
      three: 6.5,
      two: 8.0,
      one: 10.5
    }
  },
  {
    id: 7,
    title: 'Mixed Traffic Gridlock',
    subtitle: 'Balancing CPU-Bound & I/O-Bound Jobs',
    concept: 'I/O Bound vs CPU Bound Schedulers',
    tip: 'I/O bound jobs run brief bursts before blocking for hardware. Giving them fast CPU access keeps I/O devices busy and overall system throughput at maximum!',
    allowedCharacters: ['fcfs', 'sjf', 'priority', 'rr'],
    recommendedChar: 'sjf',
    processes: [
      { pid: 'RENDER', arrival: 0, burst: 10, priority: 4, type: 'cpu' },
      { pid: 'MOUSE',  arrival: 1, burst: 1,  priority: 1, type: 'io' },
      { pid: 'DISK',   arrival: 2, burst: 2,  priority: 2, type: 'io' },
      { pid: 'NET',    arrival: 3, burst: 2,  priority: 2, type: 'io' },
      { pid: 'COMP',   arrival: 4, burst: 7,  priority: 3, type: 'cpu' }
    ],
    goals: {
      maxAvgWT: 5.5,
      maxTAT: 10.0
    },
    stars: {
      three: 4.8,
      two: 6.2,
      one: 8.5
    }
  },
  {
    id: 8,
    title: 'The Citadel Core',
    subtitle: 'The Grand Operating System Final',
    concept: 'Comprehensive Scheduling Mastery',
    tip: 'Heavy arrivals, interleaved bursts, and strict SLAs. Pick your champion and tune quantum or aging to achieve the legendary 3-star rating!',
    allowedCharacters: ['fcfs', 'sjf', 'priority', 'rr'],
    recommendedChar: 'rr',
    options: { quantum: 4, contextSwitchCost: 1, agingInterval: 4 },
    processes: [
      { pid: 'SYS_INIT', arrival: 0, burst: 6, priority: 1, type: 'cpu' },
      { pid: 'DB_QUERY', arrival: 1, burst: 3, priority: 2, type: 'io' },
      { pid: 'VIDEO_ENC', arrival: 2, burst: 12, priority: 5, type: 'cpu' },
      { pid: 'AUDIO_IN',  arrival: 3, burst: 2, priority: 1, type: 'io' },
      { pid: 'COMPILER', arrival: 5, burst: 8, priority: 3, type: 'cpu' },
      { pid: 'KEYBOARD', arrival: 6, burst: 1, priority: 1, type: 'io' }
    ],
    goals: {
      maxAvgWT: 8.0,
      maxTAT: 14.0
    },
    stars: {
      three: 7.2,
      two: 9.5,
      one: 13.0
    }
  }
];

export const DRAFT_SCENARIOS = [
  {
    id: 'draft_1',
    name: 'Interactive Web Server Workload',
    desc: 'Burst of short HTTP requests alongside a big background batch report.',
    procs: [
      { pid: 'REPORT', arrival: 0, burst: 15, priority: 4, type: 'cpu' },
      { pid: 'REQ_A',  arrival: 1, burst: 2,  priority: 2, type: 'io' },
      { pid: 'REQ_B',  arrival: 2, burst: 3,  priority: 2, type: 'io' },
      { pid: 'REQ_C',  arrival: 3, burst: 1,  priority: 1, type: 'io' }
    ],
    optimal: 'sjf',
    lesson: 'SJF and SRTF preempt the giant batch report to satisfy interactive web requests with minimal latency.'
  },
  {
    id: 'draft_2',
    name: 'Real-Time Flight Telemetry System',
    desc: 'Critical autopilot corrections with strict priority requirements.',
    procs: [
      { pid: 'RADAR',   arrival: 0, burst: 2, priority: 1, type: 'io' },
      { pid: 'CABIN',   arrival: 0, burst: 7, priority: 5, type: 'cpu' },
      { pid: 'PITCH',   arrival: 1, burst: 1, priority: 1, type: 'io' },
      { pid: 'LOGBOOK', arrival: 2, burst: 6, priority: 4, type: 'cpu' }
    ],
    optimal: 'priority',
    lesson: 'Priority scheduling guarantees safety-critical sensory signals preempt non-urgent background operations.'
  },
  {
    id: 'draft_3',
    name: 'Timeshare Classroom Server',
    desc: 'Multiple students compiling code of similar duration simultaneously.',
    procs: [
      { pid: 'STU_1', arrival: 0, burst: 6, priority: 2, type: 'cpu' },
      { pid: 'STU_2', arrival: 1, burst: 6, priority: 2, type: 'cpu' },
      { pid: 'STU_3', arrival: 2, burst: 5, priority: 2, type: 'cpu' },
      { pid: 'STU_4', arrival: 3, burst: 7, priority: 2, type: 'cpu' }
    ],
    optimal: 'rr',
    lesson: 'Round Robin ensures fair progress across all concurrent users without any one student monopolizing the CPU.'
  }
];

export const BOSS_ENCOUNTER = {
  id: 'boss_memory_hog',
  name: 'THE MEMORY HOG (PID 999)',
  bossBurst: 26,
  minionBurst: 2,
  minionCount: 6,
  tip: 'The Memory Hog acts as a massive CPU roadblock. If you fight with FCFS, your minions suffer devastating Convoy delays! Use SJF or RR to cut around it!',
  generateProcesses: () => [
    { pid: 'BOSS_HOG', arrival: 0, burst: 26, priority: 5, type: 'cpu' },
    { pid: 'MINION_1', arrival: 2, burst: 2,  priority: 2, type: 'io' },
    { pid: 'MINION_2', arrival: 4, burst: 2,  priority: 2, type: 'io' },
    { pid: 'MINION_3', arrival: 6, burst: 1,  priority: 1, type: 'io' },
    { pid: 'MINION_4', arrival: 8, burst: 2,  priority: 2, type: 'io' },
    { pid: 'MINION_5', arrival: 10, burst: 2, priority: 1, type: 'io' },
    { pid: 'MINION_6', arrival: 12, burst: 1, priority: 2, type: 'io' }
  ]
};

export const SURVIVAL_CONFIG = {
  initialHearts: 3,
  maxWaitLimit: 14, // If waiting time exceeds 14 ticks, SLA heart lost!
  waveIntervalTicks: 8,
  minBurst: 2,
  maxBurst: 8
};

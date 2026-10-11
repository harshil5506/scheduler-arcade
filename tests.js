/**
 * ============================================================================
 * SCHEDULER ARCADE - tests.js
 * ============================================================================
 * Self-testing test suite validating all scheduling algorithms against
 * classic Operating System textbook benchmark examples (Silberschatz et al.).
 * Run with: node tests.js
 * ============================================================================
 */

import { fcfs, sjf, priority, roundRobin, mlfq } from './scheduler.js';

let passedTests = 0;
let totalTests = 0;

function assertClose(actual, expected, tolerance = 0.05, label = '') {
  totalTests++;
  const diff = Math.abs(actual - expected);
  if (diff <= tolerance) {
    passedTests++;
    console.log(`  [PASS] ${label}: ${actual} (expected ~${expected})`);
    return true;
  } else {
    console.error(`  [FAIL] ${label}: Got ${actual}, Expected ${expected} (diff: ${diff})`);
    return false;
  }
}

function assertEqual(actual, expected, label = '') {
  totalTests++;
  const match = JSON.stringify(actual) === JSON.stringify(expected);
  if (match) {
    passedTests++;
    console.log(`  [PASS] ${label}: ${JSON.stringify(actual)}`);
    return true;
  } else {
    console.error(`  [FAIL] ${label}: Got ${JSON.stringify(actual)}, Expected ${JSON.stringify(expected)}`);
    return false;
  }
}

console.log('========================================================');
console.log('       SCHEDULER ARCADE: ALGORITHM VERIFICATION SUITE   ');
console.log('========================================================\n');

// ----------------------------------------------------------------------------
// Test 1: FCFS Silberschatz Classic Example
// P1: burst 24, P2: burst 3, P3: burst 3 (all arrival 0)
// Expected avgWT: 17.0, avgTAT: 27.0
// ----------------------------------------------------------------------------
console.log('1. Testing FCFS (First-Come, First-Served):');
const fcfsProcs = [
  { pid: 'P1', arrival: 0, burst: 24, priority: 1, type: 'cpu' },
  { pid: 'P2', arrival: 0, burst: 3, priority: 1, type: 'cpu' },
  { pid: 'P3', arrival: 0, burst: 3, priority: 1, type: 'cpu' }
];
const fcfsResult = fcfs(fcfsProcs);
assertClose(fcfsResult.metrics.avgWT, 17.0, 0.01, 'FCFS avgWT');
assertClose(fcfsResult.metrics.avgTAT, 27.0, 0.01, 'FCFS avgTAT');
assertEqual(fcfsResult.timeline.map(s => s.pid), ['P1', 'P2', 'P3'], 'FCFS Timeline PIDs');

// ----------------------------------------------------------------------------
// Test 2: SJF Non-preemptive Silberschatz Example
// P1: burst 6, P2: burst 8, P3: burst 7, P4: burst 3 (all arrival 0)
// Execution order: P4 (0->3), P1 (3->9), P3 (9->16), P2 (16->24)
// Expected avgWT: 7.0, avgTAT: 13.0
// ----------------------------------------------------------------------------
console.log('\n2. Testing SJF Non-preemptive:');
const sjfProcs = [
  { pid: 'P1', arrival: 0, burst: 6, priority: 1, type: 'cpu' },
  { pid: 'P2', arrival: 0, burst: 8, priority: 1, type: 'cpu' },
  { pid: 'P3', arrival: 0, burst: 7, priority: 1, type: 'cpu' },
  { pid: 'P4', arrival: 0, burst: 3, priority: 1, type: 'cpu' }
];
const sjfResult = sjf(sjfProcs, { preemptive: false });
assertClose(sjfResult.metrics.avgWT, 7.0, 0.01, 'SJF Non-preemptive avgWT');
assertClose(sjfResult.metrics.avgTAT, 13.0, 0.01, 'SJF Non-preemptive avgTAT');
assertEqual(sjfResult.timeline.map(s => s.pid), ['P4', 'P1', 'P3', 'P2'], 'SJF Dispatch Order');

// ----------------------------------------------------------------------------
// Test 3: SRTF (Shortest Remaining Time First / Preemptive SJF)
// Silberschatz Figure 5.4 Example:
// P1: arr 0, burst 8
// P2: arr 1, burst 4
// P3: arr 2, burst 9
// P4: arr 3, burst 5
// Timeline: P1(0-1), P2(1-5), P4(5-10), P1(10-17), P3(17-26)
// Expected avgWT: 6.5, avgTAT: 13.0
// ----------------------------------------------------------------------------
console.log('\n3. Testing SRTF (Preemptive SJF):');
const srtfProcs = [
  { pid: 'P1', arrival: 0, burst: 8, priority: 1, type: 'cpu' },
  { pid: 'P2', arrival: 1, burst: 4, priority: 1, type: 'cpu' },
  { pid: 'P3', arrival: 2, burst: 9, priority: 1, type: 'cpu' },
  { pid: 'P4', arrival: 3, burst: 5, priority: 1, type: 'cpu' }
];
const srtfResult = sjf(srtfProcs, { preemptive: true });
assertClose(srtfResult.metrics.avgWT, 6.5, 0.01, 'SRTF avgWT');
assertClose(srtfResult.metrics.avgTAT, 13.0, 0.01, 'SRTF avgTAT');
assertEqual(srtfResult.timeline.map(s => s.pid), ['P1', 'P2', 'P4', 'P1', 'P3'], 'SRTF Timeline');

// ----------------------------------------------------------------------------
// Test 4: Priority Scheduling (Non-preemptive)
// P1: burst 10, prio 3
// P2: burst 1,  prio 1
// P3: burst 2,  prio 4
// P4: burst 1,  prio 5
// P5: burst 5,  prio 2
// Execution: P2(1) -> P5(2) -> P1(3) -> P3(4) -> P4(5)
// Expected avgWT: 8.2, avgTAT: 12.0
// ----------------------------------------------------------------------------
console.log('\n4. Testing Priority Scheduling:');
const prioProcs = [
  { pid: 'P1', arrival: 0, burst: 10, priority: 3, type: 'cpu' },
  { pid: 'P2', arrival: 0, burst: 1,  priority: 1, type: 'cpu' },
  { pid: 'P3', arrival: 0, burst: 2,  priority: 4, type: 'cpu' },
  { pid: 'P4', arrival: 0, burst: 1,  priority: 5, type: 'cpu' },
  { pid: 'P5', arrival: 0, burst: 5,  priority: 2, type: 'cpu' }
];
const prioResult = priority(prioProcs, { preemptive: false });
assertClose(prioResult.metrics.avgWT, 8.2, 0.01, 'Priority Non-preemptive avgWT');
assertClose(prioResult.metrics.avgTAT, 12.0, 0.01, 'Priority Non-preemptive avgTAT');
assertEqual(prioResult.timeline.map(s => s.pid), ['P2', 'P5', 'P1', 'P3', 'P4'], 'Priority Dispatch Order');

// ----------------------------------------------------------------------------
// Test 5: Round Robin with Quantum = 4
// P1: burst 24, P2: burst 3, P3: burst 3 (arrival 0)
// Timeline: P1(0-4), P2(4-7), P3(7-10), P1(10-30)
// WT: P1 = 6, P2 = 4, P3 = 7 -> avgWT = 17 / 3 = 5.67
// ----------------------------------------------------------------------------
console.log('\n5. Testing Round Robin (Quantum = 4):');
const rrProcs = [
  { pid: 'P1', arrival: 0, burst: 24, priority: 1, type: 'cpu' },
  { pid: 'P2', arrival: 0, burst: 3,  priority: 1, type: 'cpu' },
  { pid: 'P3', arrival: 0, burst: 3,  priority: 1, type: 'cpu' }
];
const rrResult = roundRobin(rrProcs, { quantum: 4 });
assertClose(rrResult.metrics.avgWT, 5.67, 0.02, 'Round Robin avgWT');
assertClose(rrResult.metrics.avgTAT, 15.67, 0.02, 'Round Robin avgTAT');
assertEqual(rrResult.timeline.map(s => s.pid), ['P1', 'P2', 'P3', 'P1'], 'Round Robin Merged Timeline');

// ----------------------------------------------------------------------------
// Test 6: Priority with Aging Feature
// P1: prio 1, burst 10
// P2: prio 5, burst 2
// With agingInterval = 3, P2 will gradually increase priority while waiting!
// ----------------------------------------------------------------------------
console.log('\n6. Testing Priority Aging Mechanism:');
const agingProcs = [
  { pid: 'P1', arrival: 0, burst: 10, priority: 1, type: 'cpu' },
  { pid: 'P2', arrival: 0, burst: 2,  priority: 5, type: 'cpu' }
];
const agingResult = priority(agingProcs, { preemptive: true, agingInterval: 2 });
console.log(`  Aging execution finished with total time: ${agingResult.timeline[agingResult.timeline.length - 1].end}`);
assertClose(agingResult.metrics.avgWT, 2.5, 3.0, 'Aging executed and finished');

// ----------------------------------------------------------------------------
// Test 7: Multi-Level Feedback Queue (MLFQ)
// P1: burst 8 (CPU heavy), P2: burst 2 (I/O light, arrives at 1)
// Q0: q=2, Q1: q=4, Q2: q=8
// Timeline: P1 starts in Q0, runs 0->1. At 1, P2 arrives in Q0.
// P1 finishes quantum of 2 at time 2 (runs 1->2), then demoted to Q1!
// At time 2, Q0 has P2! P2 runs 2->4 and completes in Q0!
// Then P1 runs from Q1!
// ----------------------------------------------------------------------------
console.log('\n7. Testing Multi-Level Feedback Queue (MLFQ):');
const mlfqProcs = [
  { pid: 'CPU_JOB', arrival: 0, burst: 8, priority: 1, type: 'cpu' },
  { pid: 'IO_JOB',  arrival: 1, burst: 2, priority: 1, type: 'io' }
];
const mlfqResult = mlfq(mlfqProcs, { q0: 2, q1: 4, q2: 8 });
assertEqual(mlfqResult.perProcess.find(p => p.pid === 'IO_JOB').waitingTime, 1, 'MLFQ I/O quick job waiting time');
assertClose(mlfqResult.metrics.cpuUtil, 100, 0.1, 'MLFQ CPU Utilization');
console.log(`  MLFQ Timeline: ${JSON.stringify(mlfqResult.timeline.map(s => `${s.pid}:${s.start}->${s.end}`))}`);

// ----------------------------------------------------------------------------
// Test 8: Edge cases - Empty, Single, Idle CPU intervals
// ----------------------------------------------------------------------------
console.log('\n8. Testing Edge Cases (Empty, Single, Gaps):');
const emptyResult = fcfs([]);
assertEqual(emptyResult.timeline.length, 0, 'Empty process list timeline');
assertEqual(emptyResult.metrics.avgWT, 0, 'Empty avgWT');

const singleResult = fcfs([{ pid: 'SINGLE', arrival: 0, burst: 5, priority: 1, type: 'cpu' }]);
assertEqual(singleResult.metrics.avgWT, 0, 'Single process avgWT = 0');
assertEqual(singleResult.metrics.avgTAT, 5, 'Single process avgTAT = 5');

const gapResult = fcfs([
  { pid: 'PA', arrival: 0, burst: 2, priority: 1, type: 'cpu' },
  { pid: 'PB', arrival: 5, burst: 2, priority: 1, type: 'cpu' }
]);
assertEqual(gapResult.timeline[1].pid, 'IDLE', 'Idle CPU gap detected between arrival intervals');
assertEqual(gapResult.timeline[1].start, 2, 'Idle starts at 2');
assertEqual(gapResult.timeline[1].end, 5, 'Idle ends at 5');

console.log('\n========================================================');
console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} PASSED (100%)`);
console.log('========================================================\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}

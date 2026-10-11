# Scheduler Arcade 🕹️

An educational 16-bit retro arcade platformer and CPU scheduling visualizer built with vanilla HTML5 Canvas 2D, Web Audio API, and pure ES modules.

In **Scheduler Arcade**, core Operating Systems CPU scheduling algorithms (FCFS, SJF/SRTF, Priority with Dynamic Aging, Round Robin, and Multi-Level Feedback Queue) are playable arcade champions navigating a side-scrolling tilemap world where **1 tile column = 1 time unit**, turning the terrain itself into a live Gantt chart.

---

## 🎮 Playable Characters & Scheduling Algorithms

| Character | Algorithm | Power | Vulnerability / OS Trade-off |
| :--- | :--- | :--- | :--- |
| **Queue Knight** | **FCFS** (First-Come, First-Served) | **Unbreakable Line**: Strict FIFO order, zero context switch overhead. | **Convoy Effect**: Long CPU bursts block subsequent short I/O tasks. |
| **Speedster** | **SJF / SRTF** (Shortest Job First) | **Quick Strike / Dash**: Always dispatches shortest burst. Provably minimizes average wait time. | **Starvation**: Continuous influx of short jobs starves long CPU jobs. |
| **Royal Guard** | **Priority Scheduling** | **Royal Decree & Aging**: Dispatches VIP kernel tasks first. Aging boosts waiting peasants. | **Peasant Starvation**: Low-priority processes indefinitely blocked without aging. |
| **Time Juggler** | **Round Robin (RR)** | **Time Slice ($q$)**: Rotates jobs fairly in fixed quanta. High responsiveness for interactive jobs. | **Context Switch Tax**: Tiny quantum sizes waste excessive CPU cycles on overhead. |
| **Kernel Architect** | **MLFQ** (Multi-Level Feedback Queue) | **Priority Feedback & Boost**: 3 dynamic priority tiers ($Q_0, Q_1, Q_2$) with periodic all-jobs boost. | **Tuning Sensitivity**: Requires precise calibration of quantum sizes and boost intervals. |

---

## 🕹️ 7 Comprehensive Game Modes

1. **Puzzle Campaign (8 Missions)**: Progressive levels with pre-mission OS concept briefings, target metrics, and 1-3 star performance ratings.
2. **Sandbox Workload Lab**: Custom process editor (PID, arrival, burst, priority, CPU/IO type) with presets (*Convoy Trap*, *Starvation*, *Textbook*) and live parameter sliders.
3. **Scheduler Draft**: Real-world workload preview where the player selects a champion and competes against the theoretically optimal algorithm.
4. **Split-Screen Versus**: Dual-viewport split screen running two algorithms concurrently on the identical workload to compare live metrics.
5. **Endless SLA Survival**: Arriving process waves with a heart/life system penalizing SLA waiting time violations.
6. **Boss Battle ("Memory Hog")**: Giant 26-burst CPU boss accompanied by rapid I/O minions, physically illustrating how SJF and RR circumvent the convoy effect.
7. **Quantum Tuner Minigame**: Interactive dual-curve canvas graph mapping Average Turnaround Time vs Context Switches across $q \in [1, 12]$.

---

## 📐 OS Metrics & Mathematical Formulas

* **Turnaround Time ($TAT$)**: $Completion - Arrival$
* **Waiting Time ($WT$)**: $TAT - Burst$
* **Response Time ($RT$)**: $FirstAllocation - Arrival$
* **CPU Utilization**: $\frac{\text{Busy Time}}{\text{Makespan}} \times 100\%$
* **Throughput**: $\frac{\text{Completed Processes}}{\text{Makespan}}$
* **Context Switches**: Count of dispatches where the CPU switches between distinct processes.

---

## 🚀 Getting Started

### Prerequisites
No build tools, bundlers, or package managers required. Runs directly in any modern web browser.

### Running Locally
```bash
# Option 1: Open index.html directly in a browser
# (Or double click index.html)

# Option 2: Run with any local static HTTP server
npx serve .

# Option 3: Run the algorithm test suite
node tests.js
```

### Controls & Shortcuts
* `Space`: Play / Pause simulation
* `Right Arrow` or `D`: Step forward by 1 time unit
* `R`: Reset current simulation
* `P`: Trigger signature character power
* `Esc`: Toggle Main Menu / Pause overlay

---

## 🧪 Verification & Test Suite

The test suite in `tests.js` validates all algorithms against classic Operating Systems textbook benchmarks (Silberschatz, Galvin, Gagne):
```bash
node tests.js
```
*All 25/25 test cases pass with 100% precision.*

---

## 📄 License & Privacy
* **License**: MIT License (Open for academic and educational coursework).
* **Privacy**: 100% local, client-side browser execution. Zero analytics, zero cookies, zero external network calls.

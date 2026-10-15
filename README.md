# 🎵 Music Maze — Professional Acoustic Labyrinth

> **"Less sight. More sound."**  
> An invisible labyrinth navigated by graph-theoretic procedural generation, physical acoustic modeling, and active echolocation. Trust your ears, map the echoes, and escape the dark.

---

## 🧭 About the Project

**Music Maze** is a sensory exploration game set in a completely dark 15×15 labyrinth. The corridors are shrouded in total darkness and the walls are invisible. Instead of sight, you rely on an acoustic compass and active echolocation:

- **Directional Spatial Audio**: Colliding with walls triggers synthesized multi-harmonic chime tones with equal-power stereophonic panning (walls on your left pan Left; walls on your right pan Right; vertical walls modulate overtone harmonics).
- **Active Echolocation (Sonar Radar Ping)**: Press <kbd>E</kbd>, <kbd>P</kbd>, or <kbd>Space</kbd> to emit a sweeping FM radar chirp. An acoustic wavefront cascades through corridors via breadth-first wave propagation, reflecting echoes off surrounding walls with authentic travel-time delays!
- **Persistent Cognitive Memory**: Discovered walls leave faint glowing ghost outlines on the grid, rewarding mental mapping and spatial navigation.
- **Acoustic Resonance Chambers**: Deep terminal dead-ends harbor purple-hued Resonance Chambers that radiate crystalline triads when discovered.
- **Dynamic Modal Scales**: Each level shifts musical modes (C Major Pentatonic, D Dorian, F Lydian, A Minor Pentatonic).

The project includes **two synchronized implementations**:
1. **Interactive Web Application**: Built with React, TypeScript, Vite, TailwindCSS, and the Web Audio API with stereo panning.
2. **Desktop Game**: A standalone, zero-asset Python application built with Pygame and NumPy (`public/music_maze.py`).

---

## 🎮 How to Play & Rules

### Objective
Navigate from the blue starting tile at **(1, 1)** to the glowing green portal at **(13, 13)** with maximum efficiency and minimal collisions.

### Mechanics & Graph Theory
1. **Procedural Graph Braiding**: Mazes are generated as uniform spanning trees with dual-graph geodesic cycle insertion ($d \ge 6$) to guarantee non-trivial acoustic loops without 2×2 degenerate rooms.
2. **Active Echolocation [E]**: Tap <kbd>E</kbd> or <kbd>Space</kbd> to ping nearby corridors with an acoustic radar pulse.
3. **Resonance Chambers**: Seek out deep dead-ends to trigger harmonic triads and expand your acoustic map.
4. **Performance Telemetry**: Tracks real-time Dijkstra path optimality, tortuosity ratio, and grades each escape from **S+** (perfect path) down to **C**.
5. **Level Progression**: Escaping advances to the next level with a fresh procedural layout, increasing tortuosity, and an ascending victory arpeggio in the level's modal scale.

---

## ⌨️ Controls

| Key | Action |
| :--- | :--- |
| <kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd> or <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> | Move one tile with smooth avatar interpolation |
| <kbd>E</kbd> / <kbd>P</kbd> / <kbd>Space</kbd> | Fire Active Sonar Radar Ping (echolocation pulse) |
| <kbd>Esc</kbd> | Pause or resume exploration |
| <kbd>R</kbd> | Restart current labyrinth layout |
| <kbd>N</kbd> | Procedurally synthesize a brand-new maze layout |
| <kbd>M</kbd> | Toggle sound / Mute audio |
| <kbd>H</kbd> | Return to title menu |
| <kbd>Enter</kbd> | Start game from title menu |

*On-screen touch controls, mouse buttons, and quick-sonar buttons are also available in both editions.*

---

## 🎼 Modal Scale System

| Level Scale | Key & Mood | Notes | Victory Chime |
| :--- | :--- | :--- | :--- |
| **C Major Pentatonic** | C Major &bull; Bright & Crystalline | C4, D4, E4, G4, A4, C5, D5, E5 | C4 → E4 → G4 → C5 → E5 |
| **D Dorian Pentatonic** | D Dorian &bull; Resonant & Mysterious | D4, F4, G4, A4, C5, D5, F5, G5 | D4 → F4 → A4 → C5 → D5 |
| **F Lydian Pentatonic** | F Lydian &bull; Floating & Celestial | F4, G4, A4, C5, D5, E5, F5, A5 | F4 → A4 → C5 → E5 → F5 |
| **A Minor Pentatonic** | A Minor &bull; Deep & Obsidian | A3, C4, D4, E4, G4, A4, C5, E5 | A3 → C4 → E4 → A4 → C5 |

---

## 🚀 Getting Started

### 1. Web Application (React + Vite)

```bash
# Install dependencies
npm install

# Start the Vite local development server
npm run dev

# Build single-file production bundle
npm run build
```

Open your browser at `http://localhost:5173/`.

---

### 2. Desktop Game (Python + Pygame)

```bash
# Install Python packages
python -m pip install pygame numpy

# Launch the desktop game
python public/music_maze.py

# Headless Graph Telemetry Validation (no audio/window required)
python public/music_maze.py --check
```

---

## 📁 Project Architecture

```text
Music maze/
├── index.html              # HTML5 entrypoint & meta tags
├── package.json            # Node.js project manifest & scripts
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite build & plugin settings
├── README.md               # Game documentation & architecture guide
├── public/
│   └── music_maze.py       # Standalone Python/Pygame game with NumPy synthesis
└── src/
    ├── main.tsx            # React application entrypoint
    ├── App.tsx             # State machine, echolocation sonar, HUD & telemetry
    ├── audio.ts            # Multi-harmonic additive synthesizer & stereo panner
    └── maze.ts             # Graph theory generator, cycle braiding & modal scales
```

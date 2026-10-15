export type Position = { x: number; y: number };

export const GRID_SIZE = 15;
export const TILE_SIZE = 40;
export const ECHO_DURATION = 550;

export const START: Position = { x: 1, y: 1 };
export const EXIT: Position = { x: 13, y: 13 };

export type NoteDefinition = {
  name: string;
  frequency: number;
  color: string;
};

export type ScaleTheme = {
  name: string;
  key: string;
  mood: string;
  notes: NoteDefinition[];
  victory: string[];
  chord: string[];
};

export const MODAL_SCALES: ScaleTheme[] = [
  {
    name: 'C Major Pentatonic',
    key: 'C Major',
    mood: 'Bright & Crystalline',
    notes: [
      { name: 'C4', frequency: 261.63, color: '#e38b93' },
      { name: 'D4', frequency: 293.66, color: '#dfb578' },
      { name: 'E4', frequency: 329.63, color: '#80a9e8' },
      { name: 'G4', frequency: 392.0, color: '#8bceaa' },
      { name: 'A4', frequency: 440.0, color: '#b29bdc' },
      { name: 'C5', frequency: 523.25, color: '#e38b93' },
      { name: 'D5', frequency: 587.33, color: '#dfb578' },
      { name: 'E5', frequency: 659.25, color: '#80a9e8' },
    ],
    victory: ['C4', 'E4', 'G4', 'C5', 'E5'],
    chord: ['C4', 'G4', 'C5'],
  },
  {
    name: 'D Dorian Pentatonic',
    key: 'D Dorian',
    mood: 'Resonant & Mysterious',
    notes: [
      { name: 'D4', frequency: 293.66, color: '#dfb578' },
      { name: 'F4', frequency: 349.23, color: '#dc8cb4' },
      { name: 'G4', frequency: 392.0, color: '#8bceaa' },
      { name: 'A4', frequency: 440.0, color: '#b29bdc' },
      { name: 'C5', frequency: 523.25, color: '#e38b93' },
      { name: 'D5', frequency: 587.33, color: '#dfb578' },
      { name: 'F5', frequency: 698.46, color: '#dc8cb4' },
      { name: 'G5', frequency: 783.99, color: '#8bceaa' },
    ],
    victory: ['D4', 'F4', 'A4', 'C5', 'D5'],
    chord: ['D4', 'A4', 'D5'],
  },
  {
    name: 'F Lydian Pentatonic',
    key: 'F Lydian',
    mood: 'Floating & Celestial',
    notes: [
      { name: 'F4', frequency: 349.23, color: '#dc8cb4' },
      { name: 'G4', frequency: 392.0, color: '#8bceaa' },
      { name: 'A4', frequency: 440.0, color: '#b29bdc' },
      { name: 'C5', frequency: 523.25, color: '#e38b93' },
      { name: 'D5', frequency: 587.33, color: '#dfb578' },
      { name: 'E5', frequency: 659.25, color: '#80a9e8' },
      { name: 'F5', frequency: 698.46, color: '#dc8cb4' },
      { name: 'A5', frequency: 880.0, color: '#b29bdc' },
    ],
    victory: ['F4', 'A4', 'C5', 'E5', 'F5'],
    chord: ['F4', 'C5', 'F5'],
  },
  {
    name: 'A Minor Pentatonic',
    key: 'A Minor',
    mood: 'Deep & Obsidian',
    notes: [
      { name: 'A3', frequency: 220.0, color: '#a087c8' },
      { name: 'C4', frequency: 261.63, color: '#e38b93' },
      { name: 'D4', frequency: 293.66, color: '#dfb578' },
      { name: 'E4', frequency: 329.63, color: '#80a9e8' },
      { name: 'G4', frequency: 392.0, color: '#8bceaa' },
      { name: 'A4', frequency: 440.0, color: '#b29bdc' },
      { name: 'C5', frequency: 523.25, color: '#e38b93' },
      { name: 'E5', frequency: 659.25, color: '#80a9e8' },
    ],
    victory: ['A3', 'C4', 'E4', 'A4', 'C5'],
    chord: ['A3', 'E4', 'A4'],
  },
];

export const NOTES = MODAL_SCALES[0].notes;

export function getScaleForLevel(level: number): ScaleTheme {
  const index = Math.max(0, level - 1) % MODAL_SCALES.length;
  return MODAL_SCALES[index];
}

export function wallNote(x: number, y: number, scale = MODAL_SCALES[0]): number {
  return (x * 3 + y * 5) % scale.notes.length;
}

export function shortestRoute(maze: number[][]): Position[] {
  const queue: Position[][] = [[START]];
  const visited = new Set([`${START.x},${START.y}`]);
  for (let index = 0; index < queue.length; index += 1) {
    const route = queue[index];
    const current = route[route.length - 1];
    if (current.x === EXIT.x && current.y === EXIT.y) return route;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const next = { x: current.x + dx, y: current.y + dy };
      const key = `${next.x},${next.y}`;
      const tile = maze[next.y]?.[next.x];
      if (tile !== undefined && tile !== 1 && !visited.has(key)) {
        visited.add(key);
        queue.push([...route, next]);
      }
    }
  }
  return [];
}

export const LEVEL_TITLES = [
  'THE QUIET CORRIDOR',
  'THE RESONANT ECHO',
  'THE VELVET LABYRINTH',
  'THE HARMONIC CHAMBER',
  'THE OBSIDIAN CANYON',
  'THE PENTATONIC DRIFT',
  'THE WHISPERING VAULT',
  'THE CELESTIAL MAZE',
  'THE ECHOING DEPTHS',
  'THE ASTRAL SANCTUARY',
  'THE INFINITE GROVE',
  'THE PHANTOM PASSAGE',
];

export function getLevelTitle(level: number): string {
  const index = Math.max(0, level - 1) % LEVEL_TITLES.length;
  const cycle = Math.floor(Math.max(0, level - 1) / LEVEL_TITLES.length);
  return cycle > 0 ? `${LEVEL_TITLES[index]} ${cycle + 1}` : LEVEL_TITLES[index];
}

export type MazeGenerationResult = {
  maze: number[][];
  distance: number;
  shortestPath: Position[];
  tortuosity: number;
  braids: number;
  junctions: number;
  deadEnds: Position[];
  resonanceChambers: Position[];
  distanceField: Record<string, number>;
};

/**
 * Procedurally generates a solvable 15x15 maze using graph theory.
 * Incorporates spanning trees, dual-path cycle braiding (d >= 6),
 * dead-end isolation, and resonance chamber placement.
 */
export function generateMaze(minShortestDistance = 26): MazeGenerationResult {
  const dirs = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ] as const;

  for (let attempt = 0; attempt < 60; attempt++) {
    const maze: number[][] = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(1));
    const visited: boolean[][] = Array.from({ length: 7 }, () => Array(7).fill(false));
    const stack: [number, number][] = [[0, 0]];
    visited[0][0] = true;
    maze[1][1] = 0;

    // Spanning tree construction
    while (stack.length > 0) {
      const [cx, cy] = stack[stack.length - 1];
      const neighbors: [number, number, number, number][] = [];
      for (const [dx, dy] of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx >= 0 && nx < 7 && ny >= 0 && ny < 7 && !visited[ny][nx]) {
          neighbors.push([nx, ny, dx, dy]);
        }
      }
      if (neighbors.length > 0) {
        const [nx, ny, dx, dy] = neighbors[Math.floor(Math.random() * neighbors.length)];
        visited[ny][nx] = true;
        maze[cy * 2 + 1 + dy][cx * 2 + 1 + dx] = 0;
        maze[ny * 2 + 1][nx * 2 + 1] = 0;
        stack.push([nx, ny]);
      } else {
        stack.pop();
      }
    }

    // Identify candidate internal walls for cycle injection
    type Candidate = { wx: number; wy: number; p1: Position; p2: Position };
    const candidates: Candidate[] = [];
    for (let ry = 1; ry < GRID_SIZE - 1; ry++) {
      for (let rx = 1; rx < GRID_SIZE - 1; rx++) {
        if (maze[ry][rx] === 1) {
          if (
            maze[ry - 1]?.[rx] === 0 &&
            maze[ry + 1]?.[rx] === 0 &&
            maze[ry]?.[rx - 1] === 1 &&
            maze[ry]?.[rx + 1] === 1
          ) {
            candidates.push({ wx: rx, wy: ry, p1: { x: rx, y: ry - 1 }, p2: { x: rx, y: ry + 1 } });
          } else if (
            maze[ry]?.[rx - 1] === 0 &&
            maze[ry]?.[rx + 1] === 0 &&
            maze[ry - 1]?.[rx] === 1 &&
            maze[ry + 1]?.[rx] === 1
          ) {
            candidates.push({ wx: rx, wy: ry, p1: { x: rx - 1, y: ry }, p2: { x: rx + 1, y: ry } });
          }
        }
      }
    }

    // Shuffle candidates
    candidates.sort(() => Math.random() - 0.5);

    let braidsAdded = 0;
    for (const { wx, wy, p1, p2 } of candidates) {
      if (braidsAdded >= 5) break;

      // Prevent 2x2 open squares
      let creates2x2 = false;
      for (const dy of [-1, 0]) {
        for (const dx of [-1, 0]) {
          let openTiles = 0;
          for (let ox = 0; ox <= 1; ox++) {
            for (let oy = 0; oy <= 1; oy++) {
              const tx = wx + dx + ox;
              const ty = wy + dy + oy;
              if ((tx === wx && ty === wy) || maze[ty]?.[tx] === 0) {
                openTiles++;
              }
            }
          }
          if (openTiles === 4) {
            creates2x2 = true;
            break;
          }
        }
        if (creates2x2) break;
      }
      if (creates2x2) continue;

      // Check existing geodesic path distance between p1 and p2
      const q: [Position, number][] = [[p1, 0]];
      const seen = new Set([`${p1.x},${p1.y}`]);
      let dualDist = -1;
      while (q.length > 0) {
        const [curr, d] = q.shift()!;
        if (curr.x === p2.x && curr.y === p2.y) {
          dualDist = d;
          break;
        }
        for (const [dx, dy] of dirs) {
          const nx = curr.x + dx;
          const ny = curr.y + dy;
          const key = `${nx},${ny}`;
          if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE && maze[ny][nx] !== 1 && !seen.has(key)) {
            seen.add(key);
            q.push([{ x: nx, y: ny }, d + 1]);
          }
        }
      }

      if (dualDist >= 6) {
        maze[wy][wx] = 0;
        braidsAdded++;
      }
    }

    maze[START.y][START.x] = 2;
    maze[EXIT.y][EXIT.x] = 3;

    const route = shortestRoute(maze);
    const distance = route.length - 1;
    if (distance >= minShortestDistance) {
      const euclidean = Math.hypot(EXIT.x - START.x, EXIT.y - START.y);
      const tortuosity = distance / euclidean;

      // Compute Dijkstra distance field from Exit
      const distanceField: Record<string, number> = {};
      const exitQ: [Position, number][] = [[EXIT, 0]];
      distanceField[`${EXIT.x},${EXIT.y}`] = 0;
      while (exitQ.length > 0) {
        const [pos, d] = exitQ.shift()!;
        for (const [dx, dy] of dirs) {
          const nx = pos.x + dx;
          const ny = pos.y + dy;
          const key = `${nx},${ny}`;
          if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE && maze[ny][nx] !== 1 && !(key in distanceField)) {
            distanceField[key] = d + 1;
            exitQ.push([{ x: nx, y: ny }, d + 1]);
          }
        }
      }

      // Analyze dead-ends and junctions
      let junctions = 0;
      const deadEnds: Position[] = [];
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          if (maze[y][x] !== 1) {
            let deg = 0;
            for (const [dx, dy] of dirs) {
              if (maze[y + dy]?.[x + dx] !== 1) deg++;
            }
            if (deg >= 3) junctions++;
            else if (deg === 1 && (x !== START.x || y !== START.y) && (x !== EXIT.x || y !== EXIT.y)) {
              deadEnds.push({ x, y });
            }
          }
        }
      }

      // Sort dead-ends by distance from critical path to select Resonance Chambers
      const pathSet = new Set(route.map((p) => `${p.x},${p.y}`));
      const scoredDeadEnds = deadEnds.map((de) => {
        let distToPath = 0;
        const q: [Position, number][] = [[de, 0]];
        const s = new Set([`${de.x},${de.y}`]);
        while (q.length > 0) {
          const [c, d] = q.shift()!;
          if (pathSet.has(`${c.x},${c.y}`)) {
            distToPath = d;
            break;
          }
          for (const [dx, dy] of dirs) {
            const nx = c.x + dx;
            const ny = c.y + dy;
            const key = `${nx},${ny}`;
            if (maze[ny]?.[nx] !== 1 && !s.has(key)) {
              s.add(key);
              q.push([{ x: nx, y: ny }, d + 1]);
            }
          }
        }
        return { pos: de, distToPath };
      });
      scoredDeadEnds.sort((a, b) => b.distToPath - a.distToPath);
      const resonanceChambers = scoredDeadEnds.slice(0, 2).map((item) => item.pos);

      return {
        maze,
        distance,
        shortestPath: route,
        tortuosity,
        braids: braidsAdded,
        junctions,
        deadEnds,
        resonanceChambers,
        distanceField,
      };
    }
  }

  // Fallback
  const fallback = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(1));
  for (let i = 1; i <= 13; i++) {
    fallback[1][i] = 0;
    fallback[i][13] = 0;
  }
  fallback[START.y][START.x] = 2;
  fallback[EXIT.y][EXIT.x] = 3;
  return {
    maze: fallback,
    distance: 24,
    shortestPath: [],
    tortuosity: 1.41,
    braids: 0,
    junctions: 1,
    deadEnds: [],
    resonanceChambers: [],
    distanceField: {},
  };
}

// Initial maze for app startup
export const MAZE: number[][] = generateMaze(26).maze;
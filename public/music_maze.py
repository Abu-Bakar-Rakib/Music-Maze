#!/usr/bin/env python3
"""Music Maze: Professional Invisible Acoustic Labyrinth.

An invisible maze navigated purely through spatialized acoustics, procedural
graph theory, and active echolocation.

Requirements:
    Python 3.9+
    pip install pygame numpy

Controls:
    Arrow keys / W, A, S, D: Move avatar with smooth interpolation
    E / P / Space: Fire active Sonar Ping (echolocation radar pulse)
    Escape: Pause or resume exploration
    R: Restart current labyrinth layout
    N: Procedurally synthesize a brand new labyrinth
    M: Toggle sound / mute
    H: Return to the title menu
    Close window: Quit

Run:
    python music_maze.py
    python music_maze.py --check   # Headless validation & graph telemetry
"""

import collections
from collections import deque
import math
import random
import sys
import time

try:
    import numpy as np
    import pygame
except ImportError as error:
    raise SystemExit(
        "Missing dependency. Run: python -m pip install pygame numpy"
    ) from error

# ==============================================================================
# CONFIGURATION & CONSTANTS
# ==============================================================================

WINDOW_SIZE = 640
GRID_SIZE = 15
TILE_SIZE = WINDOW_SIZE // GRID_SIZE  # 42 px with offset centering
OFFSET_X = (WINDOW_SIZE - GRID_SIZE * 40) // 2  # 20 px padding
OFFSET_Y = (WINDOW_SIZE - GRID_SIZE * 40) // 2  # 20 px padding
PLAYABLE_TILE_SIZE = 40

SAMPLE_RATE = 44100
FPS = 60
SONAR_COOLDOWN = 1.6  # Seconds between active sonar pings
SONAR_MAX_RADIUS = 5  # Wavefront corridor propagation radius
ECHO_DURATION = 0.55  # Seconds an illuminated wall remains visible
RESTART_DELAY = 2.8   # Victory celebration delay before next level

# Color Palette (Dark Mode Glassmorphism & Bioluminescence)
COLOR_BG = (9, 12, 11)
COLOR_GRID = (22, 28, 24)
COLOR_CYAN_PLAYER = (105, 244, 250)
COLOR_PLAYER_HALO = (60, 180, 210)
COLOR_START = (24, 46, 85)
COLOR_START_ACCENT = (70, 120, 210)
COLOR_EXIT = (36, 175, 90)
COLOR_EXIT_PULSE = (120, 255, 175)
COLOR_CHAMBER = (185, 130, 240)
COLOR_TEXT = (205, 222, 201)
COLOR_TEXT_DIM = (110, 132, 104)
COLOR_PANEL = (20, 26, 21)
COLOR_PANEL_BORDER = (48, 62, 45)
COLOR_MINT = (183, 232, 185)

# UI Hitboxes
MENU_START_RECT = pygame.Rect(180, 360, 280, 52)
MENU_HELP_RECT = pygame.Rect(180, 424, 135, 42)
MENU_SOUND_RECT = pygame.Rect(325, 424, 135, 42)
HELP_BACK_RECT = pygame.Rect(210, 530, 220, 46)

# ==============================================================================
# MUSICAL SCALES & THEMES
# ==============================================================================

MODAL_SCALES = [
    {
        "name": "C Major Pentatonic",
        "key": "C Major",
        "mood": "Bright & Crystalline",
        "notes": [
            ("C4", 261.63, (227, 139, 147)),
            ("D4", 293.66, (223, 181, 120)),
            ("E4", 329.63, (128, 169, 232)),
            ("G4", 392.00, (139, 206, 170)),
            ("A4", 440.00, (178, 155, 220)),
            ("C5", 523.25, (227, 139, 147)),
            ("D5", 587.33, (223, 181, 120)),
            ("E5", 659.25, (128, 169, 232)),
        ],
        "victory": ["C4", "E4", "G4", "C5", "E5"],
        "chord": ["C4", "G4", "C5"],
    },
    {
        "name": "D Dorian Pentatonic",
        "key": "D Dorian",
        "mood": "Resonant & Mysterious",
        "notes": [
            ("D4", 293.66, (223, 181, 120)),
            ("F4", 349.23, (220, 140, 180)),
            ("G4", 392.00, (139, 206, 170)),
            ("A4", 440.00, (178, 155, 220)),
            ("C5", 523.25, (227, 139, 147)),
            ("D5", 587.33, (223, 181, 120)),
            ("F5", 698.46, (220, 140, 180)),
            ("G5", 783.99, (139, 206, 170)),
        ],
        "victory": ["D4", "F4", "A4", "C5", "D5"],
        "chord": ["D4", "A4", "D5"],
    },
    {
        "name": "F Lydian Pentatonic",
        "key": "F Lydian",
        "mood": "Floating & Celestial",
        "notes": [
            ("F4", 349.23, (220, 140, 180)),
            ("G4", 392.00, (139, 206, 170)),
            ("A4", 440.00, (178, 155, 220)),
            ("C5", 523.25, (227, 139, 147)),
            ("D5", 587.33, (223, 181, 120)),
            ("E5", 659.25, (128, 169, 232)),
            ("F5", 698.46, (220, 140, 180)),
            ("A5", 880.00, (178, 155, 220)),
        ],
        "victory": ["F4", "A4", "C5", "E5", "F5"],
        "chord": ["F4", "C5", "F5"],
    },
    {
        "name": "A Minor Pentatonic",
        "key": "A Minor",
        "mood": "Deep & Obsidian",
        "notes": [
            ("A3", 220.00, (160, 135, 200)),
            ("C4", 261.63, (227, 139, 147)),
            ("D4", 293.66, (223, 181, 120)),
            ("E4", 329.63, (128, 169, 232)),
            ("G4", 392.00, (139, 206, 170)),
            ("A4", 440.00, (178, 155, 220)),
            ("C5", 523.25, (227, 139, 147)),
            ("E5", 659.25, (128, 169, 232)),
        ],
        "victory": ["A3", "C4", "E4", "A4", "C5"],
        "chord": ["A3", "E4", "A4"],
    },
]

LEVEL_TITLES = [
    "THE QUIET CORRIDOR",
    "THE RESONANT ECHO",
    "THE VELVET LABYRINTH",
    "THE HARMONIC CHAMBER",
    "THE OBSIDIAN CANYON",
    "THE PENTATONIC DRIFT",
    "THE WHISPERING VAULT",
    "THE CELESTIAL MAZE",
    "THE ECHOING DEPTHS",
    "THE ASTRAL SANCTUARY",
    "THE INFINITE GROVE",
    "THE PHANTOM PASSAGE",
]


def get_level_title(level: int) -> str:
    """Return thematic title for the given level."""
    idx = max(0, level - 1) % len(LEVEL_TITLES)
    cycle = max(0, level - 1) // len(LEVEL_TITLES)
    return f"{LEVEL_TITLES[idx]} {cycle + 1}" if cycle > 0 else LEVEL_TITLES[idx]


def get_scale_for_level(level: int) -> dict:
    """Return scale configuration matching the level progression."""
    return MODAL_SCALES[(max(0, level - 1)) % len(MODAL_SCALES)]


# ==============================================================================
# ADVANCED GRAPH THEORY MAZE GENERATOR
# ==============================================================================

class MazeMetrics:
    """Telemetry and topological analysis of an acoustic maze."""

    def __init__(
        self,
        maze: list[list[int]],
        start: tuple[int, int],
        exit_tile: tuple[int, int],
        shortest_path: list[tuple[int, int]],
        tortuosity: float,
        braids: int,
        junctions: int,
        dead_ends: list[tuple[int, int]],
        resonance_chambers: list[tuple[int, int]],
        distance_matrix: dict[tuple[int, int], int],
    ):
        self.maze = maze
        self.start = start
        self.exit_tile = exit_tile
        self.shortest_path = shortest_path
        self.shortest_distance = len(shortest_path) - 1
        self.tortuosity = tortuosity
        self.braids = braids
        self.junctions = junctions
        self.dead_ends = dead_ends
        self.resonance_chambers = resonance_chambers
        self.distance_matrix = distance_matrix


def generate_professional_maze(min_distance: int = 26) -> tuple[list[list[int]], MazeMetrics]:
    """Procedurally synthesize a solvable 15x15 maze using graph theory.

    Logic:
    1. Spanning Tree via randomized recursive backtracker with topological shuffling.
    2. Intelligent Cycle Injection (Braiding): removes candidate walls only when the
       dual-graph geodesic distance d >= 6 to guarantee meaningful alternate loops.
    3. Prevents 2x2 open rooms to preserve authentic corridor labyrinth geometry.
    4. Topological analysis: classifies junctions (degree >= 3), dead-ends (degree == 1),
       and isolates the deepest dead-ends as Resonance Chambers.
    5. Computes complete Dijkstra distance matrix to the exit.
    """
    dirs = ((0, -1), (1, 0), (0, 1), (-1, 0))

    for _ in range(60):
        maze = [[1 for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]
        visited = [[False for _ in range(7)] for _ in range(7)]
        stack = [(0, 0)]
        visited[0][0] = True
        maze[1][1] = 0

        # Step 1: Generate perfect spanning tree
        while stack:
            cx, cy = stack[-1]
            neighbors = []
            for dx, dy in dirs:
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < 7 and 0 <= ny < 7 and not visited[ny][nx]:
                    neighbors.append((nx, ny, dx, dy))
            if neighbors:
                nx, ny, dx, dy = random.choice(neighbors)
                visited[ny][nx] = True
                maze[cy * 2 + 1 + dy][cx * 2 + 1 + dx] = 0
                maze[ny * 2 + 1][nx * 2 + 1] = 0
                stack.append((nx, ny))
            else:
                stack.pop()

        # Step 2: Intelligent Braiding with Geodesic Distance Filtering
        # Find internal walls that divide two open corridor spaces
        candidates = []
        for ry in range(1, GRID_SIZE - 1):
            for rx in range(1, GRID_SIZE - 1):
                if maze[ry][rx] == 1:
                    # Horizontal wall dividing north and south corridors
                    if (
                        maze[ry - 1][rx] == 0
                        and maze[ry + 1][rx] == 0
                        and maze[ry][rx - 1] == 1
                        and maze[ry][rx + 1] == 1
                    ):
                        candidates.append((rx, ry, (rx, ry - 1), (rx, ry + 1)))
                    # Vertical wall dividing west and east corridors
                    elif (
                        maze[ry][rx - 1] == 0
                        and maze[ry][rx + 1] == 0
                        and maze[ry - 1][rx] == 1
                        and maze[ry + 1][rx] == 1
                    ):
                        candidates.append((rx, ry, (rx - 1, ry), (rx + 1, ry)))

        random.shuffle(candidates)
        braids_added = 0
        for wx, wy, p1, p2 in candidates:
            if braids_added >= 5:
                break

            # Prevent 2x2 open squares
            has_2x2 = False
            for dy in (-1, 0):
                for dx in (-1, 0):
                    coords = [(wx + dx + ox, wy + dy + oy) for ox in (0, 1) for oy in (0, 1)]
                    open_count = sum(1 for (x, y) in coords if (x, y) == (wx, wy) or maze[y][x] == 0)
                    if open_count == 4:
                        has_2x2 = True
                        break
                if has_2x2:
                    break
            if has_2x2:
                continue

            # BFS dual-graph distance between p1 and p2 in existing maze
            queue = deque([(p1, 0)])
            seen = {p1}
            geodesic_dist = -1
            while queue:
                curr, dist = queue.popleft()
                if curr == p2:
                    geodesic_dist = dist
                    break
                for dx, dy in dirs:
                    nx, ny = curr[0] + dx, curr[1] + dy
                    if (
                        0 <= nx < GRID_SIZE
                        and 0 <= ny < GRID_SIZE
                        and maze[ny][nx] != 1
                        and (nx, ny) not in seen
                    ):
                        seen.add((nx, ny))
                        queue.append(((nx, ny), dist + 1))

            if geodesic_dist >= 6:
                maze[wy][wx] = 0
                braids_added += 1

        start = (1, 1)
        exit_tile = (13, 13)
        maze[start[1]][start[0]] = 2
        maze[exit_tile[1]][exit_tile[0]] = 3

        # Step 3: Solve Shortest Path via BFS
        path_queue = deque([(start, [start])])
        visited_coords = {start}
        shortest_path = []
        while path_queue:
            curr, path = path_queue.popleft()
            if curr == exit_tile:
                shortest_path = path
                break
            for dx, dy in dirs:
                nx, ny = curr[0] + dx, curr[1] + dy
                if (
                    0 <= nx < GRID_SIZE
                    and 0 <= ny < GRID_SIZE
                    and maze[ny][nx] != 1
                    and (nx, ny) not in visited_coords
                ):
                    visited_coords.add((nx, ny))
                    path_queue.append(((nx, ny), path + [(nx, ny)]))

        shortest_dist = len(shortest_path) - 1
        if shortest_dist < min_distance:
            continue

        euclidean = math.sqrt((exit_tile[0] - start[0]) ** 2 + (exit_tile[1] - start[1]) ** 2)
        tortuosity = shortest_dist / euclidean

        # Step 4: Topological Analysis (Junctions, Dead-Ends, Distance Field)
        junctions = 0
        dead_ends = []
        distance_matrix: dict[tuple[int, int], int] = {}

        # Dijkstra distance field backwards from Exit
        exit_queue = deque([(exit_tile, 0)])
        distance_matrix[exit_tile] = 0
        while exit_queue:
            pos, dist = exit_queue.popleft()
            for dx, dy in dirs:
                nx, ny = pos[0] + dx, pos[1] + dy
                if (
                    0 <= nx < GRID_SIZE
                    and 0 <= ny < GRID_SIZE
                    and maze[ny][nx] != 1
                    and (nx, ny) not in distance_matrix
                ):
                    distance_matrix[(nx, ny)] = dist + 1
                    exit_queue.append(((nx, ny), dist + 1))

        # Classify corridor nodes
        for y in range(GRID_SIZE):
            for x in range(GRID_SIZE):
                if maze[y][x] != 1:
                    deg = sum(
                        1
                        for dx, dy in dirs
                        if 0 <= x + dx < GRID_SIZE
                        and 0 <= y + dy < GRID_SIZE
                        and maze[y + dy][x + dx] != 1
                    )
                    if deg >= 3:
                        junctions += 1
                    elif deg == 1 and (x, y) not in (start, exit_tile):
                        dead_ends.append((x, y))

        # Select deepest dead ends as Resonance Chambers
        path_set = set(shortest_path)
        dead_ends_scored = []
        for de in dead_ends:
            # Score by distance away from critical path
            q = deque([(de, 0)])
            s = {de}
            dist_to_path = 0
            while q:
                c, d = q.popleft()
                if c in path_set:
                    dist_to_path = d
                    break
                for dx, dy in dirs:
                    nx, ny = c[0] + dx, c[1] + dy
                    if (
                        0 <= nx < GRID_SIZE
                        and 0 <= ny < GRID_SIZE
                        and maze[ny][nx] != 1
                        and (nx, ny) not in s
                    ):
                        s.add((nx, ny))
                        q.append(((nx, ny), d + 1))
            dead_ends_scored.append((dist_to_path, de))

        dead_ends_scored.sort(reverse=True)
        resonance_chambers = [pos for _, pos in dead_ends_scored[:2]]

        metrics = MazeMetrics(
            maze=maze,
            start=start,
            exit_tile=exit_tile,
            shortest_path=shortest_path,
            tortuosity=tortuosity,
            braids=braids_added,
            junctions=junctions,
            dead_ends=dead_ends,
            resonance_chambers=resonance_chambers,
            distance_matrix=distance_matrix,
        )
        return maze, metrics

    # Deterministic fallback labyrinth
    fallback = [[1 for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]
    for i in range(1, 14):
        fallback[1][i] = 0
        fallback[i][13] = 0
    fallback[1][1] = 2
    fallback[13][13] = 3
    dummy_path = [(1, i) for i in range(1, 14)] + [(i, 13) for i in range(2, 14)]
    metrics = MazeMetrics(
        maze=fallback,
        start=(1, 1),
        exit_tile=(13, 13),
        shortest_path=dummy_path,
        tortuosity=1.41,
        braids=0,
        junctions=1,
        dead_ends=[],
        resonance_chambers=[],
        distance_matrix={(x, y): abs(13 - x) + abs(13 - y) for y in range(GRID_SIZE) for x in range(GRID_SIZE)},
    )
    return fallback, metrics


# Default initialization
INITIAL_MAZE, INITIAL_METRICS = generate_professional_maze(26)


def validate_maze(maze=None):
    """Validation helper for headless testing and CLI --check flag."""
    if maze is None:
        maze = INITIAL_MAZE
    if len(maze) != GRID_SIZE or any(len(row) != GRID_SIZE for row in maze):
        raise ValueError(f"The maze must be exactly {GRID_SIZE} by {GRID_SIZE}.")

    starts, exits = [], []
    for y, row in enumerate(maze):
        for x, tile in enumerate(row):
            if tile == 2:
                starts.append((x, y))
            elif tile == 3:
                exits.append((x, y))
            if (x in (0, GRID_SIZE - 1) or y in (0, GRID_SIZE - 1)) and tile != 1:
                raise ValueError("All outside edges must be perimeter walls.")

    if len(starts) != 1 or len(exits) != 1:
        raise ValueError("The maze requires exactly one Start and one Exit.")

    start, exit_tile = starts[0], exits[0]
    queue = deque([(start, 0)])
    visited = {start}
    dirs = ((0, -1), (1, 0), (0, 1), (-1, 0))
    while queue:
        (x, y), distance = queue.popleft()
        if (x, y) == exit_tile:
            return start, exit_tile, distance
        for dx, dy in dirs:
            nx, ny = x + dx, y + dy
            if (
                0 <= nx < GRID_SIZE
                and 0 <= ny < GRID_SIZE
                and maze[ny][nx] != 1
                and (nx, ny) not in visited
            ):
                visited.add((nx, ny))
                queue.append(((nx, ny), distance + 1))
    raise ValueError("The Exit is mathematically unreachable from Start.")


# ==============================================================================
# ACOUSTIC PHYSICS & SPATIAL SYNTHESIZER
# ==============================================================================

class AcousticEngine:
    """Multi-harmonic additive synthesizer with equal-power stereophonic panning.

    Models physical acoustic reflections, harmonic resonance, exponential envelopes,
    and frequency-modulated active sonar chirps using pure NumPy arrays in memory.
    """

    def __init__(self, sample_rate: int = SAMPLE_RATE):
        self.sample_rate = sample_rate
        self.cached_sounds: dict[str, pygame.mixer.Sound] = {}

    def synthesize_harmonic_tone(
        self,
        frequency: float,
        duration: float = 0.28,
        volume: float = 0.24,
        pan: float = 0.0,
        timbre: str = "balanced",
    ) -> pygame.mixer.Sound:
        """Synthesize rich multi-harmonic chime with physical decay and stereo panning.

        pan: -1.0 (Full Left) to +1.0 (Full Right), 0.0 (Centered)
        """
        sample_count = max(4, int(self.sample_rate * duration))
        t = np.linspace(0.0, duration, sample_count, endpoint=False)

        # Multi-harmonic additive spectrum
        if timbre == "bright":
            h1, h2, h3, h4 = 1.0, 0.45, 0.22, 0.10
        elif timbre == "warm":
            h1, h2, h3, h4 = 1.0, 0.25, 0.08, 0.02
        else:
            h1, h2, h3, h4 = 1.0, 0.35, 0.15, 0.05

        waveform = (
            h1 * np.sin(2.0 * np.pi * frequency * t)
            + h2 * np.sin(2.0 * np.pi * (frequency * 2.0) * t)
            + h3 * np.sin(2.0 * np.pi * (frequency * 3.0) * t)
            + h4 * np.sin(2.0 * np.pi * (frequency * 4.0) * t)
        )

        # Warm soft analog saturation
        waveform = np.tanh(waveform * 0.95)

        # Attack and exponential decay envelope
        attack_len = max(1, int(0.007 * self.sample_rate))
        attack_env = np.minimum(1.0, np.arange(sample_count) / attack_len)
        decay_env = np.exp(-3.6 * t / duration)
        envelope = attack_env * decay_env

        # Equal-power stereophonic panning law
        clamped_pan = max(-1.0, min(1.0, pan))
        angle = (clamped_pan + 1.0) * (math.pi / 4.0)
        gain_left = math.cos(angle)
        gain_right = math.sin(angle)

        pcm_l = np.round(waveform * envelope * volume * gain_left * 32767.0).astype(np.int16)
        pcm_r = np.round(waveform * envelope * volume * gain_right * 32767.0).astype(np.int16)

        stereo = np.ascontiguousarray(np.column_stack((pcm_l, pcm_r)), dtype=np.int16)
        return pygame.sndarray.make_sound(stereo)

    def synthesize_sonar_chirp(
        self,
        f_start: float = 880.0,
        f_end: float = 440.0,
        duration: float = 0.22,
        volume: float = 0.20,
    ) -> pygame.mixer.Sound:
        """Synthesize sweeping FM radar chirp for echolocation pulses."""
        sample_count = max(4, int(self.sample_rate * duration))
        t = np.linspace(0.0, duration, sample_count, endpoint=False)

        # Frequency modulation phase integration
        k = (f_end - f_start) / duration
        phase = 2.0 * np.pi * (f_start * t + 0.5 * k * (t ** 2))
        waveform = np.sin(phase) + 0.25 * np.sin(phase * 2.0)
        waveform = np.tanh(waveform)

        attack_len = max(1, int(0.005 * self.sample_rate))
        attack_env = np.minimum(1.0, np.arange(sample_count) / attack_len)
        decay_env = np.exp(-4.2 * t / duration)
        envelope = attack_env * decay_env

        pcm = np.round(waveform * envelope * volume * 32767.0).astype(np.int16)
        stereo = np.ascontiguousarray(np.column_stack((pcm, pcm)), dtype=np.int16)
        return pygame.sndarray.make_sound(stereo)

    def synthesize_chamber_triad(
        self,
        root_freq: float,
        duration: float = 0.65,
        volume: float = 0.18,
    ) -> pygame.mixer.Sound:
        """Synthesize a crystalline triad chord for Resonance Chambers."""
        sample_count = max(4, int(self.sample_rate * duration))
        t = np.linspace(0.0, duration, sample_count, endpoint=False)

        f1 = root_freq
        f2 = root_freq * 1.25  # Major third
        f3 = root_freq * 1.50  # Perfect fifth

        waveform = (
            0.50 * np.sin(2.0 * np.pi * f1 * t)
            + 0.35 * np.sin(2.0 * np.pi * f2 * t)
            + 0.30 * np.sin(2.0 * np.pi * f3 * t)
        )
        waveform = np.tanh(waveform)

        attack_len = max(1, int(0.02 * self.sample_rate))
        attack_env = np.minimum(1.0, np.arange(sample_count) / attack_len)
        decay_env = np.exp(-2.2 * t / duration)
        envelope = attack_env * decay_env

        gain_l = 0.707
        gain_r = 0.707
        pcm_l = np.round(waveform * envelope * volume * gain_l * 32767.0).astype(np.int16)
        pcm_r = np.round(waveform * envelope * volume * gain_r * 32767.0).astype(np.int16)
        stereo = np.ascontiguousarray(np.column_stack((pcm_l, pcm_r)), dtype=np.int16)
        return pygame.sndarray.make_sound(stereo)


# ==============================================================================
# VISUAL PARTICLES & SHOCKWAVES
# ==============================================================================

class SoundShockwave:
    """Expanding acoustic shockwave ripple rendering on the labyrinth grid."""

    def __init__(self, x: float, y: float, max_radius: float, color: tuple, speed: float = 120.0):
        self.x = x
        self.y = y
        self.current_radius = 2.0
        self.max_radius = max_radius
        self.color = color
        self.speed = speed
        self.alive = True

    def update(self, dt: float):
        self.current_radius += self.speed * dt
        if self.current_radius >= self.max_radius:
            self.alive = False

    def draw(self, surface: pygame.Surface):
        if not self.alive:
            return
        progress = self.current_radius / self.max_radius
        alpha = int(220 * (1.0 - progress))
        if alpha <= 0:
            return
        ripple_surf = pygame.Surface((int(self.current_radius * 2 + 4), int(self.current_radius * 2 + 4)), pygame.SRCALPHA)
        center = (ripple_surf.get_width() // 2, ripple_surf.get_height() // 2)
        pygame.draw.circle(
            ripple_surf,
            (*self.color[:3], alpha),
            center,
            int(self.current_radius),
            width=2,
        )
        surface.blit(
            ripple_surf,
            (int(self.x - center[0]), int(self.y - center[1])),
        )


# ==============================================================================
# UI RENDERING FUNCTIONS
# ==============================================================================

def draw_centered_text(surface, font, text, color, center_y, center_x=WINDOW_SIZE // 2):
    img = font.render(text, True, color)
    surface.blit(img, img.get_rect(center=(center_x, center_y)))


def draw_styled_button(surface, font, text, rect, mouse_pos, primary=False):
    hovered = rect.collidepoint(mouse_pos)
    if primary:
        bg_col = (205, 245, 204) if hovered else COLOR_MINT
        fg_col = (18, 32, 20)
        border_col = bg_col
    else:
        bg_col = (36, 46, 35) if hovered else COLOR_PANEL
        fg_col = COLOR_MINT if hovered else (165, 180, 158)
        border_col = (85, 105, 75) if hovered else COLOR_PANEL_BORDER

    pygame.draw.rect(surface, bg_col, rect, border_radius=8)
    pygame.draw.rect(surface, border_col, rect, width=1, border_radius=8)
    label = font.render(text, True, fg_col)
    surface.blit(label, label.get_rect(center=rect.center))
    return hovered


def draw_equalizer_bars(surface, rect, time_val, is_playing=True):
    """Render a dynamic 4-band audio spectrum visualizer."""
    x, y, w, h = rect
    bar_w = 4
    spacing = 3
    for i in range(4):
        if is_playing:
            scale = 0.35 + 0.65 * abs(math.sin(time_val * 4.5 + i * 1.3))
        else:
            scale = 0.15
        bar_h = max(3, int(h * scale))
        bx = x + i * (bar_w + spacing)
        by = y + h - bar_h
        pygame.draw.rect(surface, (120, 220, 150), (bx, by, bar_w, bar_h), border_radius=1)


# ==============================================================================
# MAIN GAME APPLICATION
# ==============================================================================

def main():
    # Headless verification mode for testing & CI
    if "--check" in sys.argv:
        start, exit_tile, shortest_distance = validate_maze(INITIAL_MAZE)
        print(
            f"Valid {GRID_SIZE}x{GRID_SIZE} maze. Start: {start}. "
            f"Exit: {exit_tile}. Shortest route: {shortest_distance} moves."
        )
        print(
            f"Graph Telemetry: Tortuosity: {INITIAL_METRICS.tortuosity:.2f} | "
            f"Braids: {INITIAL_METRICS.braids} | Junctions: {INITIAL_METRICS.junctions} | "
            f"Dead Ends: {len(INITIAL_METRICS.dead_ends)} | "
            f"Resonance Chambers: {len(INITIAL_METRICS.resonance_chambers)}"
        )
        return

    # Audio & Pygame Subsystem Initialization
    pygame.mixer.pre_init(frequency=SAMPLE_RATE, size=-16, channels=2, buffer=512, allowedchanges=0)
    pygame.init()

    try:
        screen = pygame.display.set_mode((WINDOW_SIZE, WINDOW_SIZE))
        pygame.display.set_caption("Music Maze | Professional Echolocation Labyrinth")
        if pygame.mixer.get_init() is None:
            pygame.mixer.init(frequency=SAMPLE_RATE, size=-16, channels=2, buffer=512, allowedchanges=0)
        pygame.mixer.set_num_channels(32)
    except (pygame.error, RuntimeError) as error:
        pygame.quit()
        raise SystemExit(f"Initialization failure: {error}") from error

    audio = AcousticEngine(SAMPLE_RATE)
    clock = pygame.time.Clock()

    # Typography
    fonts = {
        "title": pygame.font.SysFont("arial", 46, bold=True),
        "subtitle": pygame.font.SysFont("arial", 26, bold=True),
        "label": pygame.font.SysFont("arial", 12, bold=True),
        "button": pygame.font.SysFont("arial", 14, bold=True),
        "body": pygame.font.SysFont("arial", 17),
        "hud": pygame.font.SysFont("arial", 14, bold=True),
        "small": pygame.font.SysFont("arial", 12),
        "tiny": pygame.font.SysFont("arial", 10),
    }

    # Level & Game State
    level = 1
    scale_info = get_scale_for_level(level)
    maze, metrics = INITIAL_MAZE, INITIAL_METRICS

    player_x, player_y = metrics.start
    visual_x, visual_y = float(player_x), float(player_y)

    wall_echoes: list[dict] = []
    discovered_walls: set[tuple[int, int]] = set()
    shockwaves: list[SoundShockwave] = []
    scheduled_sounds: list[dict] = []

    sonar_last_used = -10.0
    moves = 0
    wall_bumps = 0
    elapsed = 0.0
    won_at: float | None = None
    paused = False
    muted = False
    running = True
    view = "home"  # 'home', 'game', 'help'

    single_press_keys = {
        pygame.K_m, pygame.K_r, pygame.K_n, pygame.K_h, pygame.K_ESCAPE,
        pygame.K_SPACE, pygame.K_RETURN, pygame.K_BACKSPACE, pygame.K_e, pygame.K_p,
    }
    held_keys = set()
    directions = {
        pygame.K_LEFT: (-1, 0),
        pygame.K_a: (-1, 0),
        pygame.K_RIGHT: (1, 0),
        pygame.K_d: (1, 0),
        pygame.K_UP: (0, -1),
        pygame.K_w: (0, -1),
        pygame.K_DOWN: (0, 1),
        pygame.K_s: (0, 1),
    }

    # Audio synthesis helper for directional impacts
    def play_spatial_wall(x: int, y: int, dx: int, dy: int):
        if muted:
            return
        note_tuple = scale_info["notes"][(x * 3 + y * 5) % len(scale_info["notes"])]
        note_name, freq, _ = note_tuple

        # Determine spatial stereo pan based on impact normal vector
        if dx == -1:
            pan = -0.85
            timbre = "balanced"
        elif dx == 1:
            pan = 0.85
            timbre = "balanced"
        elif dy == -1:
            pan = 0.0
            timbre = "bright"
        else:
            pan = 0.0
            timbre = "warm"

        sound = audio.synthesize_harmonic_tone(freq, duration=0.28, volume=0.22, pan=pan, timbre=timbre)
        channel = pygame.mixer.find_channel(force=True)
        if channel:
            channel.play(sound)

    def trigger_sonar_pulse(curr_time: float):
        nonlocal sonar_last_used
        if curr_time - sonar_last_used < SONAR_COOLDOWN or paused or won_at is not None:
            return
        sonar_last_used = curr_time

        # Play sweeping radar chirp
        if not muted:
            chirp = audio.synthesize_sonar_chirp()
            ch = pygame.mixer.find_channel(force=True)
            if ch:
                ch.play(chirp)

        # Expanding visual acoustic radar shockwave from player
        px = OFFSET_X + player_x * PLAYABLE_TILE_SIZE + PLAYABLE_TILE_SIZE // 2
        py = OFFSET_Y + player_y * PLAYABLE_TILE_SIZE + PLAYABLE_TILE_SIZE // 2
        shockwaves.append(SoundShockwave(px, py, max_radius=180.0, color=(105, 244, 250), speed=180.0))

        # BFS wavefront expansion through open corridors
        dirs = ((0, -1), (1, 0), (0, 1), (-1, 0))
        queue = deque([(player_x, player_y, 0)])
        visited_corridors = {(player_x, player_y)}
        wall_hits: dict[tuple[int, int], int] = {}

        while queue:
            cx, cy, dist = queue.popleft()
            for dx, dy in dirs:
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < GRID_SIZE and 0 <= ny < GRID_SIZE:
                    if maze[ny][nx] == 1:
                        if (nx, ny) not in wall_hits or dist + 1 < wall_hits[(nx, ny)]:
                            wall_hits[(nx, ny)] = dist + 1
                    elif (nx, ny) not in visited_corridors and dist + 1 <= SONAR_MAX_RADIUS:
                        visited_corridors.add((nx, ny))
                        queue.append((nx, ny, dist + 1))

        # Schedule spatial reflection echoes from walls reached by wavefront
        for (wx, wy), w_dist in wall_hits.items():
            discovered_walls.add((wx, wy))
            delay = w_dist * 0.055
            note_tuple = scale_info["notes"][(wx * 3 + wy * 5) % len(scale_info["notes"])]
            scheduled_sounds.append({
                "play_at": curr_time + delay,
                "x": wx,
                "y": wy,
                "note": note_tuple[0],
                "freq": note_tuple[1],
                "color": note_tuple[2],
                "vol": max(0.04, 0.20 / (1.0 + 0.35 * (w_dist ** 1.5))),
                "pan": max(-0.9, min(0.9, (wx - player_x) / 5.0)),
            })

    def reset_level(keep_maze=True):
        nonlocal player_x, player_y, visual_x, visual_y, moves, wall_bumps, elapsed
        nonlocal won_at, paused, maze, metrics, scale_info, sonar_last_used
        if not keep_maze:
            maze, metrics = generate_professional_maze(26)
            scale_info = get_scale_for_level(level)
            discovered_walls.clear()

        player_x, player_y = metrics.start
        visual_x, visual_y = float(player_x), float(player_y)
        wall_echoes.clear()
        shockwaves.clear()
        scheduled_sounds.clear()
        pygame.mixer.stop()
        moves = 0
        wall_bumps = 0
        elapsed = 0.0
        won_at = None
        paused = False
        sonar_last_used = -10.0

    def start_game():
        nonlocal view
        reset_level(keep_maze=False)
        view = "game"

    def advance_level():
        nonlocal level
        level += 1
        reset_level(keep_maze=False)

    try:
        while running:
            dt = clock.tick(FPS) / 1000.0
            curr_time = pygame.time.get_ticks() / 1000.0

            if view == "game" and not paused and won_at is None:
                elapsed += dt

            # Smooth interpolation of avatar position (exponential decay lerp)
            visual_x += (player_x - visual_x) * min(1.0, 24.0 * dt)
            visual_y += (player_y - visual_y) * min(1.0, 24.0 * dt)

            # Update visual shockwaves
            for sw in shockwaves:
                sw.update(dt)
            shockwaves[:] = [sw for sw in shockwaves if sw.alive]

            # Play delayed acoustic reflections from Sonar pulse
            for echo in scheduled_sounds[:]:
                if curr_time >= echo["play_at"]:
                    scheduled_sounds.remove(echo)
                    if not muted:
                        snd = audio.synthesize_harmonic_tone(
                            echo["freq"],
                            duration=0.20,
                            volume=echo["vol"],
                            pan=echo["pan"],
                        )
                        ch = pygame.mixer.find_channel(force=True)
                        if ch:
                            ch.play(snd)
                    wall_echoes.append({
                        "x": echo["x"],
                        "y": echo["y"],
                        "time": curr_time,
                        "color": echo["color"],
                        "note": echo["note"],
                    })

            # Event Handling
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                elif event.type == pygame.WINDOWFOCUSLOST:
                    held_keys.clear()
                    if view == "game" and won_at is None:
                        paused = True
                elif event.type == pygame.KEYUP:
                    held_keys.discard(event.key)
                elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                    mpos = event.pos
                    if view == "home":
                        if MENU_START_RECT.collidepoint(mpos):
                            start_game()
                        elif MENU_HELP_RECT.collidepoint(mpos):
                            view = "help"
                        elif MENU_SOUND_RECT.collidepoint(mpos):
                            muted = not muted
                            if muted:
                                pygame.mixer.stop()
                    elif view == "help" and HELP_BACK_RECT.collidepoint(mpos):
                        view = "home"
                    elif view == "game":
                        # Sonar click in HUD area or screen
                        trigger_sonar_pulse(curr_time)
                elif event.type == pygame.KEYDOWN:
                    if event.key in single_press_keys:
                        if event.key in held_keys:
                            continue
                        held_keys.add(event.key)

                    if event.key == pygame.K_m:
                        muted = not muted
                        if muted:
                            pygame.mixer.stop()
                    elif view == "home":
                        if event.key in (pygame.K_RETURN, pygame.K_SPACE):
                            start_game()
                        elif event.key == pygame.K_ESCAPE:
                            running = False
                    elif view == "help":
                        if event.key in (pygame.K_ESCAPE, pygame.K_BACKSPACE, pygame.K_h):
                            view = "home"
                        elif event.key in (pygame.K_RETURN, pygame.K_SPACE):
                            start_game()
                    elif view == "game":
                        if event.key == pygame.K_h:
                            view = "home"
                        elif event.key == pygame.K_r:
                            reset_level(keep_maze=True)
                        elif event.key == pygame.K_n:
                            reset_level(keep_maze=False)
                        elif event.key == pygame.K_ESCAPE and won_at is None:
                            paused = not paused
                        elif event.key in (pygame.K_e, pygame.K_p, pygame.K_SPACE) and won_at is None:
                            trigger_sonar_pulse(curr_time)
                        elif event.key in directions and not paused and won_at is None:
                            dx, dy = directions[event.key]
                            tx, ty = player_x + dx, player_y + dy
                            if 0 <= tx < GRID_SIZE and 0 <= ty < GRID_SIZE:
                                if maze[ty][tx] == 1:
                                    wall_bumps += 1
                                    discovered_walls.add((tx, ty))
                                    play_spatial_wall(tx, ty, dx, dy)

                                    # Spawn visual impact shockwave
                                    wx = OFFSET_X + tx * PLAYABLE_TILE_SIZE + PLAYABLE_TILE_SIZE // 2
                                    wy = OFFSET_Y + ty * PLAYABLE_TILE_SIZE + PLAYABLE_TILE_SIZE // 2
                                    note_idx = (tx * 3 + ty * 5) % len(scale_info["notes"])
                                    n_name, _, n_col = scale_info["notes"][note_idx]
                                    shockwaves.append(SoundShockwave(wx, wy, max_radius=48.0, color=n_col, speed=100.0))

                                    wall_echoes[:] = [e for e in wall_echoes if (e["x"], e["y"]) != (tx, ty)]
                                    wall_echoes.append({
                                        "x": tx, "y": ty, "time": curr_time,
                                        "color": n_col, "note": n_name,
                                    })
                                else:
                                    player_x, player_y = tx, ty
                                    moves += 1

                                    # Check for Resonance Chamber bonus triad
                                    if (player_x, player_y) in metrics.resonance_chambers:
                                        if not muted:
                                            triad = audio.synthesize_chamber_triad(scale_info["notes"][0][1])
                                            ch = pygame.mixer.find_channel(force=True)
                                            if ch:
                                                ch.play(triad)
                                        cx = OFFSET_X + player_x * PLAYABLE_TILE_SIZE + PLAYABLE_TILE_SIZE // 2
                                        cy = OFFSET_Y + player_y * PLAYABLE_TILE_SIZE + PLAYABLE_TILE_SIZE // 2
                                        shockwaves.append(SoundShockwave(cx, cy, max_radius=90.0, color=COLOR_CHAMBER, speed=120.0))

                                    # Check for Level Exit
                                    if maze[ty][tx] == 3:
                                        won_at = curr_time
                                        # Schedule victory arpeggio
                                        if not muted:
                                            for idx, v_name in enumerate(scale_info["victory"]):
                                                # Look up frequency
                                                v_freq = next((f for n, f, _ in scale_info["notes"] if n == v_name), 523.25)
                                                v_col = next((c for n, _, c in scale_info["notes"] if n == v_name), (180, 240, 180))
                                                scheduled_sounds.append({
                                                    "play_at": curr_time + idx * 0.12,
                                                    "x": tx, "y": ty, "note": v_name,
                                                    "freq": v_freq, "color": v_col, "vol": 0.26, "pan": 0.0,
                                                })

            if not running:
                break

            # ------------------------------------------------------------------
            # VIEW 1: TITLE SCREEN
            # ------------------------------------------------------------------
            if view == "home":
                screen.fill(COLOR_BG)
                mpos = pygame.mouse.get_pos()

                # Ambient grid ripples
                for coord in range(0, WINDOW_SIZE + 1, 40):
                    pygame.draw.line(screen, COLOR_GRID, (coord, 0), (coord, WINDOW_SIZE))
                    pygame.draw.line(screen, COLOR_GRID, (0, coord), (WINDOW_SIZE, coord))

                # Breathing acoustic crest
                pulse = (math.sin(curr_time * 2.4) + 1.0) / 2.0
                crest_surf = pygame.Surface((80, 80), pygame.SRCALPHA)
                pygame.draw.rect(
                    crest_surf,
                    (112, 160, 105, int(60 + 60 * pulse)),
                    pygame.Rect(12, 12, 56, 56),
                    width=2,
                    border_radius=8,
                )
                pygame.draw.lines(
                    crest_surf, COLOR_MINT, False,
                    [(24, 26), (56, 26), (56, 38), (36, 38), (36, 54), (58, 54)], 2,
                )
                screen.blit(crest_surf, crest_surf.get_rect(center=(WINDOW_SIZE // 2, 90)))

                draw_centered_text(screen, fonts["label"], "ECHOLOCATION  /  GRAPH THEORY  /  ACOUSTIC COMPASS", (110, 138, 102), 140)
                draw_centered_text(screen, fonts["title"], "MUSIC MAZE.", (240, 246, 238), 196)
                draw_centered_text(screen, fonts["body"], "An invisible labyrinth navigated purely through spatialized sound.", (145, 162, 138), 240)

                pygame.draw.line(screen, (55, 68, 52), (180, 282), (460, 282), 1)
                heading = f"LEVEL {level:02d}  |  {get_level_title(level)}  |  {scale_info['name']}"
                draw_centered_text(screen, fonts["label"], heading, (140, 172, 130), 304)
                pygame.draw.line(screen, (55, 68, 52), (180, 326), (460, 326), 1)

                draw_styled_button(screen, fonts["button"], "START EXPLORATION   >", MENU_START_RECT, mpos, primary=True)
                draw_styled_button(screen, fonts["label"], "HOW TO PLAY", MENU_HELP_RECT, mpos)
                sound_txt = "SOUND OFF" if muted else "SOUND ON"
                draw_styled_button(screen, fonts["label"], sound_txt, MENU_SOUND_RECT, mpos)

                draw_centered_text(screen, fonts["tiny"], "PRESS ENTER OR CLICK TO START  |  E TO EMIT ECHOLOCATION PING", (80, 96, 75), 515)
                draw_centered_text(screen, fonts["tiny"], "ZERO ASSETS  |  NUMPY HARMONIC SYNTHESIS  |  GRAPH THEORY BRAIDING", (65, 78, 62), 575)

                pygame.display.flip()
                continue

            # ------------------------------------------------------------------
            # VIEW 2: HOW TO PLAY SCREEN
            # ------------------------------------------------------------------
            if view == "help":
                screen.fill((8, 11, 9))
                mpos = pygame.mouse.get_pos()
                draw_centered_text(screen, fonts["label"], "TACTICAL GUIDE", (125, 160, 115), 45)
                draw_centered_text(screen, fonts["subtitle"], "LET YOUR EARS MAP THE VOID.", (235, 242, 232), 85)

                cards = [
                    ("01", "STEP & IMPACT", "Use Arrow keys or WASD to navigate. Bumping into an invisible wall plays its signature pentatonic pitch and reveals it for 0.5s."),
                    ("02", "ACTIVE ECHOLOCATION", "Press [E], [P], or [Space] to emit a Sonar Radar Ping. Acoustic wavefronts cascade through corridors and echo back from surrounding walls."),
                    ("03", "RESONANCE CHAMBERS", "Deep dead-ends harbor acoustic Resonance Chambers (marked with purple aura) that radiate warm harmonic triads when discovered."),
                    ("04", "REACH THE PULSING EXIT", "Navigate from Start (1,1) to Exit (13,13). Escaping dynamically synthesizes a brand-new, complex labyrinth with new musical modes!"),
                ]
                top = 135
                for num, h_txt, d_txt in cards:
                    pygame.draw.rect(screen, COLOR_PANEL, (60, top, 520, 80), border_radius=8)
                    pygame.draw.rect(screen, COLOR_PANEL_BORDER, (60, top, 520, 80), width=1, border_radius=8)
                    screen.blit(fonts["label"].render(num, True, (130, 170, 118)), (80, top + 14))
                    screen.blit(fonts["hud"].render(h_txt, True, (215, 228, 210)), (120, top + 13))

                    # Multi-line word wrap for description
                    words = d_txt.split(" ")
                    line1 = " ".join(words[:11])
                    line2 = " ".join(words[11:])
                    screen.blit(fonts["small"].render(line1, True, (135, 150, 128)), (120, top + 36))
                    if line2:
                        screen.blit(fonts["small"].render(line2, True, (135, 150, 128)), (120, top + 54))
                    top += 94

                draw_styled_button(screen, fonts["button"], "BACK TO EXPLORATION", HELP_BACK_RECT, mpos, primary=True)
                pygame.display.flip()
                continue

            # ------------------------------------------------------------------
            # VIEW 3: IN-GAME LABYRINTH
            # ------------------------------------------------------------------
            if won_at is not None and curr_time - won_at >= RESTART_DELAY:
                advance_level()

            screen.fill(COLOR_BG)

            # Draw Labyrinth Frame & Grid Lines
            grid_rect = pygame.Rect(OFFSET_X, OFFSET_Y, GRID_SIZE * PLAYABLE_TILE_SIZE, GRID_SIZE * PLAYABLE_TILE_SIZE)
            pygame.draw.rect(screen, (14, 18, 15), grid_rect)
            for i in range(GRID_SIZE + 1):
                pos_x = OFFSET_X + i * PLAYABLE_TILE_SIZE
                pos_y = OFFSET_Y + i * PLAYABLE_TILE_SIZE
                pygame.draw.line(screen, COLOR_GRID, (pos_x, OFFSET_Y), (pos_x, OFFSET_Y + GRID_SIZE * PLAYABLE_TILE_SIZE), 1)
                pygame.draw.line(screen, COLOR_GRID, (OFFSET_X, pos_y), (OFFSET_X + GRID_SIZE * PLAYABLE_TILE_SIZE, pos_y), 1)

            # Start Tile (1, 1)
            sx = OFFSET_X + metrics.start[0] * PLAYABLE_TILE_SIZE
            sy = OFFSET_Y + metrics.start[1] * PLAYABLE_TILE_SIZE
            pygame.draw.rect(screen, COLOR_START, (sx, sy, PLAYABLE_TILE_SIZE, PLAYABLE_TILE_SIZE))
            pygame.draw.rect(screen, COLOR_START_ACCENT, (sx, sy, PLAYABLE_TILE_SIZE, PLAYABLE_TILE_SIZE), width=1)

            # Exit Tile (13, 13) with breathing bioluminescent pulse
            ex = OFFSET_X + metrics.exit_tile[0] * PLAYABLE_TILE_SIZE
            ey = OFFSET_Y + metrics.exit_tile[1] * PLAYABLE_TILE_SIZE
            exit_pulse = (math.sin(curr_time * 3.5) + 1.0) / 2.0
            cur_exit_col = (
                int(COLOR_EXIT[0] + (COLOR_EXIT_PULSE[0] - COLOR_EXIT[0]) * exit_pulse),
                int(COLOR_EXIT[1] + (COLOR_EXIT_PULSE[1] - COLOR_EXIT[1]) * exit_pulse),
                int(COLOR_EXIT[2] + (COLOR_EXIT_PULSE[2] - COLOR_EXIT[2]) * exit_pulse),
            )
            pygame.draw.rect(screen, cur_exit_col, (ex, ey, PLAYABLE_TILE_SIZE, PLAYABLE_TILE_SIZE))
            pygame.draw.circle(
                screen, (255, 255, 255),
                (ex + PLAYABLE_TILE_SIZE // 2, ey + PLAYABLE_TILE_SIZE // 2),
                int(4 + 3 * exit_pulse),
            )

            # Resonance Chambers Glow
            for (cx, cy) in metrics.resonance_chambers:
                rx = OFFSET_X + cx * PLAYABLE_TILE_SIZE
                ry = OFFSET_Y + cy * PLAYABLE_TILE_SIZE
                ch_pulse = (math.sin(curr_time * 2.8 + cx) + 1.0) / 2.0
                ch_surf = pygame.Surface((PLAYABLE_TILE_SIZE, PLAYABLE_TILE_SIZE), pygame.SRCALPHA)
                ch_surf.fill((*COLOR_CHAMBER, int(25 + 30 * ch_pulse)))
                pygame.draw.rect(ch_surf, (*COLOR_CHAMBER, int(80 + 60 * ch_pulse)), ch_surf.get_rect(), width=1)
                screen.blit(ch_surf, (rx, ry))

            # Persistent Cognitive Memory: Ghost outlines for discovered walls
            for (wx, wy) in discovered_walls:
                g_rect = pygame.Rect(OFFSET_X + wx * PLAYABLE_TILE_SIZE, OFFSET_Y + wy * PLAYABLE_TILE_SIZE, PLAYABLE_TILE_SIZE, PLAYABLE_TILE_SIZE)
                pygame.draw.rect(screen, (34, 46, 36), g_rect, width=1)

            # Active Illuminated Wall Echoes (Collision & Sonar returns)
            wall_echoes[:] = [e for e in wall_echoes if curr_time - e["time"] < ECHO_DURATION]
            for echo in wall_echoes:
                age = curr_time - echo["time"]
                strength = max(0.0, 1.0 - age / ECHO_DURATION)
                ex_x = OFFSET_X + echo["x"] * PLAYABLE_TILE_SIZE
                ex_y = OFFSET_Y + echo["y"] * PLAYABLE_TILE_SIZE
                echo_surf = pygame.Surface((PLAYABLE_TILE_SIZE, PLAYABLE_TILE_SIZE), pygame.SRCALPHA)
                echo_surf.fill((*echo["color"], int(85 * strength)))
                pygame.draw.rect(echo_surf, (*echo["color"], int(245 * strength)), echo_surf.get_rect(), width=2)

                # Display note name inside the illuminated wall tile
                if strength > 0.35:
                    lbl = fonts["label"].render(echo["note"], True, (255, 255, 255))
                    echo_surf.blit(lbl, lbl.get_rect(center=(PLAYABLE_TILE_SIZE // 2, PLAYABLE_TILE_SIZE // 2)))
                screen.blit(echo_surf, (ex_x, ex_y))

            # Render Dynamic Shockwave Ripples
            for sw in shockwaves:
                sw.draw(screen)

            # Smooth Player Avatar Rendering with Soft Glow
            px = OFFSET_X + visual_x * PLAYABLE_TILE_SIZE + PLAYABLE_TILE_SIZE // 2
            py = OFFSET_Y + visual_y * PLAYABLE_TILE_SIZE + PLAYABLE_TILE_SIZE // 2

            halo_surf = pygame.Surface((44, 44), pygame.SRCALPHA)
            pygame.draw.circle(halo_surf, (*COLOR_PLAYER_HALO, 45), (22, 22), 18)
            screen.blit(halo_surf, (int(px - 22), int(py - 22)))
            pygame.draw.circle(screen, COLOR_CYAN_PLAYER, (int(px), int(py)), 10)
            pygame.draw.circle(screen, (255, 255, 255), (int(px), int(py)), 4)

            # ------------------------------------------------------------------
            # PROFESSIONAL TELEMETRY HUD
            # ------------------------------------------------------------------
            # Top Banner
            level_str = f"MUSIC MAZE   LVL {level:02d} : {get_level_title(level)}"
            screen.blit(fonts["hud"].render(level_str, True, COLOR_TEXT), (OFFSET_X, 10))

            # Sonar Readiness Indicator
            sonar_ready = (curr_time - sonar_last_used >= SONAR_COOLDOWN)
            if sonar_ready:
                sonar_badge = "[E] SONAR READY"
                s_color = COLOR_CYAN_PLAYER
            else:
                pct = (curr_time - sonar_last_used) / SONAR_COOLDOWN
                sonar_badge = f"SONAR RECHARGING {int(pct * 100)}%"
                s_color = (130, 150, 140)
            screen.blit(fonts["label"].render(sonar_badge, True, s_color), (OFFSET_X, 30))

            # Right Banner: Performance & Path Optimality
            minutes, seconds = divmod(int(elapsed), 60)
            opt_moves = metrics.shortest_distance
            efficiency = (opt_moves / max(moves, opt_moves)) * 100 if moves > 0 else 100.0

            if moves <= opt_moves and wall_bumps <= 2:
                rank = "S+"
            elif efficiency >= 85:
                rank = "S"
            elif efficiency >= 70:
                rank = "A"
            elif efficiency >= 55:
                rank = "B"
            else:
                rank = "C"

            stats_str = f"{moves:03d} MOVES  |  OPT: {opt_moves} (RANK {rank})  |  {minutes:02d}:{seconds:02d}"
            stats_img = fonts["hud"].render(stats_str, True, (135, 160, 128))
            screen.blit(stats_img, (WINDOW_SIZE - OFFSET_X - stats_img.get_width(), 10))

            # Equalizer & Mode display on top-right
            mode_str = f"MODE: {scale_info['name']}"
            mode_img = fonts["tiny"].render(mode_str, True, COLOR_TEXT_DIM)
            screen.blit(mode_img, (WINDOW_SIZE - OFFSET_X - mode_img.get_width() - 30, 32))
            draw_equalizer_bars(screen, (WINDOW_SIZE - OFFSET_X - 24, 30, 24, 14), curr_time, is_playing=not paused and not muted)

            # Bottom Control Bar
            ctrl_text = "ARROWS/WASD: Move  |  E/SPACE: Sonar  |  R: Restart  |  N: New Maze  |  M: Mute  |  ESC: Pause"
            draw_centered_text(screen, fonts["small"], ctrl_text, (100, 122, 95), WINDOW_SIZE - 12)

            # ------------------------------------------------------------------
            # MODAL OVERLAYS (PAUSE & LEVEL VICTORY)
            # ------------------------------------------------------------------
            if paused or won_at is not None:
                overlay = pygame.Surface((WINDOW_SIZE, WINDOW_SIZE), pygame.SRCALPHA)
                overlay.fill((0, 0, 0, 215))
                screen.blit(overlay, (0, 0))

                if won_at is not None:
                    draw_centered_text(screen, fonts["title"], f"Level {level:02d} Escaped!", (165, 245, 175), 235)
                    summary = f"Efficiency: {efficiency:.1f}%  |  Rank: {rank}  |  {moves} moves ({minutes:02d}:{seconds:02d})"
                    draw_centered_text(screen, fonts["body"], summary, COLOR_TEXT, 280)
                    rem = max(1, math.ceil(RESTART_DELAY - (curr_time - won_at)))
                    next_title = get_level_title(level + 1)
                    next_scale = get_scale_for_level(level + 1)["name"]
                    adv_str = f"Synthesizing Level {level + 1:02d} ({next_title} - {next_scale}) in {rem}s..."
                    draw_centered_text(screen, fonts["label"], adv_str, (125, 165, 118), 325)
                else:
                    draw_centered_text(screen, fonts["title"], "Exploration Paused", COLOR_TEXT, 250)
                    draw_centered_text(screen, fonts["body"], "Press Escape or Space to resume listening.", (135, 160, 125), 295)
                    draw_centered_text(screen, fonts["small"], "R: Restart layout  |  N: Generate brand new maze  |  H: Title screen", (100, 122, 95), 335)

            pygame.display.flip()

    finally:
        pygame.quit()


if __name__ == "__main__":
    main()
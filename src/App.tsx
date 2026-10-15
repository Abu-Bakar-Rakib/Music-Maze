import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ToneEngine } from './audio';
import Icon from './components/Icon';
import {
  ECHO_DURATION,
  EXIT,
  GRID_SIZE,
  START,
  TILE_SIZE,
  generateMaze,
  getLevelTitle,
  getScaleForLevel,
  type MazeGenerationResult,
  type Position,
} from './maze';

type GameStatus = 'home' | 'playing' | 'paused' | 'won';
type Page = 'welcome' | 'game';
type Modal = 'help' | 'code' | 'restart' | 'home' | null;
type Echo = Position & { id: number; noteName: string; color: string; timestamp: number };

const DIRECTIONS = [
  { label: 'Move left', dx: -1, dy: 0, rotation: 180 },
  { label: 'Move up', dx: 0, dy: -1, rotation: -90 },
  { label: 'Move down', dx: 0, dy: 1, rotation: 90 },
  { label: 'Move right', dx: 1, dy: 0, rotation: 0 },
];

function formatTime(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function MazeMark({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <path
        d="M4 4h19v8H12v10h10v-4h8v12H4V12h3M30 4v9M9 30v-3M17 4v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

function Equalizer({ animated = false }: { animated?: boolean }) {
  return (
    <span className={`equalizer ${animated ? 'is-playing' : ''}`} aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>('welcome');
  const [status, setStatus] = useState<GameStatus>('home');
  const [position, setPosition] = useState<Position>(START);
  const [echoes, setEchoes] = useState<Echo[]>([]);
  const [discoveredWalls, setDiscoveredWalls] = useState<Set<string>>(new Set());
  const [moves, setMoves] = useState(0);
  const [bumps, setBumps] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(65);
  const [level, setLevel] = useState(1);
  const [mazeData, setMazeData] = useState<MazeGenerationResult>(() => generateMaze(26));
  const [modal, setModal] = useState<Modal>(null);
  const [audioError, setAudioError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [source, setSource] = useState('');
  const [sourceExpanded, setSourceExpanded] = useState(false);
  const [sourceError, setSourceError] = useState(false);
  const [sonarCooldown, setSonarCooldown] = useState(0); // 0 to 1 progress

  const currentScale = useMemo(() => getScaleForLevel(level), [level]);

  const levelRef = useRef(1);
  const mazeRef = useRef<MazeGenerationResult>(mazeData);
  const statusRef = useRef<GameStatus>('home');
  const positionRef = useRef<Position>(START);
  const audioRef = useRef<ToneEngine | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const noteTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const echoSequence = useRef(0);
  const clock = useRef({ started: 0, accumulated: 0 });
  const resumeAfterModal = useRef(false);
  const modalRef = useRef<Modal>(null);
  const lastMovement = useRef(0);
  const sonarLastUsed = useRef(-10000);

  const getAudio = useCallback(() => {
    if (!audioRef.current) audioRef.current = new ToneEngine();
    return audioRef.current;
  }, []);

  const setGameStatus = useCallback((next: GameStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const schedule = useCallback((callback: () => void, delay: number) => {
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      callback();
    }, delay);
    timers.current.add(timer);
    return timer;
  }, []);

  const playHarmonic = useCallback(
    (freq: number, pan = 0, name?: string) => {
      void getAudio()
        .playHarmonicTone(freq, pan)
        .catch(() => setAudioError(true));
      if (name) {
        setActiveNote(name);
        if (noteTimeout.current) clearTimeout(noteTimeout.current);
        noteTimeout.current = setTimeout(() => setActiveNote(null), ECHO_DURATION);
      }
    },
    [getAudio]
  );

  const resetGame = useCallback(
    (next: GameStatus = 'playing') => {
      for (const timer of timers.current) clearTimeout(timer);
      timers.current.clear();
      if (noteTimeout.current) clearTimeout(noteTimeout.current);
      audioRef.current?.stopAll();
      positionRef.current = START;
      setPosition(START);
      setEchoes([]);
      setDiscoveredWalls(new Set());
      setMoves(0);
      setBumps(0);
      setElapsed(0);
      setActiveNote(null);
      clock.current = { started: performance.now(), accumulated: 0 };
      lastMovement.current = 0;
      sonarLastUsed.current = -10000;
      setSonarCooldown(0);
      setGameStatus(next);
    },
    [setGameStatus]
  );

  const pauseGame = useCallback(() => {
    if (statusRef.current !== 'playing') return;
    clock.current.accumulated += performance.now() - clock.current.started;
    setElapsed(clock.current.accumulated);
    setGameStatus('paused');
  }, [setGameStatus]);

  const resumeGame = useCallback(() => {
    clock.current.started = performance.now();
    setGameStatus('playing');
    void getAudio().unlock().catch(() => setAudioError(true));
  }, [getAudio, setGameStatus]);

  const startOrPause = useCallback(() => {
    if (statusRef.current === 'won') return;
    if (statusRef.current === 'playing') pauseGame();
    else if (statusRef.current === 'paused') resumeGame();
    panelRef.current?.focus({ preventScroll: true });
  }, [pauseGame, resumeGame]);

  const advanceLevel = useCallback(() => {
    const nextLevel = levelRef.current + 1;
    levelRef.current = nextLevel;
    setLevel(nextLevel);
    const fresh = generateMaze(26);
    mazeRef.current = fresh;
    setMazeData(fresh);
    resetGame(modalRef.current ? 'paused' : 'playing');
    if (modalRef.current) resumeAfterModal.current = true;
  }, [resetGame]);

  const generateNewMaze = useCallback(() => {
    const fresh = generateMaze(26);
    mazeRef.current = fresh;
    setMazeData(fresh);
    resetGame('playing');
    void getAudio().unlock().catch(() => setAudioError(true));
  }, [getAudio, resetGame]);

  // Active Echolocation Sonar Radar Ping
  const triggerSonarPing = useCallback(() => {
    const now = performance.now();
    if (now - sonarLastUsed.current < 1600 || statusRef.current !== 'playing') return;
    sonarLastUsed.current = now;
    setSonarCooldown(1);

    void getAudio().playSonarChirp();

    const currentPos = positionRef.current;
    const currentMaze = mazeRef.current.maze;
    const scale = getScaleForLevel(levelRef.current);

    // BFS wavefront propagation through open corridors
    const dirs = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const;
    const queue: [number, number, number][] = [[currentPos.x, currentPos.y, 0]];
    const visited = new Set([`${currentPos.x},${currentPos.y}`]);
    const wallHits = new Map<string, { x: number; y: number; dist: number }>();

    while (queue.length > 0) {
      const [cx, cy, d] = queue.shift()!;
      for (const [dx, dy] of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;
        const key = `${nx},${ny}`;
        if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
          if (currentMaze[ny]?.[nx] === 1) {
            if (!wallHits.has(key) || d + 1 < wallHits.get(key)!.dist) {
              wallHits.set(key, { x: nx, y: ny, dist: d + 1 });
            }
          } else if (!visited.has(key) && d + 1 <= 5) {
            visited.add(key);
            queue.push([nx, ny, d + 1]);
          }
        }
      }
    }

    // Schedule delayed echoes from walls
    setDiscoveredWalls((prev) => {
      const nextSet = new Set(prev);
      wallHits.forEach((hit, key) => nextSet.add(key));
      return nextSet;
    });

    wallHits.forEach((hit) => {
      const delay = hit.dist * 60;
      const noteIdx = (hit.x * 3 + hit.y * 5) % scale.notes.length;
      const noteDef = scale.notes[noteIdx];
      const pan = Math.max(-0.9, Math.min(0.9, (hit.x - currentPos.x) / 5));

      schedule(() => {
        void getAudio().playHarmonicTone(
          noteDef.frequency,
          pan,
          Math.max(0.1, 0.5 / (1 + 0.3 * hit.dist))
        );
        const echo: Echo = {
          x: hit.x,
          y: hit.y,
          id: ++echoSequence.current,
          noteName: noteDef.name,
          color: noteDef.color,
          timestamp: performance.now(),
        };
        setEchoes((curr) => [...curr.filter((item) => item.x !== hit.x || item.y !== hit.y), echo]);
        schedule(() => setEchoes((curr) => curr.filter((item) => item.id !== echo.id)), ECHO_DURATION);
      }, delay);
    });
  }, [getAudio, schedule]);

  const move = useCallback(
    (dx: number, dy: number) => {
      if (statusRef.current !== 'playing') return;
      const next = { x: positionRef.current.x + dx, y: positionRef.current.y + dy };
      const tile = mazeRef.current.maze[next.y]?.[next.x];
      if (tile === undefined) return;

      const scale = getScaleForLevel(levelRef.current);

      if (tile === 1) {
        const noteIdx = (next.x * 3 + next.y * 5) % scale.notes.length;
        const noteDef = scale.notes[noteIdx];
        const pan = dx === -1 ? -0.85 : dx === 1 ? 0.85 : 0;

        setDiscoveredWalls((prev) => new Set(prev).add(`${next.x},${next.y}`));

        const echo: Echo = {
          ...next,
          id: ++echoSequence.current,
          noteName: noteDef.name,
          color: noteDef.color,
          timestamp: performance.now(),
        };
        setEchoes((current) => [...current.filter((item) => item.x !== next.x || item.y !== next.y), echo]);
        setBumps((current) => current + 1);

        playHarmonic(noteDef.frequency, pan, noteDef.name);
        schedule(() => setEchoes((current) => current.filter((item) => item.id !== echo.id)), ECHO_DURATION);
        return;
      }

      positionRef.current = next;
      setPosition(next);
      setMoves((current) => current + 1);
      void getAudio().unlock().catch(() => setAudioError(true));

      // Resonance Chamber check
      const isChamber = mazeRef.current.resonanceChambers.some(
        (ch) => ch.x === next.x && ch.y === next.y
      );
      if (isChamber) {
        void getAudio().playChamberTriad(scale.notes[0].frequency);
      }

      // Exit check
      if (tile === 3) {
        clock.current.accumulated += performance.now() - clock.current.started;
        setElapsed(clock.current.accumulated);
        setGameStatus('won');

        // Play modal victory chord
        scale.victory.forEach((vName, idx) => {
          const vNote = scale.notes.find((n) => n.name === vName) || scale.notes[0];
          schedule(() => playHarmonic(vNote.frequency, 0, vNote.name), idx * 120);
        });

        schedule(() => {
          advanceLevel();
        }, 3000);
      }
    },
    [advanceLevel, getAudio, playHarmonic, schedule, setGameStatus]
  );

  const openModal = useCallback(
    (next: Exclude<Modal, null>) => {
      resumeAfterModal.current = statusRef.current === 'playing';
      if (resumeAfterModal.current) pauseGame();
      modalRef.current = next;
      setModal(next);
    },
    [pauseGame]
  );

  const closeModal = useCallback(
    (shouldResume = true) => {
      modalRef.current = null;
      setModal(null);
      if (shouldResume && resumeAfterModal.current && statusRef.current === 'paused') resumeGame();
      resumeAfterModal.current = false;
    },
    [resumeGame]
  );

  const requestHome = useCallback(() => {
    if (page === 'welcome') return;
    openModal('home');
  }, [openModal, page]);

  const returnHome = useCallback(() => {
    closeModal(false);
    levelRef.current = 1;
    setLevel(1);
    resetGame('home');
    setPage('welcome');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [closeModal, resetGame]);

  const beginJourney = useCallback(() => {
    if (modalRef.current) closeModal(false);
    levelRef.current = 1;
    setLevel(1);
    const fresh = generateMaze(26);
    mazeRef.current = fresh;
    setMazeData(fresh);
    setPage('game');
    resetGame('playing');
    void getAudio().unlock().catch(() => setAudioError(true));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
  }, [closeModal, getAudio, resetGame]);

  const toggleMuted = useCallback(() => {
    setMuted((current) => {
      getAudio().setMuted(!current);
      return !current;
    });
  }, [getAudio]);

  // Sonar cooldown animation frame & clock ticker
  useEffect(() => {
    const interval = setInterval(() => {
      if (statusRef.current === 'playing') {
        setElapsed(clock.current.accumulated + performance.now() - clock.current.started);
        const cooldownRemaining = Math.max(0, 1 - (performance.now() - sonarLastUsed.current) / 1600);
        setSonarCooldown(cooldownRemaining);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Keyboard navigation & Sonar bindings
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (modal || event.ctrlKey || event.metaKey || event.altKey) return;
      const element = event.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) || element.isContentEditable) return;

      const keys: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowRight: [1, 0],
        a: [-1, 0],
        w: [0, -1],
        s: [0, 1],
        d: [1, 0],
      };

      const direction = keys[event.key] || keys[event.key.toLowerCase()];
      if (direction) {
        event.preventDefault();
        const now = performance.now();
        if (!event.repeat || now - lastMovement.current >= 110) {
          lastMovement.current = now;
          move(...direction);
        }
      } else if ((event.key.toLowerCase() === 'e' || event.key.toLowerCase() === 'p' || event.key === ' ') && !event.repeat) {
        if (statusRef.current === 'playing') {
          event.preventDefault();
          triggerSonarPing();
        }
      } else if (event.key === 'Escape' && !event.repeat) {
        if (statusRef.current === 'playing') pauseGame();
        else if (statusRef.current === 'paused') resumeGame();
      } else if (event.key === 'Enter' && page === 'welcome' && !event.repeat && !['BUTTON', 'A'].includes(element.tagName)) {
        beginJourney();
      } else if (event.key.toLowerCase() === 'm' && !event.repeat) toggleMuted();
      else if (event.key.toLowerCase() === 'r' && page === 'game' && !event.repeat) openModal('restart');
      else if (event.key.toLowerCase() === 'n' && page === 'game' && !event.repeat) generateNewMaze();
      else if (event.key.toLowerCase() === 'h' && page === 'game' && !event.repeat) requestHome();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [beginJourney, generateNewMaze, modal, move, openModal, page, pauseGame, requestHome, resumeGame, toggleMuted, triggerSonarPing]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) pauseGame();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [pauseGame]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (modal) {
      if (!dialog.open) dialog.showModal();
      document.body.style.overflow = 'hidden';
    } else {
      dialog.close();
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [modal]);

  useEffect(() => {
    if (modal !== 'code' || source) return;
    const controller = new AbortController();
    setSourceError(false);
    fetch('/music_maze.py', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Source could not be loaded.');
        return response.text();
      })
      .then(setSource)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setSourceError(true);
      });
    return () => controller.abort();
  }, [modal, source]);

  useEffect(
    () => () => {
      for (const timer of timers.current) clearTimeout(timer);
      if (noteTimeout.current) clearTimeout(noteTimeout.current);
      audioRef.current?.dispose();
      audioRef.current = null;
    },
    []
  );

  const copyCommands = async () => {
    try {
      await navigator.clipboard.writeText('python -m pip install pygame numpy\npython music_maze.py');
      setCopied(true);
      schedule(() => setCopied(false), 2000);
    } catch {
      const selection = window.getSelection();
      const commands = document.getElementById('python-commands');
      if (selection && commands) {
        const range = document.createRange();
        range.selectNodeContents(commands);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  };

  const buttonLabel = {
    home: 'Begin the journey',
    playing: 'Pause exploring',
    paused: 'Keep exploring',
    won: 'Next level loading...',
  }[status];

  const statusLabel = {
    home: 'CHOOSE YOUR FIRST MOVE',
    playing: 'ACTIVE ECHOLOCATION',
    paused: 'TAKING A BREATH',
    won: `LEVEL ${String(level).padStart(2, '0')} COMPLETE`,
  }[status];

  // Telemetry computation
  const optDistance = mazeData.distance;
  const efficiency = moves > 0 ? (optDistance / Math.max(moves, optDistance)) * 100 : 100;
  const rank =
    moves <= optDistance && bumps <= 2
      ? 'S+'
      : efficiency >= 85
      ? 'S'
      : efficiency >= 70
      ? 'A'
      : efficiency >= 55
      ? 'B'
      : 'C';

  return (
    <div className={`app-shell ${page === 'welcome' ? 'welcome-shell' : 'game-shell'}`}>
      {page === 'welcome' ? (
        <>
          <header className="welcome-header">
            <div className="brand" aria-label="Music Maze">
              <MazeMark />
              <span>
                music<span className="brand-light">maze</span>
                <span className="brand-period">.</span>
              </span>
            </div>
            <span className="welcome-edition">PROFESSIONAL ACOUSTIC EDITION</span>
          </header>
          <main className="welcome-page">
            <div className="welcome-art" aria-hidden="true">
              <span className="sonar-ring ring-one" />
              <span className="sonar-ring ring-two" />
              <span className="sonar-ring ring-three" />
              <svg viewBox="0 0 520 650" fill="none">
                <path
                  d="M70 0v96h103v72H94v94h142v80H48v102h126v90h110v116M326 0v76h124v106h-94v80h126v102H331v82h102v96h87M236 96h90M236 262h120M174 534h110"
                  stroke="currentColor"
                  strokeWidth="1"
                />
                <circle cx="236" cy="262" r="7" fill="currentColor" />
              </svg>
            </div>
            <section className="welcome-content" aria-labelledby="welcome-title">
              <p className="eyebrow">
                <span className="tiny-square" /> LESS SIGHT. MORE SOUND.
              </p>
              <h1 id="welcome-title" className="welcome-title">
                Music <br />
                Maze<span className="title-period">.</span>
              </h1>
              <p className="welcome-lede">
                An invisible labyrinth navigated by acoustic graph theory and active echolocation.
                <br />
                Trust your ears, map the shadows, and find the exit.
              </p>
              <div className="welcome-rules" aria-label="How to play">
                <div>
                  <span>01</span>
                  <p>
                    <strong>Move</strong> with arrow keys or WASD through dark corridors.
                  </p>
                </div>
                <div>
                  <span>02</span>
                  <p>
                    <strong>Echo</strong>: Press [E] or Space for a Sonar Radar Ping that cascades through walls.
                  </p>
                </div>
                <div>
                  <span>03</span>
                  <p>
                    <strong>Chambers</strong>: Seek out purple Resonance Chambers for harmonic triads.
                  </p>
                </div>
              </div>
              <button className="primary-button welcome-start" onClick={beginJourney}>
                <Icon name="play" size={17} /> Start the game <Icon name="arrow" size={18} />
              </button>
              <p className="welcome-audio">
                <Icon name="headphones" size={16} /> Stereo headphones highly recommended
              </p>
            </section>
          </main>
          <footer className="welcome-footer">
            <span>PRESS ENTER TO START &nbsp;|&nbsp; PRESS E FOR ACTIVE SONAR</span>
            <p>Additive harmonic synthesis &middot; Equal-power stereophonic panning &middot; Graph cycle braiding</p>
          </footer>
        </>
      ) : (
        <>
          <header className="game-page-header">
            <button className="brand" onClick={requestHome} aria-label="Return to the welcome page">
              <MazeMark />
              <span>
                music<span className="brand-light">maze</span>
                <span className="brand-period">.</span>
              </span>
            </button>
            <div className="game-page-level">
              <span>LEVEL {String(level).padStart(2, '0')}</span>
              <i />
              <strong>{getLevelTitle(level)}</strong>
              <span className="text-xs text-mint/80 font-mono ml-2">[{currentScale.name}]</span>
            </div>
            <div className="game-page-links">
              <button onClick={generateNewMaze} title="Procedurally generate a new labyrinth layout">
                <Icon name="reset" size={16} /> New maze
              </button>
              <button onClick={() => openModal('help')}>
                <Icon name="help" size={16} /> How to play
              </button>
              <button onClick={() => openModal('code')}>
                <Icon name="code" size={16} /> Python code
              </button>
            </div>
          </header>

          <main id="play" className="game-workspace">
            <section
              className={`game-panel ${status === 'playing' ? 'game-active' : ''}`}
              aria-label="Music Maze game"
              data-game-status={status}
            >
              <div className="game-header">
                <div className="level-label">
                  <Equalizer animated={status === 'playing' && activeNote !== null} />
                  <span>{statusLabel}</span>
                  <span className="level-number">{String(moves).padStart(3, '0')} MOVES</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-mint/10 text-mint font-mono">
                    RANK {rank} ({efficiency.toFixed(0)}%)
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    className={`px-3 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition-all ${
                      sonarCooldown === 0
                        ? 'border-cyan-400 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/60 shadow-[0_0_12px_rgba(105,244,250,0.25)]'
                        : 'border-white/10 bg-white/5 text-white/40 cursor-not-allowed'
                    }`}
                    onClick={triggerSonarPing}
                    disabled={sonarCooldown > 0 || status !== 'playing'}
                    title="Emit active acoustic sonar radar pulse (Hotkey: E, P, or Space)"
                  >
                    <span>⚡ SONAR [E]</span>
                    {sonarCooldown > 0 && <span>{Math.ceil(sonarCooldown * 1.6)}s</span>}
                  </button>
                  <button
                    className={`sound-toggle ${muted ? 'is-muted' : ''}`}
                    aria-label={muted ? 'Unmute sound' : 'Mute sound'}
                    aria-pressed={muted}
                    onClick={toggleMuted}
                  >
                    <Icon name={muted ? 'muted' : 'volume'} size={17} />
                    <span>SOUND {muted ? 'OFF' : 'ON'}</span>
                  </button>
                </div>
              </div>

              <div className="board-frame">
                <div className="board-coordinate coordinate-top">
                  {GRID_SIZE} &times; {GRID_SIZE} &nbsp; / &nbsp; OPTIMAL: {optDistance} MOVES &nbsp; / &nbsp; TORTUOSITY: {mazeData.tortuosity.toFixed(2)}
                </div>
                <div
                  className="game-board"
                  ref={panelRef}
                  tabIndex={0}
                  role="application"
                  data-player-x={position.x}
                  data-player-y={position.y}
                  aria-label={`Invisible maze. Player at column ${position.x + 1}, row ${position.y + 1}. Use arrow keys to reach exit.`}
                  aria-describedby="game-instructions"
                >
                  <svg className="maze-svg" viewBox="0 0 600 600" aria-hidden="true">
                    <defs>
                      <pattern id="maze-grid" width={TILE_SIZE} height={TILE_SIZE} patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#111713" strokeWidth="0.65" />
                      </pattern>
                      <filter id="player-glow" x="-150%" y="-150%" width="400%" height="400%">
                        <feGaussianBlur stdDeviation="7" />
                      </filter>
                      <filter id="exit-glow" x="-100%" y="-100%" width="300%" height="300%">
                        <feGaussianBlur stdDeviation="9" />
                      </filter>
                    </defs>
                    <rect width="600" height="600" fill="#000" />
                    <rect width="600" height="600" fill="url(#maze-grid)" />

                    {/* Start tile */}
                    <rect
                      x={START.x * TILE_SIZE + 3}
                      y={START.y * TILE_SIZE + 3}
                      width="34"
                      height="34"
                      rx="3"
                      fill="#112b3d"
                      stroke="#1c3e52"
                    />

                    {/* Exit portal with pulse */}
                    <g className="exit-marker">
                      <rect
                        x={EXIT.x * TILE_SIZE + 3}
                        y={EXIT.y * TILE_SIZE + 3}
                        width="34"
                        height="34"
                        rx="3"
                        fill="#90ed9a"
                        opacity="0.23"
                        filter="url(#exit-glow)"
                      />
                      <rect
                        x={EXIT.x * TILE_SIZE + 5}
                        y={EXIT.y * TILE_SIZE + 5}
                        width="30"
                        height="30"
                        rx="2"
                        fill="#64c77a"
                      />
                      <rect
                        className="exit-ring"
                        x={EXIT.x * TILE_SIZE - 1}
                        y={EXIT.y * TILE_SIZE - 1}
                        width="42"
                        height="42"
                        rx="5"
                        fill="none"
                        stroke="#71e790"
                        strokeWidth="0.8"
                      />
                    </g>
                    <text className="marker-label" x={EXIT.x * TILE_SIZE + 20} y={EXIT.y * TILE_SIZE + 58} textAnchor="middle" fill="#78917a">
                      EXIT
                    </text>
                    <text className="marker-label" x={START.x * TILE_SIZE + 20} y={START.y * TILE_SIZE + 57} textAnchor="middle" fill="#577581">
                      START
                    </text>

                    {/* Resonance Chambers */}
                    {mazeData.resonanceChambers.map((ch, idx) => (
                      <g key={`chamber-${idx}`} className="resonance-chamber">
                        <rect
                          x={ch.x * TILE_SIZE + 2}
                          y={ch.y * TILE_SIZE + 2}
                          width="36"
                          height="36"
                          rx="4"
                          fill="#b982f0"
                          fillOpacity="0.18"
                          stroke="#b982f0"
                          strokeWidth="1"
                        />
                        <circle cx={ch.x * TILE_SIZE + 20} cy={ch.y * TILE_SIZE + 20} r="4" fill="#d8b2ff" opacity="0.6" />
                      </g>
                    ))}

                    {/* Persistent Cognitive Memory: Ghost outlines for discovered walls */}
                    {Array.from(discoveredWalls).map((key) => {
                      const [wx, wy] = key.split(',').map(Number);
                      return (
                        <rect
                          key={`ghost-${key}`}
                          x={wx * TILE_SIZE + 1}
                          y={wy * TILE_SIZE + 1}
                          width="38"
                          height="38"
                          rx="2"
                          fill="none"
                          stroke="#243428"
                          strokeWidth="1"
                          opacity="0.75"
                        />
                      );
                    })}

                    {/* Active Wall Echoes with illuminated note badge */}
                    {echoes.map((echo) => (
                      <g key={echo.id} className="wall-echo">
                        <rect
                          x={echo.x * TILE_SIZE + 1}
                          y={echo.y * TILE_SIZE + 1}
                          width="38"
                          height="38"
                          rx="2"
                          fill={echo.color}
                          fillOpacity="0.32"
                          stroke={echo.color}
                          strokeOpacity="0.9"
                          strokeWidth="1.5"
                        />
                        <text
                          x={echo.x * TILE_SIZE + 20}
                          y={echo.y * TILE_SIZE + 24}
                          textAnchor="middle"
                          fill={echo.color}
                          className="echo-note"
                        >
                          {echo.noteName}
                        </text>
                      </g>
                    ))}

                    {/* Player Avatar */}
                    <g
                      className="player"
                      style={{
                        transform: `translate(${position.x * TILE_SIZE + 20}px, ${position.y * TILE_SIZE + 20}px)`,
                        transition: 'transform 110ms cubic-bezier(0.2, 0.9, 0.4, 1)',
                      }}
                    >
                      <circle r="16" fill="#79edf1" opacity="0.25" filter="url(#player-glow)" />
                      <circle className="player-ring" r="18" fill="none" stroke="#73e9ed" strokeOpacity="0.25" strokeWidth="0.8" />
                      <circle r="9" fill="#8af4f5" />
                      <circle r="3" cx="-2" cy="-2" fill="#d5ffff" fillOpacity="0.7" />
                    </g>
                  </svg>

                  {status === 'paused' && (
                    <div className="board-message paused-message">
                      <span className="message-eyebrow">NO RUSH.</span>
                      <h2>Take a breath.</h2>
                      <p>The maze will wait for you.</p>
                      <button className="primary-button" onClick={startOrPause}>
                        <Icon name="play" size={16} /> Keep exploring
                      </button>
                    </div>
                  )}

                  {status === 'won' && (
                    <div className="board-message win-message">
                      <span className="message-eyebrow">LEVEL {String(level).padStart(2, '0')} ESCAPED!</span>
                      <h2>Rank: {rank}</h2>
                      <p>
                        {moves} moves ({efficiency.toFixed(1)}% optimal). {bumps} wall echoes. {formatTime(elapsed)}.
                      </p>
                      <span className="restart-message">
                        Synthesizing Level {String(level + 1).padStart(2, '0')}: {getLevelTitle(level + 1)} in 3 seconds...
                      </span>
                    </div>
                  )}
                </div>

                <div className="board-bottom-note">
                  <span className="status-light" />
                  <span>{statusLabel}</span>
                  <span className="echo-caption">PRESS [E] FOR SONAR RADAR &middot; GHOST OUTLINES PERSIST</span>
                </div>
              </div>

              <div className="game-footer">
                <div className="game-metrics">
                  <span>
                    <span className="metric-label">MOVES</span>
                    <strong>{String(moves).padStart(3, '0')}</strong>
                  </span>
                  <i />
                  <span>
                    <span className="metric-label">EFFICIENCY</span>
                    <strong>{efficiency.toFixed(0)}%</strong>
                  </span>
                  <i />
                  <span>
                    <span className="metric-label">TIME</span>
                    <strong>{formatTime(elapsed)}</strong>
                  </span>
                  <i />
                  <span>
                    <span className="metric-label">ECHOES</span>
                    <strong>{String(bumps).padStart(3, '0')}</strong>
                  </span>
                </div>
                <div className="game-tools">
                  <button className="icon-button" aria-label="Welcome page" title="Welcome page" onClick={requestHome}>
                    <Icon name="home" size={17} />
                  </button>
                  <button className="reset-button" onClick={() => openModal('restart')}>
                    <Icon name="reset" size={16} />
                    <span>Restart</span>
                  </button>
                </div>
              </div>
            </section>

            <aside className="game-sidebar">
              <div className="game-sidebar-copy">
                <p className="eyebrow">
                  <span className="tiny-square" /> GRAPH THEORY &bull; HARMONIC ACOUSTICS
                </p>
                <h1>
                  Find the
                  <br />
                  green light<span className="title-period">.</span>
                </h1>
                <p>
                  Move with arrows or WASD. Press <strong>[E]</strong> or Spacebar to fire an active echolocation pulse.
                </p>
                <div className="flex gap-2">
                  <button
                    className="primary-button game-pause flex-1"
                    onClick={startOrPause}
                    disabled={status === 'won'}
                  >
                    <Icon name={status === 'playing' ? 'pause' : status === 'won' ? 'check' : 'play'} size={17} />
                    <span>{buttonLabel}</span>
                  </button>
                  <button
                    className="px-4 py-3 rounded-xl border border-cyan-400/50 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-900/50 flex items-center gap-2 font-mono text-xs transition-all"
                    onClick={triggerSonarPing}
                    disabled={sonarCooldown > 0 || status !== 'playing'}
                    title="Active Echolocation Radar Ping"
                  >
                    <span>⚡ PING</span>
                  </button>
                </div>

                <div className="movement-hint">
                  <div className="arrow-keys" aria-label="Directional movement controls">
                    {DIRECTIONS.map((direction) => (
                      <button
                        key={direction.label}
                        aria-label={direction.label}
                        title={direction.label}
                        onClick={() => move(direction.dx, direction.dy)}
                        disabled={status !== 'playing'}
                      >
                        <Icon name="arrow" size={14} style={{ transform: `rotate(${direction.rotation}deg)` }} />
                      </button>
                    ))}
                  </div>
                  <span>ARROWS / WASD TO MOVE &middot; [E] FOR SONAR</span>
                </div>
                <p className="headphone-hint">
                  <Icon name="headphones" size={16} /> Stereo audio: directional echoes pan Left/Right.
                </p>
              </div>

              <section id="notes" className="sound-palette game-sound-palette" aria-labelledby="notes-title">
                <div className="palette-heading">
                  <h2 id="notes-title">Scale: {currentScale.name}</h2>
                  <span>TAP TO LISTEN <Icon name="arrow" size={12} /></span>
                </div>
                <div className="note-keys">
                  {currentScale.notes.map((note) => (
                    <button
                      key={note.name}
                      className={`note-key ${activeNote === note.name ? 'note-active' : ''}`}
                      style={{ '--note-color': note.color } as CSSProperties}
                      aria-label={`Play ${note.name}, ${note.frequency} hertz`}
                      onClick={() => playHarmonic(note.frequency, 0, note.name)}
                    >
                      <span>{note.name}</span>
                      <Equalizer animated={activeNote === note.name} />
                      <i className="note-light" />
                    </button>
                  ))}
                </div>
                <div className="palette-caption">
                  <span>{currentScale.mood.toUpperCase()}</span>
                  <div className="volume-control">
                    <Icon name={muted ? 'muted' : 'volume'} size={13} />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={volume}
                      aria-label="Sound volume"
                      style={{ '--volume': `${volume}%` } as CSSProperties}
                      onChange={(event) => {
                        const val = Number(event.target.value);
                        setVolume(val);
                        getAudio().setVolume(val / 100);
                      }}
                    />
                  </div>
                </div>
              </section>
            </aside>
          </main>
          <footer className="site-footer game-page-footer">
            <p>Procedural labyrinth with graph-theoretic cycle braiding and physical acoustic modeling.</p>
            <span>
              <span className="footer-dot" /> H HOME &nbsp; M SOUND &nbsp; R RESTART &nbsp; N NEW MAZE &nbsp; E SONAR
            </span>
          </footer>
        </>
      )}

      <p id="game-instructions" className="sr-only">
        Move one tile at a time with the arrow keys or WASD. Bumping a wall plays its spatial note. Press E or Spacebar for an active Sonar pulse.
      </p>

      <dialog
        ref={dialogRef}
        className={`modal ${modal === 'code' ? 'code-modal' : ''}`}
        aria-labelledby="modal-title"
        onCancel={(event) => {
          event.preventDefault();
          closeModal();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            const rect = event.currentTarget.getBoundingClientRect();
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
              closeModal();
            }
          }
        }}
      >
        <button className="modal-close icon-button" aria-label="Close dialog" onClick={() => closeModal()}>
          <Icon name="close" size={20} />
        </button>

        {modal === 'help' && (
          <>
            <p className="eyebrow">
              <span className="tiny-square" /> ADVANCED ACOUSTIC MECHANICS
            </p>
            <h2 id="modal-title">Echolocation &amp; Spatial Acoustics</h2>
            <p className="modal-intro">The walls are completely invisible. Your ears are your radar.</p>
            <div className="instructions">
              <div>
                <span className="instruction-number">01</span>
                <div>
                  <h3>Directional Wall Collisions</h3>
                  <p>
                    Impacts with walls synthesize multi-harmonic chime tones with equal-power stereophonic panning. Walls to your left pan Left; walls to your right pan Right.
                  </p>
                </div>
              </div>
              <div>
                <span className="instruction-number">02</span>
                <div>
                  <h3>Active Sonar Radar Pulse [E]</h3>
                  <p>
                    Press <strong>[E]</strong>, <strong>[P]</strong>, or <strong>Spacebar</strong> to emit a frequency-modulated acoustic radar ping. Sound waves ripple outward through corridors, reflecting echoes from nearby walls with travel-time delays!
                  </p>
                </div>
              </div>
              <div>
                <span className="instruction-number">03</span>
                <div>
                  <h3>Resonance Chambers &amp; Memory</h3>
                  <p>
                    Deep terminal dead-ends harbor glowing purple Resonance Chambers that radiate crystalline triads. Walls you discover leave faint glowing ghost outlines so you can chart your path.
                  </p>
                </div>
              </div>
            </div>
            <div className="help-shortcuts">
              <span><kbd>E</kbd> / <kbd>SPACE</kbd> Sonar</span>
              <span><kbd>ESC</kbd> Pause</span>
              <span><kbd>M</kbd> Mute</span>
              <span><kbd>N</kbd> New Maze</span>
            </div>
            <button
              className="primary-button modal-primary"
              onClick={() => {
                if (page === 'welcome') beginJourney();
                else {
                  closeModal(false);
                  if (statusRef.current === 'paused') resumeGame();
                  panelRef.current?.focus({ preventScroll: true });
                }
              }}
            >
              Start Exploring <Icon name="arrow" size={18} />
            </button>
          </>
        )}

        {modal === 'restart' && (
          <>
            <p className="eyebrow">
              <span className="tiny-square" /> A FRESH PAIR OF EARS
            </p>
            <h2 id="modal-title">Restart or Synthesize New Maze?</h2>
            <p className="modal-intro">Retry this exact layout, or synthesize a brand-new procedural labyrinth with graph theory braiding.</p>
            <div className="restart-actions">
              <button
                className="primary-button"
                onClick={() => {
                  closeModal(false);
                  resetGame('playing');
                  panelRef.current?.focus({ preventScroll: true });
                }}
              >
                <Icon name="reset" size={17} /> Restart this level
              </button>
              <button
                className="secondary-button"
                style={{ borderColor: 'var(--mint)', color: 'var(--mint)' }}
                onClick={() => {
                  closeModal(false);
                  generateNewMaze();
                  panelRef.current?.focus({ preventScroll: true });
                }}
              >
                <Icon name="play" size={16} /> Synthesize new maze
              </button>
              <button className="secondary-button" onClick={() => closeModal()}>
                Keep my place
              </button>
            </div>
          </>
        )}

        {modal === 'home' && (
          <>
            <p className="eyebrow">
              <Icon name="home" size={15} /> RETURN TO TITLE
            </p>
            <h2 id="modal-title">Leave this journey?</h2>
            <p className="modal-intro">Your current moves and telemetry will be reset. The labyrinth awaits whenever you return.</p>
            <div className="restart-actions">
              <button className="primary-button" onClick={returnHome}>
                <Icon name="home" size={16} /> Return home
              </button>
              <button className="secondary-button" onClick={() => closeModal()}>
                Keep exploring
              </button>
            </div>
          </>
        )}

        {modal === 'code' && (
          <>
            <p className="eyebrow">
              <Icon name="code" size={16} /> STANDALONE PYTHON EDITION
            </p>
            <h2 id="modal-title">Take the maze anywhere.</h2>
            <p className="modal-intro">
              One self-contained Python file. Pygame for visuals, NumPy for multi-harmonic additive synthesis and active echolocation radar. Zero asset files needed.
            </p>
            <a href="/music_maze.py" download="music_maze.py" className="primary-button download-button">
              <Icon name="download" size={18} /> Download music_maze.py <Icon name="arrow" size={18} />
            </a>
            <h3 className="code-step-heading">Install &amp; Run:</h3>
            <div className="command-box">
              <pre id="python-commands">
                <code>python -m pip install pygame numpy{'\n'}python music_maze.py</code>
              </pre>
              <button className="icon-button" aria-label={copied ? 'Commands copied' : 'Copy run commands'} onClick={() => void copyCommands()}>
                <Icon name={copied ? 'check' : 'copy'} size={17} />
              </button>
            </div>
            <p className="python-specs">Stereophonic spatial audio &middot; Active Echolocation Sonar &middot; Graph cycle analysis</p>
            <button className="source-disclosure" onClick={() => setSourceExpanded((current) => !current)} aria-expanded={sourceExpanded}>
              {sourceExpanded ? 'Hide' : 'View'} source preview <span>{sourceExpanded ? '-' : '+'}</span>
            </button>
            {sourceExpanded && (
              <pre className="python-source">
                <code>{sourceError ? 'Could not load preview. Use download button.' : source || 'Loading Python source...'}</code>
              </pre>
            )}
          </>
        )}
      </dialog>
    </div>
  );
}

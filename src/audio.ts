import type { NoteDefinition } from './maze';

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

export class ToneEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private volume = 0.65;
  private muted = false;
  private activeSources = new Set<AudioNode>();

  private initialize(): AudioContext {
    if (this.context) return this.context;
    const Constructor = window.AudioContext || (window as AudioWindow).webkitAudioContext;
    if (!Constructor) throw new Error('Web Audio API is not supported in this environment.');
    const context = new Constructor();
    this.context = context;

    this.master = context.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume * 0.26;
    this.master.connect(context.destination);

    return context;
  }

  async unlock() {
    const context = this.initialize();
    if (context.state === 'suspended') {
      await context.resume();
    }
  }

  /**
   * Synthesize a rich multi-harmonic chime with physical exponential decay
   * and equal-power stereo panning.
   */
  async playHarmonicTone(
    frequency: number,
    pan = 0.0,
    volumeScale = 1.0,
    duration = 0.28,
  ) {
    if (this.muted) return;
    const context = this.initialize();
    if (context.state === 'suspended') await context.resume();
    if (context.state === 'closed') return;

    const sampleRate = context.sampleRate;
    const sampleCount = Math.floor(sampleRate * duration);
    const buffer = context.createBuffer(1, sampleCount, sampleRate);
    const data = buffer.getChannelData(0);

    const attackSamples = Math.max(1, Math.floor(sampleRate * 0.007));

    // Multi-harmonic overtone series (f, 2f, 3f, 4f)
    for (let i = 0; i < sampleCount; i++) {
      const t = i / sampleRate;
      const fundamental = Math.sin(2 * Math.PI * frequency * t);
      const h2 = 0.35 * Math.sin(2 * Math.PI * frequency * 2 * t);
      const h3 = 0.15 * Math.sin(2 * Math.PI * frequency * 3 * t);
      const h4 = 0.06 * Math.sin(2 * Math.PI * frequency * 4 * t);

      // Warm analog soft saturation
      const raw = Math.tanh(fundamental + h2 + h3 + h4);

      // Attack and exponential release envelope
      const attackEnv = Math.min(1.0, i / attackSamples);
      const decayEnv = Math.exp((-3.6 * t) / duration);
      data[i] = raw * attackEnv * decayEnv * 0.75 * volumeScale;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;

    // Stereo Panning
    let destNode: AudioNode = this.master!;
    if (context.createStereoPanner) {
      const panner = context.createStereoPanner();
      panner.pan.value = Math.max(-1.0, Math.min(1.0, pan));
      panner.connect(this.master!);
      destNode = panner;
    }

    source.connect(destNode);
    this.activeSources.add(source);
    source.onended = () => {
      this.activeSources.delete(source);
      source.disconnect();
    };
    source.start();
  }

  /**
   * Sweeping FM chirp for active Sonar Radar Ping.
   */
  async playSonarChirp(fStart = 880, fEnd = 440, duration = 0.22) {
    if (this.muted) return;
    const context = this.initialize();
    if (context.state === 'suspended') await context.resume();
    if (context.state === 'closed') return;

    const sampleRate = context.sampleRate;
    const sampleCount = Math.floor(sampleRate * duration);
    const buffer = context.createBuffer(1, sampleCount, sampleRate);
    const data = buffer.getChannelData(0);

    const k = (fEnd - fStart) / duration;
    const attackSamples = Math.max(1, Math.floor(sampleRate * 0.005));

    for (let i = 0; i < sampleCount; i++) {
      const t = i / sampleRate;
      const phase = 2 * Math.PI * (fStart * t + 0.5 * k * (t * t));
      const raw = Math.tanh(Math.sin(phase) + 0.25 * Math.sin(phase * 2));
      const attackEnv = Math.min(1.0, i / attackSamples);
      const decayEnv = Math.exp((-4.2 * t) / duration);
      data[i] = raw * attackEnv * decayEnv * 0.7;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.master!);
    this.activeSources.add(source);
    source.onended = () => {
      this.activeSources.delete(source);
      source.disconnect();
    };
    source.start();
  }

  /**
   * Crystalline triad chord for Resonance Chambers.
   */
  async playChamberTriad(rootFreq = 261.63, duration = 0.65) {
    if (this.muted) return;
    const context = this.initialize();
    if (context.state === 'suspended') await context.resume();
    if (context.state === 'closed') return;

    const sampleRate = context.sampleRate;
    const sampleCount = Math.floor(sampleRate * duration);
    const buffer = context.createBuffer(1, sampleCount, sampleRate);
    const data = buffer.getChannelData(0);

    const f1 = rootFreq;
    const f2 = rootFreq * 1.25;
    const f3 = rootFreq * 1.5;

    for (let i = 0; i < sampleCount; i++) {
      const t = i / sampleRate;
      const raw = Math.tanh(
        0.5 * Math.sin(2 * Math.PI * f1 * t) +
        0.35 * Math.sin(2 * Math.PI * f2 * t) +
        0.3 * Math.sin(2 * Math.PI * f3 * t)
      );
      const attackEnv = Math.min(1.0, i / (sampleRate * 0.02));
      const decayEnv = Math.exp((-2.4 * t) / duration);
      data[i] = raw * attackEnv * decayEnv * 0.65;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.master!);
    this.activeSources.add(source);
    source.onended = () => {
      this.activeSources.delete(source);
      source.disconnect();
    };
    source.start();
  }

  /**
   * Backwards-compatible play method for existing callers.
   */
  async play(noteIndex: number, notes?: readonly NoteDefinition[]) {
    const list = notes || [
      { frequency: 261.63 },
      { frequency: 293.66 },
      { frequency: 329.63 },
      { frequency: 392.0 },
      { frequency: 440.0 },
      { frequency: 523.25 },
      { frequency: 587.33 },
      { frequency: 659.25 },
    ];
    const item = list[noteIndex % list.length];
    if (item) {
      await this.playHarmonicTone(item.frequency);
    }
  }

  setVolume(volume: number) {
    this.volume = volume;
    this.updateGain();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.updateGain();
  }

  private updateGain() {
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(
        this.muted ? 0 : this.volume * 0.26,
        this.context.currentTime,
        0.015,
      );
    }
  }

  stopAll() {
    for (const source of this.activeSources) {
      try {
        if ('stop' in source) (source as AudioBufferSourceNode).stop();
      } catch {
        // Source might already have ended
      }
    }
    this.activeSources.clear();
  }

  dispose() {
    this.stopAll();
    void this.context?.close();
    this.context = null;
    this.master = null;
  }
}
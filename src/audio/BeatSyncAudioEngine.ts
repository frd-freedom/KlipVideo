import type { AudioSourceMode, GenerativeMusicScore } from '../types/studio';

const CHORD_NOTES: Record<string, number[]> = {
  Am7: [57, 60, 64, 67],
  Fmaj7: [53, 57, 60, 64],
  Cmaj7: [48, 52, 55, 59],
  G6: [55, 59, 62, 64],
  Em7: [52, 55, 59, 62],
  Dm7: [50, 53, 57, 60],
  Am: [57, 60, 64],
  F: [53, 57, 60],
  C: [48, 52, 55],
  G: [55, 59, 62],
  Em: [52, 55, 59],
  Dm: [50, 53, 57],
  Bm7: [59, 62, 66, 69],
  Dmaj7: [50, 54, 57, 61],
  E7: [52, 56, 59, 62],
};

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function parseChordNotes(chordName: string): number[] {
  const clean = chordName.trim();
  if (CHORD_NOTES[clean]) return CHORD_NOTES[clean];
  const rootMap: Record<string, number> = {
    C: 48,
    'C#': 49,
    Db: 49,
    D: 50,
    'D#': 51,
    Eb: 51,
    E: 52,
    F: 53,
    'F#': 54,
    Gb: 54,
    G: 55,
    'G#': 56,
    Ab: 56,
    A: 57,
    'A#': 58,
    Bb: 58,
    B: 59,
  };
  const match = clean.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return [57, 60, 64, 67];
  const root = rootMap[match[1]] ?? 57;
  const quality = match[2].toLowerCase();
  if (quality.includes('m7')) return [root, root + 3, root + 7, root + 10];
  if (quality.includes('maj7')) return [root, root + 4, root + 7, root + 11];
  if (quality.startsWith('m')) return [root, root + 3, root + 7];
  return [root, root + 4, root + 7, root + 11];
}

export interface AudioMetrics {
  bassEnergy: number;
  midEnergy: number;
  highEnergy: number;
  isBeatHit: boolean;
  beatPhase: number;
  waveformBars: number[];
}

export class BeatSyncAudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;
  private streamDest: MediaStreamAudioDestinationNode | null = null;

  private audioEl: HTMLAudioElement | null = null;
  private mediaSource: MediaElementAudioSourceNode | null = null;
  private currentProxyUrl: string | null = null;

  private freqData: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(128));
  private rollingBass = 0.15;
  private lastBeatHitTime = 0;

  // Generative scheduler state
  private genTimer: number | null = null;
  private genStep = 0;
  private nextStepTime = 0;
  private isPlaying = false;
  private mode: AudioSourceMode = 'generative';
  private score: GenerativeMusicScore;
  private volume = 0.85;
  private muted = false;

  // Clock tracking for generative mode
  private genStartTimestamp = 0;
  private genStartOffsetSec = 0;
  private durationSec = 30;

  constructor(initialScore: GenerativeMusicScore) {
    this.score = initialScore;
  }

  private ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.78;
      this.freqData = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.volume;

      this.streamDest = this.ctx.createMediaStreamDestination();

      this.analyser.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.connect(this.streamDest);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  public setScore(score: GenerativeMusicScore) {
    this.score = score;
  }

  public setDuration(durationSec: number) {
    this.durationSec = Math.max(5, durationSec);
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.muted ? 0 : this.volume,
        this.ctx.currentTime,
        0.02
      );
    }
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.muted ? 0 : this.volume,
        this.ctx.currentTime,
        0.02
      );
    }
  }

  public async loadPreviewUrl(rawPreviewUrl: string | null): Promise<boolean> {
    if (!rawPreviewUrl) {
      this.currentProxyUrl = null;
      return false;
    }
    const proxyUrl = `/api/music/audio-proxy?url=${encodeURIComponent(rawPreviewUrl)}`;
    if (this.currentProxyUrl === proxyUrl && this.audioEl) {
      return true;
    }

    this.ensureContext();
    if (!this.audioEl) {
      this.audioEl = new Audio();
      this.audioEl.crossOrigin = 'anonymous';
      this.audioEl.preload = 'auto';
      if (this.ctx && this.analyser) {
        this.mediaSource = this.ctx.createMediaElementSource(this.audioEl);
        this.mediaSource.connect(this.analyser);
      }
    }

    this.currentProxyUrl = proxyUrl;
    this.audioEl.src = proxyUrl;
    this.audioEl.load();

    return new Promise((resolve) => {
      const el = this.audioEl!;
      const onCanPlay = () => {
        cleanup();
        resolve(true);
      };
      const onError = () => {
        cleanup();
        resolve(false);
      };
      const cleanup = () => {
        el.removeEventListener('canplay', onCanPlay);
        el.removeEventListener('error', onError);
      };
      el.addEventListener('canplay', onCanPlay);
      el.addEventListener('error', onError);
      setTimeout(() => {
        cleanup();
        resolve(el.readyState >= 2);
      }, 5000);
    });
  }

  public async start(mode: AudioSourceMode, offsetSec = 0) {
    this.ensureContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    this.stopScheduler();
    if (this.audioEl) {
      this.audioEl.pause();
    }

    this.mode = mode;
    this.isPlaying = true;
    this.genStartOffsetSec = offsetSec;
    this.genStartTimestamp = performance.now();

    if (mode === 'preview' && this.audioEl && this.currentProxyUrl) {
      try {
        this.audioEl.currentTime = Math.min(offsetSec, Math.max(0, (this.audioEl.duration || 30) - 0.1));
        await this.audioEl.play();
        return;
      } catch {
        // Fallback seamlessly to generative synth if preview audio cannot play
        this.mode = 'generative';
      }
    }

    // Start generative Web Audio scheduler
    if (this.ctx) {
      const bpm = Math.max(60, Math.min(180, this.score.bpm || 84));
      const eighthSec = 60 / bpm / 2;
      this.genStep = Math.floor(offsetSec / eighthSec);
      this.nextStepTime = this.ctx.currentTime + 0.03;
      this.runScheduler();
    }
  }

  public pause() {
    this.isPlaying = false;
    this.stopScheduler();
    if (this.audioEl) {
      this.audioEl.pause();
    }
  }

  public seek(timeSec: number) {
    this.genStartOffsetSec = Math.max(0, Math.min(this.durationSec, timeSec));
    this.genStartTimestamp = performance.now();
    if (this.mode === 'preview' && this.audioEl && this.currentProxyUrl) {
      this.audioEl.currentTime = this.genStartOffsetSec;
    } else if (this.isPlaying && this.ctx) {
      const bpm = Math.max(60, Math.min(180, this.score.bpm || 84));
      const eighthSec = 60 / bpm / 2;
      this.genStep = Math.floor(this.genStartOffsetSec / eighthSec);
    }
  }

  public getCurrentTime(): number {
    if (this.mode === 'preview' && this.audioEl && this.currentProxyUrl && !Number.isNaN(this.audioEl.currentTime)) {
      return this.audioEl.currentTime;
    }
    if (!this.isPlaying) {
      return this.genStartOffsetSec;
    }
    return this.genStartOffsetSec + (performance.now() - this.genStartTimestamp) / 1000;
  }

  public getExportAudioStream(): MediaStream | null {
    this.ensureContext();
    return this.streamDest?.stream ?? null;
  }

  private stopScheduler() {
    if (this.genTimer !== null) {
      window.clearInterval(this.genTimer);
      this.genTimer = null;
    }
  }

  private runScheduler() {
    this.stopScheduler();
    this.genTimer = window.setInterval(() => {
      if (!this.isPlaying || !this.ctx || !this.analyser) return;
      const bpm = Math.max(60, Math.min(180, this.score.bpm || 84));
      const stepDuration = 60 / bpm / 2; // 8th-note steps

      while (this.nextStepTime < this.ctx.currentTime + 0.14) {
        this.triggerGenerativeStep(this.genStep, this.nextStepTime, stepDuration);
        this.nextStepTime += stepDuration;
        this.genStep += 1;
      }
    }, 25);
  }

  private triggerGenerativeStep(step: number, time: number, stepDur: number) {
    if (!this.ctx || !this.analyser) return;

    const barStep = step % 8;
    const barIndex = Math.floor(step / 8);
    const chords = this.score.chordProgression.length > 0 ? this.score.chordProgression : ['Am7', 'Fmaj7', 'Cmaj7', 'G6'];
    const chordName = chords[barIndex % chords.length];
    const chordMidis = parseChordNotes(chordName);

    // 1. Warm Pad / Rhodes Chord on beat 1 of each bar (barStep === 0)
    if (barStep === 0) {
      const style = this.score.synthStyle;
      chordMidis.forEach((midi, idx) => {
        const osc = this.ctx!.createOscillator();
        const filter = this.ctx!.createBiquadFilter();
        const gain = this.ctx!.createGain();

        osc.type = style === 'midnight-synth' ? 'sawtooth' : style === 'dark-bass' ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(midiToFreq(midi), time);
        if (style === 'midnight-synth') {
          osc.detune.setValueAtTime((idx % 2 === 0 ? -1 : 1) * 6, time);
        }

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(style === 'midnight-synth' ? 1400 : 950, time);

        const sustain = stepDur * 7.6;
        gain.gain.setValueAtTime(0.0001, time);
        gain.gain.linearRampToValueAtTime(0.075, time + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, time + sustain);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.analyser!);

        osc.start(time);
        osc.stop(time + sustain + 0.05);
      });
    }

    // 2. Sub-Bass Pulse
    const bassArr = this.score.bassPattern.length > 0 ? this.score.bassPattern : [45, 45, 41, 41, 48, 48, 43, 43];
    if (barStep === 0 || barStep === 3 || barStep === 6) {
      const bassMidi = bassArr[(barIndex * 2 + Math.floor(barStep / 3)) % bassArr.length] ?? 45;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(midiToFreq(Math.min(54, Math.max(32, bassMidi))), time);

      const dur = stepDur * 2.2;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(0.22, time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

      osc.connect(gain);
      gain.connect(this.analyser);
      osc.start(time);
      osc.stop(time + dur + 0.03);
    }

    // 3. Expressive Arpeggio Melody
    const melodyArr = this.score.melodyNotes.length > 0 ? this.score.melodyNotes : [69, 72, 76, 71, 69, 67, 64, 67];
    if (barStep % 2 === 0 || barStep === 5) {
      const noteMidi = melodyArr[step % melodyArr.length] ?? 69;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = this.score.synthStyle === 'indie-pluck' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(midiToFreq(Math.min(84, Math.max(55, noteMidi))), time);

      const dur = stepDur * 1.8;
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(0.08, time + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0008, time + dur);

      osc.connect(gain);
      gain.connect(this.analyser);
      osc.start(time);
      osc.stop(time + dur + 0.03);
    }

    // 4. Drum Groove (Kick on 0, 5; Soft Rim/Snare on 2, 6; Hat on every step)
    const intensity = Math.max(0.2, Math.min(1, this.score.drumIntensity ?? 0.68));
    if (barStep === 0 || barStep === 5) {
      // Kick
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(125, time);
      osc.frequency.exponentialRampToValueAtTime(38, time + 0.14);

      gain.gain.setValueAtTime(0.42 * intensity, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

      osc.connect(gain);
      gain.connect(this.analyser);
      osc.start(time);
      osc.stop(time + 0.24);
    }

    if (barStep === 2 || barStep === 6) {
      // Soft atmospheric snare/rimshot
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.12);
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.28));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1600, time);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.14 * intensity, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.analyser);
      noise.start(time);
    }

    // Subtle Hi-Hat
    {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.035);
      const hatBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = hatBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
      }
      const hat = this.ctx.createBufferSource();
      hat.buffer = hatBuffer;

      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(7000, time);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime((barStep % 2 === 0 ? 0.055 : 0.03) * intensity, time);
      gain.gain.exponentialRampToValueAtTime(0.0005, time + 0.035);

      hat.connect(hp);
      hp.connect(gain);
      gain.connect(this.analyser);
      hat.start(time);
    }
  }

  public getMetrics(currentTimeSec: number): AudioMetrics {
    const bpm = Math.max(60, Math.min(180, this.score.bpm || 84));
    const beatSec = 60 / bpm;
    const beatPhase = (currentTimeSec % beatSec) / beatSec;

    if (!this.analyser || !this.isPlaying) {
      const idleBars = Array.from({ length: 32 }, (_, i) =>
        0.08 + 0.04 * Math.sin(currentTimeSec * 2 + i * 0.35)
      );
      return {
        bassEnergy: 0.08,
        midEnergy: 0.06,
        highEnergy: 0.04,
        isBeatHit: false,
        beatPhase,
        waveformBars: idleBars,
      };
    }

    this.analyser.getByteFrequencyData(this.freqData);

    const avgRange = (start: number, end: number) => {
      let sum = 0;
      const clampedEnd = Math.min(end, this.freqData.length);
      for (let i = start; i < clampedEnd; i++) {
        sum += this.freqData[i];
      }
      return sum / Math.max(1, clampedEnd - start) / 255;
    };

    const bassEnergy = avgRange(0, 6);
    const midEnergy = avgRange(6, 28);
    const highEnergy = avgRange(28, 72);

    this.rollingBass = this.rollingBass * 0.9 + bassEnergy * 0.1;
    const now = performance.now();
    let isBeatHit = false;
    if (bassEnergy > this.rollingBass * 1.24 && bassEnergy > 0.25 && now - this.lastBeatHitTime > 220) {
      isBeatHit = true;
      this.lastBeatHitTime = now;
    }

    const waveformBars: number[] = [];
    const step = Math.max(1, Math.floor(this.freqData.length / 32));
    for (let i = 0; i < 32; i++) {
      waveformBars.push((this.freqData[i * step] ?? 0) / 255);
    }

    return {
      bassEnergy,
      midEnergy,
      highEnergy,
      isBeatHit,
      beatPhase,
      waveformBars,
    };
  }

  public dispose() {
    this.pause();
    if (this.audioEl) {
      this.audioEl.src = '';
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}

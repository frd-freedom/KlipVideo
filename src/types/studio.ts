export type StudioMode = 'code-lyric' | 'text-to-video';

export type StudioPreset = 'codin-noir' | 'midnight-ide' | 'editorial-kinetic';

export type AspectRatio = '9:16' | '1:1' | '16:9';

export type AudioSourceMode = 'preview' | 'generative';

export type LineEffect = 'normal' | 'echo' | 'drop';

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface SongItem {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  previewUrl: string | null;
  durationSec: number;
  bpm: number;
  genre: string;
  mood: string;
  sampleLyrics?: string;
}

export interface CodeLyricLine {
  id: string;
  lineNumber: number;
  code: string;
  startTime: number;
  endTime: number;
  effect: LineEffect;
  beatAccent: boolean;
}

export interface TextScene {
  id: string;
  headline: string;
  subtext: string;
  startTime: number;
  endTime: number;
  emphasisWords: string[];
  beatAccent: boolean;
}

export type SynthStyle = 'lofi-piano' | 'midnight-synth' | 'indie-pluck' | 'dark-bass';

export interface GenerativeMusicScore {
  bpm: number;
  keySignature: string;
  mood: string;
  genre: string;
  synthStyle: SynthStyle;
  chordProgression: string[];
  bassPattern: number[];
  melodyNotes: number[];
  drumIntensity: number;
  description: string;
}

export interface VideoStyleConfig {
  preset: StudioPreset;
  aspectRatio: AspectRatio;
  showLineNumbers: boolean;
  watermarkHandle: string;
  glowIntensity: number;
  cameraDynamics: number;
  typingSpeedFactor: number;
}

import React from 'react';
import {
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  AspectRatio,
  StudioMode,
  StudioPreset,
  VideoStyleConfig,
} from '../types/studio';

interface VideoPreviewStageProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  studioMode: StudioMode;
  styleConfig: VideoStyleConfig;
  onUpdateStyle: (patch: Partial<VideoStyleConfig>) => void;
  isPlaying: boolean;
  isExporting: boolean;
  exportProgress: number;
  currentTime: number;
  durationSec: number;
  bpm: number;
  waveformBars: number[];
  muted: boolean;
  volume: number;
  onTogglePlay: () => void;
  onRestart: () => void;
  onSeek: (timeSec: number) => void;
  onToggleMute: () => void;
  onChangeVolume: (val: number) => void;
}

function formatTimecode(sec: number): string {
  const clamped = Math.max(0, sec);
  const mins = Math.floor(clamped / 60);
  const secs = Math.floor(clamped % 60);
  const tenths = Math.floor((clamped % 1) * 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

export const VideoPreviewStage: React.FC<VideoPreviewStageProps> = ({
  canvasRef,
  studioMode,
  styleConfig,
  onUpdateStyle,
  isPlaying,
  isExporting,
  exportProgress,
  currentTime,
  durationSec,
  bpm,
  waveformBars,
  muted,
  volume,
  onTogglePlay,
  onRestart,
  onSeek,
  onToggleMute,
  onChangeVolume,
}) => {
  const aspectRatios: { value: AspectRatio; label: string }[] = [
    { value: '9:16', label: '9:16 Reels/TikTok' },
    { value: '1:1', label: '1:1 Feed' },
    { value: '16:9', label: '16:9 YouTube' },
  ];

  const presets: { value: StudioPreset; label: string }[] = [
    { value: 'codin-noir', label: 'Code Noir' },
    { value: 'midnight-ide', label: 'Midnight IDE' },
    { value: 'editorial-kinetic', label: 'Kinetic Teks' },
  ];

  // Calculate canvas display geometry inside viewport without overflow
  const canvasBoxClass =
    styleConfig.aspectRatio === '9:16'
      ? 'h-full max-h-[540px] aspect-[9/16]'
      : styleConfig.aspectRatio === '1:1'
        ? 'h-full max-h-[500px] aspect-square'
        : 'w-full max-w-[680px] aspect-video';

  const beatInterval = 60 / Math.max(60, bpm);
  const beatCount = Math.floor(durationSec / beatInterval);
  const beatTicks = Array.from({ length: Math.min(80, beatCount) }, (_, i) => (i * beatInterval) / durationSec);

  return (
    <section className="flex flex-col h-full bg-[#09090B] min-w-0 min-h-0">
      {/* Stage Top Toolbar */}
      <div className="px-5 py-3 border-b border-[#27272A] flex flex-wrap items-center justify-between gap-3 bg-[#0D0D10]">
        <div className="flex items-center gap-1 p-1 bg-[#18181B] rounded-lg border border-[#27272A]">
          {aspectRatios.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => onUpdateStyle({ aspectRatio: r.value })}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                styleConfig.aspectRatio === r.value
                  ? 'bg-[#27272A] text-white'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#18181B] rounded-lg border border-[#27272A]">
          {presets.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => onUpdateStyle({ preset: p.value })}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                styleConfig.preset === p.value
                  ? 'bg-[#EF4444] text-white'
                  : 'text-[#A1A1AA] hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main High-DPI Canvas Viewport */}
      <div className="flex-1 flex items-center justify-center p-6 min-h-0 relative overflow-hidden">
        <div
          className={`relative rounded-xl overflow-hidden border border-[#27272A] bg-black shadow-2xl flex items-center justify-center ${canvasBoxClass}`}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full block"
          />

          {isExporting && (
            <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center z-10">
              <div className="text-sm font-semibold text-white">
                Merender Video & Sinkronisasi Audio...
              </div>
              <div className="mt-2 font-mono text-2xl font-bold text-[#F59E0B] tabular-nums">
                {Math.round(exportProgress * 100)}%
              </div>
              <div className="w-48 h-1.5 bg-[#27272A] rounded-full overflow-hidden mt-3">
                <div
                  className="h-full bg-[#EF4444] transition-all duration-150"
                  style={{ width: `${Math.round(exportProgress * 100)}%` }}
                />
              </div>
              <p className="text-xs text-[#A1A1AA] mt-3 max-w-xs">
                Harap tunggu hingga pemutaran selesai untuk mengunduh file video dengan audio asli.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Transport & Beat-Synced Scrubber Timeline */}
      <div className="px-5 py-4 border-t border-[#27272A] bg-[#111114] space-y-3">
        {/* Live Frequency & Beat Timeline Bar */}
        <div className="space-y-1.5">
          <div
            className="relative h-10 bg-[#18181B] border border-[#27272A] rounded-lg overflow-hidden cursor-pointer select-none"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              onSeek(pct * durationSec);
            }}
          >
            {/* Beat grid markers */}
            {beatTicks.map((pos, idx) => (
              <div
                key={idx}
                className="absolute top-0 bottom-0 w-px bg-white/5 pointer-events-none"
                style={{ left: `${pos * 100}%` }}
              />
            ))}

            {/* Live spectrum bars */}
            <div className="absolute inset-0 flex items-end gap-0.5 px-1.5 py-1 pointer-events-none">
              {waveformBars.map((val, idx) => (
                <div
                  key={idx}
                  className="flex-1 rounded-t-xs transition-[height] duration-75"
                  style={{
                    height: `${Math.max(10, val * 92)}%`,
                    backgroundColor:
                      idx / waveformBars.length <= currentTime / Math.max(1, durationSec)
                        ? '#EF4444'
                        : '#3F3F46',
                  }}
                />
              ))}
            </div>

            {/* Playhead line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-[#F59E0B] pointer-events-none"
              style={{
                left: `${Math.min(100, Math.max(0, (currentTime / Math.max(1, durationSec)) * 100))}%`,
              }}
            />
          </div>
        </div>

        {/* Transport Controls Row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onTogglePlay}
              disabled={isExporting}
              className="px-4 py-2 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Jeda</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Putar Video</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onRestart}
              disabled={isExporting}
              title="Ulang dari awal"
              className="p-2 rounded-lg bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-[#D4D4D8] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <div className="ml-2 font-mono text-xs text-[#E4E4E7] tabular-nums whitespace-nowrap">
              {formatTimecode(currentTime)}{' '}
              <span className="text-[#71717A]">/ {formatTimecode(durationSec)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-[#A1A1AA] font-mono tabular-nums whitespace-nowrap">
              {studioMode === 'code-lyric' ? 'Code-Lyric' : 'Teks-Video'} · {bpm} BPM
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleMute}
                aria-label={muted ? 'Aktifkan suara' : 'Bisukan suara'}
                className="p-1.5 rounded-md text-[#A1A1AA] hover:text-white transition-colors cursor-pointer"
              >
                {muted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-[#EF4444]" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => onChangeVolume(Number(e.target.value))}
                aria-label="Volume audio"
                className="w-20 accent-[#EF4444] cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

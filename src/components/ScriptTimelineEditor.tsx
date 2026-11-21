import React, { useState } from 'react';
import {
  Loader2,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  CodeLyricLine,
  GenerativeMusicScore,
  LineEffect,
  StudioMode,
  SynthStyle,
  TextScene,
  VideoStyleConfig,
} from '../types/studio';

interface ScriptTimelineEditorProps {
  studioMode: StudioMode;
  rawScriptInput: string;
  onChangeRawScriptInput: (text: string) => void;
  onGenerateAIScript: () => void;
  onQuickConvertLyrics: () => void;
  isGeneratingAI: boolean;
  codeLines: CodeLyricLine[];
  onChangeCodeLines: (lines: CodeLyricLine[]) => void;
  textScenes: TextScene[];
  onChangeTextScenes: (scenes: TextScene[]) => void;
  styleConfig: VideoStyleConfig;
  onUpdateStyle: (patch: Partial<VideoStyleConfig>) => void;
  generativeScore: GenerativeMusicScore;
  onUpdateGenerativeScore: (patch: Partial<GenerativeMusicScore>) => void;
  currentTime: number;
  onSeekToLine: (timeSec: number) => void;
}

export const ScriptTimelineEditor: React.FC<ScriptTimelineEditorProps> = ({
  studioMode,
  rawScriptInput,
  onChangeRawScriptInput,
  onGenerateAIScript,
  onQuickConvertLyrics,
  isGeneratingAI,
  codeLines,
  onChangeCodeLines,
  textScenes,
  onChangeTextScenes,
  styleConfig,
  onUpdateStyle,
  generativeScore,
  onUpdateGenerativeScore,
  currentTime,
  onSeekToLine,
}) => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'style'>('timeline');

  const updateCodeLine = (id: string, patch: Partial<CodeLyricLine>) => {
    onChangeCodeLines(
      codeLines.map((line) => (line.id === id ? { ...line, ...patch } : line))
    );
  };

  const addCodeLine = () => {
    const last = codeLines[codeLines.length - 1];
    const nextStart = last ? Number((last.endTime + 0.2).toFixed(1)) : 0.5;
    const nextLine: CodeLyricLine = {
      id: `line-${Date.now()}`,
      lineNumber: codeLines.length + 1,
      code: '  // baris lirik baru',
      startTime: nextStart,
      endTime: Number((nextStart + 2.8).toFixed(1)),
      effect: 'normal',
      beatAccent: false,
    };
    onChangeCodeLines([...codeLines, nextLine]);
  };

  const deleteCodeLine = (id: string) => {
    const filtered = codeLines
      .filter((l) => l.id !== id)
      .map((l, idx) => ({ ...l, lineNumber: idx + 1 }));
    onChangeCodeLines(filtered);
  };

  const updateTextScene = (id: string, patch: Partial<TextScene>) => {
    onChangeTextScenes(
      textScenes.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  };

  const addTextScene = () => {
    const last = textScenes[textScenes.length - 1];
    const nextStart = last ? Number((last.endTime + 0.2).toFixed(1)) : 0.5;
    const nextScene: TextScene = {
      id: `scene-${Date.now()}`,
      headline: 'Pesan baru untuk adegan ini.',
      subtext: 'Tambahkan narasi singkat yang mengikuti irama.',
      startTime: nextStart,
      endTime: Number((nextStart + 4.0).toFixed(1)),
      emphasisWords: ['baru'],
      beatAccent: true,
    };
    onChangeTextScenes([...textScenes, nextScene]);
  };

  const deleteTextScene = (id: string) => {
    onChangeTextScenes(textScenes.filter((s) => s.id !== id));
  };

  return (
    <aside className="flex flex-col h-full bg-[#111114] border-l border-[#27272A] min-h-0">
      {/* AI Script / Lyrics Input & Generator */}
      <div className="p-4 border-b border-[#27272A] space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-white">
            {studioMode === 'code-lyric'
              ? 'Lirik Lagu -> Kode Lirik JS'
              : 'Editor Teks ke Video AI'}
          </h2>
          <span className="text-[11px] font-mono text-[#71717A] tabular-nums">
            {studioMode === 'code-lyric'
              ? `${codeLines.length} baris`
              : `${textScenes.length} adegan`}
          </span>
        </div>

        <textarea
          value={rawScriptInput}
          onChange={(e) => onChangeRawScriptInput(e.target.value)}
          rows={4}
          placeholder={
            studioMode === 'code-lyric'
              ? 'Masukkan lirik lagu di sini — AI akan mengubah kata-kata lirik menjadi kode bergaya JavaScript...'
              : 'Tulis naskah, kutipan, atau hook konten media sosial Anda di sini...'
          }
          className="w-full p-3 bg-[#18181B] border border-[#27272A] focus:border-[#EF4444] rounded-lg text-xs text-[#F4F4F5] placeholder:text-[#71717A] leading-relaxed outline-none resize-none transition-colors"
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onGenerateAIScript}
            disabled={isGeneratingAI}
            className="flex-1 py-2.5 px-3 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
          >
            {isGeneratingAI ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Menyusun Kode Lirik...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>
                  {studioMode === 'code-lyric'
                    ? 'Ubah Lirik ke Kode JS (AI)'
                    : 'Generate Adegan Teks AI'}
                </span>
              </>
            )}
          </button>

          {studioMode === 'code-lyric' && (
            <button
              type="button"
              onClick={onQuickConvertLyrics}
              disabled={isGeneratingAI || !rawScriptInput.trim()}
              title="Ubah langsung lirik di atas menjadi sintaks JS tanpa menunggu AI"
              className="py-2.5 px-3 rounded-lg bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-xs font-medium text-[#E4E4E7] transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              Format Instan
            </button>
          )}
        </div>
      </div>

      {/* Inspector Tabs */}
      <div className="px-4 pt-3 border-b border-[#27272A] flex items-center gap-5 text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('timeline')}
          className={`pb-2.5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'timeline'
              ? 'border-[#EF4444] text-white'
              : 'border-transparent text-[#71717A] hover:text-[#D4D4D8]'
          }`}
        >
          {studioMode === 'code-lyric' ? 'Timeline Baris Kode' : 'Timeline Adegan Teks'}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('style')}
          className={`pb-2.5 border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'style'
              ? 'border-[#EF4444] text-white'
              : 'border-transparent text-[#71717A] hover:text-[#D4D4D8]'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Visual & Audio</span>
        </button>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {activeTab === 'timeline' ? (
          studioMode === 'code-lyric' ? (
            <>
              {codeLines.map((line) => {
                const isActive =
                  currentTime >= line.startTime && currentTime <= line.endTime;
                return (
                  <div
                    key={line.id}
                    className={`p-3 rounded-lg border transition-colors space-y-2.5 ${
                      isActive
                        ? 'bg-[#18181B] border-[#EF4444]/70'
                        : 'bg-[#141418] border-[#27272A]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onSeekToLine(line.startTime)}
                        className="font-mono text-[11px] text-[#A1A1AA] hover:text-white tabular-nums cursor-pointer"
                      >
                        Baris {String(line.lineNumber).padStart(2, '0')} · Lompat ke{' '}
                        {line.startTime.toFixed(1)}d
                      </button>

                      <div className="flex items-center gap-1.5">
                        <select
                          value={line.effect}
                          onChange={(e) =>
                            updateCodeLine(line.id, {
                              effect: e.target.value as LineEffect,
                            })
                          }
                          aria-label="Efek visual baris"
                          className="bg-[#18181B] border border-[#27272A] rounded px-2 py-0.5 text-[11px] text-[#E4E4E7] outline-none cursor-pointer"
                        >
                          <option value="normal">Normal</option>
                          <option value="echo">Echo Gema</option>
                          <option value="drop">Beat Drop</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => deleteCodeLine(line.id)}
                          aria-label="Hapus baris"
                          className="p-1 text-[#71717A] hover:text-[#EF4444] transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      value={line.code}
                      onChange={(e) =>
                        updateCodeLine(line.id, { code: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 bg-[#09090B] border border-[#27272A] focus:border-[#F59E0B] rounded font-mono text-xs text-[#F4F4F5] outline-none"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center justify-between px-2 py-1 bg-[#09090B] border border-[#27272A] rounded text-[11px] text-[#A1A1AA]">
                        <span>Mulai (d)</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="60"
                          value={line.startTime}
                          onChange={(e) =>
                            updateCodeLine(line.id, {
                              startTime: Math.max(0, Number(e.target.value)),
                            })
                          }
                          className="w-14 bg-transparent text-right font-mono text-white tabular-nums outline-none"
                        />
                      </label>
                      <label className="flex items-center justify-between px-2 py-1 bg-[#09090B] border border-[#27272A] rounded text-[11px] text-[#A1A1AA]">
                        <span>Selesai (d)</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0.2"
                          max="60"
                          value={line.endTime}
                          onChange={(e) =>
                            updateCodeLine(line.id, {
                              endTime: Math.max(
                                line.startTime + 0.2,
                                Number(e.target.value)
                              ),
                            })
                          }
                          className="w-14 bg-transparent text-right font-mono text-white tabular-nums outline-none"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={addCodeLine}
                className="w-full py-2 px-3 rounded-lg border border-dashed border-[#3F3F46] hover:border-[#71717A] text-xs font-medium text-[#A1A1AA] hover:text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Baris Kode</span>
              </button>
            </>
          ) : (
            <>
              {textScenes.map((scene, idx) => {
                const isActive =
                  currentTime >= scene.startTime && currentTime <= scene.endTime;
                return (
                  <div
                    key={scene.id}
                    className={`p-3 rounded-lg border transition-colors space-y-2.5 ${
                      isActive
                        ? 'bg-[#18181B] border-[#EF4444]/70'
                        : 'bg-[#141418] border-[#27272A]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onSeekToLine(scene.startTime)}
                        className="font-mono text-[11px] text-[#A1A1AA] hover:text-white tabular-nums cursor-pointer"
                      >
                        Adegan {String(idx + 1).padStart(2, '0')} ·{' '}
                        {scene.startTime.toFixed(1)}d
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteTextScene(scene.id)}
                        aria-label="Hapus adegan"
                        className="p-1 text-[#71717A] hover:text-[#EF4444] transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <input
                      type="text"
                      value={scene.headline}
                      onChange={(e) =>
                        updateTextScene(scene.id, { headline: e.target.value })
                      }
                      placeholder="Judul utama adegan..."
                      className="w-full px-2.5 py-1.5 bg-[#09090B] border border-[#27272A] focus:border-[#F59E0B] rounded text-xs font-medium text-white outline-none"
                    />

                    <input
                      type="text"
                      value={scene.subtext}
                      onChange={(e) =>
                        updateTextScene(scene.id, { subtext: e.target.value })
                      }
                      placeholder="Subteks pendukung..."
                      className="w-full px-2.5 py-1.5 bg-[#09090B] border border-[#27272A] focus:border-[#F59E0B] rounded text-xs text-[#D4D4D8] outline-none"
                    />

                    <input
                      type="text"
                      value={scene.emphasisWords.join(', ')}
                      onChange={(e) =>
                        updateTextScene(scene.id, {
                          emphasisWords: e.target.value
                            .split(',')
                            .map((w) => w.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="Kata sorotan (pisahkan koma)..."
                      className="w-full px-2.5 py-1.5 bg-[#09090B] border border-[#27272A] rounded text-[11px] text-[#F59E0B] outline-none"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center justify-between px-2 py-1 bg-[#09090B] border border-[#27272A] rounded text-[11px] text-[#A1A1AA]">
                        <span>Mulai (d)</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="60"
                          value={scene.startTime}
                          onChange={(e) =>
                            updateTextScene(scene.id, {
                              startTime: Math.max(0, Number(e.target.value)),
                            })
                          }
                          className="w-14 bg-transparent text-right font-mono text-white tabular-nums outline-none"
                        />
                      </label>
                      <label className="flex items-center justify-between px-2 py-1 bg-[#09090B] border border-[#27272A] rounded text-[11px] text-[#A1A1AA]">
                        <span>Selesai (d)</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0.2"
                          max="60"
                          value={scene.endTime}
                          onChange={(e) =>
                            updateTextScene(scene.id, {
                              endTime: Math.max(
                                scene.startTime + 0.3,
                                Number(e.target.value)
                              ),
                            })
                          }
                          className="w-14 bg-transparent text-right font-mono text-white tabular-nums outline-none"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={addTextScene}
                className="w-full py-2 px-3 rounded-lg border border-dashed border-[#3F3F46] hover:border-[#71717A] text-xs font-medium text-[#A1A1AA] hover:text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Adegan Teks</span>
              </button>
            </>
          )
        ) : (
          /* Visual & Audio Controls Tab */
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="text-xs font-semibold text-white">
                Identitas & Tampilan Video
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs text-[#A1A1AA]">Watermark / Handle Kreator</span>
                <input
                  type="text"
                  value={styleConfig.watermarkHandle}
                  onChange={(e) =>
                    onUpdateStyle({ watermarkHandle: e.target.value })
                  }
                  placeholder="@kodeklip.studio"
                  className="w-full px-3 py-2 bg-[#18181B] border border-[#27272A] focus:border-[#EF4444] rounded-lg font-mono text-xs text-white outline-none"
                />
              </label>

              <label className="flex items-center justify-between py-2 border-b border-[#27272A] cursor-pointer">
                <span className="text-xs text-[#E4E4E7]">Tampilkan Nomor Baris (01, 02)</span>
                <input
                  type="checkbox"
                  checked={styleConfig.showLineNumbers}
                  onChange={(e) =>
                    onUpdateStyle({ showLineNumbers: e.target.checked })
                  }
                  className="accent-[#EF4444] w-4 h-4 cursor-pointer"
                />
              </label>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-semibold text-white">
                Sinkronisasi Ketukan & Kamera
              </div>

              <label className="block space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#A1A1AA]">Intensitas Cahaya Beat</span>
                  <span className="font-mono text-white tabular-nums">
                    {Math.round(styleConfig.glowIntensity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1.5}
                  step={0.05}
                  value={styleConfig.glowIntensity}
                  onChange={(e) =>
                    onUpdateStyle({ glowIntensity: Number(e.target.value) })
                  }
                  className="w-full accent-[#EF4444] cursor-pointer"
                />
              </label>

              <label className="block space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#A1A1AA]">Dinamika Kamera 3D</span>
                  <span className="font-mono text-white tabular-nums">
                    {Math.round(styleConfig.cameraDynamics * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1.5}
                  step={0.05}
                  value={styleConfig.cameraDynamics}
                  onChange={(e) =>
                    onUpdateStyle({ cameraDynamics: Number(e.target.value) })
                  }
                  className="w-full accent-[#EF4444] cursor-pointer"
                />
              </label>

              <label className="block space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#A1A1AA]">Kecepatan Ketik Kursor</span>
                  <span className="font-mono text-white tabular-nums">
                    {styleConfig.typingSpeedFactor.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min={0.6}
                  max={1.6}
                  step={0.05}
                  value={styleConfig.typingSpeedFactor}
                  onChange={(e) =>
                    onUpdateStyle({ typingSpeedFactor: Number(e.target.value) })
                  }
                  className="w-full accent-[#EF4444] cursor-pointer"
                />
              </label>
            </div>

            <div className="space-y-3 pt-2 border-t border-[#27272A]">
              <div className="text-xs font-semibold text-white">
                Pengaturan Musik AI Beat
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs text-[#A1A1AA]">Instrumen Sintesis</span>
                <select
                  value={generativeScore.synthStyle}
                  onChange={(e) =>
                    onUpdateGenerativeScore({
                      synthStyle: e.target.value as SynthStyle,
                    })
                  }
                  className="w-full px-3 py-2 bg-[#18181B] border border-[#27272A] rounded-lg text-xs text-white outline-none cursor-pointer"
                >
                  <option value="lofi-piano">Lo-Fi Rhodes Piano (Hangat & Intim)</option>
                  <option value="midnight-synth">Midnight Synthwave (Neon & Atmosferik)</option>
                  <option value="indie-pluck">Indie Pluck Guitar (Melankolis)</option>
                  <option value="dark-bass">Dark Sub-Bass Pulse (Dramatis)</option>
                </select>
              </label>

              <label className="block space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#A1A1AA]">Tempo Ketukan (BPM)</span>
                  <span className="font-mono text-white tabular-nums">
                    {generativeScore.bpm} BPM
                  </span>
                </div>
                <input
                  type="range"
                  min={65}
                  max={155}
                  step={1}
                  value={generativeScore.bpm}
                  onChange={(e) =>
                    onUpdateGenerativeScore({ bpm: Number(e.target.value) })
                  }
                  className="w-full accent-[#F59E0B] cursor-pointer"
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

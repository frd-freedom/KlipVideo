import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Download, X } from 'lucide-react';
import { BeatSyncAudioEngine } from './audio/BeatSyncAudioEngine';
import { MusicLibraryPanel } from './components/MusicLibraryPanel';
import { ReferenceVideoModal } from './components/ReferenceVideoModal';
import { ScriptTimelineEditor } from './components/ScriptTimelineEditor';
import { VideoPreviewStage } from './components/VideoPreviewStage';
import {
  DEFAULT_CODE_LINES,
  DEFAULT_GENERATIVE_SCORE,
  DEFAULT_SONG,
  DEFAULT_TEXT_SCENES,
  SEED_CODE_PRESETS,
} from './data/defaultTemplates';
import {
  convertLyricsToJsCodeLines,
  convertTextToScenes,
} from './utils/lyricsToJsCode';
import type {
  AudioSourceMode,
  CodeLyricLine,
  GenerativeMusicScore,
  GroundingSource,
  SongItem,
  StudioMode,
  TextScene,
  VideoStyleConfig,
} from './types/studio';
import {
  CodeLyricCanvasRenderer,
  getCanvasResolution,
} from './video/CodeLyricCanvasRenderer';

export default function App() {
  const [studioMode, setStudioMode] = useState<StudioMode>('code-lyric');
  const [trendingSongs, setTrendingSongs] = useState<SongItem[]>([DEFAULT_SONG]);
  const [searchResults, setSearchResults] = useState<SongItem[]>([]);
  const [isLoadingTrending, setIsLoadingTrending] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  const [selectedSong, setSelectedSong] = useState<SongItem>(DEFAULT_SONG);
  const [audioSourceMode, setAudioSourceMode] = useState<AudioSourceMode>('generative');
  const [generativeScore, setGenerativeScore] =
    useState<GenerativeMusicScore>(DEFAULT_GENERATIVE_SCORE);

  const [codeLines, setCodeLines] = useState<CodeLyricLine[]>(DEFAULT_CODE_LINES);
  const [textScenes, setTextScenes] = useState<TextScene[]>(DEFAULT_TEXT_SCENES);
  const [rawScriptInput, setRawScriptInput] = useState<string>(
    DEFAULT_SONG.sampleLyrics ?? ''
  );

  const [lyricSources, setLyricSources] = useState<GroundingSource[]>([]);
  const [isFetchingLyrics, setIsFetchingLyrics] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const [styleConfig, setStyleConfig] = useState<VideoStyleConfig>({
    preset: 'codin-noir',
    aspectRatio: '9:16',
    showLineNumbers: true,
    watermarkHandle: '@kodeklip.studio',
    glowIntensity: 1.0,
    cameraDynamics: 1.0,
    typingSpeedFactor: 1.0,
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [previewPlayingId, setPreviewPlayingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [durationSec] = useState(30);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [waveformBars, setWaveformBars] = useState<number[]>(() =>
    Array.from({ length: 32 }, () => 0.12)
  );

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isReferenceModalOpen, setIsReferenceModalOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioEngineRef = useRef<BeatSyncAudioEngine | null>(null);
  const rendererRef = useRef<CodeLyricCanvasRenderer | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Refs synced for 60fps requestAnimationFrame loop
  const stateRef = useRef({
    studioMode,
    codeLines,
    textScenes,
    styleConfig,
    isPlaying,
    currentTime,
    durationSec,
    selectedSong,
    isExporting,
  });

  stateRef.current = {
    studioMode,
    codeLines,
    textScenes,
    styleConfig,
    isPlaying,
    currentTime,
    durationSec,
    selectedSong,
    isExporting,
  };

  if (!audioEngineRef.current) {
    audioEngineRef.current = new BeatSyncAudioEngine(DEFAULT_GENERATIVE_SCORE);
  }
  if (!rendererRef.current) {
    rendererRef.current = new CodeLyricCanvasRenderer();
  }

  // Load trending songs on mount
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/music/trending');
        if (!res.ok) throw new Error('Gagal memuat lagu populer');
        const data = (await res.json()) as { tracks?: SongItem[] };
        if (active && Array.isArray(data.tracks) && data.tracks.length > 0) {
          setTrendingSongs(data.tracks);
          const first = data.tracks[0];
          setSelectedSong(first);
          if (first.previewUrl) {
            const loaded = await audioEngineRef.current?.loadPreviewUrl(first.previewUrl);
            if (active && loaded) {
              setAudioSourceMode('preview');
            }
          }
        }
      } catch {
        // Keep default fallback song
      } finally {
        if (active) setIsLoadingTrending(false);
      }
    })();

    return () => {
      active = false;
      audioEngineRef.current?.dispose();
    };
  }, []);

  // Sync generative score & duration into audio engine
  useEffect(() => {
    audioEngineRef.current?.setScore(generativeScore);
  }, [generativeScore]);

  useEffect(() => {
    audioEngineRef.current?.setDuration(durationSec);
  }, [durationSec]);

  // Keep canvas intrinsic resolution matched to aspect ratio
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = getCanvasResolution(styleConfig.aspectRatio);
    canvas.width = width;
    canvas.height = height;
  }, [styleConfig.aspectRatio]);

  // 60fps Canvas & Audio Beat-Sync Loop
  useEffect(() => {
    let rafId = 0;
    let lastUiSync = 0;

    const tick = (now: number) => {
      const s = stateRef.current;
      const engine = audioEngineRef.current;
      const renderer = rendererRef.current;
      const canvas = canvasRef.current;

      let playhead = s.currentTime;
      if (s.isPlaying && engine) {
        playhead = engine.getCurrentTime();
        if (playhead >= s.durationSec) {
          if (s.isExporting && mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
            engine.pause();
            setIsPlaying(false);
            playhead = s.durationSec;
          } else {
            // Loop cleanly
            playhead = 0;
            engine.seek(0);
            renderer?.resetCamera();
          }
        }
      }

      const metrics = engine
        ? engine.getMetrics(playhead)
        : {
            bassEnergy: 0.08,
            midEnergy: 0.06,
            highEnergy: 0.04,
            isBeatHit: false,
            beatPhase: 0,
            waveformBars: Array.from({ length: 32 }, () => 0.1),
          };

      if (canvas && renderer) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderer.renderFrame({
            ctx,
            width: canvas.width,
            height: canvas.height,
            currentTime: playhead,
            durationSec: s.durationSec,
            mode: s.studioMode,
            lines: s.codeLines,
            scenes: s.textScenes,
            style: s.styleConfig,
            metrics,
            songTitle: s.selectedSong.title,
            songArtist: s.selectedSong.artist,
          });
        }
      }

      if (now - lastUiSync > 50) {
        lastUiSync = now;
        if (s.isPlaying) {
          setCurrentTime(playhead);
        }
        if (s.isExporting) {
          setExportProgress(Math.min(1, playhead / Math.max(1, s.durationSec)));
        }
        setWaveformBars(metrics.waveformBars);
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  const handleTogglePlay = useCallback(async () => {
    const engine = audioEngineRef.current;
    if (!engine) return;

    if (isPlaying) {
      engine.pause();
      setIsPlaying(false);
      setPreviewPlayingId(null);
    } else {
      const startFrom = currentTime >= durationSec - 0.2 ? 0 : currentTime;
      if (startFrom === 0) {
        setCurrentTime(0);
        rendererRef.current?.resetCamera();
      }
      const effectiveMode: AudioSourceMode =
        audioSourceMode === 'preview' && selectedSong.previewUrl
          ? 'preview'
          : 'generative';
      await engine.start(effectiveMode, startFrom);
      setIsPlaying(true);
      setPreviewPlayingId(selectedSong.id);
    }
  }, [audioSourceMode, currentTime, durationSec, isPlaying, selectedSong]);

  const handleRestart = useCallback(async () => {
    const engine = audioEngineRef.current;
    if (!engine) return;
    rendererRef.current?.resetCamera();
    setCurrentTime(0);
    engine.seek(0);
    if (isPlaying) {
      const effectiveMode: AudioSourceMode =
        audioSourceMode === 'preview' && selectedSong.previewUrl
          ? 'preview'
          : 'generative';
      await engine.start(effectiveMode, 0);
    }
  }, [audioSourceMode, isPlaying, selectedSong]);

  const handleSeek = useCallback((timeSec: number) => {
    const clamped = Math.max(0, Math.min(durationSec, timeSec));
    setCurrentTime(clamped);
    audioEngineRef.current?.seek(clamped);
  }, [durationSec]);

  const convertLyricsWithAI = useCallback(
    async (song: SongItem, lyricsText: string, modeOverride?: StudioMode) => {
      const targetMode = modeOverride ?? studioMode;
      setIsGeneratingAI(true);
      try {
        const res = await fetch('/api/ai/generate-script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: targetMode,
            title: song.title,
            artist: song.artist,
            lyricsOrText: lyricsText,
            bpm: song.bpm || generativeScore.bpm,
            mood: song.mood || generativeScore.mood,
            durationSec,
          }),
        });
        const data = (await res.json()) as {
          lines?: CodeLyricLine[];
          scenes?: TextScene[];
          generativeScore?: GenerativeMusicScore;
          quotaExceeded?: boolean;
          error?: string;
        };

        if (!res.ok) {
          if (res.status === 429 || data.quotaExceeded) {
            if (targetMode === 'code-lyric' && lyricsText.trim()) {
              setCodeLines(convertLyricsToJsCodeLines(lyricsText, durationSec));
            } else if (targetMode === 'text-to-video' && lyricsText.trim()) {
              setTextScenes(convertTextToScenes(lyricsText, durationSec));
            }
            return;
          }
          throw new Error(data.error ?? 'Gagal membuat kode lirik AI.');
        }

        if (targetMode === 'code-lyric' && Array.isArray(data.lines) && data.lines.length > 0) {
          setCodeLines(data.lines);
        } else if (
          targetMode === 'text-to-video' &&
          Array.isArray(data.scenes) &&
          data.scenes.length > 0
        ) {
          setTextScenes(data.scenes);
        }
        if (data.generativeScore) {
          setGenerativeScore(data.generativeScore);
        }
      } catch (err) {
        if (targetMode === 'code-lyric' && lyricsText.trim()) {
          setCodeLines(convertLyricsToJsCodeLines(lyricsText, durationSec));
        } else if (targetMode === 'text-to-video' && lyricsText.trim()) {
          setTextScenes(convertTextToScenes(lyricsText, durationSec));
        }
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Gagal menyusun kode lirik dengan AI.'
        );
      } finally {
        setIsGeneratingAI(false);
      }
    },
    [durationSec, generativeScore.bpm, generativeScore.mood, studioMode]
  );

  const handleFetchLyrics = useCallback(
    async (song: SongItem, autoConvertToJs = true) => {
      setIsFetchingLyrics(true);
      setErrorMsg(null);
      try {
        const res = await fetch('/api/music/lyrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: song.title, artist: song.artist }),
        });
        const data = (await res.json()) as {
          lyrics?: string;
          bpm?: number;
          mood?: string;
          sources?: GroundingSource[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? 'Gagal mencari lirik lagu.');

        const fetchedLyrics = data.lyrics ?? '';
        if (fetchedLyrics) {
          setRawScriptInput(fetchedLyrics);
        }

        const updatedSong: SongItem = {
          ...song,
          bpm: data.bpm ?? song.bpm,
          mood: data.mood ?? song.mood,
        };

        if (data.bpm || data.mood) {
          setSelectedSong((prev) =>
            prev.id === song.id
              ? {
                  ...prev,
                  bpm: data.bpm ?? prev.bpm,
                  mood: data.mood ?? prev.mood,
                }
              : prev
          );
          setGenerativeScore((prev) => ({
            ...prev,
            bpm: data.bpm ?? prev.bpm,
            mood: data.mood ?? prev.mood,
          }));
        }
        setLyricSources(data.sources ?? []);

        if (autoConvertToJs && fetchedLyrics) {
          // Immediately show instant JS lyric code while AI refines it
          if (studioMode === 'code-lyric') {
            setCodeLines(convertLyricsToJsCodeLines(fetchedLyrics, durationSec));
          }
          await convertLyricsWithAI(updatedSong, fetchedLyrics);
        }
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : 'Gagal mengambil lirik lagu.'
        );
      } finally {
        setIsFetchingLyrics(false);
      }
    },
    [convertLyricsWithAI, durationSec, studioMode]
  );

  const handleSelectSong = useCallback(
    async (song: SongItem) => {
      setSelectedSong(song);
      setLyricSources([]);
      setGenerativeScore((prev) => ({
        ...prev,
        bpm: song.bpm || prev.bpm,
        mood: song.mood || prev.mood,
        genre: song.genre || prev.genre,
      }));

      if (song.previewUrl) {
        const loaded = await audioEngineRef.current?.loadPreviewUrl(song.previewUrl);
        if (loaded) {
          setAudioSourceMode('preview');
        }
      } else {
        setAudioSourceMode('generative');
      }

      if (studioMode === 'code-lyric') {
        const preset = SEED_CODE_PRESETS[song.id];
        if (preset) {
          setCodeLines(preset);
          setRawScriptInput(song.sampleLyrics ?? '');
          rendererRef.current?.resetCamera();
          setCurrentTime(0);
        } else if (song.sampleLyrics) {
          setRawScriptInput(song.sampleLyrics);
          setCodeLines(convertLyricsToJsCodeLines(song.sampleLyrics, durationSec));
          rendererRef.current?.resetCamera();
          setCurrentTime(0);
        } else {
          // Searched song without preset lyrics: fetch real lyrics and turn into JS lyric code
          setRawScriptInput(`Mencari lirik untuk "${song.title}" oleh ${song.artist}...`);
          void handleFetchLyrics(song, true);
        }
      }
    },
    [durationSec, handleFetchLyrics, studioMode]
  );

  const handleToggleSongPreview = useCallback(
    async (song: SongItem) => {
      const engine = audioEngineRef.current;
      if (!engine) return;

      if (previewPlayingId === song.id && isPlaying) {
        engine.pause();
        setIsPlaying(false);
        setPreviewPlayingId(null);
        return;
      }

      void handleSelectSong(song);
      rendererRef.current?.resetCamera();
      setCurrentTime(0);

      if (song.previewUrl) {
        const loaded = await engine.loadPreviewUrl(song.previewUrl);
        if (loaded) {
          setAudioSourceMode('preview');
          await engine.start('preview', 0);
          setIsPlaying(true);
          setPreviewPlayingId(song.id);
          return;
        }
      }

      setAudioSourceMode('generative');
      await engine.start('generative', 0);
      setIsPlaying(true);
      setPreviewPlayingId(song.id);
    },
    [handleSelectSong, isPlaying, previewPlayingId]
  );

  const handleChangeAudioSourceMode = useCallback(
    async (mode: AudioSourceMode) => {
      setAudioSourceMode(mode);
      if (isPlaying && audioEngineRef.current) {
        await audioEngineRef.current.start(mode, currentTime);
      }
    },
    [currentTime, isPlaying]
  );

  const handleSearchSongs = useCallback(async (q: string) => {
    setIsSearching(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { tracks?: SongItem[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Pencarian lagu gagal');
      setSearchResults(data.tracks ?? []);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mencari lagu.');
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleGenerateAIScript = useCallback(async () => {
    setIsGeneratingAI(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/ai/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: studioMode,
          title: selectedSong.title,
          artist: selectedSong.artist,
          lyricsOrText: rawScriptInput,
          bpm: generativeScore.bpm || selectedSong.bpm,
          mood: generativeScore.mood || selectedSong.mood,
          durationSec,
        }),
      });

      const data = (await res.json()) as {
        lines?: CodeLyricLine[];
        scenes?: TextScene[];
        generativeScore?: GenerativeMusicScore;
        quotaExceeded?: boolean;
        error?: string;
      };

      if (!res.ok) {
        if (res.status === 429 || data.quotaExceeded) {
          if (studioMode === 'code-lyric') {
            setCodeLines(convertLyricsToJsCodeLines(rawScriptInput, durationSec));
            if (styleConfig.preset === 'editorial-kinetic') {
              setStyleConfig((prev) => ({ ...prev, preset: 'codin-noir' }));
            }
          } else {
            setTextScenes(convertTextToScenes(rawScriptInput, durationSec));
          }
        } else {
          throw new Error(data.error ?? 'Gagal membuat skrip AI.');
        }
      } else {
        if (studioMode === 'code-lyric' && Array.isArray(data.lines) && data.lines.length > 0) {
          setCodeLines(data.lines);
          if (styleConfig.preset === 'editorial-kinetic') {
            setStyleConfig((prev) => ({ ...prev, preset: 'codin-noir' }));
          }
        } else if (
          studioMode === 'text-to-video' &&
          Array.isArray(data.scenes) &&
          data.scenes.length > 0
        ) {
          setTextScenes(data.scenes);
        }

        if (data.generativeScore) {
          setGenerativeScore(data.generativeScore);
        }
      }

      // Auto-play newly generated video from start
      rendererRef.current?.resetCamera();
      setCurrentTime(0);
      const effectiveMode: AudioSourceMode =
        audioSourceMode === 'preview' && selectedSong.previewUrl
          ? 'preview'
          : 'generative';
      await audioEngineRef.current?.start(effectiveMode, 0);
      setIsPlaying(true);
      setPreviewPlayingId(selectedSong.id);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat menghasilkan skrip AI.'
      );
    } finally {
      setIsGeneratingAI(false);
    }
  }, [
    audioSourceMode,
    durationSec,
    generativeScore.bpm,
    generativeScore.mood,
    rawScriptInput,
    selectedSong,
    studioMode,
    styleConfig.preset,
  ]);

  const handleQuickConvertLyrics = useCallback(() => {
    if (!rawScriptInput.trim()) return;
    const lines = convertLyricsToJsCodeLines(rawScriptInput, durationSec);
    setCodeLines(lines);
    if (styleConfig.preset === 'editorial-kinetic') {
      setStyleConfig((prev) => ({ ...prev, preset: 'codin-noir' }));
    }
    rendererRef.current?.resetCamera();
    setCurrentTime(0);
  }, [durationSec, rawScriptInput, styleConfig.preset]);

  const handleChangeStudioMode = useCallback((mode: StudioMode) => {
    setStudioMode(mode);
    if (mode === 'text-to-video') {
      setStyleConfig((prev) => ({ ...prev, preset: 'editorial-kinetic' }));
      setRawScriptInput((prev) =>
        prev === DEFAULT_SONG.sampleLyrics
          ? 'Terkadang diam bukan berarti kalah. Kita hanya sedang menyusun ulang logika agar tidak patah dua kali. Tutup tab masa lalu, jalankan versi barumu hari ini.'
          : prev
      );
    } else {
      setStyleConfig((prev) => ({
        ...prev,
        preset: prev.preset === 'editorial-kinetic' ? 'codin-noir' : prev.preset,
      }));
    }
  }, []);

  const handleApplyReferenceTemplate = useCallback(() => {
    setStudioMode('code-lyric');
    setSelectedSong((prev) => ({
      ...DEFAULT_SONG,
      previewUrl: prev.id === DEFAULT_SONG.id ? prev.previewUrl : null,
    }));
    setCodeLines(DEFAULT_CODE_LINES);
    setGenerativeScore(DEFAULT_GENERATIVE_SCORE);
    setRawScriptInput(DEFAULT_SONG.sampleLyrics ?? '');
    setStyleConfig({
      preset: 'codin-noir',
      aspectRatio: '9:16',
      showLineNumbers: true,
      watermarkHandle: '@kodeklip.studio',
      glowIntensity: 1.0,
      cameraDynamics: 1.0,
      typingSpeedFactor: 1.0,
    });
    rendererRef.current?.resetCamera();
    setCurrentTime(0);
  }, []);

  const handleExportVideo = useCallback(async () => {
    const canvas = canvasRef.current;
    const engine = audioEngineRef.current;
    if (!canvas || !engine || isExporting) return;

    if (typeof MediaRecorder === 'undefined') {
      setErrorMsg('Browser Anda tidak mendukung perekaman video MediaRecorder.');
      return;
    }

    setErrorMsg(null);
    setIsExporting(true);
    setExportProgress(0);

    try {
      const canvasStream = canvas.captureStream(60);
      const audioStream = engine.getExportAudioStream();
      const tracks = [...canvasStream.getVideoTracks()];
      if (audioStream) {
        tracks.push(...audioStream.getAudioTracks());
      }
      const combined = new MediaStream(tracks);

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';

      const recorder = new MediaRecorder(combined, {
        mimeType,
        videoBitsPerSecond: 6_000_000,
      });
      mediaRecorderRef.current = recorder;

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const safeName = (selectedSong.title || 'kodeklip-video')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-');
        a.href = url;
        a.download = `${safeName}-${styleConfig.aspectRatio.replace(':', 'x')}.webm`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setIsExporting(false);
        setExportProgress(0);
      };

      rendererRef.current?.resetCamera();
      setCurrentTime(0);
      const effectiveMode: AudioSourceMode =
        audioSourceMode === 'preview' && selectedSong.previewUrl
          ? 'preview'
          : 'generative';
      await engine.start(effectiveMode, 0);
      setIsPlaying(true);
      recorder.start(250);
    } catch (err) {
      setIsExporting(false);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Gagal mengekspor video. Coba putar preview terlebih dahulu.'
      );
    }
  }, [audioSourceMode, isExporting, selectedSong, styleConfig.aspectRatio]);

  return (
    <div className="min-h-screen lg:h-screen flex flex-col bg-[#09090B] text-[#F4F4F5] overflow-x-hidden lg:overflow-hidden">
      {/* Top Bar Contract: Exact 3 zones separated by gap-8 */}
      <header className="h-14 px-6 border-b border-[#27272A] bg-[#0D0D10] flex items-center justify-between gap-8 shrink-0">
        <a
          href="#studio"
          className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          Kodeklip
        </a>

        <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-[#A1A1AA]">
          <button
            type="button"
            onClick={() => handleChangeStudioMode('code-lyric')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              studioMode === 'code-lyric'
                ? 'text-white underline decoration-[#EF4444] decoration-2 underline-offset-8'
                : ''
            }`}
          >
            Video Musik Kode
          </button>
          <button
            type="button"
            onClick={() => handleChangeStudioMode('text-to-video')}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              studioMode === 'text-to-video'
                ? 'text-white underline decoration-[#EF4444] decoration-2 underline-offset-8'
                : ''
            }`}
          >
            Teks ke Video
          </button>
          <button
            type="button"
            onClick={() => setIsReferenceModalOpen(true)}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Gaya Referensi
          </button>
          <button
            type="button"
            onClick={handleApplyReferenceTemplate}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Reset Template
          </button>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handleExportVideo}
            disabled={isExporting}
            className="px-4 py-2 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Mengekspor...' : 'Ekspor Video'}</span>
          </button>
        </div>
      </header>

      {/* Inline Dismissible Error Banner */}
      {errorMsg && (
        <div className="px-6 py-2.5 bg-[#EF4444]/10 border-b border-[#EF4444]/30 flex items-center justify-between gap-4 text-xs text-[#FCA5A5]">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            aria-label="Tutup pesan kesalahan"
            className="p-1 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main 3-Pane Studio Workspace */}
      <main
        id="studio"
        className="flex-1 grid grid-cols-1 lg:grid-cols-[350px_1fr_370px] min-h-0"
      >
        <MusicLibraryPanel
          studioMode={studioMode}
          onChangeStudioMode={handleChangeStudioMode}
          trendingSongs={trendingSongs}
          searchResults={searchResults}
          isLoadingTrending={isLoadingTrending}
          isSearching={isSearching}
          selectedSong={selectedSong}
          onSelectSong={handleSelectSong}
          onSearchSongs={handleSearchSongs}
          previewPlayingId={previewPlayingId}
          onToggleSongPreview={handleToggleSongPreview}
          audioSourceMode={audioSourceMode}
          onChangeAudioSourceMode={handleChangeAudioSourceMode}
          generativeScore={generativeScore}
          onFetchLyrics={handleFetchLyrics}
          isFetchingLyrics={isFetchingLyrics}
          lyricSources={lyricSources}
          onOpenReferenceModal={() => setIsReferenceModalOpen(true)}
        />

        <VideoPreviewStage
          canvasRef={canvasRef}
          studioMode={studioMode}
          styleConfig={styleConfig}
          onUpdateStyle={(patch) =>
            setStyleConfig((prev) => ({ ...prev, ...patch }))
          }
          isPlaying={isPlaying}
          isExporting={isExporting}
          exportProgress={exportProgress}
          currentTime={currentTime}
          durationSec={durationSec}
          bpm={
            audioSourceMode === 'generative'
              ? generativeScore.bpm
              : selectedSong.bpm
          }
          waveformBars={waveformBars}
          muted={muted}
          volume={volume}
          onTogglePlay={handleTogglePlay}
          onRestart={handleRestart}
          onSeek={handleSeek}
          onToggleMute={() => {
            const next = !muted;
            setMuted(next);
            audioEngineRef.current?.setMuted(next);
          }}
          onChangeVolume={(val) => {
            setVolume(val);
            setMuted(val === 0);
            audioEngineRef.current?.setMuted(val === 0);
            audioEngineRef.current?.setVolume(val);
          }}
        />

        <ScriptTimelineEditor
          studioMode={studioMode}
          rawScriptInput={rawScriptInput}
          onChangeRawScriptInput={setRawScriptInput}
          onGenerateAIScript={handleGenerateAIScript}
          onQuickConvertLyrics={handleQuickConvertLyrics}
          isGeneratingAI={isGeneratingAI}
          codeLines={codeLines}
          onChangeCodeLines={setCodeLines}
          textScenes={textScenes}
          onChangeTextScenes={setTextScenes}
          styleConfig={styleConfig}
          onUpdateStyle={(patch) =>
            setStyleConfig((prev) => ({ ...prev, ...patch }))
          }
          generativeScore={generativeScore}
          onUpdateGenerativeScore={(patch) =>
            setGenerativeScore((prev) => ({ ...prev, ...patch }))
          }
          currentTime={currentTime}
          onSeekToLine={handleSeek}
        />
      </main>

      <ReferenceVideoModal
        isOpen={isReferenceModalOpen}
        onClose={() => setIsReferenceModalOpen(false)}
        onApplyReferenceTemplate={handleApplyReferenceTemplate}
      />
    </div>
  );
}

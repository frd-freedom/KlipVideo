import React, { useState } from 'react';
import {
  Disc3,
  ExternalLink,
  Film,
  Loader2,
  Music,
  Pause,
  Play,
  Radio,
  Search,
  Sparkles,
  Wand2,
} from 'lucide-react';
import type {
  AudioSourceMode,
  GenerativeMusicScore,
  GroundingSource,
  SongItem,
  StudioMode,
} from '../types/studio';

interface MusicLibraryPanelProps {
  studioMode: StudioMode;
  onChangeStudioMode: (mode: StudioMode) => void;
  trendingSongs: SongItem[];
  searchResults: SongItem[];
  isLoadingTrending: boolean;
  isSearching: boolean;
  selectedSong: SongItem;
  onSelectSong: (song: SongItem) => void;
  onSearchSongs: (query: string) => void;
  previewPlayingId: string | null;
  onToggleSongPreview: (song: SongItem) => void;
  audioSourceMode: AudioSourceMode;
  onChangeAudioSourceMode: (mode: AudioSourceMode) => void;
  generativeScore: GenerativeMusicScore;
  onFetchLyrics: (song: SongItem) => void;
  isFetchingLyrics: boolean;
  lyricSources: GroundingSource[];
  onOpenReferenceModal: () => void;
}

function SongCover({ src, title }: { src: string; title: string }) {
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    return (
      <div className="w-11 h-11 rounded-md bg-gradient-to-br from-[#1F1F24] to-[#121215] border border-[#27272A] flex items-center justify-center shrink-0">
        <Disc3 className="w-5 h-5 text-[#71717A]" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`Sampul ${title}`}
      referrerPolicy="no-referrer"
      onError={() => setErrored(true)}
      className="w-11 h-11 rounded-md object-cover border border-[#27272A] shrink-0 bg-[#18181B]"
    />
  );
}

export const MusicLibraryPanel: React.FC<MusicLibraryPanelProps> = ({
  studioMode,
  onChangeStudioMode,
  trendingSongs,
  searchResults,
  isLoadingTrending,
  isSearching,
  selectedSong,
  onSelectSong,
  onSearchSongs,
  previewPlayingId,
  onToggleSongPreview,
  audioSourceMode,
  onChangeAudioSourceMode,
  generativeScore,
  onFetchLyrics,
  isFetchingLyrics,
  lyricSources,
  onOpenReferenceModal,
}) => {
  const [query, setQuery] = useState('');
  const [catalogTab, setCatalogTab] = useState<'trending' | 'search'>('trending');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setCatalogTab('search');
    onSearchSongs(query.trim());
  };

  const displayedSongs = catalogTab === 'search' ? searchResults : trendingSongs;
  const isListLoading = catalogTab === 'search' ? isSearching : isLoadingTrending;

  return (
    <aside className="flex flex-col h-full bg-[#111114] border-r border-[#27272A] min-h-0">
      {/* Studio Mode Segmented Selector */}
      <div className="p-4 border-b border-[#27272A]">
        <div className="grid grid-cols-2 gap-1 p-1 bg-[#18181B] rounded-lg border border-[#27272A]">
          <button
            type="button"
            onClick={() => onChangeStudioMode('code-lyric')}
            className={`px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              studioMode === 'code-lyric'
                ? 'bg-[#EF4444] text-white'
                : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            Video Musik Kode
          </button>
          <button
            type="button"
            onClick={() => onChangeStudioMode('text-to-video')}
            className={`px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              studioMode === 'text-to-video'
                ? 'bg-[#EF4444] text-white'
                : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            Teks ke Video
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenReferenceModal}
          className="mt-3 w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[#18181B] hover:bg-[#1E1E24] border border-[#27272A] text-xs text-[#D4D4D8] transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2 truncate">
            <Film className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
            <span className="truncate">Gaya Referensi (@codin.dev)</span>
          </span>
          <span className="text-[#A1A1AA] shrink-0 ml-2">Putar</span>
        </button>
      </div>

      {/* Selected Song & Preview Audio Mode */}
      <div className="p-4 border-b border-[#27272A] space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <SongCover src={selectedSong.coverUrl} title={selectedSong.title} />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">
                {selectedSong.title}
              </div>
              <div className="text-xs text-[#A1A1AA] truncate mt-0.5">
                {selectedSong.artist} · <span className="font-mono tabular-nums">{selectedSong.bpm} BPM</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onFetchLyrics(selectedSong)}
            disabled={isFetchingLyrics}
            title="Cari lirik & suasana lagu dengan AI"
            className="px-2.5 py-1.5 rounded-md bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-xs font-medium text-[#F4F4F5] flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isFetchingLyrics ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#F59E0B]" />
            ) : (
              <Wand2 className="w-3.5 h-3.5 text-[#F59E0B]" />
            )}
            <span>Cari Lirik</span>
          </button>
        </div>

        {/* Audio Source Switch: Real 30s Preview vs AI Generative Beat */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-[#18181B] rounded-lg border border-[#27272A]">
          <button
            type="button"
            onClick={() => onChangeAudioSourceMode('preview')}
            disabled={!selectedSong.previewUrl}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              audioSourceMode === 'preview'
                ? 'bg-[#27272A] text-white'
                : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span>Preview Lagu</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeAudioSourceMode('generative')}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              audioSourceMode === 'generative'
                ? 'bg-[#27272A] text-white'
                : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#EF4444]" />
            <span>Musik AI Beat</span>
          </button>
        </div>

        <div className="text-xs text-[#A1A1AA] leading-relaxed">
          {audioSourceMode === 'preview' && selectedSong.previewUrl ? (
            <span>Memutar cuplikan resmi 30 detik dengan deteksi ketukan real-time.</span>
          ) : (
            <span>
              Komposisi AI: <span className="text-[#E4E4E7]">{generativeScore.genre}</span> ·{' '}
              <span className="font-mono tabular-nums">{generativeScore.keySignature}</span> ·{' '}
              <span className="font-mono tabular-nums">{generativeScore.bpm} BPM</span>
            </span>
          )}
        </div>

        {lyricSources.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#71717A]">
            <span>Sumber lirik:</span>
            {lyricSources.map((src, idx) => (
              <a
                key={`${src.uri}-${idx}`}
                href={src.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#A1A1AA] hover:text-white underline decoration-[#3F3F46] underline-offset-2 truncate max-w-[140px]"
              >
                <span className="truncate">{src.title}</span>
                <ExternalLink className="w-2.5 h-2.5 shrink-0" />
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Search & Catalog Tabs */}
      <div className="p-4 pb-2 space-y-3">
        <form onSubmit={handleSubmit} className="relative">
          <Search className="w-4 h-4 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari judul lagu atau artis..."
            className="w-full pl-9 pr-16 py-2 bg-[#18181B] border border-[#27272A] focus:border-[#EF4444] rounded-lg text-xs text-white placeholder:text-[#71717A] outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-[#27272A] hover:bg-[#3F3F46] text-xs font-medium text-white rounded transition-colors disabled:opacity-40 cursor-pointer"
          >
            Cari
          </button>
        </form>

        <div className="flex items-center gap-4 border-b border-[#27272A] text-xs font-medium">
          <button
            type="button"
            onClick={() => setCatalogTab('trending')}
            className={`pb-2 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              catalogTab === 'trending'
                ? 'border-[#EF4444] text-white'
                : 'border-transparent text-[#71717A] hover:text-[#D4D4D8]'
            }`}
          >
            Lagu Terpopuler
          </button>
          <button
            type="button"
            onClick={() => setCatalogTab('search')}
            className={`pb-2 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              catalogTab === 'search'
                ? 'border-[#EF4444] text-white'
                : 'border-transparent text-[#71717A] hover:text-[#D4D4D8]'
            }`}
          >
            Hasil Pencarian{searchResults.length > 0 ? ` (${searchResults.length})` : ''}
          </button>
        </div>
      </div>

      {/* Song List */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
        {isListLoading ? (
          <div className="space-y-2 p-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-lg bg-[#18181B] border border-[#27272A]/60 animate-pulse"
              />
            ))}
          </div>
        ) : displayedSongs.length === 0 ? (
          <div className="py-10 px-4 text-center space-y-2">
            <Music className="w-7 h-7 text-[#52525B] mx-auto" />
            <p className="text-xs text-[#A1A1AA]">
              {catalogTab === 'search'
                ? 'Masukkan judul lagu atau nama artis di atas untuk mencari preview lagu.'
                : 'Belum ada lagu populer termuat.'}
            </p>
          </div>
        ) : (
          displayedSongs.map((song) => {
            const isSelected = song.id === selectedSong.id;
            const isPreviewPlaying = previewPlayingId === song.id;

            return (
              <div
                key={song.id}
                onClick={() => onSelectSong(song)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectSong(song);
                  }
                }}
                className={`group flex items-center justify-between gap-2.5 p-2.5 rounded-lg border transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#18181B] border-[#EF4444]/70'
                    : 'bg-transparent border-transparent hover:bg-[#18181B]/70 hover:border-[#27272A]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <SongCover src={song.coverUrl} title={song.title} />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#F4F4F5] truncate">
                      {song.title}
                    </div>
                    <div className="text-[11px] text-[#A1A1AA] truncate mt-0.5">
                      {song.artist}
                    </div>
                    <div className="text-[11px] text-[#71717A] truncate mt-0.5 font-mono tabular-nums">
                      {song.bpm} BPM · {song.previewUrl ? 'Preview 30d' : 'AI Synth'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSongPreview(song);
                  }}
                  title={
                    song.previewUrl
                      ? isPreviewPlaying
                        ? 'Jeda preview lagu'
                        : 'Putar preview lagu 30 detik'
                      : 'Putar beat AI untuk lagu ini'
                  }
                  className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 border transition-colors cursor-pointer ${
                    isPreviewPlaying
                      ? 'bg-[#EF4444] border-[#EF4444] text-white'
                      : 'bg-[#18181B] border-[#27272A] text-[#D4D4D8] hover:text-white hover:border-[#3F3F46]'
                  }`}
                >
                  {isPreviewPlaying ? (
                    <Pause className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5 ml-0.5" />
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};

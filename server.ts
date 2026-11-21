import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '4mb' }));

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY tidak ditemukan di environment server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface TrendingSeed {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  genre: string;
  mood: string;
  sampleLyrics: string;
}

const TRENDING_SEEDS: TrendingSeed[] = [
  {
    id: 'seed-billie-idontwannabeyou',
    title: 'idontwannabeyouanymore',
    artist: 'Billie Eilish',
    bpm: 84,
    genre: 'Alternative Pop',
    mood: 'Melancholic & Intimate',
    sampleLyrics:
      "If \"I love you\" was a promise\nWould you break it, if you're honest?\nTell the mirror what you know she's heard before\nI don't wanna be you anymore",
  },
  {
    id: 'seed-bernadya-satubulan',
    title: 'Satu Bulan',
    artist: 'Bernadya',
    bpm: 78,
    genre: 'Indonesian Indie Pop',
    mood: 'Heartbreak & Reflective',
    sampleLyrics:
      'Belum ada satu bulan\nKu yakin masih ada sisa wangiku di bajumu\nNamun kau tampak baik saja\nBahkan senyummu lebih lepas',
  },
  {
    id: 'seed-hindia-evaluasi',
    title: 'Evaluasi',
    artist: 'Hindia',
    bpm: 112,
    genre: 'Indonesian Indie Rock',
    mood: 'Cathartic & Hopeful',
    sampleLyrics:
      'Yang tak bisa kau ubah\nCukup kau terima dengan lapang dada\nSemua masalah yang ada\nPerlahan akan selesai pada waktunya',
  },
  {
    id: 'seed-joji-glimpse',
    title: 'Glimpse of Us',
    artist: 'Joji',
    bpm: 85,
    genre: 'Lo-Fi Ballad',
    mood: 'Nostalgic & Bittersweet',
    sampleLyrics:
      "Said I'm fine and said I moved on\nI'm only here passing time in her arms\nHoping I'll find a glimpse of us",
  },
  {
    id: 'seed-arctic-505',
    title: '505',
    artist: 'Arctic Monkeys',
    bpm: 140,
    genre: 'Indie Rock',
    mood: 'Dramatic & Yearning',
    sampleLyrics:
      "I'm going back to 505\nIf it's a seven hour flight or a forty-five minute drive\nIn my imagination, you're waitin' lyin' on your side",
  },
  {
    id: 'seed-weeknd-afterhours',
    title: 'After Hours',
    artist: 'The Weeknd',
    bpm: 108,
    genre: 'Synthwave R&B',
    mood: 'Noir & Hypnotic',
    sampleLyrics:
      'Thought I almost died in my dream again\nBaby, almost died\nFighting for my life, I couldn’t breathe again\nI’m falling in too deep',
  },
  {
    id: 'seed-d4vd-romantic',
    title: 'Romantic Homicide',
    artist: 'd4vd',
    bpm: 132,
    genre: 'Indie Lo-Fi',
    mood: 'Dark & Emotional',
    sampleLyrics:
      "In the back of my mind\nYou died, and I didn't even cry\nNo, not a single tear\nAnd I'm sick of waiting patiently",
  },
  {
    id: 'seed-niki-summertime',
    title: 'Every Summertime',
    artist: 'NIKI',
    bpm: 96,
    genre: 'R&B Pop',
    mood: 'Warm & Nostalgic',
    sampleLyrics:
      "Baby, I'd give up anything to travel inside your mind\nBaby, I falls in love again every summertime",
  },
];

interface ItunesResult {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  primaryGenreName?: string;
  trackTimeMillis?: number;
}

async function searchItunes(term: string, limit = 10): Promise<ItunesResult[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=${limit}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'KodeklipStudio/1.0' },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: ItunesResult[] };
    return Array.isArray(data.results) ? data.results : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function estimateBpmByGenre(genre: string): number {
  const g = genre.toLowerCase();
  if (g.includes('rock') || g.includes('punk')) return 128;
  if (g.includes('electronic') || g.includes('dance') || g.includes('house')) return 124;
  if (g.includes('hip-hop') || g.includes('rap') || g.includes('trap')) return 130;
  if (g.includes('r&b') || g.includes('soul')) return 92;
  if (g.includes('indie') || g.includes('alternative')) return 102;
  return 96;
}

function upgradeArtwork(url?: string): string {
  if (!url) return '';
  return url.replace('100x100bb', '600x600bb');
}

let cachedTrending: { timestamp: number; items: unknown[] } | null = null;

app.get('/api/music/trending', async (_req, res) => {
  try {
    if (cachedTrending && Date.now() - cachedTrending.timestamp < 30 * 60 * 1000) {
      return res.json({ tracks: cachedTrending.items });
    }

    const enriched = await Promise.all(
      TRENDING_SEEDS.map(async (seed) => {
        const matches = await searchItunes(`${seed.artist} ${seed.title}`, 2);
        const match = matches.find((m) => Boolean(m.previewUrl)) ?? matches[0];
        return {
          id: seed.id,
          title: match?.trackName ?? seed.title,
          artist: match?.artistName ?? seed.artist,
          album: match?.collectionName ?? 'Single',
          coverUrl: upgradeArtwork(match?.artworkUrl100),
          previewUrl: match?.previewUrl ?? null,
          durationSec: 30,
          bpm: seed.bpm,
          genre: match?.primaryGenreName ?? seed.genre,
          mood: seed.mood,
          sampleLyrics: seed.sampleLyrics,
        };
      })
    );

    cachedTrending = { timestamp: Date.now(), items: enriched };
    return res.json({ tracks: enriched });
  } catch (err) {
    console.error('Trending fetch error:', err);
    return res.status(500).json({ error: 'Gagal memuat daftar lagu terpopuler.' });
  }
});

app.get('/api/music/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (!q) {
    return res.status(400).json({ error: 'Kata kunci pencarian tidak boleh kosong.' });
  }

  try {
    const itunesResults = await searchItunes(q, 12);
    if (itunesResults.length > 0) {
      const tracks = itunesResults.map((item, idx) => ({
        id: String(item.trackId ?? `itunes-${idx}`),
        title: item.trackName ?? 'Unknown Track',
        artist: item.artistName ?? 'Unknown Artist',
        album: item.collectionName ?? 'Single',
        coverUrl: upgradeArtwork(item.artworkUrl100),
        previewUrl: item.previewUrl ?? null,
        durationSec: 30,
        bpm: estimateBpmByGenre(item.primaryGenreName ?? ''),
        genre: item.primaryGenreName ?? 'Pop',
        mood: 'Dynamic',
      }));
      return res.json({ tracks, source: 'itunes' });
    }

    // Grounded fallback via Gemini if iTunes returns nothing
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Cari 6 lagu populer yang paling relevan dengan kueri "${q}". Berikan daftar dalam format JSON array saja dengan field: title, artist, album, genre, bpm (angka), mood.`,
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const raw = response.text ?? '[]';
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    const parsed = jsonMatch ? (JSON.parse(jsonMatch[0]) as Array<Record<string, unknown>>) : [];
    const tracks = parsed.map((item, idx) => ({
      id: `ai-search-${idx}-${Date.now()}`,
      title: String(item.title ?? q),
      artist: String(item.artist ?? 'Artis Populer'),
      album: String(item.album ?? 'Single'),
      coverUrl: '',
      previewUrl: null,
      durationSec: 30,
      bpm: Number(item.bpm) || 96,
      genre: String(item.genre ?? 'Pop'),
      mood: String(item.mood ?? 'Atmospheric'),
    }));

    return res.json({ tracks, source: 'search-grounding' });
  } catch (err) {
    console.error('Search error:', err);
    return res.status(500).json({ error: 'Gagal mencari lagu. Periksa koneksi atau coba kata kunci lain.' });
  }
});

const ALLOWED_AUDIO_HOSTS = [
  'mzstatic.com',
  'apple.com',
  'dzcdn.net',
  'deezer.com',
  'scdn.co',
];

app.get('/api/music/audio-proxy', async (req, res) => {
  const rawUrl = String(req.query.url ?? '').trim();
  if (!rawUrl) {
    return res.status(400).send('Missing audio url');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return res.status(400).send('Invalid URL');
  }

  const isAllowed =
    parsedUrl.protocol === 'https:' &&
    ALLOWED_AUDIO_HOSTS.some(
      (host) => parsedUrl.hostname === host || parsedUrl.hostname.endsWith(`.${host}`)
    );

  if (!isAllowed) {
    return res.status(403).send('Disallowed audio host');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const upstream = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      headers: { 'User-Agent': 'KodeklipStudio/1.0' },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).send('Upstream audio error');
    }

    const contentType = upstream.headers.get('content-type') || 'audio/mp4';
    const arrayBuffer = await upstream.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('Audio proxy error:', err);
    return res.status(502).send('Failed to stream audio preview');
  } finally {
    clearTimeout(timer);
  }
});

interface LrclibRecord {
  id?: number;
  trackName?: string;
  artistName?: string;
  plainLyrics?: string;
  syncedLyrics?: string;
  instrumental?: boolean;
}

const lyricsCache = new Map<
  string,
  { lyrics: string; bpm: number; mood: string; sources: Array<{ title: string; uri: string }> }
>();

function extractIconicLyricSnippet(plainLyrics: string): string {
  const paragraphs = plainLyrics
    .split(/\n\s*\n/)
    .map((p) =>
      p
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('['))
    )
    .filter((lines) => lines.length > 0);

  if (paragraphs.length === 0) return '';

  // Prefer a punchy chorus/second stanza (4-8 lines) if available, otherwise opening stanza
  const candidate =
    paragraphs.find((p, idx) => idx >= 1 && p.length >= 3 && p.length <= 8) ??
    paragraphs[0];

  const picked = candidate.slice(0, 8);
  if (picked.length < 4 && paragraphs.length > 1) {
    const merged = [...paragraphs[0], ...paragraphs[1]].slice(0, 7);
    return merged.join('\n');
  }
  return picked.join('\n');
}

async function fetchLyricsFromLrclib(
  title: string,
  artist: string
): Promise<{ lyrics: string; sourceUrl: string } | null> {
  const endpoints = [
    `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`,
    `https://lrclib.net/api/search?q=${encodeURIComponent(`${artist} ${title}`.trim())}`,
  ];

  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(endpoint, {
        signal: controller.signal,
        headers: { 'User-Agent': 'KodeklipStudio/1.0' },
      });
      if (!res.ok) continue;
      const items = (await res.json()) as LrclibRecord[];
      if (!Array.isArray(items) || items.length === 0) continue;

      const best = items.find((item) => !item.instrumental && item.plainLyrics);
      if (best?.plainLyrics) {
        const snippet = extractIconicLyricSnippet(best.plainLyrics);
        if (snippet) {
          return {
            lyrics: snippet,
            sourceUrl: best.id ? `https://lrclib.net/api/get/${best.id}` : 'https://lrclib.net',
          };
        }
      }
    } catch {
      // try next endpoint
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

function isQuotaOrRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.toLowerCase().includes('quota') ||
    msg.toLowerCase().includes('rate limit')
  );
}

app.post('/api/music/lyrics', async (req, res) => {
  const title = String(req.body?.title ?? '').trim();
  const artist = String(req.body?.artist ?? '').trim();

  if (!title) {
    return res.status(400).json({ error: 'Judul lagu diperlukan.' });
  }

  const cacheKey = `${artist.toLowerCase()}::${title.toLowerCase()}`;
  const cached = lyricsCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  // 1. Check curated trending seeds first
  const seedMatch = TRENDING_SEEDS.find(
    (s) => s.title.toLowerCase() === title.toLowerCase()
  );

  // 2. Fetch real lyrics from LRCLIB (free, fast, zero Gemini quota cost)
  const lrcResult = await fetchLyricsFromLrclib(title, artist);
  if (lrcResult) {
    const payload = {
      lyrics: lrcResult.lyrics,
      bpm: seedMatch?.bpm ?? 96,
      mood: seedMatch?.mood ?? 'Emotional & Atmospheric',
      sources: [{ title: 'LRCLIB Lyrics Database', uri: lrcResult.sourceUrl }],
    };
    lyricsCache.set(cacheKey, payload);
    return res.json(payload);
  }

  if (seedMatch?.sampleLyrics) {
    const payload = {
      lyrics: seedMatch.sampleLyrics,
      bpm: seedMatch.bpm,
      mood: seedMatch.mood,
      sources: [],
    };
    lyricsCache.set(cacheKey, payload);
    return res.json(payload);
  }

  // 3. Fallback to Gemini Search Grounding only if LRCLIB had no match
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Temukan potongan lirik paling ikonik (sekitar 4-8 baris chorus atau bait pembuka yang paling cocok untuk klip 30 detik), estimasi BPM, dan suasana (mood) untuk lagu "${title}" oleh "${artist}".
PENTING: Pada bagian LYRICS, tulis HANYA baris-baris lirik lagunya saja tanpa keterangan tambahan, tanpa tanda kurung [Chorus], dan tanpa kunci gitar.
Balas dengan format persis berikut:
BPM: <angka>
MOOD: <deskripsi singkat mood lagu dalam 2-4 kata>
LYRICS:
<baris lirik 1>
<baris lirik 2>
...`,
      config: {
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const text = response.text ?? '';
    const bpmMatch = text.match(/BPM:\s*(\d+)/i);
    const moodMatch = text.match(/MOOD:\s*(.+)/i);
    const lyricsSplit = text.split(/LYRICS:\s*/i);
    const lyrics = (lyricsSplit[1] ?? text).trim();

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const sources = chunks
      .map((c) => c.web)
      .filter((w): w is { uri: string; title: string } => Boolean(w?.uri && w?.title))
      .slice(0, 4);

    const payload = {
      lyrics,
      bpm: bpmMatch ? Number(bpmMatch[1]) : 96,
      mood: moodMatch ? moodMatch[1].trim() : 'Atmospheric',
      sources,
    };
    lyricsCache.set(cacheKey, payload);
    return res.json(payload);
  } catch (err) {
    console.warn('Gemini lyrics fallback failed:', err instanceof Error ? err.message : err);
    if (isQuotaOrRateLimitError(err)) {
      return res.status(429).json({
        quotaExceeded: true,
        error:
          'Lirik tidak ditemukan di database LRCLIB dan kuota Gemini API sedang penuh (429). Silakan tempel lirik lagu secara manual di editor.',
      });
    }
    return res.status(500).json({ error: 'Gagal mengambil lirik lagu.' });
  }
});

const scriptCache = new Map<string, unknown>();

async function generateStructuredWithFallback(params: {
  contents: string;
  responseSchema: Record<string, unknown>;
}) {
  const ai = getAiClient();
  try {
    return await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: params.contents,
      config: {
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseSchema: params.responseSchema,
      },
    });
  } catch (primaryErr) {
    if (!isQuotaOrRateLimitError(primaryErr)) {
      throw primaryErr;
    }
    // Retry on lighter flash-lite model when primary quota is reached
    return await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: params.contents,
      config: {
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        responseSchema: params.responseSchema,
      },
    });
  }
}

app.post('/api/ai/generate-script', async (req, res) => {
  const {
    mode = 'code-lyric',
    title = '',
    artist = '',
    lyricsOrText = '',
    bpm = 90,
    mood = 'Melancholic & Intimate',
    durationSec = 30,
  } = req.body ?? {};

  const cacheKey = `${mode}::${title}::${bpm}::${String(lyricsOrText).trim()}`;
  const cachedScript = scriptCache.get(cacheKey);
  if (cachedScript) {
    return res.json(cachedScript);
  }

  try {
    if (mode === 'code-lyric') {
      const response = await generateStructuredWithFallback({
        contents: `Kamu adalah sutradara video musik lirik kode gaya "@codin.dev".
TUGAS UTAMA: Ubah LIRIK LAGU berikut menjadi "kode lirik berbasis JavaScript".

ATURAN KETAT (WAJIB DIPATUHI):
1. BUKAN KODE PEMROGRAMAN ASLI: Jangan pernah menulis logika teknis aplikasi/komputer (DILARANG memakai console.log, fetch, API, database, server, useState, error, array, atau istilah coding teknis).
2. 100% KATA-KATA DARI LIRIK LAGU: Seluruh kata di dalam kode HARUS berasal langsung dari lirik lagu yang dituju (pertahankan bahasa asli liriknya—Inggris atau Indonesia—dan maknanya secara utuh).
3. FORMAT SINTAKS JAVASCRIPT: Susun kata-kata lirik tersebut menjadi bentuk visual sintaks JavaScript seperti if (...), } else if (...) {, while (...), objek.kataKerja(argumen), "string kutipan", dan komentar // baris lirik.

Contoh persis gaya yang diinginkan:
- Lirik Inggris:
  "If 'I love you' was a promise / Would you break it, if you're honest? / Tell the mirror what you know she's heard before / I don't wanna be you anymore"
  Hasil kode lirik JS:
  1: if ("I love you" === promise) {
  2:   wouldYou.break(it);
  3: }
  4: if (you.areHonest) {
  5:   tell(mirror, what.youKnow);
  6:   // she's heard before   --> effect: "echo"
  7: }
  8: I.dontWannaBe(you, "anymore");  --> effect: "drop"

- Lirik Indonesia:
  "Belum ada satu bulan / Ku yakin masih ada sisa wangiku di bajumu / Namun kau tampak baik saja / Bahkan senyummu lebih lepas"
  Hasil kode lirik JS:
  1: if (waktu < "satu bulan") {
  2:   ku.yakin(sisaWangiku, di.bajumu);
  3: } else if (kau.tampak("baik saja")) {
  4:   // bahkan senyummu lebih lepas  --> effect: "echo"
  5: }

Target Lagu: "${title || 'Lagu Pilihan'}" oleh "${artist || 'Artis'}"
BPM: ${bpm}
Suasana: ${mood}
Durasi klip: ${durationSec} detik
Lirik Lagu Sumber:
${lyricsOrText}

Aturan waktu & ketukan:
- Buat 6 hingga 10 baris kode lirik JS berurutan dari detik 0.4 hingga ${Math.max(12, Number(durationSec) - 1.5)}.
- Gunakan effect "echo" pada 1-2 baris komentar puitis ("// ...") yang berisi penggalan lirik emosional/menggema.
- Gunakan effect "drop" pada baris klimaks terakhir.
- Sertakan juga komposisi skor musik generatif (chordProgression mis. ["Am7", "Fmaj7", "Cmaj7", "G6"], bassPattern dan melodyNotes berupa angka MIDI 36-79 sebanyak 8 langkah, synthStyle pilih salah satu dari "lofi-piano", "midnight-synth", "indie-pluck", "dark-bass").`,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            lines: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  code: { type: Type.STRING },
                  startTime: { type: Type.NUMBER },
                  endTime: { type: Type.NUMBER },
                  effect: { type: Type.STRING, description: 'normal | echo | drop' },
                  beatAccent: { type: Type.BOOLEAN },
                },
                required: ['code', 'startTime', 'endTime', 'effect', 'beatAccent'],
              },
            },
            generativeScore: {
              type: Type.OBJECT,
              properties: {
                bpm: { type: Type.NUMBER },
                keySignature: { type: Type.STRING },
                mood: { type: Type.STRING },
                genre: { type: Type.STRING },
                synthStyle: {
                  type: Type.STRING,
                  description: 'lofi-piano | midnight-synth | indie-pluck | dark-bass',
                },
                chordProgression: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                bassPattern: {
                  type: Type.ARRAY,
                  items: { type: Type.NUMBER },
                },
                melodyNotes: {
                  type: Type.ARRAY,
                  items: { type: Type.NUMBER },
                },
                drumIntensity: { type: Type.NUMBER },
                description: { type: Type.STRING },
              },
              required: [
                'bpm',
                'keySignature',
                'mood',
                'genre',
                'synthStyle',
                'chordProgression',
                'bassPattern',
                'melodyNotes',
                'drumIntensity',
                'description',
              ],
            },
          },
          required: ['lines', 'generativeScore'],
        },
      });

      const parsed = JSON.parse(response.text ?? '{}');
      const lines = Array.isArray(parsed.lines)
        ? parsed.lines.map((l: Record<string, unknown>, i: number) => ({
            id: `line-${Date.now()}-${i}`,
            lineNumber: i + 1,
            code: String(l.code ?? ''),
            startTime: Number(l.startTime ?? i * 2.5),
            endTime: Number(l.endTime ?? (i + 1) * 2.5),
            effect:
              l.effect === 'echo' || l.effect === 'drop' ? l.effect : 'normal',
            beatAccent: Boolean(l.beatAccent),
          }))
        : [];

      const result = { lines, generativeScore: parsed.generativeScore };
      scriptCache.set(cacheKey, result);
      return res.json(result);
    } else {
      // Text-to-Video mode
      const response = await generateStructuredWithFallback({
        contents: `Ubah teks/naskah berikut menjadi rangkaian adegan video media sosial (TikTok/Reels/Shorts) berdurasi ${durationSec} detik yang sinkron dengan ketukan musik (${bpm} BPM, suasana ${mood}).
Teks masukan:
${lyricsOrText || 'Terkadang diam bukan berarti menyerah. Kadang kita hanya sedang menyusun ulang baris cerita hidup kita agar berjalan lebih tenang.'}

Pecah menjadi 5 hingga 7 adegan (scenes) berurutan. Tiap adegan memiliki headline singkat nan kuat (3-8 kata), subtext penjelas singkat, emphasisWords (1-2 kata dari headline untuk disorot warna aksen), startTime, endTime, dan beatAccent. Sertakan juga generativeScore.`,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  headline: { type: Type.STRING },
                  subtext: { type: Type.STRING },
                  startTime: { type: Type.NUMBER },
                  endTime: { type: Type.NUMBER },
                  emphasisWords: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  beatAccent: { type: Type.BOOLEAN },
                },
                required: [
                  'headline',
                  'subtext',
                  'startTime',
                  'endTime',
                  'emphasisWords',
                  'beatAccent',
                ],
              },
            },
            generativeScore: {
              type: Type.OBJECT,
              properties: {
                bpm: { type: Type.NUMBER },
                keySignature: { type: Type.STRING },
                mood: { type: Type.STRING },
                genre: { type: Type.STRING },
                synthStyle: { type: Type.STRING },
                chordProgression: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                bassPattern: {
                  type: Type.ARRAY,
                  items: { type: Type.NUMBER },
                },
                melodyNotes: {
                  type: Type.ARRAY,
                  items: { type: Type.NUMBER },
                },
                drumIntensity: { type: Type.NUMBER },
                description: { type: Type.STRING },
              },
              required: [
                'bpm',
                'keySignature',
                'mood',
                'genre',
                'synthStyle',
                'chordProgression',
                'bassPattern',
                'melodyNotes',
                'drumIntensity',
                'description',
              ],
            },
          },
          required: ['scenes', 'generativeScore'],
        },
      });

      const parsed = JSON.parse(response.text ?? '{}');
      const scenes = Array.isArray(parsed.scenes)
        ? parsed.scenes.map((s: Record<string, unknown>, i: number) => ({
            id: `scene-${Date.now()}-${i}`,
            headline: String(s.headline ?? ''),
            subtext: String(s.subtext ?? ''),
            startTime: Number(s.startTime ?? i * 4),
            endTime: Number(s.endTime ?? (i + 1) * 4),
            emphasisWords: Array.isArray(s.emphasisWords)
              ? s.emphasisWords.map(String)
              : [],
            beatAccent: Boolean(s.beatAccent),
          }))
        : [];

      const result = { scenes, generativeScore: parsed.generativeScore };
      scriptCache.set(cacheKey, result);
      return res.json(result);
    }
  } catch (err) {
    console.warn('AI script generation error:', err instanceof Error ? err.message : err);
    if (isQuotaOrRateLimitError(err)) {
      return res.status(429).json({
        quotaExceeded: true,
        error:
          'Kuota Gemini API sementara tercapai (429). Menggunakan konversi lirik otomatis lokal.',
      });
    }
    return res.status(500).json({
      error:
        err instanceof Error
          ? err.message
          : 'Gagal menghasilkan skrip sinkronisasi video AI.',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kodeklip server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

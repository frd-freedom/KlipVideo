import type { CodeLyricLine } from '../types/studio';

function toCamel(words: string[]): string {
  const cleaned = words
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(Boolean);
  if (cleaned.length === 0) return 'heart';
  return cleaned
    .map((w, i) =>
      i === 0
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join('');
}

/**
 * Deterministically transforms raw song lyrics into expressive JavaScript-styled
 * lyric code lines (never technical programming code—100% derived from the lyrics).
 */
export function convertLyricsToJsCodeLines(
  rawLyrics: string,
  durationSec = 30
): CodeLyricLine[] {
  const rawLines = rawLyrics
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('[') && !l.startsWith('('));

  if (rawLines.length === 0) {
    return [
      {
        id: `line-${Date.now()}-0`,
        lineNumber: 1,
        code: '// tuliskan lirik lagu di editor',
        startTime: 0.4,
        endTime: 4.0,
        effect: 'normal',
        beatAccent: true,
      },
    ];
  }

  const snippet = rawLines.slice(0, 7);
  const formatted: { code: string; effect: 'normal' | 'echo' | 'drop'; beatAccent: boolean }[] = [];

  let openBlock = false;

  snippet.forEach((lyric, idx) => {
    const clean = lyric.replace(/"/g, "'");
    const lower = clean.toLowerCase();
    const isLast = idx === snippet.length - 1;
    const isEchoSlot = idx === Math.floor(snippet.length * 0.65) && snippet.length >= 3;

    if (isEchoSlot) {
      formatted.push({
        code: `${openBlock ? '  ' : ''}// ${clean}`,
        effect: 'echo',
        beatAccent: true,
      });
      if (openBlock) {
        formatted.push({ code: '}', effect: 'normal', beatAccent: false });
        openBlock = false;
      }
      return;
    }

    if (isLast) {
      if (openBlock) {
        formatted.push({ code: '}', effect: 'normal', beatAccent: false });
        openBlock = false;
      }
      const words = clean.split(/\s+/);
      if (words.length >= 3) {
        const subject = words[0].replace(/[^a-zA-Z0-9]/g, '') || 'I';
        const method = toCamel(words.slice(1, 3));
        const rest = words.slice(3).join(' ');
        formatted.push({
          code: rest
            ? `${subject}.${method}("${rest}");`
            : `${subject}.${method}();`,
          effect: 'drop',
          beatAccent: true,
        });
      } else {
        formatted.push({
          code: `return "${clean}";`,
          effect: 'drop',
          beatAccent: true,
        });
      }
      return;
    }

    if (
      lower.startsWith('if ') ||
      lower.startsWith('jika ') ||
      lower.startsWith('kalau ') ||
      lower.startsWith('bila ') ||
      lower.startsWith('when ') ||
      lower.startsWith('saat ')
    ) {
      if (openBlock) {
        formatted.push({ code: '}', effect: 'normal', beatAccent: false });
      }
      const body = clean.replace(/^(if|jika|kalau|bila|when|saat)\s+/i, '');
      formatted.push({
        code: `if ("${body}") {`,
        effect: 'normal',
        beatAccent: true,
      });
      openBlock = true;
      return;
    }

    if (
      lower.startsWith('but ') ||
      lower.startsWith('namun ') ||
      lower.startsWith('tapi ') ||
      lower.startsWith('tetapi ')
    ) {
      const body = clean.replace(/^(but|namun|tapi|tetapi)\s+/i, '');
      if (openBlock) {
        formatted.push({
          code: `} else if ("${body}") {`,
          effect: 'normal',
          beatAccent: true,
        });
      } else {
        formatted.push({
          code: `while ("${body}") {`,
          effect: 'normal',
          beatAccent: true,
        });
        openBlock = true;
      }
      return;
    }

    const words = clean.split(/\s+/);
    const indent = openBlock ? '  ' : '';
    if (words.length >= 4) {
      const subject = words[0].replace(/[^a-zA-Z0-9]/g, '') || 'aku';
      const action = toCamel(words.slice(1, 2));
      const arg = words.slice(2).join(' ');
      formatted.push({
        code: `${indent}${subject}.${action}("${arg}");`,
        effect: 'normal',
        beatAccent: idx % 2 === 0,
      });
    } else {
      formatted.push({
        code: `${indent}feel("${clean}");`,
        effect: 'normal',
        beatAccent: idx % 2 === 0,
      });
    }
  });

  if (openBlock) {
    formatted.push({ code: '}', effect: 'normal', beatAccent: false });
  }

  const usableDuration = Math.max(10, durationSec - 2.2);
  const totalWeight = formatted.reduce(
    (acc, item) => acc + (item.code === '}' ? 0.3 : item.effect === 'echo' ? 1.5 : 1.0),
    0
  );

  let cursorTime = 0.4;
  return formatted.map((item, idx) => {
    const weight = item.code === '}' ? 0.3 : item.effect === 'echo' ? 1.5 : 1.0;
    const span = Math.max(0.55, (weight / Math.max(1, totalWeight)) * usableDuration);
    const startTime = Number(cursorTime.toFixed(1));
    const endTime = Number((cursorTime + span - 0.1).toFixed(1));
    cursorTime += span;

    return {
      id: `jslyric-${Date.now()}-${idx}`,
      lineNumber: idx + 1,
      code: item.code,
      startTime,
      endTime: Math.max(startTime + 0.4, endTime),
      effect: item.effect,
      beatAccent: item.beatAccent,
    };
  });
}

export function convertTextToScenes(
  rawText: string,
  durationSec = 30
): Array<{
  id: string;
  headline: string;
  subtext: string;
  startTime: number;
  endTime: number;
  emphasisWords: string[];
  beatAccent: boolean;
}> {
  const chunks = rawText
    .split(/(?<=[.!?])\s+|\r?\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 7);

  const items =
    chunks.length > 0
      ? chunks
      : ['Mulai ceritamu di sini.', 'Sinkronkan setiap kata dengan ketukan musik.'];

  const span = Math.max(2.0, (durationSec - 1.5) / items.length);
  return items.map((sentence, idx) => {
    const words = sentence.split(/\s+/).filter(Boolean);
    const headline = words.slice(0, 7).join(' ');
    const subtext = words.length > 7 ? words.slice(7).join(' ') : '';
    const emphasis = words
      .filter((w) => w.length >= 4)
      .slice(-2);

    const startTime = Number((0.4 + idx * span).toFixed(1));
    const endTime = Number((startTime + span - 0.15).toFixed(1));

    return {
      id: `scene-local-${Date.now()}-${idx}`,
      headline,
      subtext,
      startTime,
      endTime,
      emphasisWords: emphasis,
      beatAccent: idx % 2 === 0,
    };
  });
}

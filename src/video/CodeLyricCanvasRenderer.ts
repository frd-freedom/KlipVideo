import type { AudioMetrics } from '../audio/BeatSyncAudioEngine';
import type {
  AspectRatio,
  CodeLyricLine,
  StudioMode,
  TextScene,
  VideoStyleConfig,
} from '../types/studio';

interface Token {
  text: string;
  color: string;
  glow?: string;
}

const KEYWORDS = new Set([
  'if',
  'else',
  'while',
  'for',
  'return',
  'const',
  'let',
  'var',
  'function',
  'async',
  'await',
  'try',
  'catch',
  'throw',
  'new',
  'true',
  'false',
  'null',
  'undefined',
]);

function tokenizeCodeLine(line: string, preset: VideoStyleConfig['preset']): Token[] {
  const isMidnight = preset === 'midnight-ide';
  const palette = {
    comment: isMidnight ? '#64748B' : '#71717A',
    keyword: isMidnight ? '#F43F5E' : '#EF4444',
    string: isMidnight ? '#38BDF8' : '#F59E0B',
    method: isMidnight ? '#A78BFA' : '#60A5FA',
    operator: '#D4D4D8',
    identifier: '#F4F4F5',
    number: '#FB923C',
  };

  const trimmed = line.trimStart();
  if (trimmed.startsWith('//')) {
    return [{ text: line, color: palette.comment }];
  }

  const tokens: Token[] = [];
  const regex =
    /(\/\/.*$)|(["'`][^"'`]*["'`])|\b(\d+(?:\.\d+)?)\b|([A-Za-z_$][\w$]*)|(\s+)|(===|!==|==|!=|=>|<=|>=|[{}()[\].,;:=+\-*/<>!&|?])/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        text: line.slice(lastIndex, match.index),
        color: palette.identifier,
      });
    }

    const [full, comment, str, num, ident, space, op] = match;
    if (comment) {
      tokens.push({ text: comment, color: palette.comment });
    } else if (str) {
      tokens.push({ text: str, color: palette.string, glow: palette.string });
    } else if (num) {
      tokens.push({ text: num, color: palette.number });
    } else if (ident) {
      if (KEYWORDS.has(ident)) {
        tokens.push({ text: ident, color: palette.keyword, glow: palette.keyword });
      } else {
        const after = line.slice(regex.lastIndex);
        const before = line.slice(0, match.index);
        if (after.startsWith('(') || before.endsWith('.')) {
          tokens.push({ text: ident, color: palette.method });
        } else {
          tokens.push({ text: ident, color: palette.identifier });
        }
      }
    } else if (space) {
      tokens.push({ text: space, color: palette.identifier });
    } else if (op) {
      tokens.push({ text: op, color: palette.operator });
    } else {
      tokens.push({ text: full, color: palette.identifier });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < line.length) {
    tokens.push({ text: line.slice(lastIndex), color: palette.identifier });
  }

  return tokens;
}

export function getCanvasResolution(ratio: AspectRatio): { width: number; height: number } {
  if (ratio === '1:1') return { width: 1080, height: 1080 };
  if (ratio === '16:9') return { width: 1920, height: 1080 };
  return { width: 1080, height: 1920 };
}

interface CameraState {
  x: number;
  y: number;
  zoom: number;
  beatFlash: number;
}

export class CodeLyricCanvasRenderer {
  private camera: CameraState = { x: 0, y: 0, zoom: 1.08, beatFlash: 0 };

  public resetCamera() {
    this.camera = { x: 0, y: 0, zoom: 1.08, beatFlash: 0 };
  }

  public renderFrame(params: {
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
    currentTime: number;
    durationSec: number;
    mode: StudioMode;
    lines: CodeLyricLine[];
    scenes: TextScene[];
    style: VideoStyleConfig;
    metrics: AudioMetrics;
    songTitle: string;
    songArtist: string;
  }) {
    const {
      ctx,
      width,
      height,
      currentTime,
      durationSec,
      mode,
      lines,
      scenes,
      style,
      metrics,
      songTitle,
      songArtist,
    } = params;

    if (metrics.isBeatHit) {
      this.camera.beatFlash = 1;
    } else {
      this.camera.beatFlash *= 0.88;
    }

    if (mode === 'code-lyric' && style.preset !== 'editorial-kinetic') {
      this.renderCodeLyricFrame({
        ctx,
        width,
        height,
        currentTime,
        durationSec,
        lines,
        style,
        metrics,
        songTitle,
        songArtist,
      });
    } else {
      this.renderKineticTextFrame({
        ctx,
        width,
        height,
        currentTime,
        durationSec,
        mode,
        lines,
        scenes,
        style,
        metrics,
        songTitle,
        songArtist,
      });
    }
  }

  private renderCodeLyricFrame(params: {
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
    currentTime: number;
    durationSec: number;
    lines: CodeLyricLine[];
    style: VideoStyleConfig;
    metrics: AudioMetrics;
    songTitle: string;
    songArtist: string;
  }) {
    const {
      ctx,
      width,
      height,
      currentTime,
      durationSec,
      lines,
      style,
      metrics,
      songTitle,
      songArtist,
    } = params;

    const isMidnight = style.preset === 'midnight-ide';
    const bgColor = isMidnight ? '#050811' : '#000000';
    const cursorColor = isMidnight ? '#F43F5E' : '#FF3B30';
    const orbPrimary = isMidnight ? 'rgba(56, 189, 248,' : 'rgba(249, 115, 22,';
    const orbSecondary = isMidnight ? 'rgba(139, 92, 246,' : 'rgba(239, 68, 68,';

    // 1. Deep OLED Void Background
    ctx.save();
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Subtle atmospheric radial depth
    const bgGrad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.45,
      width * 0.05,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.72
    );
    bgGrad.addColorStop(
      0,
      isMidnight
        ? `rgba(30, 41, 59, ${0.18 + metrics.bassEnergy * 0.14})`
        : `rgba(24, 16, 12, ${0.18 + metrics.bassEnergy * 0.16})`
    );
    bgGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Determine visible & active lines
    let activeIdx = -1;
    let activeProgress = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (currentTime >= line.startTime) {
        activeIdx = i;
        if (currentTime < line.endTime) {
          const span = Math.max(0.15, line.endTime - line.startTime);
          const rawP = Math.min(1, Math.max(0, (currentTime - line.startTime) / (span * (0.72 / Math.max(0.4, style.typingSpeedFactor)))));
          activeProgress = 1 - Math.pow(1 - rawP, 1.35);
          break;
        } else {
          activeProgress = 1;
        }
      }
    }

    if (activeIdx === -1 && lines.length > 0) {
      activeIdx = 0;
      activeProgress = 0;
    }

    const activeLine = lines[activeIdx];
    const isEchoPhase = activeLine?.effect === 'echo' && activeProgress > 0.6;
    const isDropPhase = activeLine?.effect === 'drop';
    const isFinaleReveal =
      lines.length > 0 && currentTime > (lines[lines.length - 1]?.endTime ?? durationSec) - 1.5;

    // Typography geometry
    const isLandscape = width > height;
    const fontSize = isLandscape ? 44 : width === height ? 38 : 42;
    const lineHeight = fontSize * 1.85;
    const gutterWidth = style.showLineNumbers ? 86 : 0;
    const codeFont = `500 ${fontSize}px "JetBrains Mono", monospace`;
    ctx.font = codeFont;
    ctx.textBaseline = 'middle';

    const totalBlockHeight = lines.length * lineHeight;
    const blockStartY = -totalBlockHeight / 2 + lineHeight / 2;
    const blockLeftX = isLandscape ? -640 : -430;

    // Compute cursor world position for smooth camera tracking
    let cursorWorldX = blockLeftX + gutterWidth;
    let cursorWorldY = blockStartY;

    if (activeLine) {
      const visibleCount = Math.max(0, Math.round(activeLine.code.length * activeProgress));
      const typedText = activeLine.code.slice(0, visibleCount);
      const measuredW = ctx.measureText(typedText).width;
      cursorWorldX = blockLeftX + gutterWidth + measuredW;
      cursorWorldY = blockStartY + activeIdx * lineHeight;
    }

    // Target camera position: track cursor closely during typing, pull back on finale
    const targetZoom = isFinaleReveal
      ? 0.94
      : isEchoPhase
        ? 1.14
        : 1.18 + metrics.bassEnergy * 0.08 * style.cameraDynamics;
    const targetCamX = isFinaleReveal ? 0 : cursorWorldX * 0.58;
    const targetCamY = isFinaleReveal ? 0 : cursorWorldY * 0.78;

    const lerp = 0.085;
    this.camera.x += (targetCamX - this.camera.x) * lerp;
    this.camera.y += (targetCamY - this.camera.y) * lerp;
    this.camera.zoom += (targetZoom - this.camera.zoom) * lerp;

    // 2. Beat-Reactive Warm Amber Glow Sphere (signature @codin.dev visual)
    const glowStrength = style.glowIntensity;
    if (glowStrength > 0.05) {
      const orbRadius =
        (isEchoPhase ? 210 : isDropPhase ? 260 : 150) +
        metrics.bassEnergy * 160 * glowStrength +
        this.camera.beatFlash * 55;
      const orbX = width * 0.5 + (cursorWorldX - this.camera.x) * 0.4;
      const orbY = height * 0.48 + (cursorWorldY - this.camera.y) * 0.4;

      const orbGrad = ctx.createRadialGradient(orbX, orbY, 4, orbX, orbY, orbRadius);
      const alphaBase =
        (isEchoPhase ? 0.55 : isDropPhase ? 0.48 : 0.2) *
        glowStrength *
        (0.65 + metrics.bassEnergy * 0.75);
      orbGrad.addColorStop(0, `${orbPrimary} ${Math.min(0.85, alphaBase)})`);
      orbGrad.addColorStop(0.42, `${orbSecondary} ${Math.min(0.45, alphaBase * 0.55)})`);
      orbGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(orbX, orbY, orbRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Apply virtual camera transform
    ctx.save();
    const beatScale = 1 + this.camera.beatFlash * 0.018 * style.cameraDynamics;
    const subtleTilt =
      Math.sin(currentTime * 0.9) * 0.014 * style.cameraDynamics +
      (isEchoPhase ? -0.018 : 0);

    ctx.translate(width / 2, height / 2);
    ctx.scale(this.camera.zoom * beatScale, this.camera.zoom * beatScale);
    ctx.rotate(subtleTilt);
    ctx.translate(-this.camera.x, -this.camera.y);

    // 3. Render Code Lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (currentTime < line.startTime && i > 0) continue;

      const lineY = blockStartY + i * lineHeight;
      const isCurrent = i === activeIdx;
      const isPast = i < activeIdx;

      const lineProgress = isPast ? 1 : isCurrent ? activeProgress : 0;
      const charCount = Math.max(0, Math.round(line.code.length * lineProgress));
      const visibleCode = line.code.slice(0, charCount);

      // Dim distant past lines slightly when zoomed in, restore on finale
      const distFromActive = Math.abs(i - activeIdx);
      const lineAlpha = isFinaleReveal
        ? 1
        : isCurrent
          ? 1
          : Math.max(0.28, 0.85 - distFromActive * 0.16);

      ctx.save();
      ctx.globalAlpha = lineAlpha;

      // Line Number
      if (style.showLineNumbers) {
        ctx.font = `400 ${Math.round(fontSize * 0.62)}px "JetBrains Mono", monospace`;
        ctx.fillStyle = isCurrent ? '#71717A' : '#3F3F46';
        const numLabel = String(line.lineNumber).padStart(2, '0');
        ctx.fillText(numLabel, blockLeftX, lineY);
      }

      // Tokenized Code Rendering
      ctx.font = codeFont;
      const tokens = tokenizeCodeLine(visibleCode, style.preset);
      let drawX = blockLeftX + gutterWidth;

      for (const token of tokens) {
        ctx.fillStyle = token.color;
        if (token.glow && style.glowIntensity > 0.1) {
          ctx.shadowColor = token.glow;
          ctx.shadowBlur = (10 + metrics.bassEnergy * 12) * style.glowIntensity;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.fillText(token.text, drawX, lineY);
        drawX += ctx.measureText(token.text).width;
      }

      // Echo Cascade Effect (matching frames 00:14–00:17 in reference video!)
      if (line.effect === 'echo' && lineProgress > 0.55) {
        const echoCount = 5;
        const echoLift = Math.min(1, (lineProgress - 0.55) / 0.45);
        for (let e = 1; e <= echoCount; e++) {
          ctx.save();
          ctx.globalAlpha = lineAlpha * (0.48 - e * 0.08) * echoLift;
          const echoY = lineY + e * (lineHeight * 0.76);
          const echoX = blockLeftX + gutterWidth + e * 6;
          ctx.shadowBlur = 0;
          ctx.fillStyle = isMidnight ? '#94A3B8' : '#A1A1AA';
          ctx.fillText(visibleCode.trimStart(), echoX + (line.code.length - line.code.trimStart().length) * 24, echoY);
          ctx.restore();
        }
      }

      // Signature Glowing Crimson Block Cursor
      if (isCurrent && !isFinaleReveal) {
        const cursorW = Math.round(fontSize * 0.52);
        const cursorH = Math.round(fontSize * 1.15);
        const blink =
          lineProgress < 1 || Math.sin(currentTime * 7.5) > -0.25 ? 1 : 0.35;

        ctx.save();
        ctx.globalAlpha = blink;
        ctx.fillStyle = cursorColor;
        ctx.shadowColor = cursorColor;
        ctx.shadowBlur = 22 + metrics.bassEnergy * 24 * style.glowIntensity;
        ctx.fillRect(drawX + 4, lineY - cursorH / 2, cursorW, cursorH);
        ctx.restore();
      }

      ctx.restore();
    }

    ctx.restore(); // end camera transform

    // 4. Subtle Vignette & Studio Frame Overlays
    const vignette = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.3,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.72
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.68)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    // Bottom subtle track + handle metadata (clean, no pill clutter)
    const bottomPad = isLandscape ? 54 : 96;
    ctx.save();
    ctx.textAlign = 'center';
    if (style.watermarkHandle.trim()) {
      ctx.font = `500 ${isLandscape ? 22 : 26}px "JetBrains Mono", monospace`;
      ctx.fillStyle = 'rgba(244, 244, 245, 0.55)';
      ctx.fillText(style.watermarkHandle.trim(), width / 2, height - bottomPad);
    }

    if (songTitle) {
      ctx.font = `500 ${isLandscape ? 18 : 21}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = 'rgba(161, 161, 170, 0.5)';
      const label = songArtist ? `${songTitle} · ${songArtist}` : songTitle;
      ctx.fillText(label, width / 2, height - bottomPad + (style.watermarkHandle.trim() ? 34 : 0));
    }

    // Minimalist progress hairline at very bottom
    const pct = Math.min(1, Math.max(0, currentTime / Math.max(1, durationSec)));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(0, height - 6, width, 6);
    ctx.fillStyle = cursorColor;
    ctx.fillRect(0, height - 6, width * pct, 6);
    ctx.restore();

    ctx.restore();
  }

  private renderKineticTextFrame(params: {
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
    currentTime: number;
    durationSec: number;
    mode: StudioMode;
    lines: CodeLyricLine[];
    scenes: TextScene[];
    style: VideoStyleConfig;
    metrics: AudioMetrics;
    songTitle: string;
    songArtist: string;
  }) {
    const {
      ctx,
      width,
      height,
      currentTime,
      durationSec,
      mode,
      lines,
      scenes,
      style,
      metrics,
      songTitle,
      songArtist,
    } = params;

    ctx.save();
    ctx.fillStyle = '#070709';
    ctx.fillRect(0, 0, width, height);

    // Beat-reactive ambient lighting
    const pulse = 0.25 + metrics.bassEnergy * 0.55 * style.glowIntensity + this.camera.beatFlash * 0.25;
    const grad = ctx.createRadialGradient(
      width * 0.5,
      height * 0.42,
      20,
      width * 0.5,
      height * 0.42,
      Math.max(width, height) * 0.65
    );
    grad.addColorStop(0, `rgba(239, 68, 68, ${Math.min(0.42, pulse * 0.45)})`);
    grad.addColorStop(0.45, `rgba(245, 158, 11, ${Math.min(0.22, pulse * 0.22)})`);
    grad.addColorStop(1, 'rgba(7, 7, 9, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Normalize active scene from either scenes or lines
    const effectiveScenes: TextScene[] =
      mode === 'text-to-video' && scenes.length > 0
        ? scenes
        : lines.map((l) => ({
            id: l.id,
            headline: l.code,
            subtext: '',
            startTime: l.startTime,
            endTime: l.endTime,
            emphasisWords: [],
            beatAccent: l.beatAccent,
          }));

    let activeScene = effectiveScenes[0];
    for (const s of effectiveScenes) {
      if (currentTime >= s.startTime && currentTime <= s.endTime) {
        activeScene = s;
        break;
      }
      if (currentTime > s.endTime) {
        activeScene = s;
      }
    }

    if (activeScene) {
      const span = Math.max(0.4, activeScene.endTime - activeScene.startTime);
      const progress = Math.min(1, Math.max(0, (currentTime - activeScene.startTime) / span));
      const enterAlpha = Math.min(1, progress * 4.5);
      const beatScale = 1 + metrics.bassEnergy * 0.04 * style.cameraDynamics;

      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.scale(beatScale, beatScale);
      ctx.globalAlpha = enterAlpha;

      const maxTextWidth = width * 0.78;
      const headlineSize = width > height ? 72 : 68;
      ctx.font = `700 ${headlineSize}px "Bricolage Grotesque", sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';

      // Wrap headline into lines with emphasis coloring
      const words = activeScene.headline.split(/\s+/).filter(Boolean);
      const emphasisSet = new Set(activeScene.emphasisWords.map((w) => w.toLowerCase()));
      const wrappedLines: string[][] = [];
      let currentLine: string[] = [];

      for (const w of words) {
        const testStr = [...currentLine, w].join(' ');
        if (ctx.measureText(testStr).width > maxTextWidth && currentLine.length > 0) {
          wrappedLines.push(currentLine);
          currentLine = [w];
        } else {
          currentLine.push(w);
        }
      }
      if (currentLine.length > 0) wrappedLines.push(currentLine);

      const lineH = headlineSize * 1.18;
      const totalH = wrappedLines.length * lineH;
      const startY = -totalH / 2 - (activeScene.subtext ? 36 : 0);

      // Reveal words progressively
      const revealedWordsCount = Math.max(
        1,
        Math.ceil(words.length * Math.min(1, progress * 1.85))
      );
      let wordCounter = 0;

      wrappedLines.forEach((lineWords, lIdx) => {
        const lineStr = lineWords.join(' ');
        const lineW = ctx.measureText(lineStr).width;
        let xCursor = -lineW / 2;
        const yPos = startY + lIdx * lineH;

        lineWords.forEach((word) => {
          const isRevealed = wordCounter < revealedWordsCount;
          const isEmphasis =
            emphasisSet.has(word.toLowerCase()) ||
            emphasisSet.has(word.toLowerCase().replace(/[.,!?]/g, ''));
          wordCounter += 1;

          ctx.save();
          ctx.globalAlpha = isRevealed ? enterAlpha : enterAlpha * 0.16;
          ctx.fillStyle = isEmphasis ? '#F59E0B' : '#F4F4F5';
          if (isEmphasis && isRevealed) {
            ctx.shadowColor = '#EF4444';
            ctx.shadowBlur = 18 * style.glowIntensity;
          }
          ctx.fillText(word, xCursor, yPos);
          ctx.restore();

          xCursor += ctx.measureText(word + ' ').width;
        });
      });

      // Subtext
      if (activeScene.subtext) {
        ctx.font = `400 ${width > height ? 28 : 30}px "Plus Jakarta Sans", sans-serif`;
        ctx.fillStyle = 'rgba(212, 212, 216, 0.78)';
        ctx.textAlign = 'center';

        const subWords = activeScene.subtext.split(/\s+/);
        const subLines: string[] = [];
        let buf = '';
        for (const sw of subWords) {
          const test = buf ? `${buf} ${sw}` : sw;
          if (ctx.measureText(test).width > maxTextWidth && buf) {
            subLines.push(buf);
            buf = sw;
          } else {
            buf = test;
          }
        }
        if (buf) subLines.push(buf);

        const subStartY = startY + totalH + 36;
        subLines.forEach((sl, idx) => {
          ctx.fillText(sl, 0, subStartY + idx * 42);
        });
      }

      ctx.restore();
    }

    // Audio Spectrum Minimalist Bar Strip near bottom
    const barCount = 32;
    const spectrumW = Math.min(width * 0.55, 420);
    const barW = spectrumW / barCount;
    const baseY = height - (width > height ? 110 : 175);
    ctx.fillStyle = 'rgba(244, 244, 245, 0.25)';
    for (let i = 0; i < barCount; i++) {
      const val = metrics.waveformBars[i] ?? 0.08;
      const barH = Math.max(4, val * 44);
      ctx.fillRect(
        width / 2 - spectrumW / 2 + i * barW + 2,
        baseY - barH / 2,
        Math.max(2, barW - 4),
        barH
      );
    }

    // Watermark & Track Metadata
    const bottomPad = width > height ? 48 : 90;
    ctx.textAlign = 'center';
    if (style.watermarkHandle.trim()) {
      ctx.font = `500 ${width > height ? 22 : 25}px "JetBrains Mono", monospace`;
      ctx.fillStyle = 'rgba(244, 244, 245, 0.58)';
      ctx.fillText(style.watermarkHandle.trim(), width / 2, height - bottomPad);
    }
    if (songTitle) {
      ctx.font = `500 ${width > height ? 18 : 20}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = 'rgba(161, 161, 170, 0.5)';
      ctx.fillText(
        songArtist ? `${songTitle} · ${songArtist}` : songTitle,
        width / 2,
        height - bottomPad + (style.watermarkHandle.trim() ? 32 : 0)
      );
    }

    // Progress Hairline
    const pct = Math.min(1, Math.max(0, currentTime / Math.max(1, durationSec)));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(0, height - 6, width, 6);
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(0, height - 6, width * pct, 6);

    ctx.restore();
  }
}

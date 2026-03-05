export interface VizState {
  beatPhase: number;
  bpm: number;
  time: number;
  width: number;
  height: number;
  isPlaying: boolean;
  progress: number; // 0-1 track progress
  colors: string[];
  /** 0-1, spikes on beat then decays */
  beatEnergy: number;
  /** 0-1 normalized loudness of current segment */
  loudness: number;
}

export interface Visualization {
  name: string;
  draw(ctx: CanvasRenderingContext2D, state: VizState): void;
}

// --- Waveform Visualization ---
export const waveformViz: Visualization = {
  name: "Waveform",
  draw(ctx, state) {
    const { width, height, beatPhase, time, isPlaying, colors, beatEnergy, loudness } = state;
    const cx = width / 2;
    const cy = height / 2;

    // Beat energy drives amplitude punch
    const punch = beatEnergy * beatEnergy; // quadratic for snappier feel
    const vol = 0.3 + loudness * 0.7;

    for (let layer = 0; layer < 4; layer++) {
      const color = colors[layer % colors.length];
      const alpha = isPlaying ? (0.4 + punch * 0.5) - layer * 0.08 : 0.15;
      ctx.strokeStyle = color;
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.lineWidth = (3 + punch * 4) - layer * 0.5;
      ctx.beginPath();

      for (let x = 0; x < width; x += 2) {
        const normalizedX = x / width;
        const frequency = 2 + layer * 1.5;
        const baseAmp = isPlaying ? 40 + 100 * vol : 20;
        const amplitude =
          baseAmp *
          (1 + punch * 1.5) *
          Math.sin(normalizedX * Math.PI);
        const y =
          cy +
          amplitude *
            Math.sin(normalizedX * frequency * Math.PI * 2 + time * (1 + layer * 0.3));

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Center glow - pulses hard on beat
    if (isPlaying) {
      const glowRadius = 40 + 80 * punch + 20 * loudness;
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
      gradient.addColorStop(0, colors[0] + (punch > 0.3 ? "80" : "30"));
      gradient.addColorStop(0.5, colors[1] + "20");
      gradient.addColorStop(1, "transparent");
      ctx.globalAlpha = 0.4 + punch * 0.6;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  },
};

// --- Particle Visualization ---
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

const particles: Particle[] = [];
let lastBeatPhase = 0;

export const particleViz: Visualization = {
  name: "Particles",
  draw(ctx, state) {
    const { width, height, beatPhase, isPlaying, colors, beatEnergy, loudness } = state;
    const cx = width / 2;
    const cy = height / 2;
    const punch = beatEnergy * beatEnergy;

    // Spawn burst of particles on beat hit (energy spike)
    if (isPlaying && beatEnergy > 0.7 && beatPhase < lastBeatPhase + 0.05) {
      const count = 16 + Math.floor(loudness * 20);
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
        const speed = 3 + Math.random() * 6 + loudness * 4;
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          maxLife: 1,
          size: 4 + Math.random() * 6 + punch * 4,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    }
    // Also spawn on regular beat phase wrap
    if (isPlaying && beatPhase < lastBeatPhase) {
      const count = 8 + Math.floor(Math.random() * 6);
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
        const speed = 2 + Math.random() * 3;
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          maxLife: 1,
          size: 2 + Math.random() * 4,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    }
    lastBeatPhase = beatPhase;

    // Ambient particles scale with loudness
    if (isPlaying && Math.random() > (1 - loudness * 0.5)) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 80 + Math.random() * 180;
      particles.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * (1 + loudness),
        vy: (Math.random() - 0.5) * (1 + loudness) - 0.5,
        life: 1,
        maxLife: 1,
        size: 1 + Math.random() * 3 + loudness * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    // Update and draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.01;
      p.vx *= 0.98;
      p.vy *= 0.98;

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.globalAlpha = p.life * 0.8;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();

      // Glow effect on high energy particles
      if (punch > 0.3 && p.size > 4) {
        ctx.globalAlpha = p.life * 0.15;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Limit particle count
    while (particles.length > 500) particles.shift();

    // Center pulse - explodes on beat
    if (isPlaying) {
      const pulseSize = 20 + punch * 80 + loudness * 30;
      ctx.globalAlpha = 0.2 + punch * 0.6;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, pulseSize);
      grad.addColorStop(0, colors[0] + "cc");
      grad.addColorStop(0.4, colors[1] + "40");
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, pulseSize, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  },
};

// --- Circular Bars Visualization ---
export const circularViz: Visualization = {
  name: "Circular",
  draw(ctx, state) {
    const { width, height, beatPhase, isPlaying, colors, time, beatEnergy, loudness } = state;
    const cx = width / 2;
    const cy = height / 2;
    const punch = beatEnergy * beatEnergy;
    const barCount = 64;
    // Inner radius breathes with beat
    const baseInnerRadius = Math.min(width, height) * 0.15;
    const innerRadius = baseInnerRadius * (1 + punch * 0.15);
    const maxBarHeight = Math.min(width, height) * (0.2 + loudness * 0.15);

    for (let i = 0; i < barCount; i++) {
      const angle = (Math.PI * 2 * i) / barCount - Math.PI / 2;
      const normalizedI = i / barCount;

      // Bar height responds to beat energy + loudness
      const wave = Math.abs(
        Math.sin(
          beatPhase * Math.PI * 2 +
            normalizedI * Math.PI * 4 +
            time * 0.5
        )
      );
      const barHeight = isPlaying
        ? maxBarHeight *
          (0.15 + 0.4 * wave + 0.45 * punch * (0.5 + 0.5 * Math.sin(normalizedI * Math.PI * 6)))
        : maxBarHeight * 0.1;

      const colorIndex = Math.floor(normalizedI * colors.length);
      ctx.strokeStyle = colors[colorIndex % colors.length];
      ctx.globalAlpha = isPlaying ? 0.5 + 0.5 * punch + 0.2 * (barHeight / maxBarHeight) : 0.2;
      ctx.lineWidth = (Math.PI * 2 * innerRadius) / barCount / 2 + punch * 2;
      ctx.lineCap = "round";

      const x1 = cx + Math.cos(angle) * innerRadius;
      const y1 = cy + Math.sin(angle) * innerRadius;
      const x2 = cx + Math.cos(angle) * (innerRadius + barHeight);
      const y2 = cy + Math.sin(angle) * (innerRadius + barHeight);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Inner circle glow - pumps on beat
    const glowSize = innerRadius * (1 + punch * 0.5);
    const gradient = ctx.createRadialGradient(
      cx, cy, 0,
      cx, cy, glowSize
    );
    gradient.addColorStop(0, colors[0] + (punch > 0.3 ? "90" : "30"));
    gradient.addColorStop(0.6, colors[1] + "20");
    gradient.addColorStop(1, "transparent");
    ctx.globalAlpha = 0.3 + punch * 0.7;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, glowSize, 0, Math.PI * 2);
    ctx.fill();

    // Outer ring flash on beat
    if (punch > 0.2) {
      ctx.globalAlpha = punch * 0.3;
      ctx.strokeStyle = colors[2];
      ctx.lineWidth = 2 + punch * 4;
      ctx.beginPath();
      ctx.arc(cx, cy, innerRadius + maxBarHeight * (0.5 + punch * 0.5), 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  },
};

// --- VJ Loop Visualization ---
export const vjLoopViz: Visualization = {
  name: "VJ Loop",
  draw(ctx, state) {
    const { width, height, beatPhase, isPlaying, colors, time, beatEnergy, loudness } = state;
    const cx = width / 2;
    const cy = height / 2;
    const punch = beatEnergy * beatEnergy;

    // Background flash on hard beats
    if (punch > 0.5) {
      ctx.globalAlpha = (punch - 0.5) * 0.15;
      ctx.fillStyle = colors[Math.floor(time * 2) % colors.length];
      ctx.fillRect(0, 0, width, height);
    }

    const shapeCount = 6;
    for (let s = 0; s < shapeCount; s++) {
      const progress = (s / shapeCount + time * 0.05) % 1;
      const scale = isPlaying
        ? 0.2 + progress * 0.8 + punch * 0.3
        : 0.3 + progress * 0.3;
      const radius = Math.min(width, height) * 0.4 * scale;
      const rotation = time * (0.2 + punch * 0.5) + s * (Math.PI / shapeCount);
      const sides = 3 + (s % 4);
      const alpha = isPlaying ? (1 - progress) * (0.3 + punch * 0.5 + loudness * 0.2) : 0.1;

      ctx.strokeStyle = colors[s % colors.length];
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.lineWidth = 2 + punch * 3;
      ctx.beginPath();

      for (let i = 0; i <= sides; i++) {
        const angle = (Math.PI * 2 * i) / sides + rotation;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // Connecting lines - burst on beat
    if (isPlaying) {
      const lineCount = 12 + Math.floor(punch * 12);
      ctx.lineWidth = 1 + punch * 3;
      for (let i = 0; i < lineCount; i++) {
        const angle = (Math.PI * 2 * i) / lineCount + time * 0.1;
        const len =
          Math.min(width, height) *
          (0.15 + loudness * 0.2 + punch * 0.25) *
          (0.5 + 0.5 * Math.sin(beatPhase * Math.PI * 2 + i));
        ctx.globalAlpha = 0.1 + punch * 0.3;
        ctx.strokeStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
  },
};

export const visualizations: Visualization[] = [
  waveformViz,
  particleViz,
  circularViz,
  vjLoopViz,
];

// --- Viz Engine ---
export class VizEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animationId: number = 0;
  private lastTime: number = 0;

  bpm: number = 120;
  beatPhase: number = 0;
  isPlaying: boolean = false;
  progress: number = 0;
  currentViz: Visualization = waveformViz;
  colors: string[] = ["#89b4fa", "#cba6f7", "#94e2d5", "#f5c2e7", "#a6e3a1"];
  beatEnergy: number = 0;
  loudness: number = 0.5;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
  }

  start() {
    this.lastTime = performance.now();
    this.loop();
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = 0;
    }
  }

  private loop = () => {
    const now = performance.now();
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    if (this.isPlaying) {
      this.beatPhase += (this.bpm / 60) * dt;
      this.beatPhase %= 1.0;
    }

    // Handle resize
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (
      this.canvas.width !== rect.width * dpr ||
      this.canvas.height !== rect.height * dpr
    ) {
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.ctx.scale(dpr, dpr);
    }

    this.ctx.clearRect(0, 0, rect.width, rect.height);

    this.currentViz.draw(this.ctx, {
      beatPhase: this.beatPhase,
      bpm: this.bpm,
      time: now / 1000,
      width: rect.width,
      height: rect.height,
      isPlaying: this.isPlaying,
      progress: this.progress,
      colors: this.colors,
      beatEnergy: this.beatEnergy,
      loudness: this.loudness,
    });

    this.animationId = requestAnimationFrame(this.loop);
  };
}

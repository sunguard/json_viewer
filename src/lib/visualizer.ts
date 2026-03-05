export interface VizState {
  beatPhase: number;
  bpm: number;
  time: number;
  width: number;
  height: number;
  isPlaying: boolean;
  progress: number; // 0-1 track progress
  colors: string[];
}

export interface Visualization {
  name: string;
  draw(ctx: CanvasRenderingContext2D, state: VizState): void;
}

// --- Waveform Visualization ---
export const waveformViz: Visualization = {
  name: "Waveform",
  draw(ctx, state) {
    const { width, height, beatPhase, time, isPlaying, colors } = state;
    const cx = width / 2;
    const cy = height / 2;

    for (let layer = 0; layer < 4; layer++) {
      const color = colors[layer % colors.length];
      const alpha = isPlaying ? 0.6 - layer * 0.1 : 0.15;
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 3 - layer * 0.5;
      ctx.beginPath();

      for (let x = 0; x < width; x += 2) {
        const normalizedX = x / width;
        const frequency = 2 + layer * 1.5;
        const amplitude =
          (isPlaying ? 80 : 20) *
          (1 + 0.5 * Math.sin(beatPhase * Math.PI * 2)) *
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

    // Center glow
    if (isPlaying) {
      const glowRadius = 60 + 30 * Math.sin(beatPhase * Math.PI * 2);
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
      gradient.addColorStop(0, colors[0] + "40");
      gradient.addColorStop(1, "transparent");
      ctx.globalAlpha = 0.5;
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
    const { width, height, beatPhase, isPlaying, colors } = state;
    const cx = width / 2;
    const cy = height / 2;

    // Spawn particles on beat
    if (isPlaying && beatPhase < lastBeatPhase) {
      const count = 12 + Math.floor(Math.random() * 8);
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
        const speed = 2 + Math.random() * 4;
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          maxLife: 1,
          size: 3 + Math.random() * 5,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    }
    lastBeatPhase = beatPhase;

    // Always add ambient particles
    if (isPlaying && Math.random() > 0.7) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 100 + Math.random() * 150;
      particles.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 1,
        vy: (Math.random() - 0.5) * 1 - 0.5,
        life: 1,
        maxLife: 1,
        size: 1 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    // Update and draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.008;
      p.vx *= 0.99;
      p.vy *= 0.99;

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.globalAlpha = p.life * 0.8;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }

    // Limit particle count
    while (particles.length > 300) particles.shift();

    // Center pulse
    if (isPlaying) {
      const pulse = Math.sin(beatPhase * Math.PI * 2) * 0.5 + 0.5;
      const radius = 30 + pulse * 40;
      ctx.globalAlpha = 0.3 + pulse * 0.2;
      ctx.fillStyle = colors[0];
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  },
};

// --- Circular Bars Visualization ---
export const circularViz: Visualization = {
  name: "Circular",
  draw(ctx, state) {
    const { width, height, beatPhase, isPlaying, colors, time } = state;
    const cx = width / 2;
    const cy = height / 2;
    const barCount = 64;
    const innerRadius = Math.min(width, height) * 0.15;
    const maxBarHeight = Math.min(width, height) * 0.25;

    for (let i = 0; i < barCount; i++) {
      const angle = (Math.PI * 2 * i) / barCount - Math.PI / 2;
      const normalizedI = i / barCount;

      const barHeight = isPlaying
        ? maxBarHeight *
          (0.3 +
            0.7 *
              Math.abs(
                Math.sin(
                  beatPhase * Math.PI * 2 +
                    normalizedI * Math.PI * 4 +
                    time * 0.5
                )
              ))
        : maxBarHeight * 0.1;

      const colorIndex = Math.floor(normalizedI * colors.length);
      ctx.strokeStyle = colors[colorIndex % colors.length];
      ctx.globalAlpha = isPlaying ? 0.7 + 0.3 * (barHeight / maxBarHeight) : 0.2;
      ctx.lineWidth = (Math.PI * 2 * innerRadius) / barCount / 2;
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

    // Inner circle glow
    const glowPulse = isPlaying
      ? 0.5 + 0.5 * Math.sin(beatPhase * Math.PI * 2)
      : 0.2;
    const gradient = ctx.createRadialGradient(
      cx, cy, 0,
      cx, cy, innerRadius
    );
    gradient.addColorStop(0, colors[0] + "30");
    gradient.addColorStop(1, "transparent");
    ctx.globalAlpha = glowPulse;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
  },
};

// --- VJ Loop Visualization ---
export const vjLoopViz: Visualization = {
  name: "VJ Loop",
  draw(ctx, state) {
    const { width, height, beatPhase, isPlaying, colors, time } = state;
    const cx = width / 2;
    const cy = height / 2;

    const shapeCount = 6;
    for (let s = 0; s < shapeCount; s++) {
      const progress = (s / shapeCount + time * 0.05) % 1;
      const scale = isPlaying
        ? 0.2 + progress * 0.8 + 0.1 * Math.sin(beatPhase * Math.PI * 2)
        : 0.3 + progress * 0.3;
      const radius = Math.min(width, height) * 0.4 * scale;
      const rotation = time * 0.2 + s * (Math.PI / shapeCount);
      const sides = 3 + (s % 4);
      const alpha = isPlaying ? (1 - progress) * 0.5 : 0.1;

      ctx.strokeStyle = colors[s % colors.length];
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 2;
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

    // Connecting lines
    if (isPlaying) {
      ctx.globalAlpha = 0.15;
      ctx.strokeStyle = colors[0];
      ctx.lineWidth = 1;
      for (let i = 0; i < 12; i++) {
        const angle = (Math.PI * 2 * i) / 12 + time * 0.1;
        const len =
          Math.min(width, height) *
          0.3 *
          (0.5 + 0.5 * Math.sin(beatPhase * Math.PI * 2 + i));
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
    });

    this.animationId = requestAnimationFrame(this.loop);
  };
}

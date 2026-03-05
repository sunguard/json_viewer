export interface VizState {
  beatPhase: number;
  bpm: number;
  time: number;
  width: number;
  height: number;
  isPlaying: boolean;
  progress: number;
  colors: string[];
  /** 0-1, spikes on beat then decays */
  beatEnergy: number;
  /** 0-1 normalized loudness of current segment */
  loudness: number;
  /** 0-1 normalized bass energy from timbre */
  bass: number;
  /** 0-1 normalized treble energy from timbre */
  treble: number;
}

// --- Particle Types ---
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: "burst" | "ambient" | "ring" | "spark" | "trail";
  angle?: number;
  radius?: number;
  growSpeed?: number;
}

// --- State ---
const particles: Particle[] = [];
let lastBeatEnergy = 0;
let lastTime = 0;
let cameraShake = 0;
let bgFlash = 0;
let bgFlashColor = "#ffffff";
let ringQueue: { time: number; energy: number }[] = [];

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function lerpColor(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}

export const particleViz = {
  name: "Particles",
  draw(ctx: CanvasRenderingContext2D, state: VizState) {
    const { width, height, isPlaying, colors, beatEnergy, loudness, bass, treble, time, bpm } = state;
    const cx = width / 2;
    const cy = height / 2;
    const dt = lastTime ? time - lastTime : 1 / 60;
    lastTime = time;

    const punch = beatEnergy * beatEnergy;
    const bassPunch = bass * bass;
    const isBeatHit = beatEnergy > 0.6 && beatEnergy > lastBeatEnergy + 0.2;
    const isHardBeat = beatEnergy > 0.85 && beatEnergy > lastBeatEnergy + 0.3;

    // --- Camera shake on hard beats ---
    if (isHardBeat) {
      cameraShake = 8 + bass * 12;
      bgFlash = 0.4 + bass * 0.3;
      bgFlashColor = colors[Math.floor(Math.random() * colors.length)];
    }
    cameraShake *= 0.85;
    bgFlash *= 0.88;

    const shakeX = cameraShake * (Math.random() - 0.5) * 2;
    const shakeY = cameraShake * (Math.random() - 0.5) * 2;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // --- Background flash ---
    if (bgFlash > 0.02) {
      ctx.globalAlpha = bgFlash * 0.15;
      ctx.fillStyle = bgFlashColor;
      ctx.fillRect(-10, -10, width + 20, height + 20);
    }

    // --- Vignette glow at center scales with loudness ---
    if (isPlaying) {
      const vignetteR = 150 + loudness * 200 + punch * 100;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, vignetteR);
      const baseColor = lerpColor(colors[0], colors[1], (Math.sin(time * 0.3) + 1) / 2);
      grad.addColorStop(0, hexToRgba(colors[0], 0.06 + punch * 0.15 + bassPunch * 0.1));
      grad.addColorStop(0.5, hexToRgba(baseColor.startsWith("#") ? baseColor : colors[1], 0.02 + punch * 0.05));
      grad.addColorStop(1, "transparent");
      ctx.globalAlpha = 1;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, vignetteR, 0, Math.PI * 2);
      ctx.fill();
    }

    // === SPAWN PARTICLES ===
    if (isPlaying) {
      // --- Beat burst: explosive from center ---
      if (isBeatHit) {
        const count = 20 + Math.floor(bass * 30 + loudness * 15);
        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
          const speed = 4 + Math.random() * 8 + bass * 8 + loudness * 3;
          const lifespan = 0.6 + Math.random() * 0.8 + loudness * 0.4;
          particles.push({
            x: cx + (Math.random() - 0.5) * 20,
            y: cy + (Math.random() - 0.5) * 20,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: lifespan,
            maxLife: lifespan,
            size: 3 + Math.random() * 5 + bassPunch * 6,
            color: colors[Math.floor(Math.random() * colors.length)],
            type: "burst",
          });
        }
        // Queue expanding ring
        ringQueue.push({ time, energy: beatEnergy });
      }

      // --- Hard beat: sparks fly outward fast ---
      if (isHardBeat) {
        const sparkCount = 12 + Math.floor(bass * 15);
        for (let i = 0; i < sparkCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 10 + Math.random() * 12 + bass * 6;
          particles.push({
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0.3 + Math.random() * 0.3,
            maxLife: 0.5,
            size: 1.5 + Math.random() * 2,
            color: "#ffffff",
            type: "spark",
          });
        }
      }

      // --- Ambient particles: continuous, density scales with loudness ---
      const ambientRate = 0.3 + loudness * 0.7 + treble * 0.3;
      if (Math.random() < ambientRate) {
        const edge = Math.random() > 0.5;
        let x: number, y: number, vx: number, vy: number;
        if (edge) {
          // Spawn from edges, drift inward
          const side = Math.floor(Math.random() * 4);
          if (side === 0) { x = Math.random() * width; y = -10; vx = (Math.random() - 0.5) * 1.5; vy = 0.5 + Math.random(); }
          else if (side === 1) { x = Math.random() * width; y = height + 10; vx = (Math.random() - 0.5) * 1.5; vy = -(0.5 + Math.random()); }
          else if (side === 2) { x = -10; y = Math.random() * height; vx = 0.5 + Math.random(); vy = (Math.random() - 0.5) * 1.5; }
          else { x = width + 10; y = Math.random() * height; vx = -(0.5 + Math.random()); vy = (Math.random() - 0.5) * 1.5; }
        } else {
          // Spawn around center with offset
          const angle = Math.random() * Math.PI * 2;
          const dist = 30 + Math.random() * 200;
          x = cx + Math.cos(angle) * dist;
          y = cy + Math.sin(angle) * dist;
          vx = (Math.random() - 0.5) * (1 + loudness * 2);
          vy = (Math.random() - 0.5) * (1 + loudness * 2) - 0.3;
        }
        const lifespan = 1.5 + Math.random() * 2;
        particles.push({
          x, y, vx, vy,
          life: lifespan,
          maxLife: lifespan,
          size: 1 + Math.random() * 2.5 + loudness * 2 + treble * 1.5,
          color: colors[Math.floor(Math.random() * colors.length)],
          type: "ambient",
        });
      }

      // --- Trail particles on bass: orbit around center ---
      if (bassPunch > 0.15 && Math.random() < bassPunch * 0.8) {
        const angle = Math.random() * Math.PI * 2;
        const orbitR = 60 + Math.random() * 120 + loudness * 80;
        const lifespan = 1.0 + Math.random() * 1.5;
        particles.push({
          x: cx + Math.cos(angle) * orbitR,
          y: cy + Math.sin(angle) * orbitR,
          vx: 0, vy: 0,
          life: lifespan,
          maxLife: lifespan,
          size: 2 + Math.random() * 3 + bassPunch * 4,
          color: colors[Math.floor(Math.random() * colors.length)],
          type: "trail",
          angle,
          radius: orbitR,
          growSpeed: 0.8 + Math.random() * 1.5 + bassPunch * 2,
        });
      }
    }

    lastBeatEnergy = beatEnergy;

    // === UPDATE & DRAW PARTICLES ===
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const lifeRatio = p.life / p.maxLife;

      if (p.type === "trail" && p.angle !== undefined && p.radius !== undefined && p.growSpeed !== undefined) {
        // Orbit and slowly expand
        p.angle += dt * p.growSpeed;
        p.radius += dt * (20 + loudness * 40);
        p.x = cx + Math.cos(p.angle) * p.radius;
        p.y = cy + Math.sin(p.angle) * p.radius;
      } else {
        p.x += p.vx;
        p.y += p.vy;

        if (p.type === "burst") {
          p.vx *= 0.96;
          p.vy *= 0.96;
          // Slight gravity
          p.vy += 0.03;
        } else if (p.type === "spark") {
          p.vx *= 0.92;
          p.vy *= 0.92;
        } else {
          p.vx *= 0.99;
          p.vy *= 0.99;
        }
      }

      p.life -= dt;

      if (p.life <= 0 || p.x < -50 || p.x > width + 50 || p.y < -50 || p.y > height + 50) {
        particles.splice(i, 1);
        continue;
      }

      // Fade in quickly, fade out smoothly
      const fadeIn = Math.min(1, (1 - lifeRatio) * 5);
      const fadeOut = lifeRatio < 0.3 ? lifeRatio / 0.3 : 1;
      const alpha = fadeIn * fadeOut;

      const currentSize = p.size * (0.3 + 0.7 * lifeRatio);

      // Draw glow for burst/trail particles
      if ((p.type === "burst" || p.type === "trail") && currentSize > 2) {
        ctx.globalAlpha = alpha * 0.2;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, currentSize * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Main particle
      ctx.globalAlpha = alpha * (p.type === "spark" ? 0.9 : 0.75);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
      ctx.fill();

      // Bright core for sparks
      if (p.type === "spark") {
        ctx.globalAlpha = alpha * 0.8;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, currentSize * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // === EXPANDING RINGS ===
    for (let i = ringQueue.length - 1; i >= 0; i--) {
      const ring = ringQueue[i];
      const elapsed = time - ring.time;
      const maxTime = 1.2;
      if (elapsed > maxTime) {
        ringQueue.splice(i, 1);
        continue;
      }
      const t = elapsed / maxTime;
      const radius = 20 + t * (200 + ring.energy * 200 + bass * 100);
      const alpha = (1 - t) * (0.3 + ring.energy * 0.4);
      const lineWidth = (1 - t) * (2 + ring.energy * 4);
      const colorIdx = i % colors.length;

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = colors[colorIdx];
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Second ring slightly delayed
      if (elapsed > 0.08) {
        const t2 = (elapsed - 0.08) / maxTime;
        const r2 = 20 + t2 * (180 + ring.energy * 150);
        ctx.globalAlpha = alpha * 0.4;
        ctx.lineWidth = lineWidth * 0.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // === CENTER CORE ===
    if (isPlaying) {
      // Pulsating core orb
      const coreSize = 8 + punch * 35 + bassPunch * 25 + loudness * 12;
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreSize);
      const coreColor = lerpColor(
        colors[0],
        colors[Math.floor(time * 0.5) % colors.length],
        0.5 + 0.5 * Math.sin(time * 2)
      );
      coreGrad.addColorStop(0, hexToRgba(coreColor.startsWith("#") ? coreColor : colors[0], 0.8 + punch * 0.2));
      coreGrad.addColorStop(0.3, hexToRgba(colors[1], 0.3 + punch * 0.3));
      coreGrad.addColorStop(0.7, hexToRgba(colors[2], 0.05 + punch * 0.1));
      coreGrad.addColorStop(1, "transparent");
      ctx.globalAlpha = 0.6 + punch * 0.4;
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, coreSize, 0, Math.PI * 2);
      ctx.fill();

      // Outer halo
      const haloSize = coreSize * (2 + punch + loudness * 0.5);
      const haloGrad = ctx.createRadialGradient(cx, cy, coreSize * 0.5, cx, cy, haloSize);
      haloGrad.addColorStop(0, hexToRgba(colors[0], 0.08 + punch * 0.12));
      haloGrad.addColorStop(1, "transparent");
      ctx.globalAlpha = 0.5 + punch * 0.5;
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, haloSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Limit particle count
    while (particles.length > 800) particles.shift();
    // Trim old rings
    while (ringQueue.length > 8) ringQueue.shift();

    ctx.restore();
    ctx.globalAlpha = 1;
  },
};

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
  colors: string[] = ["#89b4fa", "#cba6f7", "#94e2d5", "#f5c2e7", "#a6e3a1"];
  beatEnergy: number = 0;
  loudness: number = 0.5;
  bass: number = 0;
  treble: number = 0;

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

    particleViz.draw(this.ctx, {
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
      bass: this.bass,
      treble: this.treble,
    });

    this.animationId = requestAnimationFrame(this.loop);
  };
}

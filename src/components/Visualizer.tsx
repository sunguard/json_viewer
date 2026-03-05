"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { VizEngine, visualizations } from "@/lib/visualizer";

interface VisualizerProps {
  isPlaying: boolean;
  progress: number;
  trackUri: string | null;
}

export default function Visualizer({
  isPlaying,
  progress,
  trackUri,
}: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<VizEngine | null>(null);
  const [vizIndex, setVizIndex] = useState(0);
  const [bpm, setBpm] = useState(120);

  // Initialize engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new VizEngine(canvas);
    engine.start();
    engineRef.current = engine;

    return () => {
      engine.stop();
      engineRef.current = null;
    };
  }, []);

  // Sync state to engine
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.isPlaying = isPlaying;
    engineRef.current.progress = progress;
    engineRef.current.bpm = bpm;
    engineRef.current.currentViz = visualizations[vizIndex];
  }, [isPlaying, progress, bpm, vizIndex]);

  // Reset beat phase on track change
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.beatPhase = 0;
    }
  }, [trackUri]);

  const cycleViz = useCallback(() => {
    setVizIndex((prev) => (prev + 1) % visualizations.length);
  }, []);

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: "block" }}
      />

      {/* Controls overlay */}
      <div className="absolute bottom-4 right-4 flex items-center gap-3">
        {/* Viz mode button */}
        <button
          onClick={cycleViz}
          className="px-3 py-1.5 bg-crust/70 backdrop-blur-sm text-sm text-text rounded-lg border border-border/50 hover:bg-surface/70 transition-colors"
        >
          {visualizations[vizIndex].name}
        </button>

        {/* BPM control */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-crust/70 backdrop-blur-sm rounded-lg border border-border/50">
          <button
            onClick={() => setBpm((b) => Math.max(60, b - 10))}
            className="text-muted hover:text-text text-sm"
          >
            -
          </button>
          <span className="text-xs text-text tabular-nums w-12 text-center">
            {bpm} BPM
          </span>
          <button
            onClick={() => setBpm((b) => Math.min(200, b + 10))}
            className="text-muted hover:text-text text-sm"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { VizEngine, visualizations } from "@/lib/visualizer";
import { useBeatSync } from "@/hooks/useBeatSync";

interface VisualizerProps {
  isPlaying: boolean;
  progress: number;
  trackUri: string | null;
  positionMs: number;
  accessToken: string | null;
}

function extractTrackId(uri: string | null): string | null {
  if (!uri) return null;
  // spotify:track:XXXX
  const parts = uri.split(":");
  return parts.length === 3 ? parts[2] : null;
}

export default function Visualizer({
  isPlaying,
  progress,
  trackUri,
  positionMs,
  accessToken,
}: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<VizEngine | null>(null);
  const [vizIndex, setVizIndex] = useState(0);
  const [bpm, setBpm] = useState(120);

  const trackId = extractTrackId(trackUri);
  const beatSync = useBeatSync(trackId, positionMs, !isPlaying, accessToken);

  // Auto-set BPM from analysis
  useEffect(() => {
    if (beatSync.hasAnalysis && beatSync.bpm > 0) {
      setBpm(Math.round(beatSync.bpm));
    }
  }, [beatSync.hasAnalysis, beatSync.bpm]);

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
    engineRef.current.beatEnergy = beatSync.beatEnergy;
    engineRef.current.loudness = beatSync.loudness;
  }, [isPlaying, progress, bpm, vizIndex, beatSync.beatEnergy, beatSync.loudness]);

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
        {/* Beat sync indicator */}
        {beatSync.hasAnalysis && (
          <div className="px-2 py-1 bg-crust/70 backdrop-blur-sm rounded-lg border border-border/50">
            <span className="text-xs text-green">Beat Sync</span>
          </div>
        )}

        {/* Viz mode button */}
        <button
          onClick={cycleViz}
          className="px-3 py-1.5 bg-crust/70 backdrop-blur-sm text-sm text-text rounded-lg border border-border/50 hover:bg-surface/70 transition-colors"
        >
          {visualizations[vizIndex].name}
        </button>

        {/* BPM display (auto from analysis or manual) */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-crust/70 backdrop-blur-sm rounded-lg border border-border/50">
          {!beatSync.hasAnalysis && (
            <button
              onClick={() => setBpm((b) => Math.max(60, b - 10))}
              className="text-muted hover:text-text text-sm"
            >
              -
            </button>
          )}
          <span className="text-xs text-text tabular-nums w-12 text-center">
            {bpm} BPM
          </span>
          {!beatSync.hasAnalysis && (
            <button
              onClick={() => setBpm((b) => Math.min(200, b + 10))}
              className="text-muted hover:text-text text-sm"
            >
              +
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

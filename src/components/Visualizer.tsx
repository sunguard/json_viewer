"use client";

import { useRef, useEffect, useState } from "react";
import { VizEngine } from "@/lib/visualizer";
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
    engineRef.current.beatEnergy = beatSync.beatEnergy;
    engineRef.current.loudness = beatSync.loudness;
    engineRef.current.bass = beatSync.bass;
    engineRef.current.treble = beatSync.treble;
  }, [isPlaying, progress, bpm, beatSync.beatEnergy, beatSync.loudness, beatSync.bass, beatSync.treble]);

  // Reset beat phase on track change
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.beatPhase = 0;
    }
  }, [trackUri]);

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: "block" }}
      />

      {/* Minimal overlay */}
      <div className="absolute bottom-4 right-4 flex items-center gap-3">
        {beatSync.hasAnalysis && (
          <div className="px-2 py-1 bg-crust/70 backdrop-blur-sm rounded-lg border border-border/50">
            <span className="text-xs text-green">Beat Sync</span>
          </div>
        )}
        <div className="px-3 py-1.5 bg-crust/70 backdrop-blur-sm rounded-lg border border-border/50">
          <span className="text-xs text-text tabular-nums">
            {bpm} BPM
          </span>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import {
  getAudioAnalysis,
  type AudioAnalysis,
} from "@/lib/spotify";

export interface BeatSyncState {
  /** 0-1, spikes to 1 on beat then decays quickly */
  beatEnergy: number;
  /** 0-1 normalized loudness of current segment */
  loudness: number;
  /** 0-1 bass energy from timbre[0] */
  bass: number;
  /** 0-1 treble energy from timbre high bands */
  treble: number;
  /** Auto-detected BPM from current section */
  bpm: number;
  /** Whether analysis data is loaded */
  hasAnalysis: boolean;
}

function binarySearch<T extends { start: number }>(
  arr: T[],
  time: number
): number {
  let lo = 0;
  let hi = arr.length - 1;
  let result = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].start <= time) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}

export function useBeatSync(
  trackId: string | null,
  positionMs: number,
  isPaused: boolean,
  accessToken: string | null
): BeatSyncState {
  const [analysis, setAnalysis] = useState<AudioAnalysis | null>(null);
  const [hasAnalysis, setHasAnalysis] = useState(false);
  const beatEnergyRef = useRef(0);
  const lastBeatIndexRef = useRef(-1);
  const stateRef = useRef<BeatSyncState>({
    beatEnergy: 0,
    loudness: 0,
    bass: 0,
    treble: 0,
    bpm: 120,
    hasAnalysis: false,
  });
  const [state, setState] = useState<BeatSyncState>(stateRef.current);
  const animFrameRef = useRef(0);
  const lastUpdateRef = useRef(0);

  // Fetch analysis when track changes
  useEffect(() => {
    if (!trackId || !accessToken) {
      setAnalysis(null);
      setHasAnalysis(false);
      lastBeatIndexRef.current = -1;
      return;
    }

    let cancelled = false;
    setHasAnalysis(false);
    lastBeatIndexRef.current = -1;

    getAudioAnalysis(trackId, accessToken)
      .then((data) => {
        if (!cancelled) {
          setAnalysis(data);
          setHasAnalysis(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAnalysis(null);
          setHasAnalysis(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [trackId, accessToken]);

  // Update beat sync state at high frequency
  useEffect(() => {
    if (!analysis || isPaused) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = 0;
      }
      return;
    }

    const { beats, segments, sections } = analysis;
    if (!beats.length) return;

    // Precompute loudness range for normalization
    let minLoudness = 0;
    let maxLoudness = -60;
    for (const seg of segments) {
      if (seg.loudness_max > maxLoudness) maxLoudness = seg.loudness_max;
      if (seg.loudness_start < minLoudness) minLoudness = seg.loudness_start;
    }
    const loudnessRange = maxLoudness - minLoudness || 1;

    // Precompute timbre ranges for bass/treble normalization
    let minBass = Infinity, maxBass = -Infinity;
    let minTreble = Infinity, maxTreble = -Infinity;
    for (const seg of segments) {
      if (seg.timbre && seg.timbre.length >= 12) {
        // timbre[0] = overall loudness/bass energy
        // timbre[1] = brightness, timbre[2+] = higher harmonics
        const bassVal = seg.timbre[0];
        const trebleVal = (seg.timbre[3] + seg.timbre[4] + seg.timbre[5]) / 3;
        if (bassVal < minBass) minBass = bassVal;
        if (bassVal > maxBass) maxBass = bassVal;
        if (trebleVal < minTreble) minTreble = trebleVal;
        if (trebleVal > maxTreble) maxTreble = trebleVal;
      }
    }
    const bassRange = maxBass - minBass || 1;
    const trebleRange = maxTreble - minTreble || 1;

    const tick = () => {
      const now = performance.now();
      const dt = (now - (lastUpdateRef.current || now)) / 1000;
      lastUpdateRef.current = now;

      const timeSec = positionMs / 1000;

      // Find current beat
      const beatIdx = binarySearch(beats, timeSec);
      const beat = beats[beatIdx];

      // Detect new beat
      if (beatIdx !== lastBeatIndexRef.current && beat) {
        const timeSinceBeat = timeSec - beat.start;
        if (timeSinceBeat < 0.1) {
          beatEnergyRef.current = 1.0;
        }
        lastBeatIndexRef.current = beatIdx;
      }

      // Decay beat energy
      beatEnergyRef.current *= Math.pow(0.05, dt);
      if (beatEnergyRef.current < 0.01) beatEnergyRef.current = 0;

      // Find current segment data
      let loudness = 0.5;
      let bass = 0;
      let treble = 0;
      if (segments.length) {
        const segIdx = binarySearch(segments, timeSec);
        const seg = segments[segIdx];
        if (seg) {
          const segTime = timeSec - seg.start;
          const currentLoudness =
            segTime < seg.loudness_max_time
              ? seg.loudness_start +
                ((seg.loudness_max - seg.loudness_start) * segTime) /
                  (seg.loudness_max_time || 0.01)
              : seg.loudness_max;
          loudness = Math.max(
            0,
            Math.min(1, (currentLoudness - minLoudness) / loudnessRange)
          );

          // Extract bass and treble from timbre
          if (seg.timbre && seg.timbre.length >= 12) {
            bass = Math.max(0, Math.min(1, (seg.timbre[0] - minBass) / bassRange));
            const trebleVal = (seg.timbre[3] + seg.timbre[4] + seg.timbre[5]) / 3;
            treble = Math.max(0, Math.min(1, (trebleVal - minTreble) / trebleRange));
          }
        }
      }

      // Find current section for BPM
      let bpm = 120;
      if (sections.length) {
        const secIdx = binarySearch(sections, timeSec);
        const sec = sections[secIdx];
        if (sec && sec.tempo > 0) {
          bpm = sec.tempo;
        }
      }

      const newState: BeatSyncState = {
        beatEnergy: beatEnergyRef.current,
        loudness,
        bass,
        treble,
        bpm,
        hasAnalysis: true,
      };

      stateRef.current = newState;
      setState(newState);

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = 0;
      }
    };
  }, [analysis, positionMs, isPaused]);

  return hasAnalysis
    ? state
    : { beatEnergy: 0, loudness: 0.5, bass: 0, treble: 0, bpm: 120, hasAnalysis: false };
}

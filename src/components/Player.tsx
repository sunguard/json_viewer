"use client";

import { useState } from "react";
import type { PlaybackState } from "@/types/spotify";

interface PlayerProps {
  playbackState: PlaybackState;
  onTogglePlay: () => void;
  onSeek: (positionMs: number) => void;
  onNext: () => void;
  onPrevious: () => void;
  onVolumeChange: (volume: number) => void;
}

function formatTime(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function Player({
  playbackState,
  onTogglePlay,
  onSeek,
  onNext,
  onPrevious,
  onVolumeChange,
}: PlayerProps) {
  const [volume, setVolume] = useState(50);
  const { position, duration, isPaused, currentTrack } = playbackState;

  const progress = duration > 0 ? (position / duration) * 100 : 0;

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    onSeek(Math.floor(percent * duration));
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    onVolumeChange(val / 100);
  };

  const albumArt = currentTrack?.album.images[
    currentTrack.album.images.length - 1
  ]?.url;

  return (
    <div className="bg-surface border-t border-border px-4 py-3">
      <div className="max-w-screen-xl mx-auto flex items-center gap-4">
        {/* Current track info */}
        <div className="flex items-center gap-3 w-56 min-w-0">
          {albumArt && (
            <img
              src={albumArt}
              alt=""
              className="w-12 h-12 rounded-lg object-cover"
            />
          )}
          {currentTrack && (
            <div className="min-w-0">
              <p className="text-sm font-medium text-text truncate">
                {currentTrack.name}
              </p>
              <p className="text-xs text-muted truncate">
                {currentTrack.artists.map((a) => a.name).join(", ")}
              </p>
            </div>
          )}
        </div>

        {/* Controls + Progress */}
        <div className="flex-1 flex flex-col items-center gap-1.5">
          {/* Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={onPrevious}
              className="text-muted hover:text-text transition-colors"
              aria-label="Previous"
            >
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="currentColor"
              >
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </button>

            <button
              onClick={onTogglePlay}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-text text-crust hover:scale-105 transition-transform"
              aria-label={isPaused ? "Play" : "Pause"}
            >
              {isPaused ? (
                <svg
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="currentColor"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="currentColor"
                >
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              )}
            </button>

            <button
              onClick={onNext}
              className="text-muted hover:text-text transition-colors"
              aria-label="Next"
            >
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="currentColor"
              >
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>
          </div>

          {/* Progress bar */}
          <div className="w-full max-w-lg flex items-center gap-2">
            <span className="text-[11px] text-muted tabular-nums w-10 text-right">
              {formatTime(position)}
            </span>
            <div
              className="flex-1 h-1.5 bg-surface2 rounded-full cursor-pointer group relative"
              onClick={handleSeek}
            >
              <div
                className="h-full bg-accent rounded-full relative"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-text rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            <span className="text-[11px] text-muted tabular-nums w-10">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2 w-36">
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="currentColor"
            className="text-muted"
          >
            {volume === 0 ? (
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
            ) : volume < 50 ? (
              <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
            ) : (
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            )}
          </svg>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={handleVolumeChange}
            className="w-full h-1 bg-surface2 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-text [&::-webkit-slider-thumb]:rounded-full"
          />
        </div>
      </div>
    </div>
  );
}

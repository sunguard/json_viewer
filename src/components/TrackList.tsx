"use client";

import type { SpotifyTrack } from "@/types/spotify";

interface TrackListProps {
  tracks: SpotifyTrack[];
  currentTrackUri: string | null;
  onTrackClick: (track: SpotifyTrack, index: number) => void;
  playlistName?: string;
  playlistImage?: string;
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function TrackList({
  tracks,
  currentTrackUri,
  onTrackClick,
  playlistName,
  playlistImage,
}: TrackListProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Playlist header */}
      {playlistName && (
        <div className="flex items-center gap-4 p-4 border-b border-border">
          {playlistImage && (
            <img
              src={playlistImage}
              alt={playlistName}
              className="w-14 h-14 rounded-lg object-cover shadow-lg"
            />
          )}
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-text truncate">
              {playlistName}
            </h2>
            <p className="text-sm text-muted">{tracks.length} tracks</p>
          </div>
        </div>
      )}

      {/* Track list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {tracks.map((track, index) => {
          const isPlaying = track.uri === currentTrackUri;
          return (
            <button
              key={`${track.id}-${index}`}
              onClick={() => onTrackClick(track, index)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface2 group ${
                isPlaying ? "bg-accent/10" : ""
              }`}
            >
              {/* Track number / playing indicator */}
              <span
                className={`w-8 text-right text-sm tabular-nums ${
                  isPlaying ? "text-accent" : "text-muted"
                }`}
              >
                {isPlaying ? (
                  <span className="inline-flex gap-[2px] items-end h-3">
                    <span className="w-[3px] bg-accent animate-pulse h-2" />
                    <span className="w-[3px] bg-accent animate-pulse h-3 [animation-delay:0.15s]" />
                    <span className="w-[3px] bg-accent animate-pulse h-1.5 [animation-delay:0.3s]" />
                  </span>
                ) : (
                  index + 1
                )}
              </span>

              {/* Album art */}
              {track.album.images[track.album.images.length - 1] && (
                <img
                  src={track.album.images[track.album.images.length - 1].url}
                  alt=""
                  className="w-10 h-10 rounded object-cover"
                />
              )}

              {/* Track info */}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium truncate ${
                    isPlaying ? "text-accent" : "text-text"
                  }`}
                >
                  {track.name}
                </p>
                <p className="text-xs text-muted truncate">
                  {track.artists.map((a) => a.name).join(", ")}
                </p>
              </div>

              {/* Duration */}
              <span className="text-xs text-muted tabular-nums">
                {formatDuration(track.duration_ms)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import type { SpotifyTrack } from "@/types/spotify";

interface NowPlayingProps {
  track: SpotifyTrack | null;
}

export default function NowPlaying({ track }: NowPlayingProps) {
  if (!track) return null;

  const albumArt = track.album.images[0]?.url;

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      {/* Album Art */}
      {albumArt && (
        <div className="relative">
          <img
            src={albumArt}
            alt={track.album.name}
            className="w-48 h-48 md:w-64 md:h-64 rounded-2xl object-cover shadow-2xl"
          />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-white/10" />
        </div>
      )}

      {/* Track info */}
      <div className="text-center max-w-xs">
        <h3 className="text-xl font-bold text-text truncate">{track.name}</h3>
        <p className="text-base text-muted truncate mt-1">
          {track.artists.map((a) => a.name).join(", ")}
        </p>
        <p className="text-sm text-muted/60 truncate mt-0.5">
          {track.album.name}
        </p>
      </div>
    </div>
  );
}

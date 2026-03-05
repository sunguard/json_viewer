"use client";

import { useState, useCallback } from "react";
import type {
  SpotifyTrack,
  SpotifyPlaylist,
  SpotifyPlaylistTrackItem,
} from "@/types/spotify";
import {
  parsePlaylistUrl,
  getPlaylistTracks,
  getPlaylistInfo,
  playPlaylist,
  playTrackInContext,
} from "@/lib/spotify";

interface PlaylistData {
  info: SpotifyPlaylist;
  tracks: SpotifyTrack[];
}

export function useSpotifyApi(accessToken: string | null) {
  const [playlistData, setPlaylistData] = useState<PlaylistData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPlaylist = useCallback(
    async (input: string) => {
      if (!accessToken) {
        setError("Not authenticated");
        return null;
      }

      const playlistId = parsePlaylistUrl(input);
      if (!playlistId) {
        setError("Invalid playlist URL. Please enter a valid Spotify playlist link.");
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const [info, trackItems] = await Promise.all([
          getPlaylistInfo(playlistId, accessToken),
          getPlaylistTracks(playlistId, accessToken),
        ]);

        const tracks = trackItems
          .filter(
            (item: SpotifyPlaylistTrackItem) => item.track !== null
          )
          .map((item: SpotifyPlaylistTrackItem) => item.track as SpotifyTrack);

        const data = { info, tracks };
        setPlaylistData(data);
        setIsLoading(false);
        return data;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load playlist"
        );
        setIsLoading(false);
        return null;
      }
    },
    [accessToken]
  );

  const startPlaylist = useCallback(
    async (playlistId: string, deviceId: string, offsetPosition?: number) => {
      if (!accessToken) return;
      try {
        await playPlaylist(playlistId, deviceId, accessToken, offsetPosition);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to start playback"
        );
      }
    },
    [accessToken]
  );

  const playTrack = useCallback(
    async (playlistId: string, trackUri: string, deviceId: string) => {
      if (!accessToken) return;
      try {
        await playTrackInContext(playlistId, trackUri, deviceId, accessToken);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to play track"
        );
      }
    },
    [accessToken]
  );

  return {
    playlistData,
    isLoading,
    error,
    loadPlaylist,
    startPlaylist,
    playTrack,
  };
}

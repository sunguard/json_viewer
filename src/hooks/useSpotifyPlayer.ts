"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { SpotifyTrack, PlaybackState } from "@/types/spotify";
import { transferPlayback } from "@/lib/spotify";

interface UseSpotifyPlayerProps {
  accessToken: string | null;
}

export function useSpotifyPlayer({ accessToken }: UseSpotifyPlayerProps) {
  const [player, setPlayer] = useState<Spotify.Player | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    currentTrack: null,
    position: 0,
    duration: 0,
    isPaused: true,
    deviceId: null,
  });
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<Spotify.Player | null>(null);
  const positionIntervalRef = useRef<NodeJS.Timeout>(undefined);

  // Load SDK script
  useEffect(() => {
    if (!accessToken) return;
    if (document.getElementById("spotify-sdk")) return;

    const script = document.createElement("script");
    script.id = "spotify-sdk";
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);
  }, [accessToken]);

  // Initialize player
  useEffect(() => {
    if (!accessToken) return;

    const initPlayer = () => {
      const newPlayer = new Spotify.Player({
        name: "Spotify DJ Web Player",
        getOAuthToken: (cb) => cb(accessToken),
        volume: 0.5,
      });

      newPlayer.addListener("ready", ({ device_id }) => {
        setPlaybackState((prev) => ({ ...prev, deviceId: device_id }));
        setIsReady(true);
        setError(null);
        // Proactively activate the device so it's ready for playback
        if (accessToken) {
          transferPlayback(device_id, accessToken).catch(() => {});
        }
      });

      newPlayer.addListener("not_ready", () => {
        setIsReady(false);
      });

      newPlayer.addListener("player_state_changed", (state) => {
        if (!state) return;

        const track = state.track_window.current_track;
        const currentTrack: SpotifyTrack | null = track
          ? {
              id: track.id || "",
              name: track.name,
              artists: track.artists.map((a) => ({
                id: "",
                name: a.name,
                uri: a.uri,
              })),
              album: {
                id: "",
                name: track.album.name,
                images: track.album.images.map((img) => ({
                  url: img.url,
                  height: img.height ?? null,
                  width: img.width ?? null,
                })),
                uri: track.album.uri,
              },
              duration_ms: state.duration,
              uri: track.uri,
              track_number: 0,
            }
          : null;

        setPlaybackState((prev) => ({
          ...prev,
          currentTrack,
          position: state.position,
          duration: state.duration,
          isPaused: state.paused,
        }));
      });

      newPlayer.addListener("initialization_error", ({ message }) => {
        setError(`Initialization error: ${message}`);
      });

      newPlayer.addListener("authentication_error", ({ message }) => {
        setError(`Authentication error: ${message}`);
      });

      newPlayer.addListener("account_error", ({ message }) => {
        setError(`Account error (Premium required): ${message}`);
      });

      newPlayer.connect();
      setPlayer(newPlayer);
      playerRef.current = newPlayer;
    };

    if (window.Spotify) {
      initPlayer();
    } else {
      window.onSpotifyWebPlaybackSDKReady = initPlayer;
    }

    return () => {
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, [accessToken]);

  // Position tracking interval
  useEffect(() => {
    if (positionIntervalRef.current) {
      clearInterval(positionIntervalRef.current);
    }

    if (!playbackState.isPaused && isReady) {
      positionIntervalRef.current = setInterval(() => {
        setPlaybackState((prev) => ({
          ...prev,
          position: Math.min(prev.position + 500, prev.duration),
        }));
      }, 500);
    }

    return () => {
      if (positionIntervalRef.current) {
        clearInterval(positionIntervalRef.current);
      }
    };
  }, [playbackState.isPaused, isReady]);

  const togglePlay = useCallback(async () => {
    if (!player) return;
    await player.togglePlay();
  }, [player]);

  const seek = useCallback(
    async (positionMs: number) => {
      if (!player) return;
      await player.seek(positionMs);
      setPlaybackState((prev) => ({ ...prev, position: positionMs }));
    },
    [player]
  );

  const setVolume = useCallback(
    async (volume: number) => {
      if (!player) return;
      await player.setVolume(volume);
    },
    [player]
  );

  return {
    player,
    playbackState,
    isReady,
    error,
    togglePlay,
    seek,
    setVolume,
  };
}

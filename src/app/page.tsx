"use client";

import { useCallback } from "react";
import { useSpotifyAuth } from "@/hooks/useSpotifyAuth";
import { useSpotifyPlayer } from "@/hooks/useSpotifyPlayer";
import { useSpotifyApi } from "@/hooks/useSpotifyApi";
import LoginButton from "@/components/LoginButton";
import PlaylistInput from "@/components/PlaylistInput";
import TrackList from "@/components/TrackList";
import NowPlaying from "@/components/NowPlaying";
import Player from "@/components/Player";
import Visualizer from "@/components/Visualizer";
import {
  skipNext,
  skipPrevious,
} from "@/lib/spotify";

export default function Home() {
  const { accessToken, isAuthenticated, isLoading: authLoading, login, logout } =
    useSpotifyAuth();
  const { playbackState, isReady, error: playerError, togglePlay, seek, setVolume } =
    useSpotifyPlayer({ accessToken });
  const {
    playlistData,
    isLoading: playlistLoading,
    error: apiError,
    loadPlaylist,
    startPlaylist,
    playTrack,
  } = useSpotifyApi(accessToken);

  const handlePlaylistSubmit = useCallback(
    async (url: string) => {
      const data = await loadPlaylist(url);
      if (data && playbackState.deviceId && accessToken) {
        await startPlaylist(data.info.id, playbackState.deviceId);
      }
    },
    [loadPlaylist, startPlaylist, playbackState.deviceId, accessToken]
  );

  const handleTrackClick = useCallback(
    async (track: { uri: string }) => {
      if (playlistData && playbackState.deviceId) {
        await playTrack(playlistData.info.id, track.uri, playbackState.deviceId);
      }
    },
    [playTrack, playlistData, playbackState.deviceId]
  );

  const handleNext = useCallback(async () => {
    if (playbackState.deviceId && accessToken) {
      await skipNext(playbackState.deviceId, accessToken);
    }
  }, [playbackState.deviceId, accessToken]);

  const handlePrevious = useCallback(async () => {
    if (playbackState.deviceId && accessToken) {
      await skipPrevious(playbackState.deviceId, accessToken);
    }
  }, [playbackState.deviceId, accessToken]);

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Not authenticated - login screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-base gap-8 p-8">
        {/* Background visualization */}
        <div className="fixed inset-0 -z-10 opacity-30">
          <Visualizer isPlaying={false} progress={0} trackUri={null} />
        </div>

        <div className="text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-text mb-3">
            Spotify <span className="text-accent">DJ</span>
          </h1>
          <p className="text-lg text-muted max-w-md">
            Paste a playlist link, watch the visualizer, and enjoy the music.
          </p>
        </div>

        <LoginButton onLogin={login} />

        <p className="text-xs text-muted/60 text-center max-w-sm">
          Requires Spotify Premium. Your music streams directly in the browser
          via Spotify Web Playback SDK.
        </p>
      </div>
    );
  }

  // Authenticated - DJ interface
  return (
    <div className="h-screen flex flex-col bg-base overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-mantle shrink-0">
        <h1 className="text-lg font-bold text-text">
          Spotify <span className="text-accent">DJ</span>
        </h1>

        <div className="flex-1 flex justify-center mx-4">
          <PlaylistInput
            onSubmit={handlePlaylistSubmit}
            isLoading={playlistLoading}
            error={apiError}
          />
        </div>

        <div className="flex items-center gap-3">
          {isReady ? (
            <span className="text-xs text-green flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green rounded-full animate-pulse" />
              Connected
            </span>
          ) : playerError ? (
            <span className="text-xs text-red">{playerError}</span>
          ) : (
            <span className="text-xs text-yellow">Connecting...</span>
          )}
          <button
            onClick={logout}
            className="text-xs text-muted hover:text-text transition-colors px-2 py-1"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Track list sidebar */}
        {playlistData && (
          <aside className="w-80 border-r border-border bg-mantle overflow-hidden flex flex-col shrink-0">
            <TrackList
              tracks={playlistData.tracks}
              currentTrackUri={playbackState.currentTrack?.uri || null}
              onTrackClick={handleTrackClick}
              playlistName={playlistData.info.name}
              playlistImage={playlistData.info.images[0]?.url}
            />
          </aside>
        )}

        {/* Center - Visualizer + Now Playing */}
        <main className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
          {/* Visualizer background */}
          <div className="absolute inset-0">
            <Visualizer
              isPlaying={!playbackState.isPaused}
              progress={
                playbackState.duration > 0
                  ? playbackState.position / playbackState.duration
                  : 0
              }
              trackUri={playbackState.currentTrack?.uri || null}
            />
          </div>

          {/* Now playing overlay */}
          <div className="relative z-10">
            {playbackState.currentTrack ? (
              <NowPlaying track={playbackState.currentTrack} />
            ) : (
              <div className="text-center p-8">
                <p className="text-xl text-muted">
                  {playlistData
                    ? "Ready to play"
                    : "Paste a Spotify playlist link above to get started"}
                </p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Player bar */}
      <Player
        playbackState={playbackState}
        onTogglePlay={togglePlay}
        onSeek={seek}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onVolumeChange={setVolume}
      />
    </div>
  );
}

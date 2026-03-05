"use client";

import { useState } from "react";

interface PlaylistInputProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
  error: string | null;
}

export default function PlaylistInput({
  onSubmit,
  isLoading,
  error,
}: PlaylistInputProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste Spotify playlist link here..."
            className="w-full px-5 py-3.5 bg-surface border border-border rounded-xl text-text placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 transition-colors text-base"
            disabled={isLoading}
          />
          {isLoading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={isLoading || !url.trim()}
          className="px-6 py-3.5 bg-accent hover:bg-accent/80 text-crust font-semibold rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-95"
        >
          {isLoading ? "Loading..." : "Play"}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red">{error}</p>
      )}
    </form>
  );
}

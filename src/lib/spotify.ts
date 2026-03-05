import type {
  SpotifyTokenResponse,
  SpotifyPlaylistTrackItem,
  SpotifyPaginatedResponse,
  SpotifyPlaylist,
} from "@/types/spotify";

const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

const SCOPES = [
  "streaming",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-read-email",
  "user-read-private",
].join(" ");

// --- PKCE Helpers ---

export function generateCodeVerifier(): string {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

export async function generateCodeChallenge(
  verifier: string
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let str = "";
  bytes.forEach((byte) => (str += String.fromCharCode(byte)));
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// --- Auth Flow ---

export function getClientId(): string {
  return process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || "";
}

export function getRedirectUri(): string {
  return process.env.NEXT_PUBLIC_REDIRECT_URI || "http://localhost:3000/callback";
}

export async function buildAuthUrl(): Promise<string> {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);

  sessionStorage.setItem("spotify_code_verifier", verifier);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: getClientId(),
    scope: SCOPES,
    redirect_uri: getRedirectUri(),
    code_challenge_method: "S256",
    code_challenge: challenge,
  });

  return `${SPOTIFY_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(
  code: string
): Promise<SpotifyTokenResponse> {
  const verifier = sessionStorage.getItem("spotify_code_verifier") || "";

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
      client_id: getClientId(),
      code_verifier: verifier,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status}`);
  }

  return response.json();
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<SpotifyTokenResponse> {
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: getClientId(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  return response.json();
}

// --- Spotify API ---

async function spotifyFetch<T>(
  endpoint: string,
  token: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Spotify API error: ${response.status}`);
  }

  if (response.status === 204) return {} as T;
  return response.json();
}

export function parsePlaylistUrl(input: string): string | null {
  // Handle: https://open.spotify.com/playlist/{id}?si=...
  const urlMatch = input.match(
    /open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/
  );
  if (urlMatch) return urlMatch[1];

  // Handle: spotify:playlist:{id}
  const uriMatch = input.match(/spotify:playlist:([a-zA-Z0-9]+)/);
  if (uriMatch) return uriMatch[1];

  // Handle: bare playlist ID (22 chars alphanumeric)
  if (/^[a-zA-Z0-9]{22}$/.test(input.trim())) return input.trim();

  return null;
}

export async function getPlaylistTracks(
  playlistId: string,
  token: string
): Promise<SpotifyPlaylistTrackItem[]> {
  const items: SpotifyPlaylistTrackItem[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const data = await spotifyFetch<
      SpotifyPaginatedResponse<SpotifyPlaylistTrackItem>
    >(`/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}`, token);

    items.push(...data.items);

    if (!data.next) break;
    offset += limit;
  }

  return items;
}

export async function getPlaylistInfo(
  playlistId: string,
  token: string
): Promise<SpotifyPlaylist> {
  return spotifyFetch<SpotifyPlaylist>(
    `/playlists/${playlistId}?fields=id,name,description,images,tracks(total),uri,owner(display_name)`,
    token
  );
}

export async function transferPlayback(
  deviceId: string,
  token: string
): Promise<void> {
  await spotifyFetch<void>("/me/player", token, {
    method: "PUT",
    body: JSON.stringify({ device_ids: [deviceId], play: false }),
  });
}

async function activateDevice(deviceId: string, token: string): Promise<void> {
  try {
    await fetch(`${SPOTIFY_API_BASE}/me/player`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ device_ids: [deviceId], play: false }),
    });
  } catch {
    // Best-effort activation — ignore errors
  }
}

async function playWithRetry(
  deviceId: string,
  token: string,
  body: object
): Promise<void> {
  const maxRetries = 3;
  const delays = [500, 1000, 2000];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(
      `${SPOTIFY_API_BASE}/me/player/play?device_id=${deviceId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (response.ok || response.status === 204) return;

    if (response.status === 403 && attempt < maxRetries) {
      // Activate the device and wait before retrying
      await activateDevice(deviceId, token);
      await new Promise((r) => setTimeout(r, delays[attempt]));
      continue;
    }

    throw new Error(`Spotify API error: ${response.status}`);
  }
}

export async function playPlaylist(
  playlistId: string,
  deviceId: string,
  token: string,
  offsetPosition: number = 0
): Promise<void> {
  await playWithRetry(deviceId, token, {
    context_uri: `spotify:playlist:${playlistId}`,
    offset: { position: offsetPosition },
  });
}

export async function playTrackInContext(
  playlistId: string,
  trackUri: string,
  deviceId: string,
  token: string
): Promise<void> {
  await playWithRetry(deviceId, token, {
    context_uri: `spotify:playlist:${playlistId}`,
    offset: { uri: trackUri },
  });
}

export async function togglePlayback(
  isPaused: boolean,
  deviceId: string,
  token: string
): Promise<void> {
  const endpoint = isPaused ? "/me/player/play" : "/me/player/pause";
  await spotifyFetch<void>(`${endpoint}?device_id=${deviceId}`, token, {
    method: "PUT",
  });
}

export async function skipNext(
  deviceId: string,
  token: string
): Promise<void> {
  await spotifyFetch<void>(
    `/me/player/next?device_id=${deviceId}`,
    token,
    { method: "POST" }
  );
}

export async function skipPrevious(
  deviceId: string,
  token: string
): Promise<void> {
  await spotifyFetch<void>(
    `/me/player/previous?device_id=${deviceId}`,
    token,
    { method: "POST" }
  );
}

export async function seekToPosition(
  positionMs: number,
  deviceId: string,
  token: string
): Promise<void> {
  await spotifyFetch<void>(
    `/me/player/seek?position_ms=${positionMs}&device_id=${deviceId}`,
    token,
    { method: "PUT" }
  );
}

export async function setVolume(
  volumePercent: number,
  deviceId: string,
  token: string
): Promise<void> {
  await spotifyFetch<void>(
    `/me/player/volume?volume_percent=${Math.round(volumePercent)}&device_id=${deviceId}`,
    token,
    { method: "PUT" }
  );
}

// --- Audio Analysis ---

export interface AudioAnalysisBeat {
  start: number;
  duration: number;
  confidence: number;
}

export interface AudioAnalysisSegment {
  start: number;
  duration: number;
  loudness_start: number;
  loudness_max: number;
  loudness_max_time: number;
  pitches: number[];
  timbre: number[];
}

export interface AudioAnalysisSection {
  start: number;
  duration: number;
  loudness: number;
  tempo: number;
  key: number;
  mode: number;
  time_signature: number;
}

export interface AudioAnalysis {
  beats: AudioAnalysisBeat[];
  segments: AudioAnalysisSegment[];
  sections: AudioAnalysisSection[];
}

export async function getAudioAnalysis(
  trackId: string,
  token: string
): Promise<AudioAnalysis> {
  return spotifyFetch<AudioAnalysis>(`/audio-analysis/${trackId}`, token);
}

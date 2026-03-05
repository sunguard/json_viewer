"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  buildAuthUrl,
  exchangeCode,
  refreshAccessToken,
} from "@/lib/spotify";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
}

function loadSavedAuth(): AuthState {
  if (typeof window === "undefined") {
    return { accessToken: null, refreshToken: null, expiresAt: null };
  }
  try {
    const saved = localStorage.getItem("spotify_auth");
    if (saved) {
      const { accessToken, refreshToken, expiresAt } = JSON.parse(saved);
      if (expiresAt > Date.now()) {
        return { accessToken, refreshToken, expiresAt };
      }
      if (refreshToken) {
        return { accessToken: null, refreshToken, expiresAt: 0 };
      }
    }
  } catch {
    localStorage.removeItem("spotify_auth");
  }
  return { accessToken: null, refreshToken: null, expiresAt: null };
}

export function useSpotifyAuth() {
  const [auth, setAuth] = useState<AuthState>(loadSavedAuth);
  const refreshTimeoutRef = useRef<NodeJS.Timeout>(undefined);

  const needsRefresh = !auth.accessToken && !!auth.refreshToken && auth.expiresAt === 0;
  const isAuthenticated = !!auth.accessToken;
  const isLoading = needsRefresh;

  const logout = useCallback(() => {
    setAuth({ accessToken: null, refreshToken: null, expiresAt: null });
    localStorage.removeItem("spotify_auth");
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
  }, []);

  const saveTokens = useCallback(
    (accessToken: string, refreshToken: string, expiresIn: number) => {
      const expiresAt = Date.now() + expiresIn * 1000;
      setAuth({ accessToken, refreshToken, expiresAt });
      localStorage.setItem(
        "spotify_auth",
        JSON.stringify({ accessToken, refreshToken, expiresAt })
      );
    },
    []
  );

  const scheduleRefresh = useCallback(
    (refreshToken: string, expiresAt: number) => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      const msUntilRefresh = expiresAt - Date.now() - 60000;
      if (msUntilRefresh <= 0) {
        refreshAccessToken(refreshToken)
          .then((data) => {
            saveTokens(
              data.access_token,
              data.refresh_token || refreshToken,
              data.expires_in
            );
          })
          .catch(() => logout());
        return;
      }

      refreshTimeoutRef.current = setTimeout(async () => {
        try {
          const data = await refreshAccessToken(refreshToken);
          saveTokens(
            data.access_token,
            data.refresh_token || refreshToken,
            data.expires_in
          );
        } catch {
          logout();
        }
      }, msUntilRefresh);
    },
    [saveTokens, logout]
  );

  // Handle initial refresh if token was expired but we have refresh token
  useEffect(() => {
    if (needsRefresh && auth.refreshToken) {
      refreshAccessToken(auth.refreshToken)
        .then((data) => {
          saveTokens(
            data.access_token,
            data.refresh_token || auth.refreshToken!,
            data.expires_in
          );
        })
        .catch(() => logout());
    }
  }, [needsRefresh]); // eslint-disable-line react-hooks/exhaustive-deps

  // Schedule refresh when auth changes
  useEffect(() => {
    if (auth.refreshToken && auth.expiresAt && auth.expiresAt > 0) {
      scheduleRefresh(auth.refreshToken, auth.expiresAt);
    }
    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    };
  }, [auth.refreshToken, auth.expiresAt, scheduleRefresh]);

  const login = useCallback(async () => {
    const url = await buildAuthUrl();
    window.location.href = url;
  }, []);

  const handleCallback = useCallback(
    async (code: string) => {
      const data = await exchangeCode(code);
      saveTokens(
        data.access_token,
        data.refresh_token || "",
        data.expires_in
      );
    },
    [saveTokens]
  );

  return {
    accessToken: auth.accessToken,
    isAuthenticated,
    isLoading,
    login,
    logout,
    handleCallback,
  };
}

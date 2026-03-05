"use client";

import { useMemo, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useSpotifyAuth } from "@/hooks/useSpotifyAuth";
import Link from "next/link";

function CallbackHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { handleCallback } = useSpotifyAuth();
  const handledRef = useRef(false);

  const authError = useMemo(
    () => searchParams.get("error"),
    [searchParams]
  );

  useEffect(() => {
    if (handledRef.current || authError) return;
    handledRef.current = true;

    const code = searchParams.get("code");
    if (code) {
      handleCallback(code).then(() => router.replace("/"));
    }
  }, [searchParams, handleCallback, router, authError]);

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base">
        <div className="text-center">
          <p className="text-red text-lg mb-4">
            Authentication denied: {authError}
          </p>
          <Link href="/" className="text-accent hover:underline">
            Go back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted">Connecting to Spotify...</p>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-base">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}

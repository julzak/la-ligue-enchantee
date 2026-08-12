"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

interface PlayerAvatarProps {
  imageUrl?: string | null;
  playerId?: number;
  name: string;
  size?: number;
  clubLogoUrl?: string | null;
}

// Client-side cache shared across all instances
const imageCache = new Map<number, string | null>();

export function PlayerAvatar({ imageUrl, playerId, name, size = 40, clubLogoUrl }: PlayerAvatarProps) {
  const [error, setError] = useState(false);
  const [dynamicUrl, setDynamicUrl] = useState<string | null>(null);

  useEffect(() => {
    if (imageUrl || !playerId || !name) return;

    // Check cache first
    if (imageCache.has(playerId)) {
      setDynamicUrl(imageCache.get(playerId) ?? null);
      return;
    }

    // Fetch from API
    fetch(`/api/player-image?id=${playerId}&name=${encodeURIComponent(name)}`)
      .then((res) => res.json())
      .then((data) => {
        imageCache.set(playerId, data.url);
        setDynamicUrl(data.url);
        })
      .catch(() => {
        imageCache.set(playerId, null);
        });
  }, [imageUrl, playerId, name]);

  const finalUrl = imageUrl || dynamicUrl;
  const showFallback = !finalUrl || error;

  const logoSize = Math.max(Math.round(size * 0.45), 14);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {/* Player photo circle */}
      <div
        className="rounded-full overflow-hidden bg-surface-2 border border-white/[0.07]"
        style={{ width: size, height: size }}
      >
        {showFallback ? (
          <Image
            src="/images/player-silhouette.svg"
            alt={name}
            width={size}
            height={size}
            unoptimized
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={finalUrl}
            alt={name}
            width={size}
            height={size}
            className="object-cover w-full h-full"
            onError={() => setError(true)}
          />
        )}
      </div>
      {/* Club badge overlay — bottom right, slightly overlapping */}
      {clubLogoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={clubLogoUrl}
          alt=""
          width={logoSize}
          height={logoSize}
          className="absolute object-contain drop-shadow-md"
          style={{ bottom: -3, right: -4, width: logoSize, height: logoSize }}
        />
      )}
    </div>
  );
}

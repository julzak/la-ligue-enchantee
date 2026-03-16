"use client";

import { useState } from "react";
import Image from "next/image";

interface PlayerAvatarProps {
  imageUrl?: string;
  name: string;
  size?: number;
}

export function PlayerAvatar({ imageUrl, name, size = 40 }: PlayerAvatarProps) {
  const [error, setError] = useState(false);
  const showFallback = !imageUrl || error;

  return (
    <div
      className="relative rounded-full overflow-hidden bg-surface-2 border border-white/[0.07] shrink-0"
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
        <Image
          src={imageUrl}
          alt={name}
          width={size}
          height={size}
          className="object-cover"
          onError={() => setError(true)}
        />
      )}
    </div>
  );
}

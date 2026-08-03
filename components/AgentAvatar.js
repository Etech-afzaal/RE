"use client";

import Image from "next/image";
import { useState } from "react";

export const DEFAULT_AGENT_AVATAR = "/images/default-agent-avatar.svg";

function hasUsableAgentProfileImage(src) {
  if (typeof src !== "string") return false;
  return src.trim().length > 0;
}

export default function AgentAvatar({
  src,
  alt = "",
  className,
  width,
  height,
  fill = false,
  sizes,
  ...props
}) {
  const [hasError, setHasError] = useState(false);
  const usableImage = hasUsableAgentProfileImage(src) && !hasError;

  if (!usableImage) {
    return (
      <Image
        src={DEFAULT_AGENT_AVATAR}
        alt={alt || "Default agent profile"}
        fill={fill}
        width={fill ? undefined : width || 72}
        height={fill ? undefined : height || 72}
        sizes={fill ? sizes || "(max-width: 640px) 104px, 104px" : undefined}
        className={className}
        {...props}
      />
    );
  }

  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes || "(max-width: 640px) 104px, 104px"}
        className={className}
        onError={() => setHasError(true)}
        {...props}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width || 72}
      height={height || 72}
      className={className}
      onError={() => setHasError(true)}
      {...props}
    />
  );
}

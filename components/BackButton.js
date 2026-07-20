"use client";

import { useRouter } from "next/navigation";

export default function BackButton({
  fallbackHref = "/",
  label = "← Back",
  className,
  style,
}) {
  const router = useRouter();

  const handleClick = (e) => {
    e.preventDefault();
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
      style={style}
    >
      {label}
    </button>
  );
}

import { useEffect, useState } from "react";

// Browser-side helpers for showing ads anywhere on the customer site.
// Use from client components ("use client"). See docs/ads-network.md.
//
//   const { ad, loading, ref } = useAd("leaderboard_728x90", { placement: "home_top" });
//   if (!ad) return null;
//   return (
//     <a ref={ref} href={ad.clickUrl}>
//       <img src={ad.imageUrl} alt={ad.altText} width={ad.format.width} height={ad.format.height} />
//     </a>
//   );

export async function fetchAd(format, { placement, exclude = [], signal } = {}) {
  const params = new URLSearchParams({ format });
  if (placement) params.set("placement", placement);
  if (exclude.length > 0) params.set("exclude", exclude.join(","));

  try {
    const res = await fetch(`/api/ads?${params}`, {
      signal,
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.ad || null;
  } catch (err) {
    if (err.name === "AbortError") throw err;
    return null; // an ad failing must never break the page
  }
}

export function trackImpression(ad) {
  if (!ad?.impressionToken) return;
  const body = JSON.stringify({ token: ad.impressionToken });
  const blob = new Blob([body], { type: "application/json" });
  if (navigator.sendBeacon && navigator.sendBeacon("/api/ads/impression", blob)) return;
  fetch("/api/ads/impression", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
    keepalive: true,
  }).catch(() => {});
}

// Counts the impression once the element has been ≥50% visible for 1s
// (IAB viewability standard). Returns a cleanup function.
export function observeImpression(element, ad, { threshold = 0.5, minVisibleMs = 1000 } = {}) {
  if (!element || !ad) return () => {};
  if (typeof IntersectionObserver === "undefined") {
    trackImpression(ad);
    return () => {};
  }

  let timer = null;
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
        timer ??= setTimeout(() => {
          trackImpression(ad);
          observer.disconnect();
        }, minVisibleMs);
      } else {
        clearTimeout(timer);
        timer = null;
      }
    },
    { threshold: [0, threshold] },
  );
  observer.observe(element);

  return () => {
    clearTimeout(timer);
    observer.disconnect();
  };
}

// React hook: fetches an ad for a format and tracks its impression.
// Attach `ref` to the element that shows the ad.
export function useAd(format, { placement, exclude = [], enabled = true } = {}) {
  const [state, setState] = useState({ ad: null, loading: Boolean(enabled && format) });
  const [node, setNode] = useState(null);
  const excludeKey = exclude.join(",");

  useEffect(() => {
    if (!enabled || !format) {
      setState({ ad: null, loading: false });
      return;
    }
    const controller = new AbortController();
    setState({ ad: null, loading: true });
    fetchAd(format, {
      placement,
      exclude: excludeKey ? excludeKey.split(",") : [],
      signal: controller.signal,
    })
      .then((ad) => setState({ ad, loading: false }))
      .catch(() => {}); // aborted by a newer request
    return () => controller.abort();
  }, [format, placement, excludeKey, enabled]);

  useEffect(() => observeImpression(node, state.ad), [node, state.ad]);

  return { ad: state.ad, loading: state.loading, ref: setNode };
}

import { useEffect, useMemo, useRef, useState } from "react";

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

// `also`: other format codes the slot may switch to (see useAd).
export async function fetchAd(format, { placement, exclude = [], also = [], signal } = {}) {
  const params = new URLSearchParams({ format });
  const others = also.filter((code) => code && code !== format);
  if (others.length > 0) params.set("also", others.join(","));
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

// The served ad shown in another of its sizes, or null if it doesn't have it.
export function adForFormat(ad, format) {
  if (!ad) return null;
  if (ad.format?.code === format) return ad;
  const variant = ad.variants?.find((item) => item.format.code === format);
  return variant ? { ...ad, ...variant } : null;
}

// React hook: fetches an ad for a format and tracks its impression.
// Attach `ref` to the element that shows the ad.
//
// `also` lists the other formats the slot may switch to (e.g. the mobile
// size). When the format changes and the served ad has that size too, it
// swaps in place: no new request, and still one impression for the view.
export function useAd(format, { placement, exclude = [], also = [], enabled = true } = {}) {
  const [state, setState] = useState({ ad: null, loading: Boolean(enabled && format) });
  const [node, setNode] = useState(null);
  const servedRef = useRef(null);
  servedRef.current = state.ad;
  const excludeKey = exclude.join(",");
  const alsoKey = [...new Set(also)].sort().join(",");

  useEffect(() => {
    if (!enabled || !format) {
      setState({ ad: null, loading: false });
      return;
    }
    if (adForFormat(servedRef.current, format)) return; // same ad, other size
    const controller = new AbortController();
    setState({ ad: null, loading: true });
    fetchAd(format, {
      placement,
      exclude: excludeKey ? excludeKey.split(",") : [],
      also: alsoKey ? alsoKey.split(",") : [],
      signal: controller.signal,
    })
      .then((ad) => setState({ ad, loading: false }))
      .catch(() => {}); // aborted by a newer request
    return () => controller.abort();
  }, [format, placement, excludeKey, alsoKey, enabled]);

  const ad = useMemo(() => adForFormat(state.ad, format), [state.ad, format]);

  // Swapped sizes share the served token, so the view still counts once.
  useEffect(() => observeImpression(node, ad), [node, ad]);

  return { ad, loading: state.loading, ref: setNode };
}

// Every ad for one location's carousel: [] when nothing qualifies.
export async function fetchAds(location, format, { also = [], signal } = {}) {
  const params = new URLSearchParams({ location, format });
  const others = also.filter((code) => code && code !== format);
  if (others.length > 0) params.set("also", others.join(","));

  try {
    const res = await fetch(`/api/ads?${params}`, {
      signal,
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.ads) ? data.ads : [];
  } catch (err) {
    if (err.name === "AbortError") throw err;
    return []; // ads failing must never break the page
  }
}

// React hook: the ads for a location (see lib/ads/locations.js), in the
// size for the current `format`. When the format changes and every served ad
// has that size too, they swap in place with no new request.
// Impressions are counted per slide by useImpression().
export function useAds(location, format, { also = [], enabled = true } = {}) {
  const [state, setState] = useState({ ads: [], loading: Boolean(enabled && format) });
  const servedRef = useRef([]);
  servedRef.current = state.ads;
  const alsoKey = [...new Set(also)].sort().join(",");

  useEffect(() => {
    if (!enabled || !format || !location) {
      setState({ ads: [], loading: false });
      return;
    }
    const served = servedRef.current;
    if (served.length > 0 && served.every((ad) => adForFormat(ad, format))) return;
    const controller = new AbortController();
    setState({ ads: [], loading: true });
    fetchAds(location, format, {
      also: alsoKey ? alsoKey.split(",") : [],
      signal: controller.signal,
    })
      .then((ads) => setState({ ads, loading: false }))
      .catch(() => {}); // aborted by a newer request
    return () => controller.abort();
  }, [location, format, alsoKey, enabled]);

  const ads = useMemo(
    () => state.ads.map((ad) => adForFormat(ad, format)).filter(Boolean),
    [state.ads, format],
  );
  return { ads, loading: state.loading };
}

// Counts `ad`'s impression once the returned ref's element has been ≥50%
// visible for 1s. Slides hidden inside a carousel are clipped, so they only
// count while they're actually shown.
export function useImpression(ad) {
  const [node, setNode] = useState(null);
  useEffect(() => observeImpression(node, ad), [node, ad]);
  return setNode;
}

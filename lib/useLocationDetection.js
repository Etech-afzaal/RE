"use client";

import { useEffect, useRef, useState } from "react";
import { matchDatabaseLocation, reverseGeocodeLocationValues } from "@/lib/locationMatching";

const STORAGE_KEY = "dhalahome_detected_area";

async function reverseGeocode(latitude, longitude) {
  const response = await fetch("/api/location/reverse-geocode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latitude, longitude }),
  });
  if (!response.ok) throw new Error("Reverse geocoding failed.");
  return response.json();
}

/**
 * Resolves browser coordinates to an address, then matches that address only
 * against location labels currently supplied from the database. Browser or
 * reverse-geocoder failures intentionally leave the normal all-agent view.
 */
export function useLocationDetection({ areas = [], enabled = true } = {}) {
  const [selectedArea, setSelectedArea] = useState(null);
  const [detectedLabel, setDetectedLabel] = useState(null);
  const [status, setStatus] = useState("idle");
  const startedRef = useRef(false);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    if (startedRef.current) return;
    startedRef.current = true;

    if (!("geolocation" in navigator)) {
      setStatus("skipped");
      return;
    }

    try {
      const cached = window.sessionStorage.getItem(STORAGE_KEY);
      if (cached && areas.some((area) => area?.name === cached)) {
        setSelectedArea(cached);
        setStatus("resolved");
        return;
      }
    } catch {
      // Storage is optional; continue with a live lookup.
    }

    let cancelled = false;
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude, longitude } }) => {
        try {
          const result = await reverseGeocode(latitude, longitude);
          if (cancelled) return;

          const match = matchDatabaseLocation(areas, result);
          const values = reverseGeocodeLocationValues(result);
          setDetectedLabel(match || values[0] || "your area");
          if (!match) {
            setSelectedArea(null);
            setStatus("no_match");
            return;
          }

          try {
            window.sessionStorage.setItem(STORAGE_KEY, match);
          } catch {
            // Non-fatal: the location can still be used for this page.
          }
          setSelectedArea(match);
          setStatus("resolved");
        } catch {
          if (!cancelled) setStatus("failed");
        }
      },
      () => {
        if (!cancelled) setStatus("denied");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );

    return () => {
      cancelled = true;
      startedRef.current = false;
    };
  }, [enabled, areas]);

  return { selectedArea, status, detectedLabel };
}

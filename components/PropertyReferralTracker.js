"use client";

import { useEffect, useRef } from "react";
import { trackMarketingEvent } from "@/lib/marketingTrackClient";

export default function PropertyReferralTracker({ refCode, propertyId }) {
  const tracked = useRef(false);

  useEffect(() => {
    if (!refCode || tracked.current) return;
    tracked.current = true;
    trackMarketingEvent(refCode, "page_view", propertyId);
  }, [refCode, propertyId]);

  return null;
}

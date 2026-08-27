"use client";

import { useCallback } from "react";
import { trackMarketingEvent } from "@/lib/marketingTrackClient";
import AgentPhoneReveal from "./AgentPhoneReveal";

export default function TrackedAgentPhoneReveal({
  phoneEntries,
  marketingRef,
  propertyId,
}) {
  const trackPhone = useCallback(() => {
    if (marketingRef) {
      trackMarketingEvent(marketingRef, "phone_click", propertyId);
    }
  }, [marketingRef, propertyId]);

  return (
    <AgentPhoneReveal
      phoneEntries={phoneEntries}
      onReveal={marketingRef ? trackPhone : undefined}
      onPhoneClick={marketingRef ? trackPhone : undefined}
    />
  );
}

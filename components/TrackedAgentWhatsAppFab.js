"use client";

import AgentWhatsAppFab from "@/components/AgentWhatsAppFab";
import { trackMarketingEvent } from "@/lib/marketingTrackClient";

export default function TrackedAgentWhatsAppFab({
  phone,
  message,
  label,
  marketingRef,
  propertyId,
}) {
  function handleTrack() {
    if (marketingRef) {
      trackMarketingEvent(marketingRef, "whatsapp_click", propertyId);
    }
  }

  return (
    <div onClick={handleTrack}>
      <AgentWhatsAppFab phone={phone} message={message} label={label} />
    </div>
  );
}

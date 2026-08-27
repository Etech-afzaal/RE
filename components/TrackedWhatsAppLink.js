"use client";

import { trackMarketingEvent } from "@/lib/marketingTrackClient";

export default function TrackedWhatsAppLink({
  href,
  className,
  children,
  marketingRef,
  propertyId,
  ...rest
}) {
  function handleClick() {
    if (marketingRef) {
      trackMarketingEvent(marketingRef, "whatsapp_click", propertyId);
    }
  }

  return (
    <a
      href={href}
      className={className}
      onClick={handleClick}
      {...rest}
    >
      {children}
    </a>
  );
}

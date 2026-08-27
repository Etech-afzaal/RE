"use client";

import { trackMarketingEvent } from "@/lib/marketingTrackClient";

export default function TrackedTelLink({
  href,
  className,
  children,
  marketingRef,
  propertyId,
  ...rest
}) {
  function handleClick() {
    if (marketingRef) {
      trackMarketingEvent(marketingRef, "phone_click", propertyId);
    }
  }

  return (
    <a href={href} className={className} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}

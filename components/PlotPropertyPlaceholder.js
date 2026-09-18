import { MapPinned } from "lucide-react";

export default function PlotPropertyPlaceholder({ size = 80, fill = false }) {
  return (
    <div
      role="img"
      aria-label="Plot property"
      style={{
        ...(fill ? { position: "absolute", inset: 0 } : { width: "100%", height: "100%" }),
        display: "grid",
        placeItems: "center",
        background: "#edf3e7",
        color: "#6d8d45",
        borderRadius: "inherit",
        overflow: "hidden",
      }}
    >
      <MapPinned size={size} strokeWidth={1.5} aria-hidden="true" style={{ maxWidth: "60%", maxHeight: "60%" }} />
    </div>
  );
}

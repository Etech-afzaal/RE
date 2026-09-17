import { FileText } from "lucide-react";

export default function FilePropertyPlaceholder({ size = 80, fill = false }) {
  return (
    <div
      role="img"
      aria-label="File property"
      style={{
        ...(fill ? { position: "absolute", inset: 0 } : { width: "100%", height: "100%" }),
        display: "grid",
        placeItems: "center",
        background: "#f3eee3",
        borderRadius: "inherit",
        overflow: "hidden",
        color: "#a88945",
      }}
    >
      <FileText size={size} strokeWidth={1.5} aria-hidden="true" style={{ maxWidth: "60%", maxHeight: "60%" }} />
    </div>
  );
}

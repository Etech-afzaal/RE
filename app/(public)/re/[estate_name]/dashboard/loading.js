import LoadingSpinner from "@/components/LoadingSpinner";

export default function Loading() {
  return (
    <LoadingSpinner
      fullPage={false}
      label="Loading"
      hint="Preparing your workspace…"
    />
  );
}

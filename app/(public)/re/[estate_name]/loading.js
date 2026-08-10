import LoadingSpinner from "@/components/LoadingSpinner";

export default function Loading() {
  return (
    <LoadingSpinner
      fullPage
      label="Loading"
      hint="Finding your next space…"
    />
  );
}

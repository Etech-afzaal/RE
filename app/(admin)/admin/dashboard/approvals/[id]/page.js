import ReviewClient from "./ReviewClient";

export default function PropertyReviewPage({ params }) {
  return <ReviewClient propertyId={params.id} />;
}

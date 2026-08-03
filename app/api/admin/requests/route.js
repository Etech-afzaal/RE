import { getSignupRequests } from "@/lib/queries";
import { requireAdmin } from "@/lib/adminAuth";

// This route reads the session from request headers and must run per request.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const requests = await getSignupRequests();
    return Response.json({ requests }, { status: 200 });
  } catch (err) {
    console.error("Error fetching requests:", err);
    return Response.json(
      { error: "Failed to fetch requests" },
      { status: 500 },
    );
  }
}

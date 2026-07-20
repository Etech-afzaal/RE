import { getSignupRequests } from "@/lib/queries";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);

    // Only allow admin to access this endpoint
    if (!session || session.user.role !== "admin") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requests = await getSignupRequests();
    return Response.json({ requests }, { status: 200 });
  } catch (error) {
    console.error("Error fetching requests:", error);
    return Response.json(
      { error: "Failed to fetch requests" },
      { status: 500 },
    );
  }
}

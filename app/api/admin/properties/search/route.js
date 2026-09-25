import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { searchProperties } from "@/lib/ads/queries";

// Property picker for the ad form — searches every agent's listings.
export async function GET(req) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const properties = await searchProperties(req.nextUrl.searchParams.get("q"));
  return NextResponse.json({ properties });
}

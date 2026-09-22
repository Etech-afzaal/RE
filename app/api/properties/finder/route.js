import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/adminAuth";
import { getPublishedPropertiesPage } from "@/lib/queries";
import { sanitizeSearchInput } from "@/lib/validators/common";

export async function GET(req) {
  const { error } = await requireAgent();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const search = sanitizeSearchInput(searchParams.get("search")).value;
  const propertyType = searchParams.get("type") || "all";
  const city = searchParams.get("city") || "";
  const page = searchParams.get("page") || "1";

  const payload = await getPublishedPropertiesPage({
    page,
    pageSize: 20,
    search,
    propertyType,
    city,
  });

  return NextResponse.json(payload);
}

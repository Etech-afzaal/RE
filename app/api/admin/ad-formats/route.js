import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { createFormat, getFormatByCode, getFormatById, listFormats } from "@/lib/ads/queries";
import { fieldErrors, firstError, formatInputSchema } from "@/lib/ads/validation";

export async function GET() {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;
  return NextResponse.json({ formats: await listFormats() });
}

export async function POST(req) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const body = await req.json().catch(() => ({}));
  const parsed = formatInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstError(parsed), fields: fieldErrors(parsed) },
      { status: 400 },
    );
  }

  if (await getFormatByCode(parsed.data.code)) {
    return NextResponse.json(
      { error: "A format with this code already exists.", fields: { code: "Already in use." } },
      { status: 409 },
    );
  }

  const id = await createFormat(parsed.data);
  return NextResponse.json({ success: true, format: await getFormatById(id) }, { status: 201 });
}

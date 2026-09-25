import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { getActivationError, getAdById, setAdStatus } from "@/lib/ads/queries";

// ON/OFF toggle and archive/restore.
//   { status: "active" }   → ON (validated first)
//   { status: "paused" }   → OFF, also used to restore an archived ad
//   { status: "archived" } → hidden from the list, stats kept
const ALLOWED = ["active", "paused", "archived"];

export async function PATCH(req, { params }) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const { status } = await req.json().catch(() => ({}));
  if (!ALLOWED.includes(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${ALLOWED.join(", ")}.` },
      { status: 400 },
    );
  }

  const ad = await getAdById(params.id);
  if (!ad) return NextResponse.json({ error: "Ad not found." }, { status: 404 });

  if (status === "active") {
    if (ad.status === "archived") {
      return NextResponse.json(
        { error: "Restore the ad before turning it on." },
        { status: 409 },
      );
    }
    const activationError = getActivationError(ad);
    if (activationError) {
      return NextResponse.json({ error: activationError }, { status: 400 });
    }
  }

  await setAdStatus(ad.id, status);
  return NextResponse.json({ success: true, ad: await getAdById(ad.id) });
}

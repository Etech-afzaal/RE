import { NextResponse } from "next/server";
import { requireAgent } from "@/lib/adminAuth";
import {
  agentIdFromSession,
  getFreeAdsSettings,
  setFreeAdsEnabled,
} from "@/lib/freeAds";

export async function GET() {
  const { session, error } = await requireAgent();
  if (error) return error;

  const settings = await getFreeAdsSettings(agentIdFromSession(session));
  if (!settings) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }
  return NextResponse.json(settings);
}

// The global setting is deliberately stored on the agent account instead of
// inferred from properties: OFF always overrides every property preference.
export async function PATCH(req) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  if (typeof body.freeAdsEnabled !== "boolean") {
    return NextResponse.json(
      { error: "freeAdsEnabled must be true or false." },
      { status: 400 },
    );
  }

  const saved = await setFreeAdsEnabled(
    agentIdFromSession(session),
    body.freeAdsEnabled,
  );
  if (!saved) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    freeAdsEnabled: body.freeAdsEnabled,
  });
}

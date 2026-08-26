import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAgent } from "@/lib/adminAuth";
import { query } from "@/lib/db";
import {
  normalizeWebsiteListingPreferences,
  validateWebsiteListingPreferencesInput,
} from "@/lib/websiteListingPreferences";

function agentIdFrom(session) {
  return Number(session.user.agent_id || session.user.id);
}

export async function GET() {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFrom(session);
  const rows = await query(
    `SELECT website_listing_preferences
     FROM users WHERE id = ? AND user_type = 'agent' LIMIT 1`,
    [agentId],
  );
  if (!rows[0]) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  return NextResponse.json({
    preferences: normalizeWebsiteListingPreferences(
      rows[0].website_listing_preferences,
    ),
  });
}

export async function PATCH(req) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFrom(session);
  const body = await req.json().catch(() => ({}));
  const validated = validateWebsiteListingPreferencesInput(
    body.preferences ?? body,
  );
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  await query(
    `UPDATE users
     SET website_listing_preferences = ?
     WHERE id = ? AND user_type = 'agent'`,
    [JSON.stringify(validated.value), agentId],
  );

  const rows = await query(
    "SELECT username, estate_name FROM users WHERE id = ? AND user_type = 'agent' LIMIT 1",
    [agentId],
  );
  const handle = rows[0]?.username || rows[0]?.estate_name;
  if (handle) revalidatePath(`/re/${handle}`);

  return NextResponse.json({
    success: true,
    preferences: validated.value,
  });
}

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAgent } from "@/lib/adminAuth";
import { query } from "@/lib/db";
import {
  DEFAULT_THEME_ID,
  CUSTOM_THEME_ID,
  getThemeSummary,
  validateCustomPaletteInput,
} from "@/lib/agentTheme";
import { getThemeDefinition } from "@/themes";

function agentIdFrom(session) {
  return Number(session.user.agent_id || session.user.id);
}

/**
 * GET /api/agent/theme — current website theme for the signed-in agent.
 */
export async function GET() {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFrom(session);
  const rows = await query(
    `SELECT theme_id, theme_settings
     FROM users WHERE id = ? AND user_type = 'agent' LIMIT 1`,
    [agentId],
  );
  if (!rows[0]) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  return NextResponse.json({ theme: getThemeSummary(rows[0]) });
}

/**
 * PATCH /api/agent/theme — update the agent's website theme.
 *
 * Body shapes:
 *   { theme_id: "default" }                          → use a predefined theme
 *   { theme_id: "royal_estate" }                     → use a predefined theme
 *   { theme_id: "custom", theme_settings: {…6 hex} } → custom palette
 *
 * Predefined ids only store the id; custom stores the validated 6-field palette.
 */
export async function PATCH(req) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFrom(session);
  const body = await req.json().catch(() => ({}));
  const themeId = String(body?.theme_id || "").trim();

  if (!themeId) {
    return NextResponse.json({ error: "theme_id is required." }, { status: 400 });
  }

  let settingsToStore = null;

  if (themeId === DEFAULT_THEME_ID) {
    // default: clear any stale custom settings.
  } else if (themeId === CUSTOM_THEME_ID) {
    const validated = validateCustomPaletteInput(body?.theme_settings);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    settingsToStore = validated.value;
  } else {
    // predefined theme — must exist. Only store the id.
    if (!getThemeDefinition(themeId)) {
      return NextResponse.json({ error: "Unknown theme." }, { status: 400 });
    }
  }

  await query(
    `UPDATE users
     SET theme_id = ?, theme_settings = ?
     WHERE id = ? AND user_type = 'agent'`,
    [themeId, settingsToStore ? JSON.stringify(settingsToStore) : null, agentId],
  );

  const rows = await query(
    "SELECT username, estate_name FROM users WHERE id = ? AND user_type = 'agent' LIMIT 1",
    [agentId],
  );
  const handle = rows[0]?.username || rows[0]?.estate_name;
  if (handle) {
    // Revalidate every public route that renders the agent theme so the
    // saved change is visible immediately (these are ISR pages).
    revalidatePath(`/re/${handle}`);
    revalidatePath(`/re/${handle}/[propertyId]`, "page");
    revalidatePath(`/re/${handle}/blogs/[slug]`, "page");
    revalidatePath(`/re/${handle}/videos/[slug]`, "page");
    revalidatePath(`/re/${handle}/files-updates`);
  }

  const updated = await query(
    "SELECT theme_id, theme_settings FROM users WHERE id = ? AND user_type = 'agent' LIMIT 1",
    [agentId],
  );

  return NextResponse.json({
    success: true,
    theme: getThemeSummary(updated[0]),
  });
}

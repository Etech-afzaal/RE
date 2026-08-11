import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";
import { requireAgent } from "@/lib/adminAuth";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  createAuditLog,
  getRequestIp,
} from "@/lib/auditLogger";
import { query } from "@/lib/db";
import {
  IMAGE_KINDS,
  imageProcessErrorMessage,
  validateImageUploadFile,
} from "@/lib/imageUpload";
import { validateAndCompressImageBuffer } from "@/lib/serverImageProcess";
import { resolvePublicUploadPath } from "@/lib/uploadPath";

function agentIdFrom(session) {
  return Number(session.user.agent_id || session.user.id);
}

/** Only unlink files under this agent's own uploads folder. */
async function removeOwnedAgentFile(publicUrl, agentId) {
  const expectedPrefix = `/uploads/agents/${agentId}/`;
  if (!String(publicUrl || "").startsWith(expectedPrefix)) return;
  const localPath = resolvePublicUploadPath(publicUrl);
  if (localPath) await rm(localPath, { force: true });
}

export async function POST(req) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFrom(session);
  const formData = await req.formData();
  const image = formData.get("image");

  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ error: "Please select an image." }, { status: 400 });
  }

  const validated = validateImageUploadFile(image, IMAGE_KINDS.COMPANY_LOGO);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  try {
    const agents = await query(
      "SELECT username, estate_name, full_name, company_logo FROM users WHERE id = ? AND user_type = 'agent' LIMIT 1",
      [agentId],
    );
    const agent = agents[0];
    if (!agent) {
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    }

    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "agents",
      String(agentId),
    );
    await mkdir(uploadDir, { recursive: true });

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const processed = await validateAndCompressImageBuffer(imageBuffer, {
      maxWidth: 600,
      maxHeight: 600,
    });

    if (!processed.ok) {
      return NextResponse.json({ error: processed.error }, { status: 400 });
    }

    const filename = `company-logo-${nanoid(8)}.webp`;
    const outputPath = path.join(uploadDir, filename);
    await writeFile(outputPath, processed.buffer);

    const companyLogo = `/uploads/agents/${agentId}/${filename}`;
    await query("UPDATE users SET company_logo = ? WHERE id = ? AND user_type = 'agent'", [
      companyLogo,
      agentId,
    ]);

    if (agent.company_logo && agent.company_logo !== companyLogo) {
      await removeOwnedAgentFile(agent.company_logo, agentId);
    }
    const handle = agent.username || agent.estate_name;
    revalidatePath("/");
    revalidatePath(`/re/${handle}`);

    const agentName = agent.full_name || session.user.name || "Agent";
    await createAuditLog({
      userId: agentId,
      action: AUDIT_ACTIONS.COMPANY_LOGO_CHANGED,
      entityType: AUDIT_ENTITY_TYPES.BRANDING,
      entityId: agentId,
      description: `${agentName} changed company logo`,
      metadata: {
        actor_name: agentName,
        agent_name: agentName,
        agent_username: handle,
        estate_name: agent.estate_name,
        company_logo: companyLogo,
      },
      ipAddress: getRequestIp(req),
    });

    return NextResponse.json({ success: true, company_logo: companyLogo });
  } catch (err) {
    console.error("Failed to upload company logo:", err);
    return NextResponse.json(
      { error: imageProcessErrorMessage() },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFrom(session);

  try {
    const agents = await query(
      "SELECT username, estate_name, full_name, company_logo FROM users WHERE id = ? AND user_type = 'agent' LIMIT 1",
      [agentId],
    );
    const agent = agents[0];
    if (!agent) {
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    }

    if (!agent.company_logo) {
      return NextResponse.json({ success: true, company_logo: null });
    }

    const previousLogo = agent.company_logo;
    await removeOwnedAgentFile(previousLogo, agentId);
    await query(
      "UPDATE users SET company_logo = NULL WHERE id = ? AND user_type = 'agent'",
      [agentId],
    );

    const handle = agent.username || agent.estate_name;
    revalidatePath("/");
    revalidatePath(`/re/${handle}`);

    const agentName = agent.full_name || session.user.name || "Agent";
    await createAuditLog({
      userId: agentId,
      action: AUDIT_ACTIONS.COMPANY_LOGO_CHANGED,
      entityType: AUDIT_ENTITY_TYPES.BRANDING,
      entityId: agentId,
      description: `${agentName} removed company logo`,
      metadata: {
        actor_name: agentName,
        agent_name: agentName,
        agent_username: handle,
        estate_name: agent.estate_name,
        company_logo: null,
        previous_company_logo: previousLogo,
      },
      ipAddress: getRequestIp(req),
    });

    return NextResponse.json({ success: true, company_logo: null });
  } catch (err) {
    console.error("Failed to remove company logo:", err);
    return NextResponse.json(
      { error: "Could not remove company logo. Please try again." },
      { status: 500 },
    );
  }
}

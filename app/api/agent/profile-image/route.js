import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";
import { requireAgent } from "@/lib/adminAuth";
import { query } from "@/lib/db";
import {
  IMAGE_KINDS,
  imageFormatErrorMessage,
  imageProcessErrorMessage,
  validateImageUploadFile,
} from "@/lib/imageUpload";
import { validateAndCompressImageBuffer } from "@/lib/serverImageProcess";
import { resolvePublicUploadPath } from "@/lib/uploadPath";

function agentIdFromSession(session) {
  return Number(session.user.agent_id || session.user.id);
}

/** Only unlink files under this agent's own uploads folder. */
async function removeOwnedAgentFile(publicUrl, agentId) {
  const expectedPrefix = `/uploads/agents/${agentId}/`;
  if (!String(publicUrl || "").startsWith(expectedPrefix)) return;
  const localPath = resolvePublicUploadPath(publicUrl);
  if (localPath) await rm(localPath, { force: true });
}

export async function GET() {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFromSession(session);
  const agents = await query(
    "SELECT profile_image FROM users WHERE id = ? AND user_type = 'agent' LIMIT 1",
    [agentId],
  );

  if (!agents[0]) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  return NextResponse.json({ profile_image: agents[0].profile_image || null });
}

export async function POST(req) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFromSession(session);
  const formData = await req.formData();
  const image = formData.get("image");

  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ error: "Please select an image." }, { status: 400 });
  }

  const validated = validateImageUploadFile(image, IMAGE_KINDS.PROFILE);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  try {
    const agents = await query(
      "SELECT username, estate_name, profile_image FROM users WHERE id = ? AND user_type = 'agent' LIMIT 1",
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
    const processed = await validateAndCompressImageBuffer(imageBuffer);

    if (!processed.ok) {
      return NextResponse.json({ error: processed.error }, { status: 400 });
    }

    const filename = `${nanoid(10)}.webp`;
    const outputPath = path.join(uploadDir, filename);
    await writeFile(outputPath, processed.buffer);

    const profileImage = `/uploads/agents/${agentId}/${filename}`;
    await query("UPDATE users SET profile_image = ? WHERE id = ? AND user_type = 'agent'", [
      profileImage,
      agentId,
    ]);

    if (agent.profile_image && agent.profile_image !== profileImage) {
      await removeOwnedAgentFile(agent.profile_image, agentId);
    }
    revalidatePath("/");
    revalidatePath(`/re/${agent.username || agent.estate_name}`);

    return NextResponse.json({ success: true, profile_image: profileImage });
  } catch (err) {
    console.error("Failed to upload agent profile image:", err);
    return NextResponse.json(
      {
        error:
          err?.message?.includes("unsupported") || err?.message?.includes("Input")
            ? imageFormatErrorMessage()
            : imageProcessErrorMessage(),
      },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFromSession(session);

  try {
    const agents = await query(
      "SELECT username, estate_name, profile_image FROM users WHERE id = ? AND user_type = 'agent' LIMIT 1",
      [agentId],
    );
    const agent = agents[0];
    if (!agent) {
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    }

    if (!agent.profile_image) {
      return NextResponse.json({ success: true, profile_image: null });
    }

    await removeOwnedAgentFile(agent.profile_image, agentId);
    await query(
      "UPDATE users SET profile_image = NULL WHERE id = ? AND user_type = 'agent'",
      [agentId],
    );

    revalidatePath("/");
    revalidatePath(`/re/${agent.username || agent.estate_name}`);

    return NextResponse.json({ success: true, profile_image: null });
  } catch (err) {
    console.error("Failed to remove agent profile image:", err);
    return NextResponse.json(
      { error: "Could not remove profile image. Please try again." },
      { status: 500 },
    );
  }
}

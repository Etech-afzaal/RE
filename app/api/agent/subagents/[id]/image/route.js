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
import { getSubagentForAgent } from "@/lib/subagents";

function agentIdFromSession(session) {
  return Number(session.user.agent_id || session.user.id);
}

async function removeOwnedSubagentFile(publicUrl, agentId) {
  const expectedPrefix = `/uploads/agents/${agentId}/subagents/`;
  if (!String(publicUrl || "").startsWith(expectedPrefix)) return;
  const localPath = resolvePublicUploadPath(publicUrl);
  if (localPath) await rm(localPath, { force: true });
}

export async function POST(req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFromSession(session);
  const subagentId = Number(params.id);

  if (!Number.isInteger(subagentId) || subagentId <= 0) {
    return NextResponse.json({ error: "Invalid subagent." }, { status: 400 });
  }

  const subagent = await getSubagentForAgent(agentId, subagentId);
  if (!subagent) {
    return NextResponse.json({ error: "Subagent not found." }, { status: 404 });
  }

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
    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "agents",
      String(agentId),
      "subagents",
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

    const imageUrl = `/uploads/agents/${agentId}/subagents/${filename}`;
    await query(
      "UPDATE subagents SET image = ? WHERE id = ? AND agent_id = ?",
      [imageUrl, subagentId, agentId],
    );

    if (subagent.image && subagent.image !== imageUrl) {
      await removeOwnedSubagentFile(subagent.image, agentId);
    }

    revalidatePath("/");

    return NextResponse.json({ success: true, image: imageUrl });
  } catch (err) {
    console.error("Failed to upload subagent image:", err);
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

export async function DELETE(_req, { params }) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFromSession(session);
  const subagentId = Number(params.id);

  if (!Number.isInteger(subagentId) || subagentId <= 0) {
    return NextResponse.json({ error: "Invalid subagent." }, { status: 400 });
  }

  const subagent = await getSubagentForAgent(agentId, subagentId);
  if (!subagent) {
    return NextResponse.json({ error: "Subagent not found." }, { status: 404 });
  }

  if (subagent.image) {
    await removeOwnedSubagentFile(subagent.image, agentId);
  }

  await query(
    "UPDATE subagents SET image = NULL WHERE id = ? AND agent_id = ?",
    [subagentId, agentId],
  );

  return NextResponse.json({ success: true, image: null });
}

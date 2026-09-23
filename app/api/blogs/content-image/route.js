import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";
import { requireAgent } from "@/lib/adminAuth";
import {
  IMAGE_KINDS,
  imageFormatErrorMessage,
  imageProcessErrorMessage,
  validateImageUploadFile,
} from "@/lib/imageUpload";
import { validateAndCompressImageBuffer } from "@/lib/serverImageProcess";

function agentIdFromSession(session) {
  return Number(session.user.agent_id || session.user.id);
}

/**
 * Upload an in-content image for a blog article. Stored under the agent's
 * blogs-content directory; no blog id required so images can be added before
 * the first save.
 */
export async function POST(req) {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFromSession(session);

  const formData = await req.formData();
  const image = formData.get("image");

  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ error: "Please select an image." }, { status: 400 });
  }

  const validated = validateImageUploadFile(image, IMAGE_KINDS.PROPERTY);
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
      "blogs-content",
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

    const imageUrl = `/uploads/agents/${agentId}/blogs-content/${filename}`;

    return NextResponse.json({ success: true, url: imageUrl });
  } catch (err) {
    console.error("Failed to upload blog content image:", err);
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

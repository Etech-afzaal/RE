import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { nanoid } from "nanoid";
import { requireAgent } from "@/lib/adminAuth";
import { query } from "@/lib/db";
import { imageFormatErrorMessage, isImageFile } from "@/lib/imageUpload";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function agentIdFromSession(session) {
  return Number(session.user.agent_id || session.user.id);
}

export async function GET() {
  const { session, error } = await requireAgent();
  if (error) return error;

  const agentId = agentIdFromSession(session);
  const agents = await query(
    "SELECT profile_image FROM agents WHERE id = ? LIMIT 1",
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

  if (!isImageFile(image)) {
    return NextResponse.json({ error: imageFormatErrorMessage() }, { status: 400 });
  }

  if (image.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Profile images must be 5 MB or smaller." },
      { status: 400 },
    );
  }

  try {
    const agents = await query(
      "SELECT username, estate_name FROM agents WHERE id = ? LIMIT 1",
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

    const filename = `${nanoid(10)}.jpg`;
    const outputPath = path.join(uploadDir, filename);
    const imageBuffer = Buffer.from(await image.arrayBuffer());

    await sharp(imageBuffer, { failOn: "none" })
      .rotate()
      .resize(600, 600, { fit: "cover", position: "attention" })
      .jpeg({ quality: 88, mozjpeg: true })
      .toFile(outputPath);

    const profileImage = `/uploads/agents/${agentId}/${filename}`;
    await query("UPDATE agents SET profile_image = ? WHERE id = ?", [
      profileImage,
      agentId,
    ]);

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
            : "Could not upload profile image. Please try again.",
      },
      { status: 500 },
    );
  }
}

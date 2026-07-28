import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { mkdir } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { nanoid } from "nanoid";
import { requireAgent } from "@/lib/adminAuth";
import { query } from "@/lib/db";
import { imageFormatErrorMessage, isImageFile } from "@/lib/imageUpload";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

function agentIdFrom(session) {
  return Number(session.user.agent_id || session.user.id);
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
  if (!isImageFile(image)) {
    return NextResponse.json({ error: imageFormatErrorMessage() }, { status: 400 });
  }
  if (image.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Logo images must be 5 MB or smaller." },
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

    const filename = `company-logo-${nanoid(8)}.jpg`;
    const outputPath = path.join(uploadDir, filename);
    const imageBuffer = Buffer.from(await image.arrayBuffer());

    await sharp(imageBuffer, { failOn: "none" })
      .rotate()
      .resize(600, 600, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88, mozjpeg: true })
      .toFile(outputPath);

    const companyLogo = `/uploads/agents/${agentId}/${filename}`;
    await query("UPDATE agents SET company_logo = ? WHERE id = ?", [
      companyLogo,
      agentId,
    ]);

    revalidatePath("/");
    revalidatePath(`/re/${agent.username || agent.estate_name}`);

    return NextResponse.json({ success: true, company_logo: companyLogo });
  } catch (err) {
    console.error("Failed to upload company logo:", err);
    return NextResponse.json(
      { error: "Could not upload company logo. Please try again." },
      { status: 500 },
    );
  }
}

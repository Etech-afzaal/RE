import { query } from "@/lib/db";

export async function getSignupRequests() {
  return query("SELECT * FROM signup_requests ORDER BY created_at DESC");
}

export async function getPendingSignupRequests() {
  return getSignupRequests();
}

export async function getAgentByEstateName(estateName) {
  const normalized = String(estateName || "")
    .trim()
    .replace(/%20/g, " ");

  const rows = await query(
    "SELECT id, estate_name, full_name, email, phone FROM agents WHERE estate_name = ? AND status = 'active'",
    [normalized],
  );
  return rows[0] || null;
}

export async function getPropertiesByAgentId(agentId) {
  const properties = await query(
    `SELECT * FROM properties WHERE agent_id = ? AND status = 'active' ORDER BY created_at DESC`,
    [agentId],
  );

  if (properties.length === 0) return [];

  const ids = properties.map((p) => p.id);
  const images = await query(
    `SELECT * FROM property_images WHERE property_id IN (${ids.map(() => "?").join(",")}) ORDER BY sort_order ASC`,
    ids,
  );

  return properties.map((p) => {
    const propertyImages = images.filter((img) => img.property_id === p.id);
    const featuredImage =
      propertyImages.find((img) => img.is_featured) ||
      propertyImages[0] ||
      null;

    return {
      ...p,
      images: propertyImages,
      featuredImage,
    };
  });
}

export async function getFeaturedProperties(limit = 6) {
  // limit is sanitized to a positive integer and inlined because mysql2's
  // prepared-statement execute() does not reliably bind LIMIT placeholders.
  const safeLimit = Math.max(1, Math.min(24, Number(limit) || 6));

  const properties = await query(
    `SELECT p.*, a.estate_name, a.full_name AS agent_name
     FROM properties p
     JOIN agents a ON a.id = p.agent_id
     WHERE p.status = 'active' AND a.status = 'active'
     ORDER BY p.created_at DESC
     LIMIT ${safeLimit}`,
  );

  if (properties.length === 0) return [];

  const ids = properties.map((p) => p.id);
  const images = await query(
    `SELECT * FROM property_images WHERE property_id IN (${ids.map(() => "?").join(",")}) ORDER BY sort_order ASC`,
    ids,
  );

  return properties.map((p) => {
    const propertyImages = images.filter((img) => img.property_id === p.id);
    const featuredImage =
      propertyImages.find((img) => img.is_featured) ||
      propertyImages[0] ||
      null;

    return { ...p, images: propertyImages, featuredImage };
  });
}

export async function getPublicStats() {
  const rows = await query(
    `SELECT
       (SELECT COUNT(*) FROM properties WHERE status = 'active') AS activeListings,
       (SELECT COUNT(*) FROM agents WHERE status = 'active') AS activeAgents,
       (SELECT COUNT(DISTINCT location) FROM properties WHERE status = 'active' AND location IS NOT NULL AND location != '') AS locations`,
  );
  return rows[0] || { activeListings: 0, activeAgents: 0, locations: 0 };
}

export async function getPropertyById(id) {
  const rows = await query("SELECT * FROM properties WHERE id = ?", [id]);
  const property = rows[0];
  if (!property) return null;

  const images = await query(
    "SELECT * FROM property_images WHERE property_id = ? ORDER BY sort_order ASC, id ASC",
    [id],
  );
  const featuredImage =
    images.find((image) => image.is_featured) || images[0] || null;
  return { ...property, images, featuredImage };
}

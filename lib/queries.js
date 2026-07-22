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

  // Round-robin across locations (rn = 1 for every area first, then rn = 2, ...)
  // so the featured grid always mixes Bahria, DHA, Gulberg, etc. instead of
  // showing several near-identical listings from the same area.
  const properties = await query(
    `SELECT * FROM (
       SELECT p.*, a.estate_name, a.full_name AS agent_name,
              ROW_NUMBER() OVER (
                PARTITION BY p.location
                ORDER BY p.created_at DESC, p.id ASC
              ) AS location_rank
       FROM properties p
       JOIN agents a ON a.id = p.agent_id
       WHERE p.status = 'active' AND a.status = 'active'
     ) ranked
     ORDER BY location_rank ASC, location ASC
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

export async function getPopularLocations(limit = 6) {
  const safeLimit = Math.max(1, Math.min(12, Number(limit) || 6));
  return query(
    `SELECT p.location AS name, COUNT(*) AS listingCount,
            (
              SELECT pi.image_url
              FROM property_images pi
              JOIN properties p2 ON p2.id = pi.property_id
              WHERE p2.location = p.location AND p2.status = 'active'
              ORDER BY pi.is_featured DESC, pi.sort_order ASC
              LIMIT 1
            ) AS image_url
     FROM properties p
     JOIN agents a ON a.id = p.agent_id
     WHERE p.status = 'active'
       AND a.status = 'active'
       AND p.location IS NOT NULL
       AND p.location != ''
     GROUP BY p.location
     ORDER BY listingCount DESC
     LIMIT ${safeLimit}`,
  );
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

/**
 * Active listings used as homepage hero slides — one per location
 * (e.g. Bahria, DHA, Gulberg) so the slides showcase different areas.
 * Background = featured image, front text = title + description.
 */
export async function getHeroSlides(limit = 5) {
  const safeLimit = Math.max(1, Math.min(6, Number(limit) || 5));

  const properties = await query(
    `SELECT id, title, description, location, price,
            estate_name, agent_name, agent_phone
     FROM (
       SELECT p.id, p.title, p.description, p.location, p.price, p.created_at,
              a.estate_name, a.full_name AS agent_name, a.phone AS agent_phone,
              ROW_NUMBER() OVER (
                PARTITION BY p.location
                ORDER BY p.created_at DESC, p.id ASC
              ) AS location_rank
       FROM properties p
       JOIN agents a ON a.id = p.agent_id
       WHERE p.status = 'active' AND a.status = 'active'
     ) ranked
     ORDER BY location_rank ASC, created_at DESC
     LIMIT ${safeLimit}`,
  );

  if (properties.length === 0) return [];

  const ids = properties.map((p) => p.id);
  const images = await query(
    `SELECT * FROM property_images
     WHERE property_id IN (${ids.map(() => "?").join(",")})
     ORDER BY is_featured DESC, sort_order ASC, id ASC`,
    ids,
  );

  return properties.map((p) => {
    const propertyImages = images.filter((img) => img.property_id === p.id);
    const featuredImage =
      propertyImages.find((img) => img.is_featured) ||
      propertyImages[0] ||
      null;

    return {
      id: p.id,
      title: p.title,
      description: p.description,
      location: p.location,
      price: p.price,
      estate_name: p.estate_name,
      agent_name: p.agent_name,
      agent_phone: p.agent_phone,
      image_url: featuredImage?.image_url || null,
      image_title: featuredImage?.image_title || p.title,
      href: `/re/${p.estate_name}/${p.id}`,
    };
  });
}

const DEFAULT_HERO = {
  title: "Real Estate Solutions",
  subtitle:
    "It's important to note that real estate laws and regulations vary by jurisdiction.",
  cta_label: "Find Property",
  cta_href: "#properties",
  trust_rating: 5.0,
  trust_reviews: 2348,
  phone: "+990-737 621 432",
  phone_label: "To More Inquiry",
  slides: [
    {
      id: 0,
      image_url: "/hero/1.jpg",
      alt_text: "Modern luxury home exterior",
    },
  ],
};

export async function getHeroContent() {
  try {
    const [settingsRows, slides] = await Promise.all([
      query("SELECT * FROM hero_settings WHERE id = 1 LIMIT 1"),
      query(
        `SELECT id, image_url, alt_text, sort_order
         FROM hero_slides
         WHERE is_active = TRUE
         ORDER BY sort_order ASC, id ASC`,
      ),
    ]);

    const settings = settingsRows[0];
    if (!settings) {
      return DEFAULT_HERO;
    }

    return {
      title: settings.title,
      subtitle: settings.subtitle,
      cta_label: settings.cta_label,
      cta_href: settings.cta_href,
      trust_rating: Number(settings.trust_rating),
      trust_reviews: Number(settings.trust_reviews),
      phone: settings.phone,
      phone_label: settings.phone_label,
      slides:
        slides.length > 0
          ? slides
          : DEFAULT_HERO.slides,
    };
  } catch {
    // Tables may not exist yet on a fresh DB — fall back so the homepage still renders.
    return DEFAULT_HERO;
  }
}

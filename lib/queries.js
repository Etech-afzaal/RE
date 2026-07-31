import { query } from "@/lib/db";
import { AGENT_LIVE_STATUS, PROPERTY_PUBLIC_STATUS } from "@/lib/status";
import {
  groupImagesByCategory,
  imageCategoryLabel,
  normalizeImageCategory,
} from "@/lib/imageCategories";
import {
  agentPublicUsername,
  parsePropertySlugParam,
  propertyPublicPath,
} from "@/lib/propertySlug";

/**
 * Add the display label for an image's room/area category.
 * Images uploaded before categories existed come back as "Uncategorized"
 * rather than blank, so galleries never render an empty label.
 */
function withImageCategory(image) {
  const category = normalizeImageCategory(image.category);
  return {
    ...image,
    category,
    category_label: imageCategoryLabel(category),
  };
}

export async function getSignupRequests() {
  return query("SELECT * FROM signup_requests ORDER BY created_at DESC");
}

export async function getPendingSignupRequests() {
  return getSignupRequests();
}

/**
 * Public agent lookup by username (falls back to estate_name for legacy URLs).
 * Only returns approved (live) agents.
 */
export async function getAgentByUsername(username) {
  const normalized = String(username || "")
    .trim()
    .replace(/%20/g, " ");

  if (!normalized) return null;

  const rows = await query(
    `SELECT id, estate_name, username, full_name, email, phone,
            profile_image, company_logo, company_name, description,
            areas_served, office_address, social_links, status
     FROM agents
     WHERE status = ?
       AND (username = ? OR estate_name = ?)
     LIMIT 1`,
    [AGENT_LIVE_STATUS, normalized, normalized],
  );
  return rows[0] || null;
}

/** @deprecated Prefer getAgentByUsername — kept for older call sites. */
export async function getAgentByEstateName(estateName) {
  return getAgentByUsername(estateName);
}

/**
 * Public directory of approved agents (no secrets).
 * Includes approved property counts for cards.
 */
export async function getApprovedAgents() {
  const rows = await query(
    `SELECT
       a.id,
       a.full_name,
       a.username,
       a.estate_name,
       a.profile_image,
       a.description,
       a.areas_served,
       (
         SELECT COUNT(*)
         FROM properties p
         WHERE p.agent_id = a.id AND p.status = ?
       ) AS property_count,
       (
         SELECT GROUP_CONCAT(DISTINCT p.location ORDER BY p.location SEPARATOR '||')
         FROM properties p
         WHERE p.agent_id = a.id
           AND p.status = ?
           AND p.location IS NOT NULL
           AND p.location != ''
       ) AS listing_locations
     FROM agents a
     WHERE a.status = ?
     ORDER BY property_count DESC, a.full_name ASC`,
    [PROPERTY_PUBLIC_STATUS, PROPERTY_PUBLIC_STATUS, AGENT_LIVE_STATUS],
  );

  return rows.map((row) => ({
    id: row.id,
    full_name: row.full_name,
    username: row.username || row.estate_name,
    estate_name: row.estate_name,
    profile_image: row.profile_image || null,
    description: row.description || null,
    areas_served: row.areas_served || null,
    property_count: Number(row.property_count) || 0,
    listing_locations: row.listing_locations
      ? String(row.listing_locations)
          .split("||")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  }));
}

export async function getApprovedPropertyCount(agentId) {
  const rows = await query(
    `SELECT COUNT(*) AS c
     FROM properties
     WHERE agent_id = ? AND status = ?`,
    [agentId, PROPERTY_PUBLIC_STATUS],
  );
  return Number(rows[0]?.c) || 0;
}

/** Distinct listing areas for the customer homepage area filter. */
export async function getAgentDiscoveryAreas() {
  return query(
    `SELECT p.location AS name, COUNT(*) AS listingCount
     FROM properties p
     JOIN agents a ON a.id = p.agent_id
     WHERE p.status = ?
       AND a.status = ?
       AND p.location IS NOT NULL
       AND p.location != ''
     GROUP BY p.location
     ORDER BY listingCount DESC, p.location ASC`,
    [PROPERTY_PUBLIC_STATUS, AGENT_LIVE_STATUS],
  );
}

async function attachPropertyImages(properties) {
  if (!properties.length) return [];

  const ids = properties.map((p) => p.id);
  const images = await query(
    `SELECT * FROM property_images WHERE property_id IN (${ids.map(() => "?").join(",")}) ORDER BY sort_order ASC`,
    ids,
  );

  return properties.map((p) => {
    const propertyImages = images
      .filter((img) => img.property_id === p.id)
      .map(withImageCategory);
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

/**
 * Approved (public) properties for one agent.
 */
export async function getApprovedPropertiesByAgent(agentId) {
  const properties = await query(
    `SELECT p.*, a.estate_name, a.username, a.full_name AS agent_name
     FROM properties p
     JOIN agents a ON a.id = p.agent_id
     WHERE p.agent_id = ?
       AND p.status = ?
       AND a.status = ?
     ORDER BY p.created_at DESC`,
    [agentId, PROPERTY_PUBLIC_STATUS, AGENT_LIVE_STATUS],
  );

  return attachPropertyImages(properties);
}

/** Alias used by older estate pages / agent APIs. */
export async function getPropertiesByAgentId(agentId) {
  return getApprovedPropertiesByAgent(agentId);
}

/**
 * All properties owned by an agent (any status) — agent dashboard only.
 * Never used for public pages.
 */
export async function getManagedPropertiesByAgent(agentId) {
  const properties = await query(
    `SELECT p.*, a.estate_name, a.username, a.full_name AS agent_name
     FROM properties p
     JOIN agents a ON a.id = p.agent_id
     WHERE p.agent_id = ?
     ORDER BY p.updated_at DESC, p.created_at DESC`,
    [agentId],
  );

  return attachPropertyImages(properties);
}

/**
 * A single page of an agent's managed listings. This intentionally keeps the
 * database result set small; the dashboard must never fetch every listing just
 * to render one page.
 */
export async function getManagedPropertiesPageByAgent(
  agentId,
  { page = 1, pageSize = 10, status, search } = {},
) {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safePageSize = Math.max(1, Math.min(100, Number.parseInt(pageSize, 10) || 10));
  const filters = ["p.agent_id = ?"];
  const params = [agentId];

  if (status && status !== "all") {
    filters.push("p.status = ?");
    params.push(status);
  }

  const normalizedSearch = String(search || "").trim();
  if (normalizedSearch) {
    const like = `%${normalizedSearch}%`;
    filters.push("(p.title LIKE ? OR p.location LIKE ? OR p.description LIKE ?)");
    params.push(like, like, like);
  }

  const where = filters.join(" AND ");
  const countRows = await query(
    `SELECT COUNT(*) AS total FROM properties p WHERE ${where}`,
    params,
  );
  const totalProperties = Number(countRows[0]?.total) || 0;
  const totalPages = Math.max(1, Math.ceil(totalProperties / safePageSize));
  const currentPage = Math.min(safePage, totalPages);
  const offset = (currentPage - 1) * safePageSize;

  const properties = await query(
    `SELECT p.*, a.estate_name, a.username, a.full_name AS agent_name
     FROM properties p
     JOIN agents a ON a.id = p.agent_id
     WHERE ${where}
     ORDER BY p.updated_at DESC, p.created_at DESC
     LIMIT ${safePageSize} OFFSET ${offset}`,
    params,
  );

  return {
    properties: await attachPropertyImages(properties),
    currentPage,
    totalProperties,
    totalPages,
  };
}

export async function getAgentPropertyStats(agentId) {
  const rows = await query(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
       SUM(CASE WHEN status = 'pending_approval' THEN 1 ELSE 0 END) AS pending_approval,
       SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft,
       SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
       SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) AS sold
     FROM properties
     WHERE agent_id = ?`,
    [agentId],
  );
  const row = rows[0] || {};
  return {
    total: Number(row.total) || 0,
    approved: Number(row.approved) || 0,
    pending_approval: Number(row.pending_approval) || 0,
    draft: Number(row.draft) || 0,
    rejected: Number(row.rejected) || 0,
    sold: Number(row.sold) || 0,
  };
}

/**
 * Load a public property by agent + slug (or numeric id).
 * Enforces ownership and approved status.
 */
export async function getPropertyByAgentAndSlug(agentId, slug) {
  const propertyId = parsePropertySlugParam(slug);
  if (!propertyId) return null;

  const rows = await query(
    `SELECT p.*, a.estate_name, a.username, a.full_name AS agent_name
     FROM properties p
     JOIN agents a ON a.id = p.agent_id
     WHERE p.id = ?
       AND p.agent_id = ?
       AND p.status = ?
       AND a.status = ?
     LIMIT 1`,
    [propertyId, agentId, PROPERTY_PUBLIC_STATUS, AGENT_LIVE_STATUS],
  );

  const property = rows[0];
  if (!property) return null;

  const imageRows = await query(
    "SELECT * FROM property_images WHERE property_id = ? ORDER BY sort_order ASC, id ASC",
    [propertyId],
  );
  const images = imageRows.map(withImageCategory);
  const featuredImage =
    images.find((image) => image.is_featured) || images[0] || null;

  return {
    ...property,
    images,
    featuredImage,
    // Room-by-room view of the same images, for galleries that group by area.
    imagesByCategory: groupImagesByCategory(images),
  };
}

export async function getFeaturedProperties(limit = 6) {
  const safeLimit = Math.max(1, Math.min(24, Number(limit) || 6));

  const properties = await query(
    `SELECT * FROM (
       SELECT p.*, a.estate_name, a.username, a.full_name AS agent_name,
              ROW_NUMBER() OVER (
                PARTITION BY p.location
                ORDER BY p.created_at DESC, p.id ASC
              ) AS location_rank
       FROM properties p
       JOIN agents a ON a.id = p.agent_id
       WHERE p.status = ? AND a.status = ?
     ) ranked
     ORDER BY location_rank ASC, location ASC
     LIMIT ${safeLimit}`,
    [PROPERTY_PUBLIC_STATUS, AGENT_LIVE_STATUS],
  );

  return attachPropertyImages(properties);
}

export async function getPublicStats() {
  const rows = await query(
    `SELECT
       (SELECT COUNT(*) FROM properties WHERE status = ?) AS activeListings,
       (SELECT COUNT(*) FROM agents WHERE status = ?) AS activeAgents,
       (SELECT COUNT(DISTINCT location) FROM properties WHERE status = ? AND location IS NOT NULL AND location != '') AS locations`,
    [PROPERTY_PUBLIC_STATUS, AGENT_LIVE_STATUS, PROPERTY_PUBLIC_STATUS],
  );
  return rows[0] || { activeListings: 0, activeAgents: 0, locations: 0 };
}

export async function getPublicStatsForAgent(agentId) {
  const rows = await query(
    `SELECT
       (SELECT COUNT(*) FROM properties WHERE agent_id = ? AND status = ?) AS activeListings,
       1 AS activeAgents,
       (SELECT COUNT(DISTINCT location) FROM properties
         WHERE agent_id = ? AND status = ?
           AND location IS NOT NULL AND location != '') AS locations`,
    [agentId, PROPERTY_PUBLIC_STATUS, agentId, PROPERTY_PUBLIC_STATUS],
  );
  return rows[0] || { activeListings: 0, activeAgents: 1, locations: 0 };
}

export async function getPopularLocations(limit = 6) {
  const safeLimit = Math.max(1, Math.min(24, Number(limit) || 6));
  return query(
    `SELECT p.location AS name, COUNT(*) AS listingCount,
            (
              SELECT pi.image_url
              FROM property_images pi
              JOIN properties p2 ON p2.id = pi.property_id
              WHERE p2.location = p.location AND p2.status = ?
              ORDER BY pi.is_featured DESC, pi.sort_order ASC
              LIMIT 1
            ) AS image_url
     FROM properties p
     JOIN agents a ON a.id = p.agent_id
     WHERE p.status = ?
       AND a.status = ?
       AND p.location IS NOT NULL
       AND p.location != ''
     GROUP BY p.location
     ORDER BY listingCount DESC
     LIMIT ${safeLimit}`,
    [PROPERTY_PUBLIC_STATUS, PROPERTY_PUBLIC_STATUS, AGENT_LIVE_STATUS],
  );
}

export async function getPopularLocationsForAgent(agentId, limit = 6) {
  const safeLimit = Math.max(1, Math.min(24, Number(limit) || 6));
  return query(
    `SELECT p.location AS name, COUNT(*) AS listingCount,
            (
              SELECT pi.image_url
              FROM property_images pi
              JOIN properties p2 ON p2.id = pi.property_id
              WHERE p2.location = p.location
                AND p2.agent_id = p.agent_id
                AND p2.status = ?
              ORDER BY pi.is_featured DESC, pi.sort_order ASC
              LIMIT 1
            ) AS image_url
     FROM properties p
     WHERE p.agent_id = ?
       AND p.status = ?
       AND p.location IS NOT NULL
       AND p.location != ''
     GROUP BY p.location, p.agent_id
     ORDER BY listingCount DESC
     LIMIT ${safeLimit}`,
    [PROPERTY_PUBLIC_STATUS, agentId, PROPERTY_PUBLIC_STATUS],
  );
}

export async function getPropertyById(id) {
  const rows = await query("SELECT * FROM properties WHERE id = ?", [id]);
  const property = rows[0];
  if (!property) return null;

  const imageRows = await query(
    "SELECT * FROM property_images WHERE property_id = ? ORDER BY sort_order ASC, id ASC",
    [id],
  );
  const images = imageRows.map(withImageCategory);
  const featuredImage =
    images.find((image) => image.is_featured) || images[0] || null;
  return {
    ...property,
    images,
    featuredImage,
    imagesByCategory: groupImagesByCategory(images),
  };
}

function mapHeroSlides(properties, images) {
  return properties.map((p) => {
    const propertyImages = images.filter((img) => img.property_id === p.id);
    const featuredImage =
      propertyImages.find((img) => img.is_featured) ||
      propertyImages[0] ||
      null;
    const username = agentPublicUsername(p);

    return {
      id: p.id,
      title: p.title,
      description: p.description,
      location: p.location,
      price: p.price,
      estate_name: p.estate_name,
      username,
      agent_name: p.agent_name,
      agent_phone: p.agent_phone,
      image_url: featuredImage?.image_url || null,
      image_title: featuredImage?.image_title || p.title,
      href: propertyPublicPath(username, p),
    };
  });
}

export async function getHeroSlides(limit = 5) {
  const safeLimit = Math.max(1, Math.min(6, Number(limit) || 5));

  const properties = await query(
    `SELECT id, title, description, location, price,
            estate_name, username, agent_name, agent_phone
     FROM (
       SELECT p.id, p.title, p.description, p.location, p.price, p.created_at,
              a.estate_name, a.username, a.full_name AS agent_name, a.phone AS agent_phone,
              ROW_NUMBER() OVER (
                PARTITION BY p.location
                ORDER BY p.created_at DESC, p.id ASC
              ) AS location_rank
       FROM properties p
       JOIN agents a ON a.id = p.agent_id
       WHERE p.status = ? AND a.status = ?
         AND LOWER(p.title) NOT LIKE '%rent%'
         AND LOWER(p.title) NOT LIKE '%plot%'
     ) ranked
     ORDER BY location_rank ASC, created_at DESC
     LIMIT ${safeLimit}`,
    [PROPERTY_PUBLIC_STATUS, AGENT_LIVE_STATUS],
  );

  if (properties.length === 0) return [];

  const ids = properties.map((p) => p.id);
  const images = await query(
    `SELECT * FROM property_images
     WHERE property_id IN (${ids.map(() => "?").join(",")})
     ORDER BY is_featured DESC, sort_order ASC, id ASC`,
    ids,
  );

  return mapHeroSlides(properties, images);
}

export async function getHeroSlidesForAgent(agentId, limit = 5) {
  const safeLimit = Math.max(1, Math.min(6, Number(limit) || 5));

  const properties = await query(
    `SELECT id, title, description, location, price,
            estate_name, username, agent_name, agent_phone
     FROM (
       SELECT p.id, p.title, p.description, p.location, p.price, p.created_at,
              a.estate_name, a.username, a.full_name AS agent_name, a.phone AS agent_phone,
              ROW_NUMBER() OVER (
                PARTITION BY p.location
                ORDER BY p.created_at DESC, p.id ASC
              ) AS location_rank
       FROM properties p
       JOIN agents a ON a.id = p.agent_id
       WHERE p.agent_id = ?
         AND p.status = ?
         AND a.status = ?
         AND LOWER(p.title) NOT LIKE '%rent%'
         AND LOWER(p.title) NOT LIKE '%plot%'
     ) ranked
     ORDER BY location_rank ASC, created_at DESC
     LIMIT ${safeLimit}`,
    [agentId, PROPERTY_PUBLIC_STATUS, AGENT_LIVE_STATUS],
  );

  const source =
    properties.length > 0
      ? properties
      : await query(
          `SELECT p.id, p.title, p.description, p.location, p.price,
                  a.estate_name, a.username, a.full_name AS agent_name, a.phone AS agent_phone
           FROM properties p
           JOIN agents a ON a.id = p.agent_id
           WHERE p.agent_id = ? AND p.status = ? AND a.status = ?
           ORDER BY p.created_at DESC
           LIMIT ${safeLimit}`,
          [agentId, PROPERTY_PUBLIC_STATUS, AGENT_LIVE_STATUS],
        );

  if (source.length === 0) return [];

  const ids = source.map((p) => p.id);
  const images = await query(
    `SELECT * FROM property_images
     WHERE property_id IN (${ids.map(() => "?").join(",")})
     ORDER BY is_featured DESC, sort_order ASC, id ASC`,
    ids,
  );

  return mapHeroSlides(source, images);
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
      slides: slides.length > 0 ? slides : DEFAULT_HERO.slides,
    };
  } catch {
    return DEFAULT_HERO;
  }
}

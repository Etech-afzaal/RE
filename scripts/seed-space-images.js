/**
 * Demo data: give every existing listing a room-by-room gallery so the
 * "Swipe through the property" rail on the public detail page has real spaces
 * (kitchen, bathroom, parking, bedrooms ...) instead of a single exterior shot.
 *
 * What it does:
 *   1. Copies a curated, descriptively named set of photos out of the existing
 *      public/uploads folders into public/uploads/demo/spaces/.
 *   2. Re-labels the images already attached to properties, because the seeded
 *      titles do not match what the photos actually show (a lawn was titled
 *      "Dining room", a poolside shot "Attached bath").
 *   3. Appends the missing spaces to each listing, chosen by listing type:
 *      houses get full interiors, apartments a smaller set, plots only
 *      land/neighbourhood views.
 *
 * Usage: node scripts/seed-space-images.js  (add --dry to preview)
 * Safe to re-run: photos are matched by file content, so nothing is duplicated.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const ROOT = path.join(__dirname, "..");
const UPLOADS = path.join(ROOT, "public", "uploads");
const SPACES_DIR = path.join(UPLOADS, "demo", "spaces");
const SPACES_URL = "/uploads/demo/spaces";

/**
 * Curated library. `source` is relative to public/uploads and points at a photo
 * that already ships with the project; `file` is the readable copy we create.
 */
const LIBRARY = [
  { file: "drawing-room-1.jpg", source: "33/q1fLez2uaw.jpg", category: "drawing_room", title: "Formal drawing room" },
  { file: "drawing-room-2.jpg", source: "35/IZbbyoM-k5.jpg", category: "drawing_room", title: "Drawing room" },
  { file: "drawing-room-3.jpg", source: "33/uii0yU3v_g.jpg", category: "drawing_room", title: "Guest drawing room" },

  { file: "living-room-1.jpg", source: "33/-WomcU-rHd.jpg", category: "living_room", title: "Main living room" },
  { file: "living-room-2.jpg", source: "10/58fRyE7J0W.jpg", category: "living_room", title: "Living area" },

  { file: "tv-lounge-1.jpg", source: "33/Yjqu5PCpHb.jpg", category: "tv_lounge", title: "TV lounge" },
  { file: "tv-lounge-2.jpg", source: "33/alA7sF-CP5.jpg", category: "tv_lounge", title: "Family lounge" },
  { file: "tv-lounge-3.jpg", source: "33/An11m5mMaF.jpg", category: "tv_lounge", title: "Upper floor lounge" },

  { file: "master-bedroom-1.jpg", source: "33/M9CCvj77xc.jpg", category: "master_bedroom", title: "Master bedroom" },
  { file: "master-bedroom-2.jpg", source: "33/J4cpjVvTuo.jpg", category: "master_bedroom", title: "Master bedroom wardrobes" },

  { file: "bedroom-1.jpg", source: "33/M4z3gYASDA.jpg", category: "bedroom", title: "Bedroom" },
  { file: "bedroom-2.jpg", source: "35/12WxQOKJvw.jpg", category: "bedroom", title: "Second bedroom" },
  { file: "bedroom-3.jpg", source: "35/LWp1XrvifP.jpg", category: "bedroom", title: "Guest bedroom" },
  { file: "bedroom-4.jpg", source: "33/-iPDUazkIr.jpg", category: "bedroom", title: "Bedroom with wooden flooring" },

  { file: "kitchen-1.jpg", source: "33/4XxhEoMI7y.jpg", category: "kitchen", title: "Fitted kitchen" },
  { file: "kitchen-2.jpg", source: "33/eA3ZmOwFzq.jpg", category: "kitchen", title: "Pantry and prep area" },

  { file: "bathroom-1.jpg", source: "33/QTI3KSwvDS.jpg", category: "bathroom", title: "Guest washroom" },
  { file: "bathroom-2.jpg", source: "33/NII_M8tCaS.jpg", category: "bathroom", title: "Master bathroom" },
  { file: "bathroom-3.jpg", source: "33/qa-Fu-9Aik.jpg", category: "bathroom", title: "Family bathroom" },
  { file: "bathroom-4.jpg", source: "33/oEcjC3Xdvp.jpg", category: "bathroom", title: "Vanity and washbasin" },
  { file: "bathroom-5.jpg", source: "35/LmF-gjtt2A.jpg", category: "bathroom", title: "Attached washroom" },
  { file: "bathroom-6.jpg", source: "33/ywX71DeQIU.jpg", category: "bathroom", title: "Bathroom with tub" },
  { file: "bathroom-7.jpg", source: "9/9-6su3ELOn.jpg", category: "bathroom", title: "Second bathroom" },

  { file: "parking-1.jpg", source: "35/Xx3IBSCzrB.jpg", category: "parking", title: "Covered car porch" },
  { file: "parking-2.jpg", source: "demo/rent-6.jpeg", category: "parking", title: "Car parking area" },

  { file: "street-view-1.jpg", source: "demo/plot-1.jpeg", category: "street_view", title: "Plot frontage" },
  { file: "street-view-2.jpg", source: "demo/plot-2.jpeg", category: "street_view", title: "Plot and surroundings" },
  { file: "street-view-3.jpg", source: "demo/plot-3.jpeg", category: "street_view", title: "Levelled ground" },
  { file: "street-view-4.jpg", source: "demo/plot-4.jpeg", category: "street_view", title: "Road access" },
  { file: "street-view-5.jpg", source: "demo/plot-5.jpg", category: "street_view", title: "Plot boundary" },

  { file: "community-view-1.jpg", source: "demo/images (1).jpg", category: "community_view", title: "Developed neighbourhood" },
  { file: "community-view-2.jpg", source: "33/IWCABPF6O9.jpg", category: "community_view", title: "Nearby homes" },
];

/**
 * Photos already attached to listings, labelled by what they actually show.
 * Keyed by a representative path; every byte-identical copy gets the same label.
 */
const EXISTING_CONTENT = [
  { source: "demo/sale-1.jpg", category: "front_view", title: "Front elevation" },
  { source: "demo/sale-2.jpg", category: "front_view", title: "Front elevation" },
  { source: "demo/sale-3.jpg", category: "front_view", title: "Front elevation" },
  { source: "demo/sale-3.jpeg", category: "front_view", title: "Front elevation" },
  { source: "demo/sale-4.jpg", category: "front_view", title: "Front elevation" },
  { source: "demo/sale-6.jpeg", category: "front_view", title: "Front elevation" },
  { source: "demo/sale-7.jpeg", category: "front_view", title: "Front elevation" },
  { source: "demo/house-front.jpg", category: "front_view", title: "Front elevation" },
  { source: "demo/rent-1.jpeg", category: "front_view", title: "Front elevation" },
  { source: "demo/rent-2.jpeg", category: "front_view", title: "Front elevation" },
  { source: "demo/rent-3.jpeg", category: "front_view", title: "Evening elevation" },
  { source: "demo/rent4.jpeg", category: "front_view", title: "Front elevation" },
  { source: "demo/rent-5.jpeg", category: "front_view", title: "Front elevation" },
  // Also shows the house front, so it stays an elevation where it is already
  // the hero shot; the copy in the library below is used as the parking photo.
  { source: "demo/rent-6.jpeg", category: "front_view", title: "Front elevation with car porch" },
  { source: "demo/dining-room.jpg", category: "garden", title: "Lawn and garden" },
  { source: "demo/washroom.jpg", category: "garden", title: "Pool and outdoor area" },
];

const PLANS = {
  house: [
    "drawing_room",
    "living_room",
    "tv_lounge",
    "master_bedroom",
    "bedroom",
    "kitchen",
    "bathroom",
    "bathroom",
    "parking",
  ],
  apartment: [
    "living_room",
    "tv_lounge",
    "master_bedroom",
    "bedroom",
    "kitchen",
    "bathroom",
    "parking",
  ],
  studio: ["living_room", "bedroom", "kitchen", "bathroom", "parking"],
  plot: ["street_view", "street_view", "community_view", "community_view"],
};

function loadEnv() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function hashFile(absPath) {
  return crypto.createHash("md5").update(fs.readFileSync(absPath)).digest("hex");
}

/** Listing type is not a column, so derive it from the title like the UI does. */
function planFor(title) {
  const text = String(title || "").toLowerCase();
  if (text.includes("plot")) return PLANS.plot;
  if (text.includes("studio")) return PLANS.studio;
  if (/apartment|flat|portion/.test(text)) return PLANS.apartment;
  return PLANS.house;
}

/** Copy the curated photos into demo/spaces and return them with their hashes. */
function buildLibrary(dryRun) {
  if (!dryRun) fs.mkdirSync(SPACES_DIR, { recursive: true });

  return LIBRARY.map((entry) => {
    const src = path.join(UPLOADS, entry.source);
    if (!fs.existsSync(src)) {
      throw new Error(`Missing source photo: ${entry.source}`);
    }
    const dest = path.join(SPACES_DIR, entry.file);
    if (!dryRun && !fs.existsSync(dest)) fs.copyFileSync(src, dest);
    return {
      ...entry,
      md5: hashFile(src),
      url: `${SPACES_URL}/${entry.file}`,
    };
  });
}

/**
 * How to label a photo we recognise. Path wins over content, so a photo that
 * means one thing at its original location (an elevation) can mean another as
 * a library copy (the parking shot).
 */
function buildContentIndex(library) {
  const byPath = new Map();
  const byHash = new Map();

  for (const entry of EXISTING_CONTENT) {
    const src = path.join(UPLOADS, entry.source);
    if (!fs.existsSync(src)) continue;
    const meta = { category: entry.category, title: entry.title };
    byPath.set(entry.source, meta);
    byHash.set(hashFile(src), meta);
  }

  for (const entry of library) {
    const meta = { category: entry.category, title: entry.title };
    byPath.set(`demo/spaces/${entry.file}`, meta);
    if (!byHash.has(entry.md5)) byHash.set(entry.md5, meta);
  }

  return {
    lookup: (uploadsRelPath, md5) =>
      byPath.get(uploadsRelPath) || byHash.get(md5) || null,
  };
}

async function main() {
  loadEnv();
  const dryRun = process.argv.includes("--dry");
  const library = buildLibrary(dryRun);
  const contentIndex = buildContentIndex(library);

  const byCategory = new Map();
  for (const entry of library) {
    if (!byCategory.has(entry.category)) byCategory.set(entry.category, []);
    byCategory.get(entry.category).push(entry);
  }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  let relabelled = 0;
  let added = 0;
  let skipped = 0;

  try {
    const [properties] = await conn.query(
      "SELECT id, title FROM properties ORDER BY id",
    );

    for (const property of properties) {
      const [images] = await conn.query(
        `SELECT id, image_url, category, sort_order
         FROM property_images WHERE property_id = ?
         ORDER BY sort_order, id`,
        [property.id],
      );

      const usedHashes = new Set();
      const have = new Map();
      let nextOrder = 0;

      for (const image of images) {
        nextOrder = Math.max(nextOrder, Number(image.sort_order || 0) + 1);
        const abs = path.join(ROOT, "public", image.image_url.replace(/^\//, ""));
        if (!fs.existsSync(abs)) continue;

        const md5 = hashFile(abs);
        usedHashes.add(md5);

        const known = contentIndex.lookup(
          image.image_url.replace(/^\/uploads\//, ""),
          md5,
        );
        const category = known ? known.category : image.category;
        if (category) have.set(category, (have.get(category) || 0) + 1);
        if (!known) continue;
        if (image.category === known.category) {
          continue;
        }
        if (!dryRun) {
          await conn.query(
            "UPDATE property_images SET category = ? WHERE id = ?",
            [known.category, image.id],
          );
        }
        relabelled += 1;
      }

      // The plan says how many photos each space should end up with, so a
      // second run tops nothing up and the listing keeps a stable gallery.
      const wanted = new Map();
      for (const category of planFor(property.title)) {
        wanted.set(category, (wanted.get(category) || 0) + 1);
      }

      const picks = [];
      for (const [category, target] of wanted) {
        const options = byCategory.get(category) || [];
        let missing = target - (have.get(category) || 0);

        while (missing > 0) {
          // Rotate the starting point per property so listings do not all show
          // the same photo for a given room.
          const offset = (property.id + picks.length) % (options.length || 1);
          let chosen = null;
          for (let i = 0; i < options.length; i += 1) {
            const candidate = options[(offset + i) % options.length];
            if (usedHashes.has(candidate.md5)) continue;
            chosen = candidate;
            break;
          }
          if (!chosen) {
            skipped += 1;
            break;
          }
          usedHashes.add(chosen.md5);
          picks.push(chosen);
          missing -= 1;
        }
      }

      for (const pick of picks) {
        if (!dryRun) {
          await conn.query(
            `INSERT INTO property_images
               (property_id, image_url, category, is_featured, sort_order)
             VALUES (?, ?, ?, 0, ?)`,
            [property.id, pick.url, pick.category, nextOrder],
          );
        }
        nextOrder += 1;
        added += 1;
      }

      console.log(
        `#${property.id} ${property.title} -> ${images.length} existing, +${picks.length} spaces`,
      );
    }

    console.log(
      `\n${dryRun ? "[dry run] " : ""}${relabelled} image(s) re-labelled, ${added} space photo(s) added, ${skipped} slot(s) with no unused photo.`,
    );
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

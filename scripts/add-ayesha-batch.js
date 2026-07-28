/**
 * Additive demo batch:
 * - Enrich existing Agent "Ayesha Raza" (johar-living)
 * - Insert 5 new Lahore agents (Ayesha already exists → 6 agents in this batch)
 * - Insert 17 properties for Ayesha (sale / rent / plot via titles)
 * - Profile images:
 *     Keep existing public/uploads/agents/{id}/profile.* files (never overwrite)
 *     Only copy a demo portrait when no profile image exists yet
 * - Property images:
 *     public/uploads/{property_id}/imgN.jpg (new properties only)
 *
 * Usage: node scripts/add-ayesha-batch.js
 * Safe to re-run: skips duplicate agents/properties; preserves real profile photos.
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const DEMO_PASS_HASH =
  "$2a$10$KWiNUkqao2tKODRlMY7lMOKBOUY8Io4wUQeInJ42Lfm8glIVkP9R2"; // demo1234

const ROOT = path.join(__dirname, "..");
const DEMO_DIR = path.join(ROOT, "public", "uploads", "demo");
const UPLOADS = path.join(ROOT, "public", "uploads");

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

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function demoPath(name) {
  const full = path.join(DEMO_DIR, name);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing demo image: ${name}`);
  }
  return full;
}

const PROFILE_IMAGE_RE =
  /^profile\.(jpe?g|png|webp|gif|avif|heic|heif|jfif)$/i;

/**
 * Prefer an existing profile.* file for an agent. Never overwrite real photos.
 * If none exists, copy the demo portrait once as profile.jpg.
 * @returns {{ url: string, created: boolean, kept: boolean }}
 */
function ensureAgentProfileImage(agentId, demoFileName) {
  const dir = path.join(UPLOADS, "agents", String(agentId));
  ensureDir(dir);

  const existing = fs
    .readdirSync(dir)
    .filter((name) => PROFILE_IMAGE_RE.test(name))
    .sort((a, b) => {
      // Prefer profile.jpg then profile.jpeg then others
      const rank = (n) =>
        n.toLowerCase() === "profile.jpg"
          ? 0
          : n.toLowerCase() === "profile.jpeg"
            ? 1
            : 2;
      return rank(a) - rank(b) || a.localeCompare(b);
    });

  if (existing.length > 0) {
    const filename = existing[0];
    return {
      url: `/uploads/agents/${agentId}/${filename}`,
      created: false,
      kept: true,
    };
  }

  const destName = "profile.jpg";
  copyFile(demoPath(demoFileName), path.join(dir, destName));
  return {
    url: `/uploads/agents/${agentId}/${destName}`,
    created: true,
    kept: false,
  };
}

const NEW_AGENTS = [
  {
    estate_name: "wapda-homes",
    username: "wapda-homes",
    full_name: "Zainab Iqbal",
    email: "zainab@wapdahomes.pk",
    phone: "+923001234601",
    description:
      "WAPDA Town and Township specialist helping families find practical homes and investment plots across south Lahore.",
    areas_served: "WAPDA Town, Township, Johar Town, Lahore",
    message: "WAPDA Town residential focus",
  },
  {
    estate_name: "defence-link",
    username: "defence-link",
    full_name: "Ali Hassan",
    email: "ali@defencelink.pk",
    phone: "+923001234602",
    description:
      "DHA and Askari specialist for sale and rent listings with clear paperwork and on-ground site visits.",
    areas_served: "DHA Lahore, Askari, Lahore Cantt",
    message: "DHA & Askari brokerage",
  },
  {
    estate_name: "askari-re",
    username: "askari-re",
    full_name: "Mariam Tariq",
    email: "mariam@askarire.pk",
    phone: "+923001234603",
    description:
      "Askari and Cantt homes expert focused on secure communities and family-friendly rentals.",
    areas_served: "Askari X, Askari XI, Lahore Cantt",
    message: "Askari community listings",
  },
  {
    estate_name: "township-re",
    username: "township-re",
    full_name: "Fahad Mehmood",
    email: "fahad@townshipre.pk",
    phone: "+923001234604",
    description:
      "Township and College Road broker covering affordable houses, upper portions, and residential plots.",
    areas_served: "Township, College Road, Green Town, Lahore",
    message: "Township & College Road",
  },
  {
    estate_name: "pier-avenue",
    username: "pier-avenue",
    full_name: "Sana Javed",
    email: "sana@pieravenue.pk",
    phone: "+923001234605",
    description:
      "Bahria Orchard and Raiwind Road specialist for plots, farmhouses, and emerging community homes.",
    areas_served: "Bahria Orchard, Raiwind Road, Lake City, Lahore",
    message: "Bahria Orchard & outskirts",
  },
];

/** 17 listings for Ayesha — titles drive homepage Sale / Rent / Plots tabs. */
const AYESHA_PROPERTIES = [
  // SALE (7)
  {
    title: "10 Marla House for Sale in DHA Phase 5",
    description:
      "Spacious 10 Marla double-storey for sale in DHA Phase 5 with 5 bedrooms, lawn, modern kitchen and double car porch. Quiet block near commercial boulevard.",
    size_value: 10,
    size_unit: "marla",
    price: 45500000,
    location: "DHA Phase 5, Lahore",
    images: [
      { file: "sale-1.jpg", title: "Front elevation", featured: true },
      { file: "dining-room.jpg", title: "Dining room", featured: false },
      { file: "washroom.jpg", title: "Attached bath", featured: false },
    ],
  },
  {
    title: "5 Marla Brand New House for Sale in Johar Town",
    description:
      "Brand-new 5 Marla house for sale in Johar Town Block G with 3 bedrooms, open kitchen, tiled flooring and covered porch. Near park and mosque.",
    size_value: 5,
    size_unit: "marla",
    price: 19500000,
    location: "Johar Town, Lahore",
    images: [
      { file: "sale-2.jpg", title: "Street view", featured: true },
      { file: "dining-room.jpg", title: "Lounge", featured: false },
    ],
  },
  {
    title: "1 Kanal Luxury House for Sale in Model Town",
    description:
      "Premium 1 Kanal bungalow for sale in Model Town with wide lawn, marble flooring, 6 bedrooms and servant quarters. Close to Model Town Link Road.",
    size_value: 1,
    size_unit: "kanal",
    price: 88000000,
    location: "Model Town, Lahore",
    images: [
      { file: "sale-3.jpg", title: "Luxury exterior", featured: true },
      { file: "house-front.jpg", title: "Front lawn", featured: false },
      { file: "dining-room.jpg", title: "Formal dining", featured: false },
    ],
  },
  {
    title: "8 Marla Designer House for Sale in Gulberg III",
    description:
      "Designer 8 Marla house for sale near MM Alam Road with glass elevation, 4 bedrooms, modular kitchen and basement. Ideal executive home.",
    size_value: 8,
    size_unit: "marla",
    price: 72000000,
    location: "Gulberg III, Lahore",
    images: [
      { file: "sale-3.jpeg", title: "Designer elevation", featured: true },
      { file: "washroom.jpg", title: "Master bath", featured: false },
    ],
  },
  {
    title: "7 Marla Modern House for Sale in WAPDA Town",
    description:
      "Modern 7 Marla house for sale in WAPDA Town with 4 bedrooms, solar-ready roof, TV lounge and car porch. Settled residential street.",
    size_value: 7,
    size_unit: "marla",
    price: 24200000,
    location: "WAPDA Town, Lahore",
    images: [
      { file: "sale-4.jpg", title: "Modern front", featured: true },
      { file: "dining-room.jpg", title: "Living area", featured: false },
    ],
  },
  {
    title: "10 Marla House for Sale in Bahria Town Sector D",
    description:
      "Well-kept 10 Marla house for sale in Bahria Town Sector D with drawing + dining, 5 bedrooms and landscaped front. Near main boulevard.",
    size_value: 10,
    size_unit: "marla",
    price: 38500000,
    location: "Bahria Town, Lahore",
    images: [
      { file: "sale-6.jpeg", title: "Bahria elevation", featured: true },
      { file: "house-front.jpg", title: "Approach view", featured: false },
    ],
  },
  {
    title: "5 Marla Corner House for Sale in Valencia Town",
    description:
      "Corner 5 Marla house for sale in Valencia Town with dual road access, 3 bedrooms, open kitchen and covered parking. Gated community amenities.",
    size_value: 5,
    size_unit: "marla",
    price: 18900000,
    location: "Valencia Town, Lahore",
    images: [
      { file: "sale-7.jpeg", title: "Corner house", featured: true },
      { file: "dining-room.jpg", title: "Interior", featured: false },
    ],
  },
  // RENT (5)
  {
    title: "3 Bed House for Rent in Johar Town Block R",
    description:
      "Semi-furnished 3-bed house for rent in Johar Town Block R with TV lounge, kitchen, terrace and car porch. Family preferred.",
    size_value: 5,
    size_unit: "marla",
    price: 85000,
    location: "Johar Town, Lahore",
    images: [
      { file: "rent-1.jpeg", title: "Living area", featured: true },
      { file: "dining-room.jpg", title: "Dining", featured: false },
    ],
  },
  {
    title: "Fully Furnished Apartment for Rent in DHA Phase 4",
    description:
      "Fully furnished 2-bed apartment for rent in DHA Phase 4 with AC units, appliances and reserved parking. Ready to move.",
    size_value: 900,
    size_unit: "sqft",
    price: 135000,
    location: "DHA Phase 4, Lahore",
    images: [
      { file: "rent-2.jpeg", title: "Furnished lounge", featured: true },
      { file: "washroom.jpg", title: "Bathroom", featured: false },
    ],
  },
  {
    title: "Upper Portion for Rent in Model Town Extension",
    description:
      "Independent upper portion for rent in Model Town Extension with 3 bedrooms, separate entrance, kitchen and rooftop access.",
    size_value: 5,
    size_unit: "marla",
    price: 95000,
    location: "Model Town, Lahore",
    images: [
      { file: "rent-3.jpeg", title: "Upper portion", featured: true },
      { file: "dining-room.jpg", title: "Lounge", featured: false },
    ],
  },
  {
    title: "4 Bed House for Rent near MM Alam Road",
    description:
      "Spacious 4-bed house for rent a short drive from MM Alam Road. Drawing room, two kitchens, lawn and double car porch.",
    size_value: 10,
    size_unit: "marla",
    price: 250000,
    location: "Gulberg III, Lahore",
    images: [
      { file: "rent4.jpeg", title: "House exterior", featured: true },
      { file: "house-front.jpg", title: "Front", featured: false },
    ],
  },
  {
    title: "Studio Flat for Rent in Lahore Cantt",
    description:
      "Compact studio flat for rent near Saddar Cantt with kitchenette, attached bath and 24/7 security. Ideal for singles.",
    size_value: 450,
    size_unit: "sqft",
    price: 48000,
    location: "Lahore Cantt",
    images: [
      { file: "rent-5.jpeg", title: "Studio interior", featured: true },
      { file: "rent-6.jpeg", title: "Alternate view", featured: false },
    ],
  },
  // PLOT (5)
  {
    title: "10 Marla Residential Plot in DHA Phase 8",
    description:
      "Possession 10 Marla residential plot in DHA Phase 8 with metalled roads and nearby parks. Clear title, ready for construction.",
    size_value: 10,
    size_unit: "marla",
    price: 42000000,
    location: "DHA Phase 8, Lahore",
    images: [
      { file: "plot-1.jpeg", title: "Plot overview", featured: true },
      { file: "plot-2.jpeg", title: "Road access", featured: false },
    ],
  },
  {
    title: "5 Marla Corner Plot in Bahria Town",
    description:
      "Prime 5 Marla corner plot in Bahria Town with dual road access. Ideal for a custom family home.",
    size_value: 5,
    size_unit: "marla",
    price: 9800000,
    location: "Bahria Town, Lahore",
    images: [
      { file: "plot-2.jpeg", title: "Corner plot", featured: true },
      { file: "plot-3.jpeg", title: "Levelled ground", featured: false },
    ],
  },
  {
    title: "1 Kanal Residential Plot in Lake City",
    description:
      "1 Kanal residential plot in Lake City with boulevard access and society amenities. Levelled ground, ready for foundation.",
    size_value: 1,
    size_unit: "kanal",
    price: 18500000,
    location: "Lake City, Lahore",
    images: [
      { file: "plot-3.jpeg", title: "Levelled plot", featured: true },
      { file: "plot-1.jpeg", title: "Site view", featured: false },
    ],
  },
  {
    title: "7 Marla Plot for Sale in Johar Town",
    description:
      "7 Marla residential plot in a settled Johar Town block with utilities on site. Quiet street for a modern family home.",
    size_value: 7,
    size_unit: "marla",
    price: 22500000,
    location: "Johar Town, Lahore",
    images: [
      { file: "plot-5.jpg", title: "Residential plot", featured: true },
      { file: "plot-4.jpeg", title: "Approach", featured: false },
    ],
  },
  {
    title: "10 Marla Commercial Plot in Township",
    description:
      "10 Marla commercial plot facing a busy Township road. High footfall location suited for retail plaza or showroom.",
    size_value: 10,
    size_unit: "marla",
    price: 26500000,
    location: "Township, Lahore",
    images: [
      { file: "plot-4.jpeg", title: "Commercial frontage", featured: true },
      { file: "plot-5.jpg", title: "Plot depth", featured: false },
    ],
  },
];

async function main() {
  loadEnv();
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  const [[ayesha]] = await conn.query(
    "SELECT id, estate_name, username FROM agents WHERE full_name = ? LIMIT 1",
    ["Ayesha Raza"],
  );
  if (!ayesha) {
    throw new Error('Agent "Ayesha Raza" not found — run seed.sql first.');
  }

  // Enrich Ayesha profile (keep existing photo if present)
  const ayeshaPortrait = ensureAgentProfileImage(ayesha.id, "house-front.jpg");
  if (ayeshaPortrait.kept) {
    console.log(`Kept existing profile image for Ayesha Raza (id ${ayesha.id})`);
  } else {
    console.log(`Added demo profile image for Ayesha Raza (id ${ayesha.id})`);
  }

  await conn.query(
    `UPDATE agents SET
      profile_image = ?,
      description = ?,
      areas_served = ?,
      status = 'approved'
     WHERE id = ?`,
    [
      ayeshaPortrait.url,
      "Johar Town and south Lahore residential specialist offering sale, rent and plot listings with verified documentation and client-first service.",
      "Johar Town, DHA Lahore, Model Town, Gulberg, Bahria Town, WAPDA Town",
      ayesha.id,
    ],
  );

  const createdAgents = [
    {
      id: ayesha.id,
      username: ayesha.username,
      estate_name: ayesha.estate_name,
      full_name: "Ayesha Raza",
      profile_image: ayeshaPortrait.url,
      existing: true,
    },
  ];

  // Insert 5 new agents
  for (const agent of NEW_AGENTS) {
    const portrait =
      {
        "wapda-homes": "sale-1.jpg",
        "defence-link": "sale-2.jpg",
        "askari-re": "sale-3.jpg",
        "township-re": "sale-4.jpg",
        "pier-avenue": "sale-7.jpeg",
      }[agent.estate_name] || "house-front.jpg";

    const [[existing]] = await conn.query(
      "SELECT id FROM agents WHERE email = ? OR estate_name = ? LIMIT 1",
      [agent.email, agent.estate_name],
    );
    if (existing) {
      console.log(`Skip existing agent ${agent.estate_name} (id ${existing.id})`);
      const profile = ensureAgentProfileImage(existing.id, portrait);
      if (profile.kept) {
        console.log(`  kept existing profile image`);
      } else {
        console.log(`  added demo profile image`);
      }
      await conn.query(
        `UPDATE agents SET profile_image = ?, description = ?, areas_served = ?, status = 'approved' WHERE id = ?`,
        [profile.url, agent.description, agent.areas_served, existing.id],
      );
      createdAgents.push({
        id: existing.id,
        username: agent.username,
        estate_name: agent.estate_name,
        full_name: agent.full_name,
        profile_image: profile.url,
        existing: true,
      });
      continue;
    }

    await conn.query(
      `INSERT INTO signup_requests (full_name, estate_name, email, phone, message, status)
       VALUES (?, ?, ?, ?, ?, 'approved')`,
      [agent.full_name, agent.estate_name, agent.email, agent.phone, agent.message],
    );

    const [result] = await conn.query(
      `INSERT INTO agents
        (estate_name, username, full_name, email, phone, profile_image, description, areas_served, password_hash, must_reset_password, status)
       VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, FALSE, 'approved')`,
      [
        agent.estate_name,
        agent.username,
        agent.full_name,
        agent.email,
        agent.phone,
        agent.description,
        agent.areas_served,
        DEMO_PASS_HASH,
      ],
    );

    const agentId = result.insertId;
    const profile = ensureAgentProfileImage(agentId, portrait);
    await conn.query("UPDATE agents SET profile_image = ? WHERE id = ?", [
      profile.url,
      agentId,
    ]);

    createdAgents.push({
      id: agentId,
      username: agent.username,
      estate_name: agent.estate_name,
      full_name: agent.full_name,
      profile_image: profile.url,
      existing: false,
    });
  }

  const createdProperties = [];

  for (const prop of AYESHA_PROPERTIES) {
    const [[dup]] = await conn.query(
      "SELECT id FROM properties WHERE title = ? AND agent_id = ? LIMIT 1",
      [prop.title, ayesha.id],
    );
    if (dup) {
      console.log(`Skip existing property "${prop.title}" (id ${dup.id})`);
      createdProperties.push({ id: dup.id, title: prop.title, skipped: true });
      continue;
    }

    const [ins] = await conn.query(
      `INSERT INTO properties
        (agent_id, title, description, size_value, size_unit, price, location, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'approved')`,
      [
        ayesha.id,
        prop.title,
        prop.description,
        prop.size_value,
        prop.size_unit,
        prop.price,
        prop.location,
      ],
    );

    const propertyId = ins.insertId;
    const propDir = path.join(UPLOADS, String(propertyId));
    ensureDir(propDir);

    const imagePaths = [];
    for (let i = 0; i < prop.images.length; i++) {
      const img = prop.images[i];
      const filename = `img${i + 1}${path.extname(img.file) || ".jpg"}`;
      const dest = path.join(propDir, filename);
      copyFile(demoPath(img.file), dest);
      const publicUrl = `/uploads/${propertyId}/${filename}`;
      await conn.query(
        `INSERT INTO property_images
          (property_id, image_url, image_title, is_featured, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
        [propertyId, publicUrl, img.title, img.featured, i],
      );
      imagePaths.push(publicUrl);
    }

    createdProperties.push({
      id: propertyId,
      title: prop.title,
      location: prop.location,
      price: prop.price,
      images: imagePaths,
    });
  }

  await conn.end();

  console.log("\n=== AGENTS (batch of 6) ===");
  for (const a of createdAgents) {
    console.log(
      `#${a.id} ${a.full_name} | username=${a.username} | ${a.profile_image}${a.existing ? " (updated)" : " (new)"}`,
    );
  }

  console.log("\n=== PROPERTIES for Ayesha Raza ===");
  for (const p of createdProperties) {
    console.log(`#${p.id} ${p.title}${p.skipped ? " (already existed)" : ""}`);
    if (p.images) {
      for (const u of p.images) console.log(`   ${u}`);
    }
  }

  console.log("\nDone. Agent login password for new demo accounts: demo1234");
  console.log("Ayesha public page: /re/johar-living");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

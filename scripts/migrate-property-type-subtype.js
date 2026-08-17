/**
 * Add property_type + property_subtype on properties and backfill from title/
 * description using the same taxonomy rules as lib/propertyTaxonomy.js.
 * Run with `npm run migrate:property-type-subtype` (add `-- --down` to roll back).
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const MIGRATION_ID = "016_property_type_subtype";

const SUBTYPES_BY_TYPE = {
  sale: ["house", "apartment", "shop", "commercial"],
  rent: ["house", "apartment", "shop", "commercial"],
  plot: ["residential_plot", "commercial_plot"],
};

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
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

async function columnExists(conn, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'properties'
       AND COLUMN_NAME = ? LIMIT 1`,
    [column],
  );
  return rows.length > 0;
}

function inferType(title, description) {
  const text = `${title || ""} ${description || ""}`;
  if (/\bplot\b/i.test(text)) return "plot";
  if (/\brent(ed|al)?\b/i.test(text)) return "rent";
  if (/\bsale\b/i.test(text)) return "sale";
  return null;
}

function inferSubtype(type, title, description) {
  const text = `${title || ""} ${description || ""}`.toLowerCase();
  if (type === "plot") {
    if (/\bcommercial\b/.test(text)) return "commercial_plot";
    if (/\bresidential\b/.test(text)) return "residential_plot";
    if (/\bplot\b/.test(text)) return "residential_plot";
    return null;
  }
  if (/\b(apartment|flat|studio)\b/.test(text)) return "apartment";
  if (/\bshop\b/.test(text)) return "shop";
  if (
    /\bcommercial\b/.test(text) &&
    !/\b(house|bungalow|villa|portion)\b/.test(text)
  ) {
    return "commercial";
  }
  if (/\b(house|bungalow|villa|portion)\b/.test(text)) return "house";
  if (/\b(for sale|for rent)\b/.test(text)) return "house";
  return null;
}

async function migrateUp(conn) {
  if (!(await columnExists(conn, "property_type"))) {
    await conn.query(
      `ALTER TABLE properties
       ADD COLUMN property_type ENUM('sale','rent','plot') NULL AFTER title`,
    );
    console.log("+ properties.property_type");
  } else {
    console.log("= properties.property_type already exists");
  }

  if (!(await columnExists(conn, "property_subtype"))) {
    await conn.query(
      `ALTER TABLE properties
       ADD COLUMN property_subtype VARCHAR(32) NULL AFTER property_type`,
    );
    console.log("+ properties.property_subtype");
  } else {
    console.log("= properties.property_subtype already exists");
  }

  const [rows] = await conn.query(
    "SELECT id, title, description, property_type, property_subtype FROM properties",
  );

  const unclassified = [];
  let updated = 0;

  for (const row of rows) {
    let type = row.property_type || inferType(row.title, row.description);
    let subtype = row.property_subtype || null;

    if (type && !subtype) {
      subtype = inferSubtype(type, row.title, row.description);
    }

    if (!type || !subtype || !(SUBTYPES_BY_TYPE[type] || []).includes(subtype)) {
      unclassified.push({
        id: row.id,
        title: row.title,
        inferred_type: type,
        inferred_subtype: subtype,
      });
      continue;
    }

    if (row.property_type === type && row.property_subtype === subtype) {
      continue;
    }

    await conn.query(
      "UPDATE properties SET property_type = ?, property_subtype = ? WHERE id = ?",
      [type, subtype, row.id],
    );
    updated += 1;
  }

  console.log(`Backfilled ${updated} properties.`);
  if (unclassified.length) {
    console.log(
      `WARNING: ${unclassified.length} properties could not be safely classified:`,
    );
    for (const item of unclassified) {
      console.log(
        `  id=${item.id} type=${item.inferred_type} subtype=${item.inferred_subtype} title=${JSON.stringify(item.title)}`,
      );
    }
  } else {
    console.log("All existing properties classified with valid type/subtype.");
  }

  await conn.query(
    "INSERT INTO schema_migrations (id) VALUES (?) ON DUPLICATE KEY UPDATE applied_at = applied_at",
    [MIGRATION_ID],
  );
  console.log("Property type/subtype migration complete.");
}

async function migrateDown(conn) {
  if (await columnExists(conn, "property_subtype")) {
    await conn.query("ALTER TABLE properties DROP COLUMN property_subtype");
    console.log("- properties.property_subtype");
  }
  if (await columnExists(conn, "property_type")) {
    await conn.query("ALTER TABLE properties DROP COLUMN property_type");
    console.log("- properties.property_type");
  }
  await conn.query("DELETE FROM schema_migrations WHERE id = ?", [
    MIGRATION_ID,
  ]);
  console.log("Property type/subtype migration rolled back.");
}

async function main() {
  loadEnv();
  const down = process.argv.includes("--down");
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(100) PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    if (down) {
      await migrateDown(conn);
    } else {
      await migrateUp(conn);
    }
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

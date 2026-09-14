/** Controlled properties-only consolidation. audit -> backfill -> verify -> drop.
 * Backups/reports live under ignored backups/property-json/. No other table is changed.
 * Run with node scripts/migrate-property-json.cjs <stage>.
 */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { isDeepStrictEqual } = require("node:util");
const mysql = require("mysql2/promise");
require("@next/env").loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
const directory = path.resolve("backups/property-json");
const mappings = {
  property_type: ["listing_type"], property_subtype: ["property_type"],
  city: ["location", "city"], area: ["location", "area"], phase: ["location", "phase"], address: ["location", "address"],
  rejected_reason: ["rejection", "reason"], rejected_by: ["rejection", "rejected_by"],
  property_highlights: ["insights", "property_highlights"], why_this_home: ["insights", "why_this_home"],
  location_advantages: ["insights", "location_advantages"], investment_insights: ["insights", "investment_insights"],
};
function object(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function get(data, keys) { return keys.reduce((value, key) => value?.[key], data); }
function migrateRow(row) {
  assert.ok(row.property_data == null || object(row.property_data), `Invalid JSON object on ${row.id}`);
  const next = structuredClone(row.property_data || {});
  const conflicts = [];
  for (const [column, keys] of Object.entries(mappings)) {
    let parent = next;
    for (const key of keys.slice(0, -1)) {
      if (parent[key] == null) parent[key] = {};
      assert.ok(object(parent[key]), `Invalid ${key} section on ${row.id}`);
      parent = parent[key];
    }
    const key = keys.at(-1);
    const old = row[column];
    if (Object.hasOwn(parent, key) && !isDeepStrictEqual(parent[key], old)) {
      // A null column never overwrites populated JSON. Differing sources require review.
      conflicts.push({ id: row.id, column, path: keys.join(".") });
    } else parent[key] = old;
  }
  return { next, conflicts };
}
async function snapshot(conn) {
  const [ddl] = await conn.query("SHOW CREATE TABLE properties");
  const [columns] = await conn.query("SHOW FULL COLUMNS FROM properties");
  const [indexes] = await conn.query("SHOW INDEX FROM properties");
  const [constraints] = await conn.execute("SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'properties' ORDER BY CONSTRAINT_NAME, ORDINAL_POSITION");
  const [rows] = await conn.query("SELECT * FROM properties ORDER BY id");
  return { ddl: ddl[0]["Create Table"], columns, indexes, constraints, rows };
}
function report(rows) {
  const mismatches = [], conflicts = [];
  for (const row of rows) {
    conflicts.push(...migrateRow(row).conflicts);
    for (const [column, keys] of Object.entries(mappings)) {
      if (!isDeepStrictEqual(row[column], get(row.property_data, keys))) mismatches.push({ id: row.id, column });
    }
  }
  return { total: rows.length, matchingRows: rows.length - new Set(mismatches.map(item => item.id)).size, mismatchingRows: new Set(mismatches.map(item => item.id)).size, conflictRows: new Set(conflicts.map(item => item.id)).size, mismatches, conflicts };
}
function save(name, value) { fs.writeFileSync(path.join(directory, name), JSON.stringify(value, null, 2)); }
async function main() {
  const stage = process.argv[2] || "audit";
  assert.ok(["audit", "backfill", "verify", "drop", "final"].includes(stage));
  const conn = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true, connectTimeout: 10000 });
  fs.mkdirSync(directory, { recursive: true });
  try {
    const [[identity]] = await conn.query("SELECT DATABASE() AS db, VERSION() AS version");
    assert.equal(identity.db, "real_estate");
    await conn.query("SET SESSION lock_wait_timeout = 15");
    const current = await snapshot(conn);
    if (stage === "audit") {
      assert.ok(!fs.existsSync(path.join(directory, "before.json")), "Backup already exists; do not overwrite it");
      save("before.json", current);
      fs.writeFileSync(path.join(directory, "before.sql"), current.ddl + ";\n");
      const counts = Object.keys(mappings).map(column => ({ column, nonNull: current.rows.filter(row => row[column] !== null).length, nonEmpty: current.rows.filter(row => row[column] !== null && row[column] !== "" && (!Array.isArray(row[column]) || row[column].length !== 0)).length }));
      const taxonomy = [...new Set(current.rows.map(row => JSON.stringify([row.property_type, row.property_subtype])))].map(value => JSON.parse(value));
      console.log(JSON.stringify({ identity, ddl: current.ddl, constraints: current.constraints, total: current.rows.length, counts, taxonomy, rejectedColumn: current.columns.some(c => c.Field === "rejected"), conflicts: report(current.rows).conflicts }, null, 2));
      return;
    }
    const before = JSON.parse(fs.readFileSync(path.join(directory, "before.json"), "utf8"));
    if (stage === "backfill") {
      await conn.beginTransaction();
      try {
        const [rows] = await conn.query("SELECT * FROM properties ORDER BY id FOR UPDATE");
        assert.deepEqual(rows, before.rows, "Properties changed since backup; take a fresh reviewed backup before migrating");
        const plans = rows.map(row => ({ row, ...migrateRow(row) }));
        assert.equal(plans.flatMap(plan => plan.conflicts).length, 0, "Existing JSON conflicts: stop without overwriting");
        for (const { row, next } of plans) await conn.execute("UPDATE properties SET property_data = ?, updated_at = updated_at WHERE id = ?", [JSON.stringify(next), row.id]);
        const [migrated] = await conn.query("SELECT * FROM properties ORDER BY id");
        const result = report(migrated);
        assert.equal(result.mismatchingRows, 0);
        assert.equal(result.conflictRows, 0);
        await conn.commit();
        save("backfill-verification.json", { ...result, migratedRows: plans.length });
        console.log(JSON.stringify({ ...result, migratedRows: plans.length }));
      } catch (error) { await conn.rollback(); throw error; }
    } else if (stage === "verify" || stage === "drop") {
      // Block concurrent property writers during the final comparison and DDL.
      if (stage === "drop") await conn.query("LOCK TABLES properties WRITE");
      try {
        const [rows] = await conn.query("SELECT * FROM properties ORDER BY id");
        const result = report(rows);
        console.log(JSON.stringify(result));
        assert.equal(result.mismatchingRows, 0, "Mismatches: columns will not be dropped");
        assert.equal(result.conflictRows, 0, "Conflicts: columns will not be dropped");
        assert.equal(rows.length, before.rows.length);
        for (const old of before.rows) {
          const row = rows.find(row => row.id === old.id); assert.ok(row);
          for (const key of Object.keys(old).filter(key => key !== "property_data")) assert.deepEqual(row[key], old[key], `Unexpected change ${old.id}.${key}`);
          assert.deepEqual(row.property_data, migrateRow(old).next, `JSON changed on ${old.id}`);
        }
        if (stage === "drop") {
          assert.ok(fs.existsSync(path.join(directory, "application-checks-passed.json")), "Application tests/build must pass before dropping");
          save("pre-drop-verification.json", result);
          await conn.query("ALTER TABLE properties " + Object.keys(mappings).map(column => `DROP COLUMN ${column}`).join(", "));
        }
      } finally { if (stage === "drop") await conn.query("UNLOCK TABLES"); }
    }
    if (stage === "final" || stage === "drop") {
      const after = await snapshot(conn);
      assert.deepEqual(after.columns, before.columns.filter(column => !Object.hasOwn(mappings, column.Field)));
      const stableIndexes = indexes => indexes.map(({ Cardinality, ...index }) => index);
      assert.deepEqual(stableIndexes(after.indexes), stableIndexes(before.indexes));
      assert.deepEqual(after.constraints, before.constraints);
      assert.equal(after.rows.length, before.rows.length);
      for (const old of before.rows) {
        const row = after.rows.find(row => row.id === old.id); assert.ok(row);
        assert.deepEqual(row.property_data, migrateRow(old).next, `Lost migrated value on ${old.id}`);
        for (const key of Object.keys(old).filter(key => key !== "property_data" && !Object.hasOwn(mappings, key))) assert.deepEqual(row[key], old[key]);
      }
      save("after.json", after);
      fs.writeFileSync(path.join(directory, "after.sql"), after.ddl + ";\n");
      console.log(JSON.stringify({ total: after.rows.length, verified: after.rows.length, mismatches: 0, removed: Object.keys(mappings), ddl: after.ddl }));
    }
  } finally { await conn.end(); }
}
module.exports = { mappings, migrateRow, report };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });

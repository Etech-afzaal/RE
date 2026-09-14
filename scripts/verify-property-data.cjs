/** Explicit integration check: uses configured MySQL, commits temporary drafts,
 * exercises real API handlers/queries/UI, then deletes only its own test rows.
 * Public approval is transaction-local and rolled back, never published.
 * Auth/session, audit logging, browser hooks and tracking are isolated test seams.
 * Run: node scripts/verify-property-data.cjs
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { createHash, randomUUID } = require("node:crypto");
const { transformSync } = require("next/dist/build/swc");
const React = require("react");
require("@next/env").loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

function loader(mocks = {}) {
  const cache = new Map();
  function load(name, parent = path.resolve("index.js")) {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.endsWith(".css")) return { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
    if (!name.startsWith("@/") && !name.startsWith(".")) return require(name);
    let filename = name.startsWith("@/") ? path.resolve(name.slice(2)) : path.resolve(path.dirname(parent), name);
    if (!path.extname(filename)) filename += ".js";
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module);
    cache.set(filename, mod);
    mod.filename = filename; mod.paths = module.paths;
    mod.require = specifier => load(specifier, filename);
    const { code } = transformSync(fs.readFileSync(filename, "utf8"), {
      filename, jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022", transform: { react: { runtime: "automatic" } } }, module: { type: "commonjs" },
    });
    mod._compile(code, filename);
    return mod.exports;
  }
  return load;
}
const text = node => node == null || typeof node === "boolean" ? "" : typeof node !== "object" ? String(node) : Array.isArray(node) ? node.map(text).join("") : text(node.props?.children);
function nodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (typeof node.type === "function") return nodes(node.type(node.props));
  return [node, ...nodes(node.props?.children)];
}
const staticHooks = { ...React, useMemo: fn => fn(), useCallback: fn => fn, useEffect() {}, useRef: value => ({ current: value }), useState: value => [typeof value === "function" ? value() : value, () => {}] };

async function editPage(api, id, agent, kind, legacy) {
  const hooks = [], effects = [];
  let cursor = 0, mounted = false, tree, pending;
  const mocks = {
    react: { ...staticHooks,
      useState(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = typeof initial === "function" ? initial() : initial; return [hooks[i], value => { hooks[i] = typeof value === "function" ? value(hooks[i]) : value; }]; },
      useRef(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = { current: initial }; return hooks[i]; },
      useEffect(effect) { if (!mounted) effects.push(effect); },
    },
    "next/navigation": { useParams: () => ({ estate_name: agent.username || agent.estate_name, id: String(id) }), useRouter: () => ({ push() {}, replace() {} }) },
    "next-auth/react": { useSession: () => ({ status: "authenticated", data: { user: agent } }) },
  };
  for (const component of ["agent-portal/AgentPortalShell", "agent-portal/PriceCurrencyInput", "ImageCategorySelect", "ImagePreviewModal", "VideoPreviewModal", "LoadingSpinner", "PropertyWatermark", "agent-portal/PropertyMarketingSectionsEditor"]) mocks[`@/components/${component}`] = component.split("/").pop();
  global.document = { getElementById: () => null };
  global.fetch = async (url, options = {}) => {
    if (url === "/api/agent/company-branding") return Response.json({ branding: {} });
    assert.equal(url, `/api/properties/${id}`, "Only property API calls expected with no media edits");
    if (options.method === "PUT") return api.PUT({ json: async () => JSON.parse(options.body) }, { params: { id } });
    pending = api.GET({}, { params: { id } });
    return pending;
  };
  const Page = loader(mocks)("@/app/(public)/re/[estate_name]/dashboard/properties/[id]/edit/page").default;
  const render = () => { cursor = 0; tree = Page(); };
  render(); mounted = true; effects.forEach(effect => effect());
  await pending;
  await new Promise(resolve => setImmediate(resolve)); render();
  function input(label) {
    const wrapper = nodes(tree).find(n => n.type === "label" && text(n.props.children?.[0]).trim() === label);
    assert.ok(wrapper, `Edit field ${label}`);
    return nodes(wrapper).find(n => ["input", "select", "textarea"].includes(n.type));
  }
  assert.equal(input("Property Type").props.value, kind);
  const building = !["plots", "file"].includes(kind);
  if (!legacy && building) assert.equal(input("Front (ft)").props.value, 30);
  const label = building ? "Front (ft)" : "Plot Type";
  input(label).props.onChange({ target: { value: building ? "35" : "Commercial" } }); render();
  const save = nodes(tree).find(n => n.type === "button" && text(n) === "Save Draft");
  assert.ok(save);
  await save.props.onClick(); render();
  const response = await api.GET({}, { params: { id } });
  const { property } = await response.json();
  assert.equal(building ? property.property_data.landInfo.front : property.property_data.plotInfo.plotType, building ? 35 : "Commercial");
  return property;
}

async function main() {
  const config = { host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, connectTimeout: 10000, dateStrings: true };
  const mysql = require("mysql2/promise");
  const conn = await mysql.createConnection(config);
  const observer = await mysql.createConnection(config);
  const query = async (sql, params = []) => (await conn.execute(sql, params))[0];
  const ids = [];
  const prefix = `JSON verification ${randomUUID().slice(0, 8)}`;
  const savedGlobals = { fetch: global.fetch, document: global.document };
  const hash = row => createHash("sha256").update(JSON.stringify(row)).digest("hex");
  let baseline;
  try {
    const [columns] = await conn.query("SHOW FULL COLUMNS FROM properties");
    const column = columns.find(c => c.Field === "property_data");
    assert.equal(column?.Type, "json"); assert.equal(column.Null, "YES");
    console.log(JSON.stringify({ database: config.database, column: { name: column.Field, type: column.Type, nullable: column.Null }, columnCount: columns.length }));
    const existing = await query("SELECT * FROM properties ORDER BY id");
    baseline = new Map(existing.map(row => [row.id, hash(row)]));
    const agents = await query("SELECT id, username, estate_name FROM users WHERE user_type = 'agent' AND status = 'approved' LIMIT 1");
    const agent = agents[0]; assert.ok(agent, "An existing approved agent is required");
    const seams = {
      "@/lib/db": { query },
      "@/lib/adminAuth": { requireAgent: async () => ({ session: { user: agent } }) },
      "@/lib/auditLogger": { AUDIT_ACTIONS: {}, AUDIT_ENTITY_TYPES: {}, createAuditLog: async () => {}, getRequestIp: () => null },
    };
    const load = loader(seams);
    const data = load("@/lib/propertyData");
    const create = load("@/app/api/properties/route").POST;
    const api = load("@/app/api/properties/[id]/route");
    const queries = load("@/lib/queries");
    const mapping = load("@/lib/publicPropertyData");
    const uiMocks = {
      ...seams, react: staticHooks, "next/link": "Link", "next/image": "Image",
      "next/navigation": { notFound() { throw Error("Public property not found"); } },
      "@/lib/marketingLinks": { resolvePropertyMarketingRef: async () => null, ensureAgentMarketingLink: async () => ({ unique_code: "verification" }) },
      "@/components/ClearableSearchInput": "Search", "@/lib/useIsMobile": { useIsMobile: () => false },
    };
    const pageSource = fs.readFileSync("app/(public)/re/[estate_name]/[propertyId]/page.js", "utf8");
    for (const [, name] of pageSource.matchAll(/from "([^"]+)"/g)) if (name.startsWith("@/components/") || (name.startsWith("./") && !name.endsWith(".css"))) uiMocks[name] = name.split("/").pop();
    delete uiMocks["@/components/publicSiteLogo"];
    const loadUi = loader(uiMocks);
    const PublicPage = loadUi("@/app/(public)/re/[estate_name]/[propertyId]/page").default;
    const Listings = loadUi("@/components/HomeListings").default;
    const examples = {
      landInfo: { dimension: "30 x 75", front: "30", depth: "75", plotPosition: "Corner", roadWidth: "40" },
      propertyDetails: { coveredArea: "2250", floors: "2", bedrooms: "4", bathrooms: "3", lounge: "1", parking: "2 cars", kitchens: "2", amenities: ["Water", "Sewerage", "24/7 Security"] },
      commercialInfo: { commercialType: "Office" },
      plotInfo: { plotDimensions: "30 x 75", plotType: "Residential", plotPosition: "Corner", facing: "East", roadWidth: "40", developmentStatus: "Developed", possession: "Available", boundaryWall: "Yes", landLevel: "Level", amenities: ["Water", "Sewerage"] },
    };
    for (const [listing, kinds] of Object.entries(data.PROPERTY_KIND_OPTIONS)) for (const kind of kinds) for (const legacy of [false, true]) {
      const form = {
        ...data.changePropertySelection({}, listing, kind), title: `${prefix} ${listing} ${kind} ${legacy ? "legacy" : "json"}`,
        description: "Verification description. Bedrooms: 4 | Bathrooms: 3", city: "Lahore", area: "DHA", phase: "Phase 5", address: "10 Test Street",
        size_value: 5, size_unit: "marla", price: 25000000, price_currency: "PKR", property_data: examples,
        bedrooms: "4", bathrooms: "3", parking: "2 cars", why_this_home: ["Saved database insight"],
        property_highlights: [{ title: "Corner", description: "Open view", icon: "home" }],
        location_advantages: [{ name: "School", description: "Nearby" }], investment_insights: ["Rental potential"],
      };
      const body = { ...form, property_data: legacy ? null : data.buildPropertyData(form) };
      const response = await create({ json: async () => body });
      assert.equal(response.status, 200, await response.clone().text());
      const { propertyId: id } = await response.json(); ids.push(id);
      const [[committed]] = await observer.execute("SELECT * FROM properties WHERE id = ?", [id]);
      assert.ok(committed, "A separate MySQL connection sees the committed insert");
      assert.equal(committed.status, "draft");
      assert.deepEqual(committed.property_data, legacy ? null : data.normalizePropertyData(body.property_data, form.propertyType, form.propertySubtype).data);
      for (const field of ["title", "description", "city", "area", "phase", "address", "size_unit", "price_currency"]) assert.equal(committed[field], body[field]);
      assert.equal(Number(committed.size_value), 5); assert.equal(Number(committed.price), 25000000);
      const get = await api.GET({}, { params: { id } });
      assert.equal(get.status, 200);
      assert.deepEqual((await get.json()).property.property_data, committed.property_data);
      // Partial JSON edits preserve omitted sections, fields and legacy insights.
      const partial = { ...body, property_data: { insights: { why_this_home: ["Partial update"] } } };
      for (const key of data.INSIGHT_FIELDS) delete partial[key];
      if (!legacy) {
        assert.equal((await api.PUT({ json: async () => partial }, { params: { id } })).status, 200);
        const [updated] = await query("SELECT * FROM properties WHERE id = ?", [id]);
        for (const section of data.sectionsForKind(kind)) assert.deepEqual(updated.property_data[section], committed.property_data[section]);
        assert.deepEqual(updated.property_data.insights.investment_insights, committed.investment_insights);
      } else {
        const omitted = { ...body }; delete omitted.property_data;
        for (const key of data.INSIGHT_FIELDS) delete omitted[key];
        assert.equal((await api.PUT({ json: async () => omitted }, { params: { id } })).status, 200);
        const [updated] = await query("SELECT * FROM properties WHERE id = ?", [id]);
        assert.equal(updated.property_data, null);
        assert.deepEqual(updated.why_this_home, committed.why_this_home);
      }
      const edited = await editPage(api, id, agent, kind, legacy);
      const [[updated]] = await observer.execute("SELECT * FROM properties WHERE id = ?", [id]);
      assert.deepEqual(updated.property_data, edited.property_data, "Edit is committed and retrievable");
      await conn.beginTransaction();
      try {
        await query("UPDATE properties SET status = 'approved' WHERE id = ?", [id]);
        const publicRow = await queries.getPropertyByAgentAndSlug(agent.id, String(id));
        assert.deepEqual(publicRow.property_data, edited.property_data);
        const detail = await PublicPage({ params: { estate_name: agent.username || agent.estate_name, propertyId: String(id) }, searchParams: {} });
        const markupText = text(detail);
        for (const section of mapping.publicPropertyDetails(publicRow).sections) for (const row of section.rows) {
          assert.ok(markupText.includes(row.label), `Public label ${row.label}`);
          assert.ok(markupText.includes(row.value), `Public value ${row.value}`);
        }
        const rows = await queries.getApprovedPropertiesByAgent(agent.id);
        const saved = rows.find(row => row.id === id); assert.ok(saved);
        const listing = nodes(Listings({ properties: [saved] }));
        assert.equal(listing.filter(n => n.type === "Link" && n.props.className === "card").length, 1);
        assert.ok(!listing.some(n => /shops|for-sale-file/.test(n.props?.id || "")));
        if (kind === "file") assert.ok(listing.some(n => n.type === "path" && n.props.d?.startsWith("M14 2H6")));
      } finally { await conn.rollback(); }
      console.log(`PASS ${listing}/${kind} ${legacy ? "NULL legacy" : "JSON"}: committed create, SQL/API retrieval, partial update, edit UI/save, public query/detail/cards`);
    }
    for (const old of existing) {
      assert.doesNotThrow(() => mapping.publicPropertyDetails(old));
      for (const key of data.INSIGHT_FIELDS) assert.doesNotThrow(() => mapping.publicPropertyInsight(old, key));
    }
    const legacyPublic = existing.find(row => row.agent_id === agent.id && row.status === "approved" && row.property_data == null);
    if (legacyPublic) {
      await PublicPage({ params: { estate_name: agent.username || agent.estate_name, propertyId: String(legacyPublic.id) }, searchParams: {} });
      console.log("PASS actual existing NULL property through public DB query and detail page");
    }
    console.log(`PASS legacy read compatibility: ${existing.length} existing records`);
  } finally {
    await conn.rollback();
    for (const id of ids) await query("DELETE FROM properties WHERE id = ? AND title LIKE ?", [id, `${prefix}%`]);
    if (baseline) {
      const remaining = await query("SELECT * FROM properties ORDER BY id");
      for (const row of remaining) if (baseline.has(row.id)) assert.equal(hash(row), baseline.get(row.id), `Existing property ${row.id} unchanged`);
      for (const id of baseline.keys()) assert.ok(remaining.some(row => row.id === id), "Existing record retained");
      assert.ok(remaining.every(row => !ids.includes(row.id)), "All verification drafts removed");
      console.log(`Verified ${baseline.size} original records unchanged; removed ${ids.length} verification drafts.`);
    }
    global.fetch = savedGlobals.fetch; global.document = savedGlobals.document;
    await observer.end(); await conn.end();
  }
}
main().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });

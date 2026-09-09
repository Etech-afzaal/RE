const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { transformSync } = require("next/dist/build/swc");

// Compile the project's existing aliases/JSX with its installed Next compiler.
// Only database, session, browser hooks and external media services are mocked.
function loader(mocks = {}) {
  const cache = new Map();
  function load(name, parent = path.join(process.cwd(), "index.js")) {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.endsWith(".css")) return { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
    if (!name.startsWith("@/") && !name.startsWith(".") && !path.isAbsolute(name)) return require(name);
    let filename = name.startsWith("@/") ? path.resolve(name.slice(2)) : path.resolve(path.dirname(parent), name);
    if (!path.extname(filename)) filename += ".js";
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module);
    cache.set(filename, mod);
    mod.filename = filename;
    mod.paths = module.paths;
    mod.require = specifier => load(specifier, filename);
    const { code } = transformSync(fs.readFileSync(filename, "utf8"), {
      filename, jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022", transform: { react: { runtime: "automatic" } } }, module: { type: "commonjs" },
    });
    mod._compile(code, filename);
    return mod.exports;
  }
  return load;
}

const load = loader();
test("price masking groups digits, emits unformatted values and reuses live listing conversions", () => {
  const PriceInput = loader({ react: {
    useState: initial => [initial, () => {}], useRef: () => ({ current: null }),
    useId: () => "price-currency", useEffect() {}, useLayoutEffect() {},
  } })("@/components/agent-portal/PriceCurrencyInput").default;
  let saved;
  for (const [amount, currency, display, label] of [
    ["2000", "PKR", "2,000", "2 thousand"],
    ["250000", "PKR", "250,000", "2.5 lakh"],
    ["2000000", "USD", "2,000,000", "$2 million"],
  ]) {
    const nodes = inputNodes(PriceInput({ amount, currency, onAmountChange: value => { saved = value; } }));
    const input = nodes.find(n => n.type === "input");
    assert.equal(input.props.value, display);
    assert.equal(nodes.find(n => n.props?.["aria-live"] === "polite").props.children, label);
    input.props.onChange({ target: { value: "20,001", selectionStart: 6 } });
    assert.equal(saved, "20001");
    input.props.onChange({ target: { value: "", selectionStart: 0 } });
    assert.equal(saved, "");
  }
  assert.ok(!inputNodes(PriceInput({ amount: "" })).some(n => n.props?.["aria-live"]));
});
function inputNodes(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(inputNodes);
  return [node, ...inputNodes(node.props?.children)];
}

test("numeric controls reject letters, negatives and fractional counts; buttons respect limits", () => {
  const NumberInput = load("@/components/agent-portal/PropertyNumberInput").default;
  let value = "2";
  const render = () => inputNodes(NumberInput({ value, step: 1, max: 99, onChange: next => { value = next; } }));
  for (const invalid of ["abc", "-1", "1.5", "1e3", "100"]) render().find(n => n.type === "input").props.onChange({ target: { value: invalid } });
  assert.equal(value, "2");
  render().find(n => n.props?.["aria-label"] === "Increase value").props.onClick();
  assert.equal(value, "3");
  render().find(n => n.props?.["aria-label"] === "Decrease value").props.onClick();
  assert.equal(value, "2");
  value = "0";
  assert.equal(render().find(n => n.props?.["aria-label"] === "Decrease value").props.disabled, true);
});

test("amenities dropdown supports multiple checkboxes, custom Other and deselection", () => {
  const hooks = []; let cursor = 0, value = [];
  const Amenities = loader({ react: { useState(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = initial; return [hooks[i], next => { hooks[i] = next; }]; } } })("@/components/agent-portal/PropertyAmenitiesInput").default;
  const render = () => { cursor = 0; return inputNodes(Amenities({ value, options: ["Electricity", "Gas", "Others"], onChange: next => { value = next; } })); };
  const check = (name, checked) => inputNodes(render().find(n => n.type === "label" && n.props.children[1] === name)).find(n => n.type === "input").props.onChange({ target: { checked } });
  assert.ok(render().some(n => n.type === "details"));
  check("Electricity", true); check("Gas", true); check("Other", true);
  render().find(n => n.props?.["aria-label"] === "Custom amenity").props.onChange({ target: { value: "24/7 Security" } });
  render().find(n => n.type === "button").props.onClick();
  assert.deepEqual(value, ["Electricity", "Gas", "24/7 Security"]);
  check("Gas", false); check("24/7 Security", false);
  assert.deepEqual(value, ["Electricity"]);
});

test("custom amenities and numeric road widths save while legacy measurements remain valid", () => {
  const data = load("@/lib/propertyData");
  for (const subtype of ["house", "apartment", "commercial", "file"]) {
    const section = subtype === "file" ? "plotInfo" : "propertyDetails";
    const result = data.normalizePropertyData({ [section]: { amenities: ["Gas", "24/7 Security"] } }, "sale", subtype);
    assert.equal(result.ok, true);
    assert.deepEqual(result.data[section].amenities, ["Gas", "24/7 Security"]);
  }
  for (const width of ["30.5", "40 ft", "80 ft+"]) assert.equal(data.normalizePropertyData({ landInfo: { roadWidth: width } }, "sale", "house").ok, true);
  for (const width of ["wide", "-20", "20e2"]) assert.equal(data.normalizePropertyData({ landInfo: { roadWidth: width } }, "sale", "house").ok, false);
  assert.equal(data.fieldsForSection("landInfo", "house")[0].key, "dimension");
  assert.equal(data.fieldsForSection("plotInfo", "plots")[0].key, "plotDimensions");
});
const data = load("@/lib/propertyData");
test("parking capacity and Lounge amenities round-trip through property data", () => {
  for (const parking of ["1 car", "2 cars", "3 cars", "4 cars+", "Yes", "No"]) {
    const result = data.normalizePropertyData({ propertyDetails: { parking, amenities: ["Lounge", "Gas"] } }, "sale", "house");
    assert.equal(result.ok, true);
    assert.equal(result.data.propertyDetails.parking, parking);
    assert.deepEqual(result.data.propertyDetails.amenities, ["Lounge", "Gas"]);
  }
  assert.equal(data.normalizePropertyData({ propertyDetails: { parking: "invalid" } }, "sale", "house").ok, false);
});
const validators = load("@/lib/validators/propertyValidator");
const submission = load("@/lib/propertyValidation");
const examples = { landInfo: { front: "30", depth: "75", plotPosition: "Corner" }, propertyDetails: { coveredArea: "2250", floors: "2", bedrooms: "4", bathrooms: "3", parking: "Yes", kitchens: "2" }, commercialInfo: { commercialType: "Office" }, plotInfo: { plotType: "Residential", roadWidth: "40 ft", possession: "Available", amenities: ["Electricity", "Gas"] }, insights: { why_this_home: ["Near schools"], property_highlights: [{ title: "Corner", description: "Open view", icon: "home" }] } };
const base = { title: "Spacious property for Sale", description: "Well maintained", city: "Lahore", area: "DHA", address: "", size_value: "5", size_unit: "marla", price: "25000000", price_currency: "PKR" };
const combos = Object.entries(data.PROPERTY_KIND_OPTIONS).flatMap(([listing, kinds]) => kinds.map(kind => [listing, kind]));

async function editHarness(row) {
  const api = apiHarness();
  api.records.set(1, { ...row, id: 1, agent_id: 7 });
  const requests = [], hooks = [], effects = [];
  let cursor = 0, tree, mounted = false;
  const React = require("react");
  const mocks = {
    react: { ...React,
      useState(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = typeof initial === "function" ? initial() : initial; return [hooks[i], value => { hooks[i] = typeof value === "function" ? value(hooks[i]) : value; }]; },
      useRef(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = { current: initial }; return hooks[i]; },
      useEffect(effect) { if (!mounted) effects.push(effect); },
    },
    "next/navigation": { useParams: () => ({ estate_name: "test", id: "1" }), useRouter: () => ({ push() {}, replace() {} }) },
    "next-auth/react": { useSession: () => ({ status: "authenticated", data: { user: { id: 7 } } }) },
    "@/lib/clientImageCompress": { compressImageForUpload: async file => file },
  };
  for (const component of ["agent-portal/AgentPortalShell", "agent-portal/PriceCurrencyInput", "ImageCategorySelect", "ImagePreviewModal", "VideoPreviewModal", "LoadingSpinner", "PropertyWatermark", "agent-portal/PropertyMarketingSectionsEditor"]) mocks[`@/components/${component}`] = component.split("/").pop();
  global.document = { getElementById: () => null };
  global.fetch = async (url, options = {}) => {
    requests.push({ url, ...options });
    if (url === "/api/agent/company-branding") return Response.json({ branding: {} });
    if (url.endsWith("/submit")) return api.submit({}, { params: { id: 1 } });
    if (url.endsWith("/images") || url.endsWith("/videos")) return Response.json({ success: true });
    if (options.method === "PUT") return api.update({ json: async () => JSON.parse(options.body) }, { params: { id: 1 } });
    return Response.json({ property: api.records.get(1) });
  };
  const Page = loader(mocks)("@/app/(public)/re/[estate_name]/dashboard/properties/[id]/edit/page").default;
  const render = () => { cursor = 0; tree = Page(); return tree; };
  function nodes(node) {
    if (arguments.length === 0) node = tree;
    if (node == null || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(nodes);
    if (typeof node.type === "function") return nodes(node.type(node.props));
    return [node, ...nodes(node.props?.children)];
  }
  const text = node => node == null || typeof node === "boolean" ? "" : typeof node !== "object" ? String(node) : Array.isArray(node) ? node.map(text).join("") : text(node.props?.children);
  const find = predicate => { const found = nodes().find(predicate); assert.ok(found, "Expected edit control"); return found; };
  const input = label => {
    const wrapper = find(n => n.type === "label" && text(n.props.children?.[0]).trim() === label);
    return nodes(wrapper).find(n => ["input", "select", "textarea"].includes(n.type));
  };
  const change = (label, value) => { input(label).props.onChange({ target: { value } }); render(); };
  const click = async label => { await find(n => n.type === "button" && text(n) === label).props.onClick(); render(); };
  render(); mounted = true;
  effects.forEach(effect => effect());
  await new Promise(resolve => setImmediate(resolve)); render();
  return { api, requests, nodes, find, input, change, click, render, text };
}

for (const [listing, kind] of combos) for (const legacy of [false, true]) test(`edit ${listing}/${kind}, ${legacy ? "NULL JSON" : "Add Property JSON"}: load, modify, save, media and submit`, async () => {
  const form = { ...data.changePropertySelection(base, listing, kind), ...base, property_data: examples };
  const created = apiHarness();
  const response = await created.create({ json: async () => ({ ...form, property_data: legacy ? null : data.buildPropertyData(form) }) });
  assert.equal(response.status, 200);
  const row = { ...created.records.get(1), address: "10 Main Street", images: [{ id: 11, image_url: "/photo.jpg", category: "exterior", is_featured: true, hero_display: "yes" }], videos: [{ id: 21, video_url: "/tour.mp4", category: "exterior", is_featured: true }] };
  const ui = await editHarness(row);
  assert.equal(ui.input("Property Type").props.value, kind);
  assert.equal(ui.input("Listing Type").props.value, listing);
  assert.equal(ui.input("Title").props.value, base.title);
  if (["plots", "file"].includes(kind)) {
    assert.ok(ui.text(ui.render()).includes(kind === "plots" ? "Plot Information" : "Plot Info"));
    assert.ok(!ui.nodes().some(n => n.type === "h3" && ui.text(n) === "Land Info"));
    ui.change("Plot Type", "Commercial");
  } else {
    if (!legacy) assert.equal(ui.input("Front (ft)").props.value, 30);
    ui.change("Front (ft)", "35");
    ui.change("Bedrooms", "6");
    if (kind === "commercial") ui.change("Commercial Type", "Warehouse");
  }
  await ui.click("Save Draft");
  const saved = JSON.parse(ui.api.records.get(1).property_data);
  if (["plots", "file"].includes(kind)) assert.equal(saved.plotInfo.plotType, "Commercial");
  else { assert.equal(saved.landInfo.front, 35); assert.equal(saved.propertyDetails.bedrooms, 6); }
  if (kind === "commercial") assert.equal(saved.commercialInfo.commercialType, "Warehouse");
  assert.equal(ui.api.records.get(1).size_value, 5);
  const imageSave = ui.requests.find(r => r.url.endsWith("/images"));
  assert.deepEqual(JSON.parse(imageSave.body).updates, [{ id: 11, category: "exterior", sortOrder: 0, isFeatured: true, heroDisplay: true }]);
  assert.ok(!ui.requests.some(r => r.url.endsWith("/videos")), "No existing video changes requested");
  assert.deepEqual(ui.api.records.get(1).videos, row.videos);
  await ui.click("Submit For Approval");
  assert.equal(ui.api.records.get(1).status, "pending_approval");
  assert.equal(ui.find(n => n.type === "fieldset" && n.props.id === "field-property_data").props.disabled, true);
  assert.ok(!ui.nodes().some(n => n.type === "button" && ui.text(n) === "Save Draft"));
});

test("edit NULL/incomplete JSON preserves existing columns and unrelated JSON; switching clears type-specific fields", async () => {
  for (const raw of [null, {}, { propertyDetails: null }, { landInfo: { front: 35, surveyReference: "keep" }, insights: { externalNote: "keep" }, externalSection: { reference: 123 } }]) {
    const ui = await editHarness({ ...base, property_type: "sale", property_subtype: "house", property_data: raw, status: "draft" });
    ui.change("Title", "Updated property for Sale");
    await ui.click("Save Draft");
    const stored = ui.api.records.get(1).property_data;
    if (raw == null) assert.equal(stored, null, "Ordinary legacy edits retain NULL JSON");
    else if (raw.externalSection) {
      assert.deepEqual(JSON.parse(stored).externalSection, raw.externalSection);
      assert.equal(JSON.parse(stored).landInfo.surveyReference, "keep");
      ui.change("Front (ft)", "");
      await ui.click("Save Draft");
      assert.ok(!Object.hasOwn(JSON.parse(ui.api.records.get(1).property_data).landInfo, "front"));
      ui.change("Property Type", "file");
      ui.change("Plot Type", "Commercial");
      await ui.click("Save Draft");
      const switched = JSON.parse(ui.api.records.get(1).property_data);
      assert.ok(!switched.landInfo && !switched.propertyDetails);
      assert.deepEqual(switched.externalSection, raw.externalSection);
      assert.equal(switched.insights.externalNote, "keep");
      ui.change("Listing Type", "rent");
      assert.equal(ui.input("Property Type").props.value, "");
      ui.change("Property Type", "apartment");
      assert.equal(ui.input("Front (ft)").props.value, "");
      await ui.click("Save Draft");
      assert.ok(!JSON.parse(ui.api.records.get(1).property_data).plotInfo);
    }
  }
});

test("edit legacy shop preserves subtype, populates Commercial Type, validates edits and retains old insights", async () => {
  const ui = await editHarness({ ...base, property_type: "sale", property_subtype: "shop", property_data: null, why_this_home: '["Legacy insight"]', status: "draft" });
  assert.equal(ui.input("Property Type").props.value, "commercial");
  assert.equal(ui.input("Commercial Type").props.value, "Shop");
  ui.change("Front (ft)", "invalid");
  assert.equal(ui.input("Front (ft)").props.value, "");
  ui.change("Front (ft)", "30");
  await ui.click("Save Draft");
  const row = ui.api.records.get(1);
  assert.equal(row.property_subtype, "shop");
  const saved = JSON.parse(row.property_data);
  assert.equal(saved.commercialInfo.commercialType, "Shop");
  assert.deepEqual(saved.insights.why_this_home, ["Legacy insight"]);
});

test("edit commercial type alias loads, updates and clears without restoring stale Shop data", async () => {
  const ui = await editHarness({ ...base, property_type: "sale", property_subtype: "commercial", property_data: { commercialInfo: { type: "Shop" } }, status: "draft" });
  assert.equal(ui.input("Commercial Type").props.value, "Shop");
  ui.change("Commercial Type", "Office");
  await ui.click("Save Draft");
  assert.deepEqual(JSON.parse(ui.api.records.get(1).property_data).commercialInfo, { commercialType: "Office" });
  ui.change("Commercial Type", "");
  await ui.click("Save Draft");
  assert.deepEqual(JSON.parse(ui.api.records.get(1).property_data).commercialInfo, {});
});

for (const [listing, kind] of combos) test(`${listing}/${kind}: classification, dynamic tabs, validation, JSON sections and submission`, () => {
  const selected = data.changePropertySelection(base, listing, kind);
  const form = { ...selected, ...base, property_data: examples };
  const built = data.buildPropertyData(form);
  const normalized = data.normalizePropertyData(built, form.propertyType, form.propertySubtype);
  assert.equal(normalized.ok, true, normalized.error);
  assert.deepEqual(Object.keys(normalized.data), [...data.sectionsForKind(kind), "insights"]);
  const tabs = data.propertyWizardSteps(kind);
  assert.deepEqual(tabs.labels.slice(-3), ["Images", "Videos", "Insights & Submission"]);
  assert.equal(tabs.labels.includes("Land Info"), !["plots", "file"].includes(kind));
  assert.equal(validators.validatePropertyDraftInput(form).ok, true);
  assert.equal(validators.validatePropertyWizardFields(form).ok, true);
  const row = { ...form, property_type: form.propertyType, property_subtype: form.propertySubtype, property_data: normalized.data };
  assert.equal(submission.validatePropertyForSubmission(row, 1).valid, true);
  assert.equal(submission.validatePropertyForSubmission(row, 0).valid, false);
  assert.equal(submission.validatePropertyForSubmission({ ...row, area: "" }, 1).valid, false);
  assert.equal(submission.validatePropertyForSubmission({ ...row, price: 0 }, 1).valid, false);
  assert.equal(submission.validatePropertyForSubmission({ ...row, size_value: "" }, 1).valid, false);
});

test("every selection transition clears stale fields and disallows rent plots/files", () => {
  for (const [listing, kind] of combos) for (const [nextListing, nextKind] of combos) {
    const old = { ...data.changePropertySelection(base, listing, kind), property_data: examples, bedrooms: 4, bathrooms: 3, parking: "Yes", plotSizePreset: "5 Marla", why_this_home: ["Saved insight"] };
    const next = data.changePropertySelection(old, nextListing, nextKind);
    assert.deepEqual(next.property_data, {});
    assert.equal(next.bedrooms, ""); assert.equal(next.bathrooms, ""); assert.equal(next.size_value, "");
    assert.equal(next.plotSizePreset, "Other");
    assert.deepEqual(next.why_this_home, ["Saved insight"]);
  }
  for (const kind of ["plots", "file"]) assert.equal(data.changePropertySelection(base, "rent", kind).propertySubtype, "");
  assert.equal(validators.validatePropertyDraftInput({ ...base, propertyType: "rent", propertySubtype: "file" }).ok, false);
});

test("reject malformed JSON, invalid numbers/options and HTML; allow custom file amenities", () => {
  for (const raw of ["{", "[]", [], true, 3]) assert.equal(data.normalizePropertyData(raw, "sale", "house").ok, false);
  for (const raw of [{ landInfo: [] }, { landInfo: { front: "oops" } }, { propertyDetails: { floors: "1.5" } }, { propertyDetails: { bedrooms: "100" } }, { landInfo: { dimension: "<script>x</script>" } }, { landInfo: { plotPosition: "Unknown" } }, { insights: [] }]) assert.equal(data.normalizePropertyData(raw, "sale", "house").ok, false);
  assert.equal(data.normalizePropertyData({ plotInfo: { amenities: ["Water"] } }, "sale", "file").ok, true);
  assert.equal(data.normalizePropertyData({ insights: { why_this_home: ["<script>bad</script>"] } }, "sale", "house").ok, false);
  const pruned = data.normalizePropertyData(examples, "sale", "file");
  assert.equal(pruned.ok, true);
  assert.deepEqual(Object.keys(pruned.data.plotInfo).sort(), ["amenities", "plotType"]);
});

test("JSON round-trip, legacy edits, insight synchronization and nullable old properties", () => {
  const first = data.preparePropertyDataSave({ property_data: examples }, "sale", "house");
  const restored = data.preparePropertyDataSave({ why_this_home: ["Updated"] }, "sale", "house", JSON.stringify(first.data));
  assert.equal(restored.data.landInfo.front, 30);
  assert.deepEqual(restored.data.insights.why_this_home, ["Updated"]);
  assert.deepEqual(restored.marketing, restored.data.insights);
  const cleared = data.preparePropertyDataSave({ property_data: { insights: { why_this_home: [] } } }, "sale", "house", first.data);
  assert.equal(cleared.marketing.why_this_home, null);
  const old = data.preparePropertyDataSave({ why_this_home: ["Legacy"] }, "sale", "house");
  assert.equal(old.data, null);
  assert.deepEqual(old.marketing.why_this_home, ["Legacy"]);
  assert.equal(submission.validatePropertyForSubmission({ ...base, property_type: "sale", property_subtype: "house" }, 1).valid, false, "Legacy address requirement stays intact");
});

function apiHarness() {
  const records = new Map(); const sqlCalls = []; let nextId = 1;
  const query = async (sql, params = []) => {
    sqlCalls.push({ sql, params });
    assert.equal((sql.match(/\?/g) || []).length, params.length, "SQL parameter count");
    if (sql.includes("INSERT INTO properties")) {
      const columns = sql.match(/INSERT INTO properties\s*\(([^)]+)\)/)[1].split(",").map(v => v.trim());
      const row = Object.fromEntries(columns.map((column, index) => [column, params[index]]));
      row.id = nextId++; records.set(row.id, row); return { insertId: row.id };
    }
    if (sql.startsWith("SELECT") && sql.includes("FROM properties")) {
      const row = records.get(Number(params[0]));
      return row && (params[1] == null || row.agent_id === params[1]) ? [{ ...row }] : [];
    }
    if (sql.includes("SELECT COUNT(*) AS total FROM property_images")) return [{ total: 1 }];
    if (sql.startsWith("UPDATE properties")) {
      const idIndex = sql.includes("submitted_at = NOW()") ? 1 : params.length - 2;
      const row = records.get(Number(params[idIndex]));
      if (!row) return { affectedRows: 0 };
      let i = 0;
      for (const part of sql.split("SET")[1].split("WHERE")[0].split(",")) {
        const match = part.trim().match(/^(\w+) = \?$/);
        if (match) row[match[1]] = params[i++];
      }
      return { affectedRows: 1 };
    }
    throw Error("Unexpected SQL: " + sql);
  };
  const session = { user: { id: 7, name: "Test Agent" } };
  const loadApi = loader({ "@/lib/db": { query }, "@/lib/adminAuth": { requireAgent: async () => ({ session }) }, "@/lib/queries": {}, "@/lib/auditLogger": { AUDIT_ACTIONS: {}, AUDIT_ENTITY_TYPES: {}, createAuditLog: async () => {}, getRequestIp: () => null } });
  return { records, sqlCalls, create: loadApi("@/app/api/properties/route").POST, update: loadApi("@/app/api/properties/[id]/route").PUT, submit: loadApi("@/app/api/properties/[id]/submit/route").POST };
}

for (const [listing, kind] of combos) test(`${listing}/${kind}: actual POST/PUT/submit handlers with isolated database stub`, async () => {
  const api = apiHarness();
  const form = { ...data.changePropertySelection(base, listing, kind), ...base, property_data: examples };
  const body = { ...form, property_data: data.buildPropertyData(form) };
  const created = await api.create({ json: async () => body });
  assert.equal(created.status, 200, await created.clone().text());
  const { propertyId } = await created.json();
  const row = api.records.get(propertyId);
  assert.equal(row.status, "draft"); assert.equal(row.price, 25000000); assert.equal(row.size_value, 5);
  const stored = JSON.parse(row.property_data);
  assert.deepEqual(stored.insights.why_this_home, JSON.parse(row.why_this_home));
  const updated = await api.update({ json: async () => ({ ...body, price: 26000000, why_this_home: ["Updated insight"] }) }, { params: { id: propertyId } });
  assert.equal(updated.status, 200, await updated.clone().text());
  assert.equal(row.price, 26000000);
  assert.deepEqual(JSON.parse(row.property_data).insights.why_this_home, ["Updated insight"]);
  const submitted = await api.submit({}, { params: { id: propertyId } });
  assert.equal(submitted.status, 200, await submitted.clone().text());
  assert.equal(row.status, "pending_approval");
  const locked = await api.update({ json: async () => body }, { params: { id: propertyId } });
  assert.equal(locked.status, 409);
});

test("API rejects invalid data without writes; old edit saves preserve JSON and type changes prune it", async () => {
  const api = apiHarness();
  const body = { ...base, propertyType: "sale", propertySubtype: "house", property_data: examples };
  const invalid = await api.create({ json: async () => ({ ...body, property_data: { propertyDetails: { floors: "bad" } } }) });
  assert.equal(invalid.status, 400); assert.equal(api.records.size, 0);
  const result = await api.create({ json: async () => body });
  const { propertyId } = await result.json();
  const legacy = { ...body, why_this_home: ["Legacy edit"] }; delete legacy.property_data;
  assert.equal((await api.update({ json: async () => legacy }, { params: { id: propertyId } })).status, 200);
  assert.equal(JSON.parse(api.records.get(propertyId).property_data).landInfo.front, 30);
  assert.equal((await api.update({ json: async () => ({ ...legacy, propertyType: "rent", propertySubtype: "apartment" }) }, { params: { id: propertyId } })).status, 200);
  assert.deepEqual(JSON.parse(api.records.get(propertyId).property_data).landInfo, {});
});

function wizardHarness() {
  const React = require("react");
  const hooks = []; let cursor = 0; let tree;
  const requests = []; const destinations = [];
  const api = apiHarness();
  global.window = { sessionStorage: { getItem: () => null, removeItem() {}, setItem() {} }, confirm: () => true };
  const mocks = {
    react: { ...React, useEffect() {}, useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = typeof initial === "function" ? initial() : initial;
      return [hooks[index], value => { hooks[index] = typeof value === "function" ? value(hooks[index]) : value; }];
    }, useRef(initial) { const index = cursor++; if (!(index in hooks)) hooks[index] = { current: initial }; return hooks[index]; } },
    "next/navigation": { useParams: () => ({ estate_name: "test" }), useRouter: () => ({ push: path => destinations.push(path), replace() {} }) },
    "next-auth/react": { useSession: () => ({ status: "authenticated", data: { user: { id: 7, name: "Test Agent" } } }) },
    "@/lib/clientImageCompress": { compressImageForUpload: async file => file },
    "@/lib/propertyDraftFiles": { persistDraftFiles() {}, loadDraftFiles: async () => ({}), clearDraftFiles: async () => {} },
  };
  for (const component of ["agent-portal/AgentPortalShell", "agent-portal/PriceCurrencyInput", "ImageCategorySelect", "ImagePreviewModal", "LoadingSpinner", "PropertyWatermark", "agent-portal/PropertyMarketingSectionsEditor"]) mocks[`@/components/${component}`] = component.split("/").pop();
  const Page = loader(mocks)("@/app/(public)/re/[estate_name]/dashboard/properties/create/page").default;
  global.fetch = async (url, options = {}) => {
    requests.push({ url, ...options });
    const request = { json: async () => JSON.parse(options.body) };
    if (url === "/api/properties") return api.create(request);
    const id = Number(url.split("/")[3]);
    if (url.endsWith("/images") || url.endsWith("/videos")) return Response.json({ success: true });
    if (url.endsWith("/submit")) return api.submit({}, { params: { id } });
    return api.update(request, { params: { id } });
  };
  function nodes(node) {
    if (arguments.length === 0) node = tree;
    if (node == null || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(nodes);
    // Expand the simple field components; the original insight editor is unchanged.
    if (typeof node.type === "function") return nodes(node.type(node.props));
    return [node, ...nodes(node.props?.children)];
  }
  function text(node) {
    if (node == null || typeof node === "boolean") return "";
    if (typeof node !== "object") return String(node);
    if (Array.isArray(node)) return node.map(text).join("");
    return text(node.props?.children);
  }
  const render = () => { cursor = 0; tree = Page(); return tree; };
  const find = predicate => { const match = nodes().find(predicate); assert.ok(match, "Expected wizard control"); return match; };
  const button = label => find(n => n.type === "button" && text(n) === label);
  const input = label => {
    const wrapper = find(n => ["label", "div"].includes(n.type) && text(n.props.children?.[0]).trim() === label);
    return nodes(wrapper).find(n => ["input", "select", "textarea"].includes(n.type));
  };
  const change = (label, value) => { input(label).props.onChange({ target: { value } }); render(); };
  const click = async label => { await button(label).props.onClick(); render(); };
  const tick = async () => { await new Promise(resolve => setImmediate(resolve)); render(); };
  render();
  return { render, nodes, text, find, button, input, change, click, tick, requests, api, destinations };
}

for (const [listing, kind] of combos) for (const action of ["Save Draft", "Submit For Approval", ...(listing === "sale" && kind === "commercial" ? ["Retry Save Draft"] : [])]) test(`${listing}/${kind}: wizard navigation, media payloads, insights and ${action}`, async () => {
  const ui = wizardHarness();
  ui.change("Title", base.title);
  ui.change("Listing Type", listing);
  ui.change("Property Type", kind);
  await ui.click("Continue");
  ui.change("City", "Lahore");
  await ui.click("Continue");
  assert.ok(ui.nodes().some(n => n.props?.["aria-describedby"] === "area-error"), "Area blocks forward navigation");
  ui.change("Area / Neighbourhood", "DHA");
  await ui.click("Continue");
  ui.change("Plot Size", "5");
  if (!["plots", "file"].includes(kind)) {
    ui.change("Front (ft)", "30");
    await ui.click("Continue");
    ui.change("Covered Area (sqft)", "2000");
    ui.change("Bedrooms", "3");
    if (kind === "commercial") ui.change("Commercial Type", "Office");
  }
  const price = ui.find(n => n.type === "PriceCurrencyInput");
  price.props.onAmountChange("25000000"); ui.render();
  ui.find(n => n.type === "PriceCurrencyInput").props.onCurrencyChange("USD"); ui.render();
  await ui.click("Continue");
  await ui.click("Continue");
  assert.ok(ui.nodes().some(n => n.type === "input" && n.props.accept?.startsWith("image/")), "Missing image blocks forward navigation");
  ui.find(n => n.type === "input" && n.props.type === "file").props.onChange({ target: { files: [new File(["test"], "photo.jpg", { type: "image/jpeg" })], value: "" } });
  await ui.tick();
  await ui.click("Continue");
  assert.ok(ui.nodes().some(n => n.type === "ImageCategorySelect"), "Image category is required");
  ui.find(n => n.type === "ImageCategorySelect").props.onChange("exterior"); ui.render();
  assert.equal(ui.find(n => n.type === "input" && n.props.name === "featured-image").props.checked, true);
  assert.equal(ui.find(n => n.type === "input" && n.props.type === "checkbox").props.checked, true);
  await ui.click("Continue");
  ui.find(n => n.type === "input" && n.props.type === "file").props.onChange({ target: { files: [new File(["test"], "tour.mp4", { type: "video/mp4" })], value: "" } });
  await ui.tick();
  ui.find(n => n.type === "ImageCategorySelect").props.onChange("exterior"); ui.render();
  await ui.click("Continue");
  const editor = ui.find(n => n.type === "PropertyMarketingSectionsEditor");
  editor.props.setForm(previous => ({ ...previous, why_this_home: ["Walk to the park"], investment_insights: ["Rental potential"] })); ui.render();
  if (action === "Retry Save Draft") {
    const originalFetch = global.fetch;
    let failed = false;
    global.fetch = async (url, options) => {
      if (url.endsWith("/videos") && !failed) {
        failed = true; ui.requests.push({ url, ...options });
        return Response.json({ error: "Video upload interrupted" }, { status: 500 });
      }
      return originalFetch(url, options);
    };
    await ui.click("Save Draft");
    assert.ok(ui.text(ui.render()).includes("Video upload interrupted"));
    ui.find(n => n.type === "PropertyMarketingSectionsEditor").props.setForm(previous => ({ ...previous, investment_insights: ["Updated after upload failure"] })); ui.render();
    await ui.click("Save Draft");
    assert.deepEqual(ui.requests.map(r => r.url), ["/api/properties", "/api/properties/1/images", "/api/properties/1/videos", "/api/properties/1", "/api/properties/1/videos"]);
    assert.equal(ui.requests[3].method, "PUT");
    assert.deepEqual(JSON.parse(ui.api.records.get(1).property_data).insights.investment_insights, ["Updated after upload failure"]);
    assert.equal(ui.api.records.size, 1, "Retry reuses the draft and does not upload images twice");
  } else {
    await ui.click(action);
    assert.deepEqual(ui.requests.map(r => r.url), ["/api/properties", "/api/properties/1/images", "/api/properties/1/videos", ...(action === "Submit For Approval" ? ["/api/properties/1/submit"] : [])]);
  }
  const payload = JSON.parse(ui.requests[0].body);
  assert.equal(payload.price_currency, "USD"); assert.equal(payload.size_value, 5);
  assert.deepEqual(payload.property_data.insights.why_this_home, ["Walk to the park"]);
  assert.equal(ui.requests[1].body.get("isFeatured"), "1");
  assert.equal(ui.requests[1].body.get("imageOrder"), "0");
  assert.equal(ui.requests[1].body.get("imageCategories"), "exterior");
  assert.equal(ui.requests[2].body.get("videoOrder"), "0");
  assert.equal(ui.requests[2].body.get("isFeatured"), "1");
  if (action !== "Submit For Approval") assert.deepEqual(ui.destinations, ["/re/test/dashboard/properties"]);
  else assert.equal(ui.api.records.get(1).status, "pending_approval");
});

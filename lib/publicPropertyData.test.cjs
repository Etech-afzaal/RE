const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { transformSync } = require("next/dist/build/swc");
const React = require("react");

function loader(mocks = {}) {
  const cache = new Map();
  function load(name, parent = path.resolve("index.js")) {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.endsWith(".css")) return { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
    if (!name.startsWith("@/") && !name.startsWith(".")) return require(name);
    let filename = name.startsWith("@/") ? path.resolve(name.slice(2)) : path.resolve(path.dirname(parent), name);
    if (!path.extname(filename)) filename += ".js";
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module); cache.set(filename, mod);
    mod.filename = filename; mod.paths = module.paths; mod.require = specifier => load(specifier, filename);
    const { code } = transformSync(fs.readFileSync(filename, "utf8"), { filename, jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022", transform: { react: { runtime: "automatic" } } }, module: { type: "commonjs" } });
    mod._compile(code, filename); return mod.exports;
  }
  return load;
}
const hooks = { ...React, useMemo: fn => fn(), useCallback: fn => fn, useEffect() {}, useRef: value => ({ current: value }), useState: value => [typeof value === "function" ? value() : value, () => {}] };
function nodes(node) {
  if (node == null || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (typeof node.type === "function") return nodes(node.type(node.props));
  return [node, ...nodes(node.props?.children)];
}
const text = node => node == null || typeof node === "boolean" ? "" : typeof node !== "object" ? String(node) : Array.isArray(node) ? node.map(text).join("") : text(node.props?.children);
const load = loader();
const mapping = load("@/lib/publicPropertyData");
const groups = load("@/lib/agentPublicListingSections");
const formData = load("@/lib/propertyData");
const base = { id: 1, agent_id: 1, estate_name: "test", title: "House for Sale", city: "Lahore", area: "DHA", size_value: 5, size_unit: "marla", price: 10000000, price_currency: "PKR", status: "approved", description: "Bedrooms: 3 | Bathrooms: 2", images: [], videos: [] };
const json = { landInfo: { front: 30, dimension: "30 × 75 ft" }, propertyDetails: { coveredArea: 1500, bedrooms: 4, bathrooms: 0, parking: "No", amenities: "Electricity" }, commercialInfo: { type: "Shop" }, plotInfo: { plotType: "Commercial", plotDimensions: "30 × 75 ft", facing: "East", roadWidth: "40 ft", developmentStatus: "Developed", possession: "Available", boundaryWall: "No", landLevel: "Level", amenities: ["Gas", "Water"] }, insights: { why_this_home: ["JSON lifestyle"], investment_insights: [], property_highlights: [], location_advantages: [] } };
const combos = Object.entries(formData.PROPERTY_KIND_OPTIONS).flatMap(([listing, kinds]) => kinds.map(kind => [listing, kind]));

function pageLoader(property) {
  const mocks = { react: hooks, "next/link": "Link", "next/image": "Image", "next/navigation": { notFound: () => { throw Error("not found"); } },
    "@/lib/queries": { getAgentByUsername: async () => ({ id: 1, estate_name: "test", full_name: "Agent", company_name: "Agency" }), getPropertyByAgentAndSlug: async () => property },
    "@/lib/marketingLinks": { resolvePropertyMarketingRef: async () => null, ensureAgentMarketingLink: async () => ({ unique_code: "test" }) },
  };
  const source = fs.readFileSync("app/(public)/re/[estate_name]/[propertyId]/page.js", "utf8");
  for (const [, name] of source.matchAll(/from "([^"]+)"/g)) if (name.startsWith("@/components/") || (name.startsWith("./") && !name.endsWith(".css"))) mocks[name] = name.split("/").pop();
  // The logo dimensions are data, not a component.
  delete mocks["@/components/publicSiteLogo"];
  return loader(mocks)("@/app/(public)/re/[estate_name]/[propertyId]/page").default;
}

for (const [listing, kind] of combos) for (const legacy of [false, true]) test(`public detail ${listing}/${kind}: ${legacy ? "NULL fallback" : "dynamic JSON"}`, async () => {
  const selected = formData.changePropertySelection({}, listing, kind);
  const property = { ...base, property_type: selected.propertyType, property_subtype: selected.propertySubtype, property_data: legacy ? null : JSON.stringify(json), why_this_home: ["Legacy lifestyle"] };
  const details = mapping.publicPropertyDetails(property);
  const Page = pageLoader(property);
  const tree = await Page({ params: { estate_name: "test", propertyId: "1" } });
  const all = nodes(tree);
  const summary = all.find(n => n.type === "PropertySummaryCard");
  assert.equal(summary.props.priceLabel.includes("10,000,000"), true);
  if (legacy) {
    assert.deepEqual(details.sections, []);
    assert.equal(summary.props.bedrooms, 3);
    assert.ok(text(tree).includes("Legacy lifestyle"));
  } else {
    assert.ok(text(tree).includes("JSON lifestyle"));
    assert.ok(!text(tree).includes("Legacy lifestyle"));
    assert.ok(text(tree).includes("Plot Size: 5 marla"));
    const labels = details.sections.flatMap(s => s.rows.map(r => r.label));
    if (["house", "apartment", "commercial"].includes(kind)) {
      assert.equal(summary.props.bedrooms, 4); assert.equal(summary.props.bathrooms, 0);
      assert.ok(labels.includes("Front (ft)")); assert.ok(!labels.includes("Facing"));
      assert.equal(labels.includes("Commercial Type"), kind === "commercial");
    } else {
      assert.ok(!labels.includes("Bedrooms"));
      assert.equal(labels.includes("Facing"), kind === "plots");
      assert.ok(labels.includes("Plot Type"));
    }
    assert.ok(details.sections.every(s => s.rows.length && s.rows.every(r => r.value !== "")));
  }
});

test("public mappings: old Shops merge with Commercial; Files join existing plot subgroups", () => {
  assert.ok(groups.AGENT_PUBLIC_LISTING_GROUPS.every(g => !g.subtypes.includes("shop") && !g.subtypes.includes("file")));
  for (const type of ["sale", "rent"]) {
    assert.equal(mapping.publicListingSubtype({ property_type: type, property_subtype: "shop" }), "commercial");
    assert.equal(mapping.publicListingSubtype({ property_type: type, property_subtype: "commercial", property_data: json }), "commercial");
  }
  assert.equal(mapping.publicListingSubtype({ property_subtype: "file", property_data: json }), "commercial_plot");
  assert.equal(mapping.publicListingSubtype({ property_subtype: "file", property_data: null }), "residential_plot");
  assert.equal(groups.listingSubsectionId("sale", "shop"), "for-sale-commercial");
});

test("empty/incomplete JSON and both Commercial Type keys are safe; insights preserve explicit empty lists", () => {
  for (const raw of [null, "invalid", [], {}, { landInfo: null }, { plotInfo: {} }]) {
    const details = mapping.publicPropertyDetails({ property_type: "sale", property_subtype: "house", property_data: raw });
    assert.deepEqual(details.sections, []);
  }
  for (const key of ["type", "commercialType"]) {
    const details = mapping.publicPropertyDetails({ property_type: "sale", property_subtype: "commercial", property_data: { commercialInfo: { [key]: "Shop" } } });
    assert.deepEqual(details.sections[0].rows, [{ label: "Commercial Type", value: "Shop" }]);
  }
  assert.deepEqual(mapping.publicPropertyInsight({ property_data: json, investment_insights: ["Old"] }, "investment_insights"), []);
  assert.deepEqual(mapping.publicPropertyInsight({ property_data: {}, investment_insights: ["Old"] }, "investment_insights"), ["Old"]);
  const empty = { property_data: { insights: { property_highlights: [null, {}, { title: " ", description: "" }], why_this_home: [null, " "] } } };
  assert.deepEqual(mapping.publicPropertyInsight(empty, "property_highlights"), []);
  assert.deepEqual(mapping.publicPropertyInsight(empty, "why_this_home"), []);
});

test("actual public listing sections retain card markup and pagination, with only a file icon added", () => {
  const loadUi = loader({ react: hooks, "next/link": "Link", "next/image": "Image", "@/components/ClearableSearchInput": "Search", "@/lib/useIsMobile": { useIsMobile: () => false } });
  const Listings = loadUi("@/components/HomeListings").default;
  const properties = [
    { ...base, id: 1, property_type: "sale", property_subtype: "house" },
    { ...base, id: 2, property_type: "sale", property_subtype: "shop" },
    { ...base, id: 3, property_type: "sale", property_subtype: "commercial", property_data: json },
    { ...base, id: 4, property_type: "sale", property_subtype: "file", property_data: json },
    { ...base, id: 5, property_type: "plot", property_subtype: "residential_plot" },
    { ...base, id: 6, property_type: "rent", property_subtype: "apartment" },
  ];
  const all = nodes(Listings({ properties }));
  assert.ok(!all.some(n => n.props?.id === "for-sale-shops" || n.props?.id === "for-sale-file"));
  const commercial = all.find(n => n.props?.id === "for-sale-commercial");
  assert.equal(nodes(commercial).filter(n => n.type === "Link" && n.props.className === "card").length, 2);
  const plots = all.find(n => n.props?.id === "plots-commercial");
  assert.equal(nodes(plots).filter(n => n.type === "Link" && n.props.className === "card").length, 1);
  assert.equal(all.filter(n => n.type === "path" && n.props.d?.startsWith("M14 2H6")).length, 1);
  const cards = all.filter(n => n.type === "Link" && n.props.className === "card");
  assert.equal(cards.length, properties.length);
  for (const card of cards) assert.deepEqual(card.props.children.map(n => n.props.className), ["media", "body"]);
  const many = nodes(Listings({ properties: Array.from({ length: 5 }, (_, i) => ({ ...properties[0], id: i + 20 })) }));
  assert.equal(many.filter(n => n.type === "Link" && n.props.className === "card").length, 3);
  assert.ok(many.some(n => n.type === "button" && text(n) === "2"));
});

test("the edited Commercial Type wins over a retained legacy alias", () => {
  const property = { property_type: "sale", property_subtype: "commercial", property_data: { commercialInfo: { type: "Shop", commercialType: "Office" } } };
  const rows = mapping.publicPropertyDetails(property).sections.flatMap(section => section.rows);
  assert.deepEqual(rows, [{ label: "Commercial Type", value: "Office" }]);
});

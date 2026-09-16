const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const vm = require("node:vm");
const { transformSync } = require("next/dist/build/swc");

function harness({ browser = false, stored = null, mobile = false, blocked = false } = {}) {
  const state = [];
  const effects = [];
  const writes = [];
  let cursor = 0;
  let mounted = false;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
      return [state[index], next => { state[index] = typeof next === "function" ? next(state[index]) : next; }];
    },
    useEffect(effect) { if (!mounted) effects.push(effect); },
    useCallback(callback) { return callback; },
  };
  const context = {
    exports: {},
    require: () => react,
    ...(browser ? {
      window: { matchMedia: () => ({ matches: mobile, addEventListener() {}, removeEventListener() {} }) },
      localStorage: {
        getItem() { if (blocked) throw Error("Storage unavailable"); return stored; },
        setItem(key, value) { if (blocked) throw Error("Storage unavailable"); writes.push([key, value]); },
      },
    } : {}),
  };
  const { code } = transformSync(fs.readFileSync(`${__dirname}/useSidebarCollapsed.js`, "utf8"), {
    jsc: { parser: { syntax: "ecmascript" }, target: "es2022" }, module: { type: "commonjs" },
  });
  vm.runInNewContext(code, context);
  return {
    render(key) { cursor = 0; return context.exports.useSidebarCollapsed(key); },
    mount() { mounted = true; effects.splice(0).forEach(effect => effect()); },
    writes,
  };
}

for (const key of ["admin.sidebarCollapsed", "agent.sidebarCollapsed"]) {
  for (const stored of [null, "true", "false"]) {
    test(`${key}: server and first browser render match with preference ${stored}`, () => {
      const server = harness();
      const client = harness({ browser: true, stored });
      assert.equal(server.render(key).collapsed, client.render(key).collapsed);
      assert.equal(client.render(key).collapsed, false);
      assert.deepEqual(client.writes, []);
      client.mount();
      assert.equal(client.render(key).collapsed, stored === "true");
      client.render(key).toggleCollapsed();
      assert.deepEqual(client.writes, [[key, String(stored !== "true")]]);
      client.render(key).toggleCollapsed();
      assert.equal(client.render(key).collapsed, stored === "true");
    });
  }
}

test("mobile drawer state is applied after hydration", () => {
  const client = harness({ browser: true, mobile: true });
  assert.equal(client.render("agent.sidebarCollapsed").collapsed, false);
  client.mount();
  assert.equal(client.render("agent.sidebarCollapsed").collapsed, false);
  assert.equal(client.render("agent.sidebarCollapsed").isMobile, true);
});

test("unavailable storage preserves the default and permits toggling", () => {
  const client = harness({ browser: true, blocked: true });
  client.render("admin.sidebarCollapsed");
  client.mount();
  assert.equal(client.render("admin.sidebarCollapsed").collapsed, false);
  client.render("admin.sidebarCollapsed").toggleCollapsed();
  assert.equal(client.render("admin.sidebarCollapsed").collapsed, true);
});

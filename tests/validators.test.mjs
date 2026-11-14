// node --test tests/*.test.mjs   (no browser or Splunk needed)
import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePayloadForm, validateSetupForm, validateCron, splitList } from "../appserver/static/javascript/views/validators.js";

const OK = {
  message_payload: "RFC1", precedence: "low", my_index: "web", my_sourcetype: "access_combined",
  my_source: "/var/log/a.log, C:\\new\\app.log", my_host: "web01, web*", app_name: "apache",
  environment: "prod", version: "1.0.0",
};

test("valid payload has no errors", () => {
  assert.deepEqual(validatePayloadForm(OK), {});
  assert.deepEqual(validatePayloadForm({ ...OK, version: "" }), {});
});

test("payload rules match the DS", () => {
  const bad = {
    my_source: ["relative.log", "C:\\logs\\", "/x]\n[script://evil]", ""],
    my_host: ["*", "web 01", ""],
    my_index: ["Web", "web index", "web\n[batch:///etc]"],
    my_sourcetype: ["access combined"],
    app_name: ["x/../../apps/pwn", "my app", "_app"],
    environment: ["prod env"],
    message_payload: ["", "a\nb"],
    precedence: ["higher"],
    version: ["v1"],
  };
  for (const [field, values] of Object.entries(bad)) {
    for (const value of values) {
      assert.ok(validatePayloadForm({ ...OK, [field]: value })[field], `${field}=${JSON.stringify(value)}`);
    }
  }
});

test("splitList drops empty items", () => {
  assert.deepEqual(splitList(" a, ,b,"), ["a", "b"]);
});

test("setup form", () => {
  const ok = { ds_host: "ds.example.com", ds_mgmt_port: "8089", ds_token: "abc", serverclass_reload_cron: "" };
  assert.deepEqual(validateSetupForm(ok, false), {});
  assert.deepEqual(validateSetupForm({ ...ok, ds_token: "" }, true), {}, "saved token may be kept");
  assert.ok(validateSetupForm({ ...ok, ds_token: "" }, false).ds_token);
  assert.ok(validateSetupForm({ ...ok, ds_token: "a b" }, false).ds_token);
  for (const host of ["https://ds", "ds:8089/x", "", "ds host"]) {
    assert.ok(validateSetupForm({ ...ok, ds_host: host }, false).ds_host, host);
  }
  for (const port of ["0", "65536", "80a", ""]) {
    assert.ok(validateSetupForm({ ...ok, ds_mgmt_port: port }, false).ds_mgmt_port, port);
  }
});

test("cron", () => {
  for (const good of ["", "*/30 * * * *", "0 1,13 * * 1-5", "300"]) assert.ok(validateCron(good), good);
  for (const bad of ["0", "* * * *", "*/30 * * * * *", "every hour"]) assert.ok(!validateCron(bad), bad);
});

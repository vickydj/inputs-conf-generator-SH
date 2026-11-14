// Form checks for the payload and setup pages.
// The payload rules copy validation_errors() in the DS app (bin/receive_process_payload.py);
// the DS stays the authority, this only gives users the error before they send.
// Each function returns {field: message} for the fields that are wrong (empty object = valid).

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const INDEX_RE = /^[a-z0-9][a-z0-9_-]{0,79}$/;
const SOURCETYPE_RE = /^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,99}$/;
const HOST_RE = /^[A-Za-z0-9*][A-Za-z0-9_.*:-]{0,252}$/;
const VERSION_RE = /^\d{1,4}(\.\d{1,4}){0,3}$/;
const CONTROL_RE = /[\x00-\x1f\x7f]/;
const ABSOLUTE_RE = /^(\/|[A-Za-z]:[\\/]|\\\\)/;
const DS_HOST_RE = /^[A-Za-z0-9.:-]{1,253}$/;
const CRON_FIELD_RE = /^[0-9*\/,-]+$/;

function splitList(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter((item) => item !== "");
}

function validatePayloadForm(form) {
  const errors = {};
  if (!String(form.message_payload || "").trim() || CONTROL_RE.test(form.message_payload)) {
    errors.message_payload = "Required, single line.";
  }
  if (!["low", "normal", "high"].includes(form.precedence)) {
    errors.precedence = "Choose low, normal or high.";
  }
  const patterns = [
    ["my_index", INDEX_RE, "Lowercase letters, digits, _ and - only; no spaces."],
    ["my_sourcetype", SOURCETYPE_RE, "Letters, digits, _ . : - only; no spaces."],
    ["app_name", NAME_RE, "Letters, digits, _ and - only; no spaces; must start with a letter or digit."],
    ["environment", NAME_RE, "Letters, digits, _ and - only; no spaces; must start with a letter or digit."],
  ];
  for (const [field, re, message] of patterns) {
    if (!re.test(String(form[field] || ""))) errors[field] = message;
  }
  if (!VERSION_RE.test(String(form.version || "1.0.0"))) {
    errors.version = "Use numbers and dots, e.g. 1.0.0.";
  }
  const sources = splitList(form.my_source);
  const badSource = sources.find((s) => CONTROL_RE.test(s) || s.endsWith("\\") || !ABSOLUTE_RE.test(s) || s.length > 1024);
  if (!sources.length) {
    errors.my_source = "At least one path is required.";
  } else if (badSource !== undefined) {
    errors.my_source = `"${badSource}" must be an absolute path (/var/log/x.log or C:\\logs\\x.log) not ending in \\.`;
  }
  const hosts = splitList(form.my_host);
  const badHost = hosts.find((h) => !HOST_RE.test(h) || !/[A-Za-z0-9]/.test(h));
  if (!hosts.length) {
    errors.my_host = "At least one host is required.";
  } else if (badHost !== undefined) {
    errors.my_host = `"${badHost}" is not a valid host. Wildcards are allowed (web*) but not on their own.`;
  }
  return errors;
}

function validateCron(value) {
  const text = String(value || "").trim();
  if (text === "") return true; // the default schedule is used
  if (/^\d+$/.test(text)) return Number(text) > 0;
  const fields = text.split(/\s+/);
  return fields.length === 5 && fields.every((f) => CRON_FIELD_RE.test(f));
}

// tokenSaved: a token is already in storage/passwords, so the field may stay empty.
function validateSetupForm(form, tokenSaved) {
  const errors = {};
  const host = String(form.ds_host || "").trim();
  if (!DS_HOST_RE.test(host)) {
    errors.ds_host = "Hostname or IP address only, without https:// or a port.";
  }
  const port = String(form.ds_mgmt_port || "").trim();
  if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    errors.ds_mgmt_port = "A port number between 1 and 65535.";
  }
  const token = String(form.ds_token || "");
  if (token === "" && !tokenSaved) {
    errors.ds_token = "Required.";
  } else if (token !== "" && /\s/.test(token)) {
    errors.ds_token = "The token cannot contain spaces or line breaks.";
  }
  if (!validateCron(form.serverclass_reload_cron)) {
    errors.serverclass_reload_cron = "A 5-field cron expression (*/30 * * * *) or a number of seconds.";
  }
  return errors;
}

export { splitList, validatePayloadForm, validateSetupForm, validateCron };

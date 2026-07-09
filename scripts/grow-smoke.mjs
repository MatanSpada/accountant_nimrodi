/* global console, process */

const args = new Set(process.argv.slice(2));

if (!args.has("--confirm")) {
  console.error(
    "Refusing to run. Use `npm run grow:smoke -- --confirm` after validating sandbox configuration."
  );
  process.exit(1);
}

const mode = (process.env.GROW_MODE || "mock").trim().toLowerCase();

if (mode !== "sandbox") {
  console.error("grow:smoke can run only when GROW_MODE=sandbox.");
  process.exit(1);
}

const requiredKeys = [
  "GROW_USER_ID",
  "GROW_PAGE_CODE",
  "GROW_API_BASE_URL",
  "GROW_SUCCESS_URL",
  "GROW_CANCEL_URL",
  "GROW_NOTIFY_URL"
];

const missingKeys = requiredKeys.filter((key) => !process.env[key]?.trim());

if (missingKeys.length > 0) {
  console.error(
    `Sandbox configuration is incomplete. Missing: ${missingKeys.join(", ")}`
  );
  process.exit(1);
}

console.log("Sandbox configuration looks structurally complete.");
console.log("No network request was sent.");
console.log(
  "This placeholder smoke script stays intentionally safe until verified GROW sandbox credentials and endpoint behavior are available locally."
);

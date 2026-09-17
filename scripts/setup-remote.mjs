/**
 * Point clickpower at a remote ClickHouse: apply the schema, create the read-only
 * user, seed demo data, and optionally push the env vars to a Vercel project.
 *
 * Usage:
 *   node scripts/setup-remote.mjs --url=https://host:8443 --password=... \
 *     [--user=default] [--seed-minutes=1440] [--rate=20] [--vercel] [--no-seed]
 *
 * Safe to re-run: every DDL statement is IF NOT EXISTS.
 */
import { readFile, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { generateRange } from "./lib/generate.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);

const URL_ = args.url ?? process.env.CLICKHOUSE_URL;
const USER = args.user ?? "default";
const PASSWORD = args.password ?? process.env.CLICKHOUSE_PASSWORD ?? "";
const SEED_MINUTES = Number(args["seed-minutes"] ?? 1440);
const SEED_RATE = Number(args.rate ?? 20);
const DO_SEED = args["no-seed"] !== "true";
const DO_VERCEL = args.vercel === "true";
const INIT_DIR = path.resolve("docker/clickhouse/init");

if (!URL_) {
  console.error("Missing --url. Example:\n  node scripts/setup-remote.mjs --url=https://abc.clickhouse.cloud:8443 --password=secret");
  process.exit(1);
}

/** Execute one statement as the admin user. Returns the response body. */
async function exec(sql, { user = USER, password = PASSWORD } = {}) {
  const res = await fetch(URL_, {
    method: "POST",
    headers: { "X-ClickHouse-User": user, "X-ClickHouse-Key": password },
    body: sql,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 400)}`);
  return text;
}

/** Split a .sql file into statements. The init files have no semicolons inside statements. */
function statements(sql) {
  return sql
    .split(";")
    .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);
}

async function applySchema() {
  const files = (await readdir(INIT_DIR)).filter((f) => f.endsWith(".sql")).sort();
  const readerPassword = args["reader-password"] ?? randomBytes(12).toString("base64url");
  let readerCreated = true;

  for (const file of files) {
    const raw = await readFile(path.join(INIT_DIR, file), "utf8");
    // The bundled reader is passwordless for local Docker; remote deployments need a secret.
    const sql = raw.replace(
      "CREATE USER IF NOT EXISTS reader IDENTIFIED WITH no_password",
      `CREATE USER IF NOT EXISTS reader IDENTIFIED WITH sha256_password BY '${readerPassword}'`,
    );
    for (const stmt of statements(sql)) {
      try {
        await exec(stmt);
      } catch (e) {
        const isUserStmt = /CREATE USER|GRANT/i.test(stmt);
        if (isUserStmt) {
          readerCreated = false;
          console.warn(`  skipped (insufficient privileges): ${stmt.split("\n")[0].slice(0, 70)}`);
          continue;
        }
        throw new Error(`${file}: ${e.message}`);
      }
    }
    console.log(`  applied ${file}`);
  }
  return { readerPassword, readerCreated };
}

async function seed() {
  const to = Date.now();
  const from = to - SEED_MINUTES * 60_000;
  const rows = generateRange(from, to, SEED_RATE);
  const CHUNK = 20_000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const body = rows.slice(i, i + CHUNK).map((r) => JSON.stringify(r)).join("\n");
    await exec(`INSERT INTO clickpower.logs FORMAT JSONEachRow\n${body}`);
    process.stderr.write(`\r  seeded ${Math.min(i + CHUNK, rows.length).toLocaleString()} / ${rows.length.toLocaleString()}`);
  }
  process.stderr.write("\n");
  return rows.length;
}

function run(cmd, cmdArgs, input) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, cmdArgs, { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(err || out))));
    if (input !== undefined) p.stdin.write(input);
    p.stdin.end();
  });
}

/** Vercel rejects a duplicate name, so remove before adding to stay idempotent. */
async function setVercelEnv(name, value) {
  for (const env of ["production", "preview"]) {
    await run("vercel", ["env", "rm", name, env, "--yes"]).catch(() => {});
    await run("vercel", ["env", "add", name, env], value);
  }
  console.log(`  set ${name}`);
}

async function main() {
  console.log(`\nClickHouse: ${URL_}`);
  const version = (await exec("SELECT version()")).trim();
  console.log(`connected, version ${version}\n`);

  console.log("applying schema…");
  const { readerPassword, readerCreated } = await applySchema();

  if (DO_SEED) {
    console.log(`\nseeding ${SEED_MINUTES} minutes at ${SEED_RATE}/s…`);
    const n = await seed();
    const count = (await exec("SELECT count() FROM clickpower.logs")).trim();
    console.log(`  inserted ${n.toLocaleString()}, table now holds ${Number(count).toLocaleString()}`);
  }

  let readerUser = readerCreated ? "reader" : USER;
  let readerPw = readerCreated ? readerPassword : PASSWORD;

  // `CREATE USER IF NOT EXISTS` leaves a pre-existing reader untouched, so the
  // generated password may not be the real one. Prove the credentials before printing them.
  if (readerCreated) {
    try {
      await exec("SELECT 1", { user: readerUser, password: readerPw });
      console.log("\nread-only user verified");
    } catch {
      console.warn(
        "\nWARNING: a `reader` user already exists with a different password, so the one\n" +
          "generated here does not apply. Re-run with --reader-password=<the existing one>,\n" +
          "or drop the user first: DROP USER reader",
      );
      readerUser = USER;
      readerPw = PASSWORD;
    }
  }

  if (readerUser === USER) {
    console.warn(
      "\nWARNING: falling back to the admin user for queries. SQL mode is then guarded only\n" +
        "by the app's statement check, not by ClickHouse itself. Fine for a demo, not for shared use.",
    );
  }

  const env = {
    CLICKHOUSE_URL: URL_,
    CLICKHOUSE_WRITER_USER: USER,
    CLICKHOUSE_WRITER_PASSWORD: PASSWORD,
    CLICKHOUSE_READER_USER: readerUser,
    CLICKHOUSE_READER_PASSWORD: readerPw,
  };

  if (DO_VERCEL) {
    console.log("\npushing env vars to Vercel…");
    for (const [k, v] of Object.entries(env)) await setVercelEnv(k, v);
    console.log("\nRedeploy to pick them up:  vercel deploy --prod");
  } else {
    console.log("\nEnv vars for your deployment:\n");
    for (const [k, v] of Object.entries(env)) console.log(`${k}=${v}`);
    console.log("\nRe-run with --vercel to push these to the linked Vercel project.");
  }
}

await main();

/**
 * Load-only check for all repository Pi extensions.
 *
 * Imports each extensions/*.ts factory through the *installed* Pi package's
 * internal extension loader (jiti) and runs the factory against the loader's
 * stub runtime. Registration calls (tools, commands, flags, shortcuts) succeed;
 * action methods throw by design, exactly as they would during real startup
 * before the runner binds the core. No session is started, no UI is created,
 * and no provider/model requests are made.
 *
 * Usage:
 *   bun scripts/check-extension-loads.ts [pi-package-dir]
 *
 * `pi-package-dir` defaults to the global npm installation of
 * @earendil-works/pi-coding-agent (discovered via `npm root -g`). Pass the
 * directory explicitly if Pi is installed somewhere else.
 *
 * NOTE: this relies on the version-specific internal loader at
 * dist/core/extensions/loader.js (verified against Pi 0.87.1). The public
 * package index does not export loadExtensions. If a future Pi release moves
 * that module, update this script. Loading is necessary but NOT sufficient
 * for full functionality: lifecycle handlers, UI, subagents, and networking
 * need separate testing.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Helper modules in extensions/ that are not extension factories. */
const EXCLUDED_FILES = new Set(["themeMap.ts"]);

function fail(message: string): never {
    console.error(message);
    process.exit(2);
}

/** Locate the installed @earendil-works/pi-coding-agent package directory. */
function discoverPiDir(explicit?: string): string {
    const candidates: string[] = [];
    if (explicit) {
        candidates.push(path.resolve(explicit));
    } else {
        const npmRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
        candidates.push(path.join(npmRoot, "@earendil-works", "pi-coding-agent"));
        candidates.push(path.join(npmRoot, "@mariozechner", "pi-coding-agent"));
    }
    for (const dir of candidates) {
        const loader = path.join(dir, "dist", "core", "extensions", "loader.js");
        if (fs.existsSync(loader)) return dir;
    }
    fail(
        `Could not find an installed Pi package with dist/core/extensions/loader.js.\n` +
            `Checked: ${candidates.join(", ")}\n` +
            `Pass the Pi package directory explicitly:\n` +
            `  bun scripts/check-extension-loads.ts <path-to-pi-coding-agent>`,
    );
}

async function main(): Promise<void> {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const piDir = discoverPiDir(process.argv[2]);
    const piVersion = JSON.parse(fs.readFileSync(path.join(piDir, "package.json"), "utf8")).version;

    const extensionsDir = path.join(repoRoot, "extensions");
    const files = fs
        .readdirSync(extensionsDir)
        .filter((f) => f.endsWith(".ts") && !EXCLUDED_FILES.has(f))
        .sort();
    const extPaths = files.map((f) => path.join(extensionsDir, f));

    const loaderUrl = pathToFileURL(
        path.join(piDir, "dist", "core", "extensions", "loader.js"),
    ).href;
    const { loadExtensions } = (await import(loaderUrl)) as {
        loadExtensions: (
            paths: string[],
            cwd: string,
        ) => Promise<{
            extensions: Array<{ path: string }>;
            errors: Array<{ path: string; error: string }>;
        }>;
    };

    const result = await loadExtensions(extPaths, repoRoot);
    const loadedByPath = new Set(result.extensions.map((e) => path.resolve(e.path)));

    console.log(`Pi ${piVersion} at ${piDir}`);
    console.log(`Checking ${files.length} extension factories (load-only, no session):\n`);
    for (const file of files) {
        const abs = path.join(extensionsDir, file);
        if (loadedByPath.has(abs)) {
            console.log(`  OK    ${file}`);
        } else {
            const err = result.errors.find((e) => path.resolve(e.path) === abs);
            console.log(`  FAIL  ${file}`);
            console.log(`        ${err?.error ?? "unknown error"}`);
        }
    }

    const failures = files.length - result.extensions.length;
    console.log(
        `\n${result.extensions.length}/${files.length} extension factories loaded.` +
            (failures > 0 ? ` ${failures} FAILED.` : ""),
    );
    // Exit explicitly: some factories may leave timers/sockets that would
    // otherwise keep the process alive.
    process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error(err);
    process.exit(2);
});

import { resolve, join, extname } from "node:path";
import { rmSync, mkdirSync, cpSync, renameSync, existsSync, readdirSync } from "node:fs";

// Paths
export const root = resolve(import.meta.dir, "..");
export const path = (...segments) => join(root, ...segments);

// File operations using Bun APIs
export const file = (p) => Bun.file(p);
export const exists = (p) => file(p).exists();
export const read = (p) => file(p).text();
export const readJson = async (p) => JSON.parse(await read(p));
export const write = Bun.write;

// Filesystem commands
export const fs = {
  exists: existsSync,
  rm: (p) => rmSync(p, { recursive: true, force: true }),
  mkdir: (p) => mkdirSync(p, { recursive: true }),
  cp: (src, dest) => cpSync(src, dest, { recursive: true }),
  mv: renameSync,
};

// Shell primitives
export const run = (cmd, opts = {}) =>
  Bun.spawnSync(cmd, { stdio: ["inherit", "inherit", "inherit"], ...opts });

export const shell = (cmd, opts = {}) =>
  run(["sh", "--", "-c", cmd], opts);

export const spawn = (cmd, opts = {}) =>
  Bun.spawn(cmd, { stdio: ["inherit", "inherit", "inherit"], ...opts });

// Git commands
export const git = {
  clone: (repo, dest, opts = {}) =>
    run(["git", "clone", "--depth", String(opts.depth || 1), repo, dest]),

  pull: (dir) =>
    run(["git", "--git-dir", join(dir, ".git"), "--work-tree", dir, "pull"]),

  reset: (dir, opts = {}) =>
    run(["git", "--git-dir", join(dir, ".git"), "--work-tree", dir, "reset", opts.hard ? "--hard" : "--soft"]),
};

// Rsync replacement - pure JavaScript implementation
const matchesPattern = (name, pattern) => {
  if (pattern.startsWith("*.")) {
    return name.endsWith(pattern.slice(1));
  }
  if (pattern.includes("*")) {
    const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
    return regex.test(name);
  }
  return name === pattern;
};

const shouldInclude = (name, excludes, includes) => {
  // If includes specified, check if it matches any include pattern
  if (includes && includes.length > 0) {
    const isDir = name.endsWith("/");
    // Directories always pass through when includes specified (to traverse)
    if (isDir && includes.some((p) => p === "*/")) return true;
    return includes.some((p) => matchesPattern(name, p));
  }
  // Otherwise check excludes
  return !excludes.some((p) => matchesPattern(name, p));
};

const copyDirRecursive = (src, dest, opts = {}) => {
  const { exclude = [], include, update = false, deleteExtra = false } = opts;

  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });

  const entries = readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const name = entry.name;
    if (!shouldInclude(name, exclude, include)) continue;

    const srcPath = join(src, name);
    const destPath = join(dest, name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, opts);
    } else {
      // Skip if update mode and dest is newer
      if (update && existsSync(destPath)) {
        const srcStat = Bun.file(srcPath);
        const destStat = Bun.file(destPath);
        if (destStat.lastModified >= srcStat.lastModified) continue;
      }
      cpSync(srcPath, destPath);
    }
  }

  // Delete files in dest that don't exist in src
  if (deleteExtra) {
    const destEntries = readdirSync(dest, { withFileTypes: true });
    for (const entry of destEntries) {
      if (!shouldInclude(entry.name, exclude, include)) continue;
      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);
      if (!existsSync(srcPath)) {
        rmSync(destPath, { recursive: true, force: true });
      }
    }
  }
};

export const rsync = (src, dest, opts = {}) => {
  const srcPath = src.endsWith("/") ? src.slice(0, -1) : src;
  const destPath = dest.endsWith("/") ? dest.slice(0, -1) : dest;

  copyDirRecursive(srcPath, destPath, {
    exclude: opts.exclude || [],
    include: opts.include,
    update: opts.update || false,
    deleteExtra: opts.delete || false,
  });

  return { exitCode: 0 };
};

// Bun commands
export const bun = {
  install: (cwd) => run(["bun", "install"], { cwd }),
  run: (script, cwd) => run(["bun", "run", script], { cwd }),
  test: (cwd) => run(["bun", "test"], { cwd }),
  spawn: (script, cwd) => spawn(["bun", "run", script], { cwd, shell: true }),
};

// Find commands
export const find = {
  deleteByExt: (dir, ext) =>
    shell(`find "${dir}" -type f -name "*${ext}" -delete 2>/dev/null || true`),
};

// Utilities
export const ext = extname;

export const debounce = (fn, ms) => {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};

export const loadEnv = async (p = path(".env")) => {
  if (!(await exists(p))) return;
  (await read(p)).split("\n").forEach((line) => {
    const [key, ...val] = line.split("=");
    if (key && val.length && !process.env[key]) {
      process.env[key] = val.join("=").trim();
    }
  });
};

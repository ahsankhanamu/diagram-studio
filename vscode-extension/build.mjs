#!/usr/bin/env node
/**
 * Build script for Diagram Studio VS Code extension.
 *
 * 1. Builds the SvelteKit app (static adapter → ../build/)
 * 2. Copies the build output into dist/webview/
 * 3. Builds the extension host TS via esbuild
 */
import { execSync } from "child_process";
import { cpSync, rmSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const buildDir = resolve(rootDir, "build");
const webviewDist = resolve(__dirname, "dist", "webview");

console.log("[build] Building SvelteKit app...");
execSync("npm run build", { cwd: rootDir, stdio: "inherit" });

console.log("[build] Copying SvelteKit build to dist/webview...");
rmSync(webviewDist, { recursive: true, force: true });
mkdirSync(webviewDist, { recursive: true });
cpSync(buildDir, webviewDist, { recursive: true });

console.log("[build] Building extension host...");
execSync("node esbuild.mjs", { cwd: __dirname, stdio: "inherit" });

console.log("[build] Done!");

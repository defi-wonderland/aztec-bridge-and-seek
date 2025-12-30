/* eslint-disable no-console */
// Run with: tsx scripts/fetch-aztec-artifacts.ts <release-tag>
// This script fetches pre-compiled artifacts from aztec-standards-testnet-deployment releases
// and stores them in ARTIFACTS_OUTPUT_DIR and TARGET_OUTPUT_DIR
//
// Requirements:
// - GitHub CLI (gh) must be installed and authenticated
// - In GitHub Actions, gh is pre-authenticated with GITHUB_TOKEN
// - Locally, run `gh auth login` first

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// GitHub release repository (private repo, requires gh auth)
const RELEASE_REPO = 'defi-wonderland/aztec-standards-testnet-deployment';
// Output directory for TypeScript artifacts
const ARTIFACTS_OUTPUT_DIR = 'src/artifacts';
// Output directory for JSON target files
const TARGET_OUTPUT_DIR = 'target';

/**
 * Run a command and throw on failure
 */
function run(cmd: string, opts: Record<string, unknown> = {}) {
  const res = spawnSync(cmd, { stdio: 'inherit', shell: true, ...opts });
  if (res.status !== 0) {
    throw new Error(`Command failed (${res.status}): ${cmd}`);
  }
}

/**
 * Check if gh CLI is available and authenticated
 */
function checkGhAuth(): boolean {
  const res = spawnSync('gh auth status', { shell: true, stdio: 'pipe' });
  return res.status === 0;
}

/**
 * Ensure a directory exists
 */
function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

/**
 * Copy files matching a filter from source to destination
 */
function copyFilteredFiles(
  sourceDir: string,
  targetDir: string,
  filter: (filename: string) => boolean,
  forceOverwrite = false
): number {
  if (!fs.existsSync(sourceDir)) {
    console.log(`⚠️ Source directory ${sourceDir} does not exist`);
    return 0;
  }

  ensureDir(targetDir);
  const files = fs.readdirSync(sourceDir);
  let copiedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    if (!filter(file)) {
      continue;
    }

    const srcPath = path.join(sourceDir, file);
    const dstPath = path.join(targetDir, file);

    if (fs.existsSync(dstPath) && !forceOverwrite) {
      console.log(`⏭️ Skipping ${file} (already exists)`);
      skippedCount++;
      continue;
    }

    if (fs.statSync(srcPath).isDirectory()) {
      fs.cpSync(srcPath, dstPath, { recursive: true, force: true });
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
    console.log(`  📄 ${file}`);
    copiedCount++;
  }

  console.log(
    `✅ Copied ${copiedCount} items, skipped ${skippedCount} existing items`
  );
  return copiedCount;
}

async function main() {
  const releaseTag = process.argv[2];
  const forceOverwrite = process.argv.includes('--force');

  if (!releaseTag) {
    console.error('❌ Please provide a release tag as the first argument');
    console.error('Usage: tsx scripts/fetch-aztec-artifacts.ts <release-tag>');
    console.error(
      'Example: tsx scripts/fetch-aztec-artifacts.ts v3.0.0-devnet.20251212-prerelease.1'
    );
    process.exit(1);
  }

  // Check gh authentication
  if (!checkGhAuth()) {
    console.error('❌ GitHub CLI (gh) is not authenticated.');
    console.error('   Run `gh auth login` to authenticate.');
    process.exit(1);
  }

  const userHome = os.homedir();
  const tmp = fs.mkdtempSync(path.join(userHome, '.aztec-artifacts-fetch-'));

  try {
    console.log(`\n📦 Fetching artifacts from ${RELEASE_REPO} @ ${releaseTag}`);
    console.log(`📁 Using temp directory: ${tmp}`);

    // Download artifacts using gh CLI (works with private repos)
    const tarballPattern = 'artifacts-*.tar.gz';
    console.log(`\n⬇️ Downloading ${tarballPattern}...`);
    run(
      `gh release download "${releaseTag}" --repo "${RELEASE_REPO}" --pattern "${tarballPattern}" --dir "${tmp}"`
    );

    // Find the downloaded tarball
    const tarballFiles = fs
      .readdirSync(tmp)
      .filter((f) => f.startsWith('artifacts-') && f.endsWith('.tar.gz'));
    if (tarballFiles.length === 0) {
      throw new Error('No artifacts tarball found after download');
    }
    const tarballPath = path.join(tmp, tarballFiles[0]);
    console.log(`📦 Downloaded: ${tarballFiles[0]}`);

    // Extract the tarball
    console.log(`\n📂 Extracting artifacts...`);
    run(`tar -xzf "${tarballPath}" -C "${tmp}"`);

    // The extracted structure is: artifacts-<tag>/src/artifacts/ and artifacts-<tag>/target/
    const extractedDir = path.join(tmp, `artifacts-${releaseTag}`);

    // Filter: only copy Dripper and Token files
    const artifactFilter = (filename: string) =>
      filename.includes('Dripper') || filename.includes('Token');

    // Copy TypeScript artifacts to src/artifacts
    const sourceArtifactsDir = path.join(extractedDir, 'src', 'artifacts');
    const targetArtifactsDir = path.join(process.cwd(), ARTIFACTS_OUTPUT_DIR);
    console.log(`\n📁 Copying TypeScript artifacts to: ${targetArtifactsDir}`);
    copyFilteredFiles(
      sourceArtifactsDir,
      targetArtifactsDir,
      artifactFilter,
      forceOverwrite
    );

    // Copy JSON target files to target/
    const sourceTargetDir = path.join(extractedDir, 'target');
    const targetTargetDir = path.join(process.cwd(), TARGET_OUTPUT_DIR);
    console.log(`\n📁 Copying JSON artifacts to: ${targetTargetDir}`);
    copyFilteredFiles(
      sourceTargetDir,
      targetTargetDir,
      artifactFilter,
      forceOverwrite
    );

    // Also download deployment-output.json for reference
    console.log(`\n📋 Downloading deployment-output.json...`);
    try {
      run(
        `gh release download "${releaseTag}" --repo "${RELEASE_REPO}" --pattern "deployment-output.json" --dir "${process.cwd()}" --clobber`
      );
      console.log(`✅ Saved deployment info to: deployment-output.json`);
    } catch {
      console.log(`⚠️ Could not download deployment-output.json (optional)`);
    }

    console.log('\n✅ Artifacts fetched successfully!');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('\n❌ Fetch failed:', message);
    process.exit(1);
  } finally {
    // Cleanup temp directory
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

main();

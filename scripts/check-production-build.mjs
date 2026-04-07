import { promises as fs } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const distBrowserDir = path.join(projectRoot, 'dist', 'skillmatch-pro-front', 'browser');
const forbiddenPatterns = [/127\.0\.0\.1:8000/g, /localhost:8000/g];

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else {
      files.push(full);
    }
  }
  return files;
}

async function main() {
  try {
    await fs.access(distBrowserDir);
  } catch {
    console.error(`Production build directory not found: ${distBrowserDir}`);
    process.exit(1);
  }

  const files = await walk(distBrowserDir);
  const textFiles = files.filter((f) => /\.(html|js|json|css)$/i.test(f));
  const mapFiles = files.filter((f) => /\.map$/i.test(f));

  const violations = [];
  for (const file of textFiles) {
    const content = await fs.readFile(file, 'utf8');
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(content)) {
        violations.push(`Forbidden URL pattern "${pattern}" found in ${path.relative(projectRoot, file)}`);
      }
    }
  }

  if (mapFiles.length > 0) {
    violations.push(
      `Source maps found in production build (${mapFiles.length} files). Expected none when sourceMap=false.`,
    );
  }

  if (violations.length > 0) {
    console.error('Production build checks failed:');
    for (const v of violations) {
      console.error(` - ${v}`);
    }
    process.exit(1);
  }

  console.log('Production build checks passed.');
  console.log(` - Scanned files: ${textFiles.length}`);
  console.log(` - No localhost API URLs found`);
  console.log(` - No source maps found`);
}

main().catch((err) => {
  console.error('Failed to run production build checks:', err);
  process.exit(1);
});

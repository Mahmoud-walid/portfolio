/// <reference types="node" />

import { fileURLToPath } from 'url';
import * as fs from 'fs';
import * as path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// usage:
// npx ts-node ./scripts/generate-folder-content.ts ./src/modules

const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build'];

const IGNORE_FILES = ['.env', 'package-lock.json', '.gitignore'];

const MAX_FILE_SIZE = 1024 * 1024 * 2; // 2MB

let processedCount = 0;
function showLoader() {
  process.stdout.write(`\r📦 Processing files: ${processedCount}`);
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach((file: string) => {
    if (IGNORE_DIRS.includes(file)) return;

    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      if (IGNORE_FILES.includes(file)) return;
      if (stat.size > MAX_FILE_SIZE) return;

      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

function createMarkdownContent(files: string[], basePath: string): string {
  return files
    .map((file) => {
      processedCount++;
      showLoader();

      const relativePath = path.relative(basePath, file);

      let content: string;
      try {
        content = fs.readFileSync(file, 'utf-8');
      } catch {
        content = '[Could not read file]';
      }

      return `${relativePath}
\`\`\`
${content}
\`\`\`
-----`;
    })
    .join('\n');
}

// Main
const targetFolder = process.argv[2];

if (!targetFolder) {
  console.error('❌ Please provide a folder path.');
  process.exit(1);
}

const resolvedPath = path.resolve(targetFolder);

if (!fs.existsSync(resolvedPath)) {
  console.error('❌ Folder does not exist.');
  process.exit(1);
}

const allFiles = getAllFiles(resolvedPath);

console.log(`🚀 Found ${allFiles.length} files in folder: ${targetFolder}\n`);

const markdownContent = createMarkdownContent(allFiles, resolvedPath);

const outputPath = path.join(__dirname, `folder-content-${path.basename(resolvedPath)}.md`);

fs.writeFileSync(outputPath, markdownContent, 'utf-8');

console.log(`\n\n✅ Done. Processed ${allFiles.length} files.`);
console.log(`📄 Output: ${outputPath}`);

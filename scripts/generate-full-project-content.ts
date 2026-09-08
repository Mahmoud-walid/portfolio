/// <reference types="node" />

import * as fs from "fs";
import * as path from "path";

const __dirname = path.dirname(process.argv[1] || process.cwd());

// to use the script => `npx ts-node --project tsconfig.node.json scripts/generate-full-project-content.ts` in terminal

const IGNORE_DIRS = [
  "node_modules",
  ".git",
  ".expo",
  ".next",
  "android",
  "public",
  "dist",
  "build",
  "scripts",
  "db",
  "postman-collections",
  "blueprints",
  "assets",
];
const IGNORE_FILES = [
  "full-project-content.md",
  ".env",
  "package-lock.json",
  "eslint.config.mts",
  "tsconfig.json",
  "README.md",
  "nodemon.json",
  ".gitignore",
  ".sentryclirc",
];

const MAX_FILE_SIZE = 1024 * 1024 * 2; // 2MB

// 🎯 Loader
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

      console.log(` => 📄 ${relativePath} \n`);

      let content: string;
      try {
        content = fs.readFileSync(file, "utf-8");
      } catch {
        content = "[Could not read file]";
      }

      return `${relativePath}
\`\`\`
${content}
\`\`\`
-----`;
    })
    .join("\n");
}

// Main
const folderPath = process.argv[2] || "./";

const allFiles = getAllFiles(folderPath);

console.log(`🚀 Found ${allFiles.length} files. Starting...\n`);

const markdownContent = createMarkdownContent(allFiles, folderPath);

const outputPath = path.join(__dirname, "full-project-content.md");

fs.writeFileSync(outputPath, markdownContent, "utf-8");

console.log(`\n\n✅ Done. Processed ${allFiles.length} files.`);
console.log(`📄 Output: ${outputPath}`);

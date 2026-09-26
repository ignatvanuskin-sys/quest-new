#!/usr/bin/env node
/**
 * Поиск невидимых символов, которые ломают переносы слов.
 *
 * Soft hyphen (U+00AD) и zero-width space (U+200B) — самая частая причина
 * того, что слово внезапно разрывается посередине без дефиса: браузер
 * считает такой символ законным местом переноса. Найти их глазами в редакторе
 * невозможно, поэтому проверка автоматическая.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const BAD = {
  0x00ad: "SOFT-HYPHEN",
  0x200b: "ZWSP",
  0x200c: "ZWNJ",
  0x200d: "ZWJ",
  0xfeff: "BOM",
  0x2010: "HYPHEN-U+2010",
  0x2011: "NONBREAK-HYPHEN",
  0x2028: "LINE-SEP",
  0x2029: "PARA-SEP",
  0x00a0: "NBSP(ok-in-kzt)",
};

const SKIP = new Set(["node_modules", ".next", ".git", ".data", ".vercel"]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|css|json|md)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const root = process.cwd();
const files = walk(root);
let problems = 0;

for (const file of files) {
  const src = readFileSync(file, "utf8");
  for (let index = 0; index < src.length; index += 1) {
    const label = BAD[src.codePointAt(index)];
    if (!label || label === "NBSP(ok-in-kzt)") continue;
    const context = src.slice(Math.max(0, index - 45), index + 45).replace(/\n/g, "\\n");
    console.log(`${label}  ${path.relative(root, file)}  …${context}…`);
    problems += 1;
    break; // одного примера на файл достаточно
  }
}

console.log(`\nФайлов с опасными символами: ${problems} из ${files.length} проверенных.`);
process.exit(problems > 0 ? 1 : 0);

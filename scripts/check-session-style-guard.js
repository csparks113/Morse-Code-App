const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const targetRoots = [
  path.join(projectRoot, 'components', 'session'),
  path.join(projectRoot, 'app', 'lessons', '[group]', '[lessonId]'),
  path.join(projectRoot, 'theme', 'sessionStyles.ts'),
];

const spacingProps = [
  'padding',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingVertical',
  'paddingHorizontal',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginVertical',
  'marginHorizontal',
  'gap',
  'rowGap',
  'columnGap',
];

const colorProps = [
  'color',
  'backgroundColor',
  'borderColor',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'shadowColor',
];

const allowedColorLiterals = new Set(['transparent']);
const allowedSpacingNumbers = new Set([0]);

function collectFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const resolved = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(resolved));
    } else if (entry.isFile()) {
      if (/\.(tsx?|jsx?)$/i.test(entry.name)) {
        files.push(resolved);
      }
    }
  }
  return files;
}

function collectTargets(root) {
  if (!fs.existsSync(root)) return [];
  const stat = fs.statSync(root);
  if (stat.isDirectory()) {
    return collectFiles(root);
  }
  if (stat.isFile()) {
    return [root];
  }
  return [];
}

function isInsideBlockComment(source, index) {
  const blockStart = source.lastIndexOf('/*', index);
  if (blockStart === -1) return false;
  const blockEnd = source.lastIndexOf('*/', index);
  return blockEnd < blockStart;
}

function isInsideLineComment(source, index) {
  const lineStart = source.lastIndexOf('\n', index - 1) + 1;
  const line = source.slice(lineStart, index);
  const commentIndex = line.indexOf('//');
  if (commentIndex === -1) return false;
  return commentIndex <= index - lineStart;
}

function positionFor(source, index) {
  const lines = source.slice(0, index).split('\n');
  const line = lines.length;
  const column = lines[lines.length - 1].length + 1;
  return { line, column };
}

function scanSpacing(content, filePath, violations) {
  for (const prop of spacingProps) {
    const regex = new RegExp(`\\b${prop}\\b\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`, 'g');
    let match;
    while ((match = regex.exec(content))) {
      const value = Number(match[1]);
      const index = match.index;
      if (allowedSpacingNumbers.has(value)) continue;
      if (isInsideLineComment(content, index) || isInsideBlockComment(content, index)) {
        continue;
      }
      const { line, column } = positionFor(content, index);
      violations.push({
        filePath,
        line,
        column,
        message: `Hard-coded spacing value ${value} for "${prop}". Use session layout tokens or spacing helpers.`,
      });
    }
  }
}

function scanColors(content, filePath, violations) {
  for (const prop of colorProps) {
    const regex = new RegExp(`\\b${prop}\\b\\s*:\\s*(['\"\`])([^'\"\`]*)\\1`, 'g');
    let match;
    while ((match = regex.exec(content))) {
      const value = match[2].trim();
      const index = match.index;
      if (allowedColorLiterals.has(value.toLowerCase())) continue;
      if (isInsideLineComment(content, index) || isInsideBlockComment(content, index)) {
        continue;
      }
      const { line, column } = positionFor(content, index);
      violations.push({
        filePath,
        line,
        column,
        message: `Hard-coded color literal \"${value}\" for ${prop}. Route through theme tokens.`,
      });
    }
  }
}

const files = targetRoots.flatMap(collectTargets);
const violations = [];

for (const filePath of files) {
  const content = fs.readFileSync(filePath, 'utf8');
  scanSpacing(content, filePath, violations);
  scanColors(content, filePath, violations);
}

if (violations.length > 0) {
  console.error('Session style guard failed:');
  for (const violation of violations) {
    const relative = path.relative(projectRoot, violation.filePath);
    console.error(`  - ${relative}:${violation.line}:${violation.column} ${violation.message}`);
  }
  process.exit(1);
}

console.log('Session style guard passed: no hard-coded spacing or color literals found.');
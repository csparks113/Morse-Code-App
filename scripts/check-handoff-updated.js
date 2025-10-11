#!/usr/bin/env node
const { execSync } = require('child_process');

function getChangedFiles() {
  const results = new Set();
  let statusOutput = '';
  try {
    statusOutput = execSync('git status --porcelain', { encoding: 'utf8' });
  } catch (error) {
    console.error('Failed to read git status. Ensure you are inside the repository.');
    process.exit(2);
  }

  const lines = statusOutput.split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    const status = line.slice(0, 2);
    let filePath = line.slice(3).trim();
    if (!filePath) {
      continue;
    }
    if (status.includes('D')) {
      continue;
    }
    if (status.startsWith('R') || status.startsWith('C')) {
      const arrowIndex = filePath.indexOf('->');
      if (arrowIndex !== -1) {
        filePath = filePath.slice(arrowIndex + 2).trim();
      }
    }
    results.add(filePath.replace(/\\/g, '/'));
  }
  return Array.from(results);
}

function hasNonDocChange(files) {
  return files.some((file) => !file.startsWith('docs/'));
}

function requiresOutputsPlan(files) {
  const outputsPatterns = [
    /^services\/outputs\//,
    /^store\/useOutputs/,
    /^app\/.*outputs/i,
  ];
  return files.some((file) => outputsPatterns.some((pattern) => pattern.test(file)));
}

function main() {
  const changedFiles = getChangedFiles();
  if (changedFiles.length === 0) {
    console.log('No changes detected.');
    process.exit(0);
  }

  const problems = [];

  if (!changedFiles.includes('docs/codex-handoff.md')) {
    problems.push('docs/codex-handoff.md was not updated.');
  }

  if (hasNonDocChange(changedFiles) && !changedFiles.includes('docs/refactor-notes.md')) {
    problems.push('docs/refactor-notes.md must be updated when non-doc files change.');
  }

  if (requiresOutputsPlan(changedFiles) && !changedFiles.includes('docs/outputs-investigation.md')) {
    problems.push('docs/outputs-investigation.md must reflect outputs-related changes.');
  }

  if (problems.length > 0) {
    console.error('Handoff verification failed:\n- ' + problems.join('\n- '));
    console.error('\nUpdate the required documents and run this check again.');
    process.exit(1);
  }

  console.log('Handoff documents look good.');
}

main();

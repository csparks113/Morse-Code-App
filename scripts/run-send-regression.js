#!/usr/bin/env node
/**
 * Send Lesson Regression Harness
 *
 * Guides a tester through the documented regression matrix, logs scenario markers
 * into logcat, and captures high-level notes for later analysis. Intended to run
 * alongside the manual device sweep described in docs/outputs-investigation.md.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');

const scenarios = [
  {
    id: 'S1',
    prompt: 'Expected A (.-)',
    input: 'User taps A correctly',
    wpm: 12,
    note: 'Baseline: confirm banner timing + outputs cut',
  },
  {
    id: 'S2',
    prompt: 'Expected N (-.)',
    input: 'User taps A (.-)',
    wpm: 12,
    note: 'Validate verdict delay + no premature cut-off',
  },
  {
    id: 'S3',
    prompt: 'Expected A (.-)',
    input: 'User taps N (-.)',
    wpm: 12,
    note: 'Confirm buffer restarts when finishing wrong pattern',
  },
  {
    id: 'S4',
    prompt: 'Expected A (.-)',
    input: 'User taps A, then immediate retry',
    wpm: 12,
    note: 'Watch for lingering press state',
  },
  {
    id: 'S5',
    prompt: 'Expected alternating prompts (A, N, R)',
    input: 'User alternates A↔N intentionally',
    wpm: 20,
    note: 'High WPM stress test',
  },
  {
    id: 'S6',
    prompt: 'Expected longer glyphs (K, R, F)',
    input: 'Rapid retries (A twice, N, A)',
    wpm: 20,
    note: 'Ensure classifier tolerances hold at high speed',
  },
  {
    id: 'S7',
    prompt: 'Challenge mode',
    input: 'User intentionally fails hearts',
    wpm: 12,
    note: 'Confirm verdict finalisation + heart decrement + torch off',
  },
  {
    id: 'S8',
    prompt: 'Challenge mode',
    input: 'User answers correctly after reveal',
    wpm: 12,
    note: 'Validate auto-reveal path + outputs',
  },
];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (prompt) =>
  new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer));
  });

function logTag(label, phase) {
  try {
    spawnSync('adb', ['shell', 'log', '-t', 'send-regression', `${label} ${phase}`], {
      stdio: 'ignore',
    });
  } catch (error) {
    console.warn(`⚠️  Failed to tag logcat (${label} ${phase}):`, error.message);
  }
}

function ensureAdbAvailable() {
  try {
    const result = spawnSync('adb', ['version'], { stdio: 'ignore' });
    if (result.error) {
      throw result.error;
    }
  } catch (error) {
    console.warn('⚠️  adb not detected in PATH. Log tagging will be skipped.');
    return false;
  }
  return true;
}

async function main() {
  const adbAvailable = ensureAdbAvailable();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logDir = path.join(__dirname, '..', 'docs', 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  const notesPath = path.join(logDir, `send-regression-notes-${timestamp}.md`);

  const header = `# Send Regression Notes (${new Date().toISOString()})\n\n` +
    `Logcat file: docs/logs/send-regression-${timestamp}.txt (capture separately via adb).\n\n`;
  fs.writeFileSync(notesPath, header);

  console.log('📋 Starting send-lesson regression harness.\n');
  console.log('✨ Notes will be appended to:', notesPath);
  console.log('⚙️  Before you begin, start logcat capture in another shell:');
  console.log('    adb logcat ReactNativeJS:D ReactNative:W *:S ^| findstr /R /C:"keyer\\." /C:"outputs"');
  console.log('    (Stop with Ctrl+C when the sweep is complete.)\n');

  for (const scenario of scenarios) {
    console.log('──────────────────────────────────────────────');
    console.log(`Scenario ${scenario.id}`);
    console.log(` Prompt: ${scenario.prompt}`);
    console.log(` Input:  ${scenario.input}`);
    console.log(` WPM:    ${scenario.wpm}`);
    console.log(` Focus:  ${scenario.note}\n`);

    const startAnswer = await question('Press Enter to log START (or type "skip" to move on): ');
    if (startAnswer.trim().toLowerCase() === 'skip') {
      fs.appendFileSync(
        notesPath,
        `## ${scenario.id}\n- Status: skipped\n\n`,
      );
      console.log(`⏭️  Skipped ${scenario.id}\n`);
      continue;
    }

    const startIso = new Date().toISOString();
    if (adbAvailable) {
      logTag(scenario.id, 'START');
    }
    fs.appendFileSync(
      notesPath,
      `## ${scenario.id}\n- Prompt: ${scenario.prompt}\n- Input: ${scenario.input}\n- WPM: ${scenario.wpm}\n- Started: ${startIso}\n`,
    );

    await question('Run the scenario now. Press Enter once complete...');
    const endIso = new Date().toISOString();
    if (adbAvailable) {
      logTag(scenario.id, 'END');
    }
    const notes = await question('Notes (optional, press Enter to continue): ');

    fs.appendFileSync(
      notesPath,
      `- Finished: ${endIso}\n- Notes: ${notes || 'n/a'}\n\n`,
    );

    console.log(`✅ Logged ${scenario.id} (${endIso})\n`);
  }

  rl.close();
  console.log('🎉 Regression walkthrough complete. Remember to stop logcat and review notes.');
  console.log(`🗒️  Notes saved to ${notesPath}`);
}

main().catch((error) => {
  console.error('Unexpected error while running regression harness:', error);
  rl.close();
  process.exit(1);
});

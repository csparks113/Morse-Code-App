const { spawnSync } = require('child_process');
const { existsSync, readFileSync } = require('fs');
const path = require('path');
const { WarningAggregator, withDangerousMod } = require('expo/config-plugins');

const CODEGEN_SCRIPT = 'nitro:codegen';
let codegenInvoked = false;

function ensureScriptExists(projectRoot) {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (!existsSync(packageJsonPath)) {
    WarningAggregator.addWarningAndroid(
      'withNitroCodegen',
      `Unable to locate package.json at ${packageJsonPath}; skipping Nitro codegen.`,
    );
    return false;
  }

  let packageJson;
  try {
    packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  } catch (error) {
    WarningAggregator.addWarningAndroid(
      'withNitroCodegen',
      `Failed to parse package.json: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }

  if (!packageJson.scripts || !packageJson.scripts[CODEGEN_SCRIPT]) {
    WarningAggregator.addWarningAndroid(
      'withNitroCodegen',
      `Missing ${CODEGEN_SCRIPT} script in package.json; skipping Nitro codegen.`,
    );
    return false;
  }

  return true;
}

function runNitroCodegen(projectRoot) {
  if (codegenInvoked) {
    return;
  }

  if (!ensureScriptExists(projectRoot)) {
    return;
  }

  const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmExecutable, ['run', CODEGEN_SCRIPT], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      FORCE_COLOR: '1',
    },
  });

  if (result.error) {
    WarningAggregator.addWarningAndroid(
      'withNitroCodegen',
      `Failed to execute ${CODEGEN_SCRIPT}: ${result.error.message}`,
    );
    return;
  }

  if (typeof result.status !== 'number' || result.status !== 0) {
    WarningAggregator.addWarningAndroid(
      'withNitroCodegen',
      `Nitro codegen script (${CODEGEN_SCRIPT}) exited with status ${result.status ?? 'unknown'}. Check logs for details.`,
    );
    return;
  }

  codegenInvoked = true;
}

const withNitroCodegen = (config) => {
  if (!config.android) {
    config.android = {};
  }

  if (config.android.newArchEnabled !== true) {
    WarningAggregator.addWarningAndroid(
      'withNitroCodegen',
      'Nitro modules require New Architecture. Set android.newArchEnabled = true and rerun prebuild.',
    );
  }

  config = withDangerousMod(config, ['android', async (modConfig) => {
    runNitroCodegen(modConfig.modRequest.projectRoot);
    return modConfig;
  }]);

  config = withDangerousMod(config, ['ios', async (modConfig) => {
    runNitroCodegen(modConfig.modRequest.projectRoot);
    return modConfig;
  }]);

  return config;
};

module.exports = withNitroCodegen;

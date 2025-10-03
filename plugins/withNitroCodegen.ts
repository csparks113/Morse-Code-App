import { spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { ConfigPlugin, WarningAggregator, withDangerousMod } from 'expo/config-plugins';

const CODEGEN_SCRIPT = 'nitro:codegen';
let codegenInvoked = false;

function ensureScriptExists(projectRoot: string): boolean {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (!existsSync(packageJsonPath)) {
    WarningAggregator.addWarningAndroid(
      'withNitroCodegen',
      `Unable to locate package.json at ${packageJsonPath}; skipping Nitro codegen.`,
    );
    return false;
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    scripts?: Record<string, string>;
  };

  if (!packageJson.scripts || !packageJson.scripts[CODEGEN_SCRIPT]) {
    WarningAggregator.addWarningAndroid(
      'withNitroCodegen',
      `Missing ${CODEGEN_SCRIPT} script in package.json; skipping Nitro codegen.`,
    );
    return false;
  }

  return true;
}

function runNitroCodegen(projectRoot: string) {
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

  if (result.status !== 0) {
    throw new Error(
      `Nitro codegen script (${CODEGEN_SCRIPT}) failed with status ${result.status ?? 'unknown'}.`,
    );
  }

  codegenInvoked = true;
}

const withNitroCodegen: ConfigPlugin = (config) => {
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

export default withNitroCodegen;

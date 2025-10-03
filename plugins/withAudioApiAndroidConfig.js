const { withGradleProperties, createRunOncePlugin } = require('@expo/config-plugins');

const DEFAULT_ANDROID_OVERRIDES = {
  compileSdkVersion: 34,
  targetSdkVersion: 34,
  ndkVersion: '26.1.10909125',
};

function applyGradleProperty(modResults, key, value) {
  const stringValue = String(value);
  const existingIndex = modResults.findIndex((entry) => entry.type === 'property' && entry.key === key);
  if (existingIndex >= 0) {
    modResults[existingIndex].value = stringValue;
  } else {
    modResults.push({ type: 'property', key, value: stringValue });
  }
}

const withAudioApiAndroidConfig = (config, options = {}) => {
  const overrides = {
    ...DEFAULT_ANDROID_OVERRIDES,
    ...(options.android ?? {}),
  };

  return withGradleProperties(config, (mod) => {
    const { modResults } = mod;
    applyGradleProperty(modResults, 'AudioAPI_compileSdkVersion', overrides.compileSdkVersion);
    applyGradleProperty(modResults, 'AudioAPI_targetSdkVersion', overrides.targetSdkVersion);
    applyGradleProperty(modResults, 'AudioAPI_ndkVersion', overrides.ndkVersion);
    return mod;
  });
};

module.exports = createRunOncePlugin(withAudioApiAndroidConfig, 'with-audio-api-android-config', '1.0.0');

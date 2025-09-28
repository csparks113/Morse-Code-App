module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // keep other plugins here if you already use them (e.g., expo-router/babel)
      'react-native-reanimated/plugin', // 👈 must be last
    ],
  };
};
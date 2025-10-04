import type { ConfigContext, ExpoConfig } from 'expo/config';

type PluginToggles = {
  nitroCodegen: boolean;
};

function resolvePluginToggles(): PluginToggles {
  const disableNitro = process.env.EXPO_DISABLE_NITRO_CODEGEN === '1';
  return {
    nitroCodegen: !disableNitro,
  };
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const toggles = resolvePluginToggles();

  config.android = {
    ...(config.android ?? {}),
    newArchEnabled: true,
  };

  const plugins: ExpoConfig['plugins'] = [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#000000',
      },
    ],
    ['react-native-audio-api', {
      iosBackgroundMode: false,
      androidPermissions: [],
      androidForegroundService: false,
    }],
    './plugins/withAudioApiAndroidConfig',
  ];

  if (toggles.nitroCodegen) {
    plugins.push('./plugins/withNitroCodegen');
  }

  const androidConfig: ExpoConfig['android'] = {
    icon: './assets/images/icon.png',
    adaptiveIcon: {
      foregroundImage: './assets/images/icon-foreground.png',
      backgroundColor: '#000000',
    },
    edgeToEdgeEnabled: true,
    package: 'com.csparks113.MorseCodeApp',
    ...config.android,
  };
  (androidConfig as Record<string, unknown>).monochromeImage = './assets/images/icon-foreground.png';
  (androidConfig as Record<string, unknown>).newArchEnabled = true;

  return {
    name: 'Morse Code Master',
    slug: 'Morse-Code-App',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'morsecodeapp',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      ...config.ios,
    },
    android: androidConfig,
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
      ...config.web,
    },
    plugins,
    experiments: {
      typedRoutes: true,
      ...config.experiments,
    },
    extra: {
      router: {},
      eas: {
        projectId: 'de15fd1a-328e-47d0-9d61-15983a555277',
      },
      ...config.extra,
    },
  };
};



import "./scripts/load-env.js";
import type { ExpoConfig } from "expo/config";

const env = {
  appName: "AssetX Mobile",
  appSlug: "assetx-mobile-source",
  logoUrl: "/manus-storage/assetx-mobile-icon_8df7e29b.png",
  scheme: "assetxmobile",
  iosBundleId: "com.assetxenterprise.mobile",
  androidPackage: "com.assetxenterprise.mobile",
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: env.scheme,
  userInterfaceStyle: "light",
  newArchEnabled: true,
  ios: { supportsTablet: false, bundleIdentifier: env.iosBundleId, infoPlist: { ITSAppUsesNonExemptEncryption: false } },
  android: {
    adaptiveIcon: {
      backgroundColor: "#0B2545",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: env.androidPackage,
    permissions: ["POST_NOTIFICATIONS"],
  },
  web: { bundler: "metro", output: "static", favicon: "./assets/images/favicon.png" },
  plugins: [
    "expo-router",
    "expo-sqlite",
    ["expo-secure-store", { configureAndroidBackup: true }],
    ["expo-camera", { cameraPermission: "السماح لتطبيق AssetX Mobile باستخدام الكاميرا لمسح رموز الأصول.", recordAudioAndroid: false }],
    ["expo-splash-screen", { image: "./assets/images/splash-icon.png", imageWidth: 192, resizeMode: "contain", backgroundColor: "#0B2545" }],
    ["expo-build-properties", { android: { buildArchs: ["armeabi-v7a", "arm64-v8a"], minSdkVersion: 24 } }],
  ],
  experiments: { reactCompiler: true },
};

export default config;

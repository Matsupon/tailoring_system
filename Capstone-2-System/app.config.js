export default {
    expo: {
      name: "Customer-Backend",
      slug: "customer-backend",
      version: "1.0.0",
      scheme: "customer-backend",
      orientation: "portrait",
      userInterfaceStyle: "automatic",
      icon: "./assets/images/icon.png",
      splash: {
        image: "./assets/images/splash-icon.png",
        resizeMode: "contain",
        backgroundColor: "#ffffff",
      },
      android: {
        adaptiveIcon: {
          foregroundImage: "./assets/images/adaptive-icon.png",
          backgroundColor: "#ffffff",
        },
        edgeToEdgeEnabled: true,
      },
      web: {
        bundler: "metro",
        output: "static",
        favicon: "./assets/images/favicon.png",
      },
      plugins: [
        "expo-router",
        "expo-font",
        "expo-web-browser",
        [
          "expo-splash-screen",
          {
            image: "./assets/images/splash-icon.png",
            imageWidth: 200,
            resizeMode: "contain",
            backgroundColor: "#ffffff",
          },
        ]
      ],
      experiments: {
        typedRoutes: true
      },
      // ✅ Force Expo Router to use the `app/` folder
      extra: {
        routerRoot: "./app"
      }
    },
  };
  
import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "@/features/assetx/session-context";
export default function RootLayout() { return <SafeAreaProvider><SessionProvider><StatusBar style="light" /><Stack screenOptions={{ headerShown: false, animation: "fade" }}><Stack.Screen name="index" /><Stack.Screen name="login" /><Stack.Screen name="(tabs)" /><Stack.Screen name="inventory/[cycleId]" /><Stack.Screen name="inventory/[cycleId]/record/[recordId]" /><Stack.Screen name="scanner" options={{ presentation: "fullScreenModal" }} /></Stack></SessionProvider></SafeAreaProvider>; }

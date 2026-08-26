import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/components/mobile-ui";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const paddingBottom = Platform.OS === "web" ? 10 : Math.max(9, insets.bottom);
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.blue, tabBarInactiveTintColor: "#64748B", tabBarLabelStyle: { fontWeight: "700", fontSize: 11 }, tabBarStyle: { height: 57 + paddingBottom, paddingTop: 7, paddingBottom, backgroundColor: "#FFFFFF", borderTopColor: "#E2E8F0" } }}>
    <Tabs.Screen name="field" options={{ title: "الميدان", tabBarIcon: ({ color }) => <MaterialIcons name="inventory-2" size={23} color={color} /> }} />
    <Tabs.Screen name="cycles" options={{ title: "الدورات", tabBarIcon: ({ color }) => <MaterialIcons name="assignment" size={23} color={color} /> }} />
    <Tabs.Screen name="sync" options={{ title: "المزامنة", tabBarIcon: ({ color }) => <MaterialIcons name="sync" size={23} color={color} /> }} />
    <Tabs.Screen name="settings" options={{ title: "الإعدادات", tabBarIcon: ({ color }) => <MaterialIcons name="settings" size={23} color={color} /> }} />
    <Tabs.Screen name="index" options={{ href: null }} />
  </Tabs>;
}

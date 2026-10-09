import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { colors } from "@/components/mobile-ui";
import { useSession } from "@/features/assetx/session-context";
export default function IndexRoute() { const { ready, user } = useSession(); if (!ready) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.navy }}><ActivityIndicator color="#FFFFFF" size="large" /></View>; return <Redirect href={user ? "/field" : "/login"} />; }

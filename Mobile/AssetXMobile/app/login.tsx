import { useMemo, useState } from "react";
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";

import { Card, FormInput, colors } from "@/components/mobile-ui";
import { friendlyError } from "@/features/assetx/domain";
import { useSession } from "@/features/assetx/session-context";

export default function LoginScreen() {
  const router = useRouter();
  const { backendUrl, signIn, updateBackendUrl } = useSession();
  const [serverUrl, setServerUrl] = useState(backendUrl ?? "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const looksLikeExpoUrl = /^exp:\/\//i.test(serverUrl.trim());
  const canSubmit = useMemo(() => Boolean(serverUrl.trim() && username.trim() && password && !looksLikeExpoUrl), [serverUrl, username, password, looksLikeExpoUrl]);

  async function handleLogin() {
    if (looksLikeExpoUrl) {
      Alert.alert("رابط غير صحيح", "استخدم رابط Backend الذي يبدأ بـ http:// وينتهي بـ :3001، وليس رابط Expo الذي يبدأ بـ exp://.");
      return;
    }
    setLoading(true);
    try {
      if (serverUrl.trim() !== backendUrl) await updateBackendUrl(serverUrl);
      await signIn(username.trim(), password);
      router.replace("/field");
    } catch (error) {
      Alert.alert("تعذر تسجيل الدخول", friendlyError(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView edges={["top", "left", "right", "bottom"]} style={styles.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboard}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.brand}>
            <Image source={require("../assets/images/icon.png")} style={styles.icon} />
            <Text style={styles.title}>AssetX Mobile</Text>
            <Text style={styles.subtitle}>الجرد الميداني المتصل بمنصة AssetX</Text>
          </View>

          <Card style={styles.card}>
            <Text style={styles.cardTitle}>تسجيل الدخول</Text>
            <Text style={styles.hint}>رابط Backend المحلي يبدأ بـ http:// وينتهي بالمنفذ :3001، ولا تستخدم exp://.</Text>
            <FormInput label="رابط Backend" value={serverUrl} onChangeText={setServerUrl} placeholder="http://192.168.x.x:3001" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
            {looksLikeExpoUrl ? <Text style={styles.urlWarning}>رابط Expo غير صالح هنا. استبدل exp:// بـ http://.</Text> : null}
            <FormInput label="اسم المستخدم" value={username} onChangeText={setUsername} placeholder="اسم المستخدم" autoCapitalize="none" autoCorrect={false} />
            <FormInput label="كلمة المرور" value={password} onChangeText={setPassword} placeholder="كلمة المرور" secureTextEntry returnKeyType="done" onSubmitEditing={() => void handleLogin()} />
          </Card>

          <Pressable accessibilityRole="button" disabled={!canSubmit || loading} onPress={() => void handleLogin()} style={({ pressed }) => [styles.loginButton, (!canSubmit || loading) && styles.loginButtonDisabled, pressed && styles.pressed]}>
            {loading ? <Text style={styles.loginButtonText}>جارٍ الدخول…</Text> : <><MaterialIcons name="login" size={22} color="#FFFFFF" /><Text style={styles.loginButtonText}>دخول آمن</Text></>}
          </Pressable>
          <Text style={styles.security}>لا يحتفظ التطبيق بكلمة المرور. تحفظ رموز الجلسة المشفرة على الجهاز فقط.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page }, keyboard: { flex: 1 }, content: { flexGrow: 1, padding: 20, paddingTop: 26, paddingBottom: 30, gap: 16 },
  brand: { alignItems: "center", gap: 6, marginBottom: 2 }, icon: { width: 74, height: 74, borderRadius: 18 }, title: { color: colors.navy, fontSize: 27, fontWeight: "900" }, subtitle: { color: colors.muted, fontSize: 14, writingDirection: "rtl" },
  card: { gap: 13 }, cardTitle: { textAlign: "right", color: colors.slate, fontSize: 21, fontWeight: "900", writingDirection: "rtl" }, hint: { color: colors.muted, fontSize: 12, lineHeight: 19, textAlign: "right", writingDirection: "rtl" }, urlWarning: { color: colors.red, backgroundColor: colors.redSoft, padding: 10, borderRadius: 10, textAlign: "right", writingDirection: "rtl" },
  loginButton: { minHeight: 56, borderRadius: 15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, paddingHorizontal: 18, backgroundColor: colors.blue }, loginButtonDisabled: { opacity: 0.48 }, loginButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 17, writingDirection: "rtl" }, pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] }, security: { color: colors.muted, textAlign: "center", fontSize: 12, lineHeight: 19, writingDirection: "rtl", marginTop: 2 },
});

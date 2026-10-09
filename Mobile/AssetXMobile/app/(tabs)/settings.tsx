import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppScreen, Card, FormInput, PageHeader, PrimaryButton, SecondaryButton, colors } from "@/components/mobile-ui";
import { clearOfflineInventory } from "@/features/assetx/offline-store";
import { useSession } from "@/features/assetx/session-context";
import { friendlyError } from "@/features/assetx/domain";

export default function SettingsScreen() {
  const router = useRouter(); const { backendUrl, user, updateBackendUrl, signOut } = useSession(); const [url, setUrl] = useState(backendUrl ?? ""); const [saving, setSaving] = useState(false); useEffect(() => setUrl(backendUrl ?? ""), [backendUrl]);
  async function saveConnection() { setSaving(true); try { await updateBackendUrl(url); Alert.alert("تم حفظ الرابط", "لتأمين الحساب، ستسجل الدخول مرة أخرى بعد تغيير الخادم."); router.replace("/login"); } catch (error) { Alert.alert("تعذر حفظ الرابط", friendlyError(error)); } finally { setSaving(false); } }
  async function handleLogout() { await signOut(); router.replace("/login"); }
  function clearOffline() { Alert.alert("مسح بيانات الجرد المحلية", "ستُحذف الدورات والعمليات المحفوظة على هذا الهاتف فقط. استخدم هذا الخيار بعد مزامنة كل النتائج.", [{ text: "إلغاء", style: "cancel" }, { text: "مسح", style: "destructive", onPress: () => void clearOfflineInventory().then(() => Alert.alert("تم المسح", "حُذفت بيانات الجرد المحلية من هذا الهاتف.")) }]); }
  return <AppScreen scroll><PageHeader title="الإعدادات" subtitle="الاتصال والحساب والبيانات المحلية" /><View style={styles.content}><Card style={styles.card}><Text style={styles.title}>اتصال Backend</Text><Text style={styles.description}>ضع رابط Backend المباشر. عند العمل محلياً استخدم IP الكمبيوتر والمنفذ 3001.</Text><FormInput label="رابط Backend" value={url} onChangeText={setUrl} placeholder="http://192.168.x.x:3001" autoCapitalize="none" autoCorrect={false} keyboardType="url" /><PrimaryButton title="حفظ رابط الاتصال" icon="save" loading={saving} onPress={() => void saveConnection()} /></Card><Card style={styles.card}><Text style={styles.title}>الحساب الحالي</Text><Text style={styles.account}>{user ? user.username : "لا يوجد حساب متصل"}</Text><SecondaryButton title="تسجيل الخروج" icon="logout" onPress={() => void handleLogout()} /></Card><Card style={styles.card}><Text style={styles.title}>بيانات الجرد على الهاتف</Text><Text style={styles.description}>لا تستخدم المسح قبل المزامنة، إلا إذا كان العمل انتهى أو تريد إزالة بيانات الاختبار فقط.</Text><PrimaryButton title="مسح البيانات المحلية" icon="delete-outline" tone="red" onPress={clearOffline} /></Card></View></AppScreen>;
}
const styles = StyleSheet.create({ content: { padding: 20, gap: 16 }, card: { gap: 13 }, title: { color: colors.slate, fontSize: 17, fontWeight: "900", textAlign: "right", writingDirection: "rtl" }, description: { color: colors.muted, textAlign: "right", lineHeight: 20, writingDirection: "rtl" }, account: { color: colors.blue, textAlign: "right", fontWeight: "800" } });

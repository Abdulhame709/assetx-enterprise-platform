import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useFocusEffect, useRouter } from "expo-router";
import { AppScreen, EmptyState, PageHeader, StatusBadge, colors } from "@/components/mobile-ui";
import { downloadMobileSnapshot, getCycles } from "@/features/assetx/api";
import { type InventoryCycle, displayCycleStatus, friendlyError } from "@/features/assetx/domain";
import { listStoredSnapshots, saveStoredSnapshot } from "@/features/assetx/offline-store";

export default function CyclesScreen() {
  const router = useRouter();
  const [cycles, setCycles] = useState<InventoryCycle[]>([]);
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set());
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [available, stored] = await Promise.all([getCycles(), listStoredSnapshots()]);
      setCycles(available);
      setDownloaded(new Set(stored.map((snapshot) => snapshot.cycle_id)));
    } catch (error) {
      Alert.alert("تعذر تحميل الدورات", friendlyError(error));
      const stored = await listStoredSnapshots();
      setCycles(stored.map((snapshot) => snapshot.cycle));
      setDownloaded(new Set(stored.map((snapshot) => snapshot.cycle_id)));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  async function downloadCycle(cycle: InventoryCycle) {
    setLoadingId(cycle.id);
    try {
      await saveStoredSnapshot(await downloadMobileSnapshot(cycle.id));
      setDownloaded((current) => new Set([...current, cycle.id]));
      router.push(`/inventory/${cycle.id}`);
    } catch (error) {
      Alert.alert("تعذر تنزيل الدورة", friendlyError(error));
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <AppScreen>
      <PageHeader
        title="الدورات"
        subtitle="نزّل دورة الجرد قبل التوجه إلى الميدان"
        action={<Pressable onPress={() => void refresh()} style={styles.headerIcon}><MaterialIcons name="refresh" size={24} color="#FFFFFF" /></Pressable>}
      />
      <FlatList
        data={cycles}
        contentContainerStyle={styles.list}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={() => void refresh()}
        ListEmptyComponent={<EmptyState icon="assignment" title={loading ? "يجري التحميل" : "لا توجد دورة"} detail="أنشئ دورة جرد من منصة AssetX Web ثم اسحب للتحديث." />}
        renderItem={({ item }) => {
          const saved = downloaded.has(item.id);
          const downloading = loadingId === item.id;
          const blocked = loadingId !== null && !downloading;
          const label = downloading ? "يجري التنزيل..." : saved ? "فتح الدورة" : "تنزيل إلى الهاتف";
          const icon = saved ? "arrow-back" : "download";
          return (
            <View style={styles.row}>
              <StatusBadge label={saved ? "محفوظة محلياً" : displayCycleStatus(item.status)} tone={saved ? "green" : item.status === "in_progress" ? "blue" : "gray"} />
              <Text style={styles.rowTitle}>دورة جرد {item.year}</Text>
              <Text style={styles.rowDetail}>{saved ? "يمكن العمل عليها دون اتصال" : "تحتاج إلى تنزيل لقطة الدورة"}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${label}: دورة جرد ${item.year}`}
                disabled={blocked || downloading}
                onPress={() => saved ? router.push(`/inventory/${item.id}`) : void downloadCycle(item)}
                style={({ pressed }) => [styles.cycleAction, (blocked || downloading) && styles.disabled, pressed && styles.pressed]}
              >
                {downloading ? <ActivityIndicator color="#FFFFFF" /> : <MaterialIcons name={icon} size={21} color="#FFFFFF" />}
                <Text style={styles.cycleActionText}>{label}</Text>
              </Pressable>
            </View>
          );
        }}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  headerIcon: { padding: 8 },
  list: { padding: 20, gap: 13, flexGrow: 1 },
  row: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, gap: 10 },
  rowTitle: { color: colors.slate, fontSize: 19, fontWeight: "900", textAlign: "right", writingDirection: "rtl" },
  rowDetail: { color: colors.muted, textAlign: "right", writingDirection: "rtl" },
  cycleAction: { minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, paddingHorizontal: 18, backgroundColor: colors.blue },
  cycleActionText: { color: "#FFFFFF", fontWeight: "800", fontSize: 16, writingDirection: "rtl" },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
});

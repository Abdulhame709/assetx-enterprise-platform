import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { AssetXUser, AuthTokens } from "./domain";

const BACKEND_URL_KEY = "assetx.backend-url";
const ACCESS_TOKEN_KEY = "assetx.access-token";
const REFRESH_TOKEN_KEY = "assetx.refresh-token";
const USER_KEY = "assetx.user";

async function setSensitive(key: string, value: string) { if (Platform.OS === "web") return AsyncStorage.setItem(key, value); return SecureStore.setItemAsync(key, value); }
async function getSensitive(key: string) { return Platform.OS === "web" ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key); }
async function removeSensitive(key: string) { if (Platform.OS === "web") return AsyncStorage.removeItem(key); return SecureStore.deleteItemAsync(key); }

export function normalizeBackendUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, "");
  let parsed: URL;
  try { parsed = new URL(normalized); } catch { throw new Error("INVALID_BACKEND_URL"); }
  if (!normalized || (parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.pathname !== "/" || parsed.search || parsed.hash) throw new Error("INVALID_BACKEND_URL");
  return normalized;
}
export async function saveBackendUrl(value: string) { const url = normalizeBackendUrl(value); await AsyncStorage.setItem(BACKEND_URL_KEY, url); return url; }
export async function getBackendUrl() { return AsyncStorage.getItem(BACKEND_URL_KEY); }
export async function saveAuth(tokens: AuthTokens, user: AssetXUser) { await Promise.all([setSensitive(ACCESS_TOKEN_KEY, tokens.accessToken), setSensitive(REFRESH_TOKEN_KEY, tokens.refreshToken), AsyncStorage.setItem(USER_KEY, JSON.stringify(user))]); }
export async function getTokens(): Promise<AuthTokens | null> { const [accessToken, refreshToken] = await Promise.all([getSensitive(ACCESS_TOKEN_KEY), getSensitive(REFRESH_TOKEN_KEY)]); return accessToken && refreshToken ? { accessToken, refreshToken } : null; }
export async function getStoredUser(): Promise<AssetXUser | null> { const raw = await AsyncStorage.getItem(USER_KEY); try { const user = raw ? JSON.parse(raw) as AssetXUser : null; return user?.id && user?.username && user?.tenant_id ? user : null; } catch { return null; } }
export async function clearAuth() { await Promise.all([removeSensitive(ACCESS_TOKEN_KEY), removeSensitive(REFRESH_TOKEN_KEY), AsyncStorage.removeItem(USER_KEY)]); }

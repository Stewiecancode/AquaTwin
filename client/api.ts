import { readApiResponse } from "./api-response";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { QueryClient } from "@tanstack/react-query";
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});
export const base = import.meta.env.VITE_API_URL || "";
let token = sessionStorage.getItem("aquatwin-token") || "";
export const firebaseAuth = import.meta.env.VITE_FIREBASE_API_KEY
  ? getAuth(
      initializeApp({
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      }),
    )
  : null;
export async function getToken() {
  return firebaseAuth?.currentUser
    ? firebaseAuth.currentUser.getIdToken()
    : token;
}
export async function api<T = any>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const auth = await getToken();
  const res = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
    },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
  return readApiResponse<T>(res);
}
export async function loginDemo(role: string) {
  const data = await api("/auth/demo", "POST", { role });
  token = data.token;
  sessionStorage.setItem("aquatwin-token", token);
  return data.user;
}
export async function loginFirebase(email: string, password: string) {
  if (!firebaseAuth)
    throw Error("Configure Firebase environment variables first");
  await signInWithEmailAndPassword(firebaseAuth, email, password);
  return api("/auth/me");
}
export async function logout() {
  await api("/auth/logout", "POST").catch(() => {});
  if (firebaseAuth) await signOut(firebaseAuth);
  token = "";
  sessionStorage.removeItem("aquatwin-token");
  queryClient.clear();
}
export async function exportCsv(kind: string, query = "") {
  const response = await fetch(
    `${base}/api/v1/reports/export?kind=${kind}&${query}`,
    { headers: { Authorization: `Bearer ${await getToken()}` } },
  );
  if (!response.ok) throw Error("Export failed or access denied");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = `aquatwin-${kind}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

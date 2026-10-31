import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { applicationDefault, initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { State } from "../shared/domain.js";
import { seed } from "./seed.js";
export const demo = process.env.DEMO_MODE !== "false";
export const firestore = process.env.STORAGE_DRIVER === "firestore";
export function firebaseApp() {
  return (
    getApps()[0] ??
    initializeApp({
      credential: applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID,
    })
  );
}
const directory = resolve(process.env.DATA_DIR || ".data");
const file = resolve(directory, "demo.json");
let previous: Record<string, string> = {};
export let state: State;
export async function initStore() {
  if (!demo && !firestore) throw new Error("Production requires Firestore");
  if (firestore) {
    firebaseApp();
    const base = seed();
    if (!demo) {
      for (const key of Object.keys(base) as (keyof State)[])
        (base[key] as unknown[]) = [];
      base.settings = [
        {
          id: "network",
          flowIncrease: 25,
          pressureDrop: 20,
          name: "Municipal Water Operations",
        },
      ];
    }
    for (const key of Object.keys(base) as (keyof State)[]) {
      const snap = await getFirestore()
        .collection(`${demo ? "demo_" : ""}${key}`)
        .get();
      if (!snap.empty)
        (base[key] as unknown[]) = snap.docs.map((d) => d.data());
    }
    state = base;
  } else {
    await mkdir(directory, { recursive: true });
    try {
      state = JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      state = seed();
    }
  }
  await persist();
}
let queue = Promise.resolve();
export function persist() {
  const snapshot = JSON.stringify(state);
  const operation = queue.then(async () => {
    if (!firestore) {
      await writeFile(`${file}.tmp`, snapshot);
      await rename(`${file}.tmp`, file);
      return;
    }
    const data = JSON.parse(snapshot) as State;
    const next: Record<string, string> = {};
    let batch = getFirestore().batch();
    let count = 0;
    for (const [collection, records] of Object.entries(data))
      for (const record of records) {
        const path = `${demo ? "demo_" : ""}${collection}/${record.id}`;
        const json = JSON.stringify(record);
        next[path] = json;
        if (previous[path] !== json) {
          batch.set(getFirestore().doc(path), record);
          if (++count === 400) {
            await batch.commit();
            batch = getFirestore().batch();
            count = 0;
          }
        }
      }
    for (const path of Object.keys(previous))
      if (!next[path]) {
        batch.delete(getFirestore().doc(path));
        if (++count === 400) {
          await batch.commit();
          batch = getFirestore().batch();
          count = 0;
        }
      }
    if (count) await batch.commit();
    previous = next;
  });
  queue = operation.catch(() => {});
  return operation;
}
export function resetState() {
  state = seed();
}

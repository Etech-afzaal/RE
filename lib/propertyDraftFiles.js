"use client";

const DB_NAME = "dhalahore_property_draft";
const DB_VERSION = 1;
const STORE = "files";

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function finish(tx, db, resolve) {
  tx.oncomplete = () => { db.close(); resolve(); };
  tx.onerror = () => { db.close(); resolve(); };
}

export async function persistDraftFiles({ images = [], videos = [] }) {
  try {
    const db = await openDb();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      store.clear();
      let order = 0;
      for (const item of images) {
        if (item && item.file instanceof Blob) {
          store.put({
            key: "img-" + order,
            kind: "image",
            order,
            name: item.file.name || "image-" + (order + 1),
            type: item.file.type || "",
            category: item.category || "",
            isFeatured: Boolean(item.isFeatured),
            heroDisplay: Boolean(item.heroDisplay),
            blob: item.file,
          });
          order += 1;
        }
      }
      order = 0;
      for (const item of videos) {
        if (item && item.file instanceof Blob) {
          store.put({
            key: "vid-" + order,
            kind: "video",
            order,
            name: item.file.name || "video-" + (order + 1),
            type: item.file.type || "",
            category: item.category || "",
            isFeatured: Boolean(item.isFeatured),
            heroDisplay: false,
            blob: item.file,
          });
          order += 1;
        }
      }
      finish(tx, db, resolve);
    });
  } catch {}
}

function getAll() {
  return openDb().then(
    (db) =>
      new Promise((resolve) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
        tx.oncomplete = () => db.close();
      }),
  );
}

function toFile(rec) {
  if (!rec || !(rec.blob instanceof Blob)) return null;
  return new File([rec.blob], rec.name || "file", { type: rec.type || "" });
}

export async function loadDraftFiles() {
  try {
    const records = await getAll();
    const imgRecords = records
      .filter((r) => r && r.kind === "image")
      .sort((a, b) => a.order - b.order);
    const vidRecords = records
      .filter((r) => r && r.kind === "video")
      .sort((a, b) => a.order - b.order);

    const images = [];
    for (const rec of imgRecords) {
      const file = toFile(rec);
      if (!file) continue;
      images.push({
        file,
        url: URL.createObjectURL(file),
        category: rec.category || "",
        isFeatured: Boolean(rec.isFeatured),
        heroDisplay: Boolean(rec.heroDisplay),
      });
    }
    const videos = [];
    for (const rec of vidRecords) {
      const file = toFile(rec);
      if (!file) continue;
      videos.push({
        file,
        url: URL.createObjectURL(file),
        category: rec.category || "",
        isFeatured: Boolean(rec.isFeatured),
      });
    }
    return { images, videos };
  } catch {
    return { images: [], videos: [] };
  }
}

export async function clearDraftFiles() {
  try {
    const db = await openDb();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      finish(tx, db, resolve);
    });
  } catch {}
}

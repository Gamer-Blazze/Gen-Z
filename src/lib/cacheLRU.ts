// Simple Cache Storage + LRU index (localStorage) for media assets
const CACHE_NAME = "media-cache-v1";
const LRU_KEY = "media-cache-lru";
const MAX_ENTRIES = 200; // keep it simple; bounded by entries not bytes

type LruIndex = Record<string, number>; // url -> lastAccess ts

function readIndex(): LruIndex {
  try {
    const raw = localStorage.getItem(LRU_KEY);
    return raw ? (JSON.parse(raw) as LruIndex) : {};
  } catch {
    return {};
  }
}

function writeIndex(idx: LruIndex) {
  try {
    localStorage.setItem(LRU_KEY, JSON.stringify(idx));
  } catch {
    // best effort
  }
}

async function openCache() {
  return await caches.open(CACHE_NAME);
}

export async function cacheMatch(url: string): Promise<Response | undefined> {
  const cache = await openCache();
  const res = await cache.match(url);
  if (res) touch(url);
  return res || undefined;
}

export async function cachePut(url: string, res: Response) {
  if (!res || !res.ok) return;
  const cache = await openCache();
  await cache.put(url, res.clone());
  touch(url);
  await evictIfNeeded(cache);
}

export async function prefetchToCache(url: string) {
  if (!url) return;
  const existing = await cacheMatch(url);
  if (existing) return;
  try {
    const res = await fetch(url, { cache: "no-store", mode: "cors" });
    if (res.ok) {
      await cachePut(url, res);
    }
  } catch {
    // ignore network errors
  }
}

function touch(url: string) {
  const idx = readIndex();
  idx[url] = Date.now();
  writeIndex(idx);
}

async function evictIfNeeded(cache: Cache) {
  const idx = readIndex();
  const keys = Object.keys(idx);
  if (keys.length <= MAX_ENTRIES) return;
  const sorted = keys
    .map((k) => ({ k, t: idx[k] }))
    .sort((a, b) => a.t - b.t); // oldest first
  const toDelete = sorted.slice(0, keys.length - MAX_ENTRIES);
  for (const { k } of toDelete) {
    await cache.delete(k);
    delete idx[k];
  }
  writeIndex(idx);
}

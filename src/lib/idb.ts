// Simple IndexedDB cache for offline message viewing
const DB_NAME = "ChatCache";
const DB_VERSION = 1;
const CONVERSATIONS_STORE = "conversations";
const MESSAGES_STORE = "messages";

let db: IDBDatabase | null = null;

async function openDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(CONVERSATIONS_STORE)) {
        db.createObjectStore(CONVERSATIONS_STORE, { keyPath: "_id" });
      }
      
      if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
        const messageStore = db.createObjectStore(MESSAGES_STORE, { keyPath: "_id" });
        messageStore.createIndex("conversationId", "conversationId", { unique: false });
      }
    };
  });
}

export async function cacheConversations(conversations: any[]) {
  try {
    const database = await openDB();
    const transaction = database.transaction([CONVERSATIONS_STORE], "readwrite");
    const store = transaction.objectStore(CONVERSATIONS_STORE);
    
    for (const conversation of conversations) {
      await store.put(conversation);
    }
  } catch (error) {
    console.warn("Failed to cache conversations:", error);
  }
}

export async function getCachedConversations(): Promise<any[]> {
  try {
    const database = await openDB();
    const transaction = database.transaction([CONVERSATIONS_STORE], "readonly");
    const store = transaction.objectStore(CONVERSATIONS_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Failed to get cached conversations:", error);
    return [];
  }
}

export async function cacheMessages(conversationId: string, messages: any[]) {
  try {
    const database = await openDB();
    const transaction = database.transaction([MESSAGES_STORE], "readwrite");
    const store = transaction.objectStore(MESSAGES_STORE);
    
    for (const message of messages) {
      await store.put(message);
    }
  } catch (error) {
    console.warn("Failed to cache messages:", error);
  }
}

export async function getCachedMessages(conversationId: string): Promise<any[]> {
  try {
    const database = await openDB();
    const transaction = database.transaction([MESSAGES_STORE], "readonly");
    const store = transaction.objectStore(MESSAGES_STORE);
    const index = store.index("conversationId");
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(conversationId);
      request.onsuccess = () => {
        const messages = request.result || [];
        // Sort by creation time descending
        messages.sort((a, b) => (b._creationTime || 0) - (a._creationTime || 0));
        resolve(messages);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Failed to get cached messages:", error);
    return [];
  }
}

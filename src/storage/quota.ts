import { SettingsSchema } from '../domain/schemas';
import { db } from './db';

export const STORAGE_FULL_EVENT = 'storage-full';
export const storageEvents = new EventTarget();
export const PERSISTENCE_SETTING_KEY = 'storage.persistence';

export function onStorageFull(listener: (event: Event) => void): () => void {
  storageEvents.addEventListener(STORAGE_FULL_EVENT, listener);
  return () => storageEvents.removeEventListener(STORAGE_FULL_EVENT, listener);
}

let persistenceRequest: Promise<boolean> | undefined;

export function isQuotaExceededError(error: unknown): boolean {
  return (
    (typeof DOMException !== 'undefined' &&
      error instanceof DOMException &&
      error.name === 'QuotaExceededError') ||
    (error instanceof Error && error.name === 'QuotaExceededError')
  );
}

export async function withQuotaHandling<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isQuotaExceededError(error)) {
      storageEvents.dispatchEvent(
        new CustomEvent(STORAGE_FULL_EVENT, { detail: error }),
      );
      if (typeof console !== 'undefined')
        console.warn('inkstory storage is full; export or clean up data');
    }
    throw error;
  }
}

/** Requests durable storage at most once, recording the browser result in settings. */
export function requestPersistence(): Promise<boolean> {
  if (persistenceRequest) return persistenceRequest;
  persistenceRequest = (async () => {
    const persist =
      typeof navigator !== 'undefined'
        ? navigator.storage?.persist?.bind(navigator.storage)
        : undefined;
    const persisted = persist ? await persist() : false;
    const setting = SettingsSchema.parse({
      key: PERSISTENCE_SETTING_KEY,
      value: { supported: Boolean(persist), persisted },
    });
    await withQuotaHandling(() => db.settings.put(setting).then(() => setting));
    return persisted;
  })();
  return persistenceRequest;
}

export interface StorageUsage {
  usage: number | null;
  quota: number | null;
}

export async function getUsage(): Promise<StorageUsage> {
  const estimate =
    typeof navigator !== 'undefined'
      ? await navigator.storage?.estimate?.()
      : undefined;
  return { usage: estimate?.usage ?? null, quota: estimate?.quota ?? null };
}

export function resetPersistenceRequestForTests(): void {
  persistenceRequest = undefined;
}

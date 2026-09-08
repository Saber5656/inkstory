import { useSyncExternalStore } from 'react';
import { settingsRepo } from '@/storage/repos/settings';
const key = 'inkstory.reducedMotion';
const changed = 'inkstory-motion-preference';
function read(): boolean | undefined {
  const value = localStorage.getItem(key);
  return value === 'true' ? true : value === 'false' ? false : undefined;
}
function subscribe(listener: () => void) {
  window.addEventListener(changed, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(changed, listener);
    window.removeEventListener('storage', listener);
  };
}
export function useMotionPreference() {
  return useSyncExternalStore(subscribe, read);
}
export async function setMotionPreference(value: boolean | undefined) {
  await settingsRepo.set('reducedMotion', value ?? 'system');
  if (value === undefined) localStorage.removeItem(key);
  else localStorage.setItem(key, String(value));
  window.dispatchEvent(new Event(changed));
}

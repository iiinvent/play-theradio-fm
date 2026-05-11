'use client'

import { useEffect } from 'react'
import { theradioSetItem } from '@/lib/theradio-shared-kv'

const THEME_STORAGE_KEY = 'theradio-player-theme'

/**
 * Mirrors next-themes persistence (hardcoded localStorage in next-themes) into the
 * shared *.theradio.fm cookie bag so play/browser/podcasts/tubeflix stay aligned.
 */
export function TheradioPlayStorageBridge() {
  useEffect(() => {
    const storage = window.localStorage
    const orig = storage.setItem.bind(storage)
    storage.setItem = function patchedSetItem(key: string, value: string) {
      orig(key, value)
      if (key === THEME_STORAGE_KEY) {
        theradioSetItem(THEME_STORAGE_KEY, value)
      }
    }
    return () => {
      storage.setItem = orig
    }
  }, [])
  return null
}

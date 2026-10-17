// src/store/settingsStore.js
import { create } from 'zustand'

export const useSettingsStore = create((set) => ({
  storeName: 'Osmar',
  settings:  {},

  loadSettings: async () => {
    try {
      const res = await window.electronAPI.settings.getAll()
      if (res.ok) {
        set({
          settings:  res.data,
          storeName: res.data.store_name || 'Osmar'
        })
      }
    } catch (e) {
      console.error('[settingsStore]', e)
    }
  },

  setSetting: async (key, value) => {
    await window.electronAPI.settings.set({ key, value })
    set(s => ({
      settings:  { ...s.settings, [key]: value },
      storeName: key === 'store_name' ? value : s.storeName,
    }))
  },
}))

// Tema de la aplicación: 'dark' por defecto, persistido en localStorage (funciona en Electron).
const KEY = 'osmar-theme'

export function getTheme() {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
}

export function setTheme(theme) {
  try { localStorage.setItem(KEY, theme) } catch { /* sin persistencia: el tema sigue aplicándose */ }
  applyTheme(theme)
}

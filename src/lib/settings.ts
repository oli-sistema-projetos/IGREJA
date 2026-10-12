export type AppSettings = {
  supabaseUrl: string
  supabaseAnonKey: string
}

const SETTINGS_KEY = 'culto-app-settings'

export function readSettings(): AppSettings {
  const saved = localStorage.getItem(SETTINGS_KEY)
  let parsed: Partial<AppSettings> = {}

  if (saved) {
    try {
      parsed = JSON.parse(saved) as Partial<AppSettings>
    } catch (error) {
      console.error('Não foi possível ler as configurações salvas.', error)
    }
  }

  return {
    supabaseUrl: parsed.supabaseUrl ?? import.meta.env.VITE_SUPABASE_URL ?? '',
    supabaseAnonKey:
      parsed.supabaseAnonKey ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  }
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

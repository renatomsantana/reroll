import { useSettings } from '@renderer/settings/SettingsContext'
import { translations, type TranslationDict } from './translations'

export function useTranslation(): TranslationDict {
  const { language } = useSettings()
  return translations[language]
}

export const LANGUAGE_OPTIONS = [
  { id: 'pt-BR', label: 'Português (BR)' },
  { id: 'en-US', label: 'English (US)' }
] as const

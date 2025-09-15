import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export function useLanguage() {
  const { i18n } = useTranslation()

  useEffect(() => {
    // Update HTML lang attribute when language changes
    document.documentElement.lang = i18n.language
    
    // Update page title based on language
    const title = i18n.language === 'nl' 
      ? 'Koi Sensei - Waterkwaliteit & Visverzorging Tracker'
      : 'Koi Sensei - Water Quality & Fish Care Tracker'
    
    document.title = title
  }, [i18n.language])

  return i18n.language
}

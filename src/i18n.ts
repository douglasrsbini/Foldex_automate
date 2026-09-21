import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ptBR from './locales/pt-br.json';
import ptPT from './locales/pt-pt.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'pt-BR': { translation: ptBR },
      'pt-PT': { translation: ptPT },
      en: { translation: en },
      es: { translation: es },
      fr: { translation: fr },
    },
    fallbackLng: 'pt-BR',
    
    //Configuração Mágica do Detector
    detection: {
      // 1. Ordem de prioridade: primeiro olha o localStorage, depois o idioma do Windows
      order: ['localStorage', 'navigator'],
      
      // 2. Onde ele deve salvar a escolha do usuário
      caches: ['localStorage'],
      
      // 3. O nome da chave que vai ficar gravada no navegador do Tauri
      lookupLocalStorage: 'foldex_language',
    },
    
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ja from './ja.json';
import en from './en.json';
const saved = localStorage.getItem('inkstory.locale');
const locale =
  saved === 'en' || saved === 'ja'
    ? saved
    : navigator.language.startsWith('en')
      ? 'en'
      : 'ja';
void i18n.use(initReactI18next).init({
  resources: { ja: { translation: ja }, en: { translation: en } },
  lng: locale,
  fallbackLng: 'ja',
  interpolation: { escapeValue: false },
});
i18n.on('languageChanged', (language) => {
  document.documentElement.lang = language;
  localStorage.setItem('inkstory.locale', language);
});
document.documentElement.lang = locale;
export default i18n;

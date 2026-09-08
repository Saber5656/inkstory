import { useTranslation } from 'react-i18next';
export default function About() {
  const { t } = useTranslation();
  return (
    <main className="narrow">
      <h1>{t('about')}</h1>
      <section className="paper">
        <h2>{t('privacy')}</h2>
        <p>{t('privacyBody')}</p>
      </section>
      <section className="paper">
        <h2>{t('licenses')}</h2>
        <p>{t('appName')}</p>
        <a
          href="https://github.com/Saber5656/inkstory/blob/main/LICENSE"
          rel="noreferrer"
        >
          {t('licenses')}
        </a>
      </section>
    </main>
  );
}

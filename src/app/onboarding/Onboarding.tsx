import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from './Onboarding.module.css';

export function Onboarding({
  sampleBookId,
  onDismiss,
  onWatchSample,
}: {
  sampleBookId?: string;
  onDismiss: () => void;
  onWatchSample: () => void;
}) {
  const { t } = useTranslation();
  return (
    <aside className={styles.root} aria-labelledby="onboarding-title">
      <div className={styles.heading}>
        <div>
          <h2 id="onboarding-title">{t('welcome')}</h2>
          <p>{t('welcomeBody')}</p>
        </div>
        <button
          className={styles.close}
          aria-label={t('close')}
          onClick={onDismiss}
        >
          ×
        </button>
      </div>
      <div className={styles.cards}>
        <article className={styles.card}>
          <span className={styles.number} aria-hidden="true">
            1
          </span>
          <h3>{t('onboardingSampleTitle')}</h3>
          <p>{t('onboardingSampleBody')}</p>
          <button className="primary" onClick={onWatchSample}>
            {t('trySample')}
          </button>
        </article>
        <article className={styles.card}>
          <span className={styles.number} aria-hidden="true">
            2
          </span>
          <h3>{t('onboardingMakeOwnTitle')}</h3>
          <p>{t('onboardingMakeOwnBody')}</p>
          <Link
            className={styles.action}
            to="/characters/new"
            onClick={onDismiss}
          >
            {t('onboardingMakeOwnAction')}
          </Link>
        </article>
        <article className={styles.card}>
          <span className={styles.number} aria-hidden="true">
            3
          </span>
          <h3>{t('onboardingVoiceTitle')}</h3>
          <p>{t('onboardingVoiceBody')}</p>
          {sampleBookId && (
            <Link
              className={styles.action}
              to={`/books/${sampleBookId}/edit`}
              onClick={onDismiss}
            >
              {t('onboardingVoiceAction')}
            </Link>
          )}
        </article>
      </div>
    </aside>
  );
}

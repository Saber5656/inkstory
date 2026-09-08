import { Component, type ErrorInfo, type ReactNode } from 'react';
import i18n from '@/i18n/setup';
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="empty">
        <h1>{i18n.t('error')}</h1>
        <button onClick={() => location.reload()}>{i18n.t('reload')}</button>
        <button
          onClick={() => {
            void navigator.clipboard
              .writeText(this.state.error?.message ?? '')
              .catch(console.warn);
          }}
        >
          {i18n.t('copyError')}
        </button>
      </main>
    );
  }
}

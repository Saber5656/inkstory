import { useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Shell } from './Shell';
import { ErrorBoundary } from './ErrorBoundary';
export function App() {
  const [router] = useState(() =>
    createBrowserRouter([{ path: '*', element: <Shell /> }], {
      basename: import.meta.env.BASE_URL,
      future: { v7_relativeSplatPath: true },
    }),
  );
  return (
    <ErrorBoundary>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </ErrorBoundary>
  );
}

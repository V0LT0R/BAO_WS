import React, { Component, useState } from 'react';
import { SiteProvider } from './components/SiteContext.jsx';
import { PublicLayout } from './components/Layout.jsx';
import PublicPage from './public/PublicPage.jsx';
import { LoginPage, AuthGate, useSession } from './admin/Auth.jsx';
import { AdminPage, UserPage } from './admin/AdminPage.jsx';
import { api } from './lib/api.js';
import { FormFeedback } from './admin/FormFeedback.jsx';

class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="container py-5"><h1>The page could not be displayed</h1><p>Please reload the page or return to the home page.</p><a href="/index.html">Home</a></main>;
    return this.props.children;
  }
}

function AccountPage({ page }) {
  const session = useSession();
  const [error, setError] = useState('');
  async function logout() {
    try {
      await api('/api/user/logout', { method: 'POST' });
      window.location.assign('/index.html');
    } catch (err) { setError(err.message); }
  }
  return <PublicLayout page={page} user={session.user} onLogout={logout}>
    {error && <div className="container"><FormFeedback error={error} /></div>}
    {page === 'login' ? <LoginPage session={session} /> : <AuthGate session={session} admin={page === 'admin'}>
      {page === 'admin' ? <AdminPage session={session} /> : <UserPage session={session} />}
    </AuthGate>}
  </PublicLayout>;
}

export default function App({ page = 'index' }) {
  return <ErrorBoundary><SiteProvider>
    {['admin', 'user', 'login'].includes(page) ? <AccountPage page={page} /> : <PublicLayout page={page}><PublicPage page={page} /></PublicLayout>}
  </SiteProvider></ErrorBoundary>;
}

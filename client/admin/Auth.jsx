import React, { useEffect, useState } from 'react';
import { api, getSession } from '../lib/api.js';
import { FormFeedback } from './FormFeedback.jsx';

export function useSession() {
  const [state, setState] = useState({ loading: true, user: null, error: '' });
  useEffect(() => {
    let active = true;
    // Retire the old bearer token; authentication now lives in an HttpOnly cookie.
    try { localStorage.removeItem('jwtToken'); } catch { /* Storage may be disabled. */ }
    getSession().then(({ user }) => {
      if (active) setState({ loading: false, user, error: '' });
    }).catch(error => {
      if (active) setState({ loading: false, user: null, error: error.message });
    });
    return () => { active = false; };
  }, []);
  return { ...state, setUser: user => setState({ loading: false, user, error: '' }) };
}

export function LoginPage({ session }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (session.user) window.location.replace(session.user.role === 'admin' ? '/admin.html' : '/user.html');
  }, [session.user]);
  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      const { user } = await api('/api/user/login', { method: 'POST', body: {
        username: form.get('username'), password: form.get('password'),
      } });
      session.setUser(user);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <header className="container-fluid block-1-bg" style={{ minHeight: 600 }}>
    <div className="container block-1 d-flex justify-content-center">
      <div className="row d-flex justify-content-center mt-5 w-100">
        <form className="col-12 col-sm-8 col-lg-6" onSubmit={submit} aria-busy={busy}>
          <h1 className="display-4 mt-5"><strong>Sign in</strong></h1>
          <div className="form-floating my-5">
            <input required type="text" className="form-control" id="loginUsername" name="username" autoComplete="username" placeholder="Username" maxLength={256} />
            <label htmlFor="loginUsername">Username</label>
          </div>
          <div className="form-floating my-5">
            <input required type="password" className="form-control" id="loginPassword" name="password" autoComplete="current-password" placeholder="Password" maxLength={72} />
            <label htmlFor="loginPassword">Password</label>
          </div>
          <button disabled={busy || session.loading} className="btn btn-secondary w-100 p-3">{busy ? 'Signing in…' : 'Sign in'}</button>
          <FormFeedback error={error || session.error} />
        </form>
      </div>
    </div>
  </header>;
}

export function AuthGate({ session, admin = false, children }) {
  useEffect(() => {
    if (session.loading || session.error) return;
    if (!session.user) window.location.replace('/login.html');
    else if (admin && session.user.role !== 'admin') window.location.replace('/user.html');
  }, [session.loading, session.error, session.user, admin]);
  if (session.error) return <main className="container py-5"><FormFeedback error={session.error} /><a href="/login.html">Back to sign in</a></main>;
  if (session.loading || !session.user || (admin && session.user.role !== 'admin')) {
    return <main className="container py-5" role="status">Checking your session…</main>;
  }
  return children;
}

export function ProfileForm({ user, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function submit(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const body = { currentPassword: form.get('currentPassword') };
    if (form.get('username') !== user.username) body.username = form.get('username');
    if (form.get('newPassword')) body.newPassword = form.get('newPassword');
    if (body.username === undefined && body.newPassword === undefined) { setMessage('No account changes to save.'); return; }
    if (body.newPassword && new TextEncoder().encode(body.newPassword).length > 72) { setError('Password must be at most 72 UTF-8 bytes.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const data = await api(`/api/user/${user._id}`, { method: 'PUT', body });
      onUpdate(data.user); element.reset(); setEditing(false); setMessage('Account updated.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <div className="container block-1 block-1-user" id="user_edit">
    <div className="row row-cols-1 w-100">
      <div className="col mt-5"><h1>Welcome, {user.username}!</h1></div>
      <div className="col mt-1"><button type="button" className="btn btn-light mb-2 border" onClick={() => setEditing(!editing)} aria-expanded={editing}><strong>{editing ? 'Cancel editing' : 'Edit user'}</strong></button></div>
      {editing && <form onSubmit={submit} className="col mb-4" aria-label="Edit account">
        <div className="mb-3"><label className="form-label" htmlFor="profile-name">Username</label><input id="profile-name" name="username" className="form-control" required minLength={3} maxLength={64} defaultValue={user.username} autoComplete="username" /></div>
        <div className="mb-3"><label className="form-label" htmlFor="profile-current">Current password</label><input id="profile-current" name="currentPassword" className="form-control" required type="password" maxLength={72} autoComplete="current-password" /></div>
        <div className="mb-3"><label className="form-label" htmlFor="profile-new">New password (leave blank to keep current)</label><input id="profile-new" name="newPassword" className="form-control" type="password" minLength={12} maxLength={72} autoComplete="new-password" /></div>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save account'}</button>
      </form>}
      <FormFeedback error={error} message={message} />
    </div>
  </div>;
}

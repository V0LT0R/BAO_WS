import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { ProfileForm } from './Auth.jsx';
import { FormFeedback } from './FormFeedback.jsx';
import { ResourceManager, resources } from './ResourceManager.jsx';

function UserManager({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [deleting, setDeleting] = useState(null);
  async function reload() {
    try { setUsers(await api('/api/user/users')); }
    catch (err) { setError(err.message); }
  }
  useEffect(() => { reload(); }, []);
  async function register(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const password = form.get('password');
    if (new TextEncoder().encode(password).length > 72) { setError('Password must be at most 72 UTF-8 bytes.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      await api('/api/user/register', { method: 'POST', body: { username: form.get('username'), password, role: form.get('role') } });
      element.reset(); setMessage('User registered.'); await reload();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function remove(id) {
    setBusy(true); setError(''); setMessage('');
    try { await api(`/api/user/${id}`, { method: 'DELETE' }); setDeleting(null); setMessage('User deleted.'); await reload(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <section aria-label="User management" className="container mb-5">
    <form onSubmit={register} className="mb-4 border p-3 rounded" aria-label="Register new user">
      <h3>Register New User</h3>
      <div className="row mt-4 g-3">
        <div className="col-md-4"><label htmlFor="newUsername" className="form-label">Username</label><input className="form-control" name="username" id="newUsername" required minLength={3} maxLength={64} autoComplete="off" /></div>
        <div className="col-md-4"><label htmlFor="newPassword" className="form-label">Password</label><input className="form-control" name="password" id="newPassword" type="password" required minLength={12} maxLength={72} autoComplete="new-password" aria-describedby="password-help" /><small id="password-help">At least 12 characters; up to 72 UTF-8 bytes.</small></div>
        <div className="col-md-4"><label htmlFor="newRole" className="form-label">User role</label><select className="form-select" name="role" id="newRole" defaultValue="user"><option value="user">User (own account only)</option><option value="admin">Administrator (manage site content)</option></select></div>
      </div>
      <button className="btn btn-primary mt-3" disabled={busy}>{busy ? 'Saving…' : 'Register User'}</button>
      <FormFeedback error={error} message={message} />
    </form>
    <div className="row"><h2 className="col-6">Username</h2><h2 className="col-6">Role</h2></div>
    {users.map(user => <div className="row align-items-center border-bottom py-3" key={user._id}>
      <div className="col-6">{user.username}</div>
      <div className="col-3">{user.role}</div>
      <div className="col-3">{user._id !== currentUser._id && user.role !== 'admin' && <button className="btn btn-light border" disabled={busy} onClick={() => setDeleting(user._id)}>Delete user</button>}</div>
      {deleting === user._id && <div className="col-12 mt-2" role="group" aria-label="Confirm user deletion"><p>Delete the account “{user.username}”? This cannot be undone.</p><button className="btn btn-danger me-2" disabled={busy} onClick={() => remove(user._id)}>Confirm delete</button><button className="btn btn-secondary" disabled={busy} onClick={() => setDeleting(null)}>Cancel</button></div>}
    </div>)}
  </section>;
}

export function AdminPage({ session }) {
  return <div className="container-fluid block-1-bg" style={{ minHeight: 750, paddingTop: 50 }}>
    <ProfileForm user={session.user} onUpdate={session.setUser} />
    <UserManager currentUser={session.user} />
    {resources.map(resource => <ResourceManager key={resource.path} resource={resource} />)}
  </div>;
}

export function UserPage({ session }) {
  return <div className="container-fluid block-1-bg" style={{ minHeight: 750, paddingTop: 50 }}>
    <ProfileForm user={session.user} onUpdate={session.setUser} />
  </div>;
}

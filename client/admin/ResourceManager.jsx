import React, { useEffect, useId, useRef, useState } from 'react';
import { api, safeImageUrl } from '../lib/api.js';
import { FormFeedback } from './FormFeedback.jsx';

const contentFields = [
  { name: 'descriptionEn', label: 'Description (English)', max: 20000, rows: 3 },
  { name: 'descriptionUa', label: 'Description (Ukrainian)', max: 20000, rows: 3 },
];
export const resources = [
  { path: 'experience', label: 'Experience', fields: [{ name: 'year', label: 'Year', max: 80 }, ...contentFields] },
  { path: 'activities', label: 'Activity', fields: [{ name: 'year', label: 'Year', max: 80 }, ...contentFields] },
  { path: 'projects', label: 'Project', image: true, fields: [{ name: 'titleEn', label: 'Title (English)', max: 500 }, { name: 'titleUa', label: 'Title (Ukrainian)', max: 500 }, ...contentFields] },
  { path: 'certificates', label: 'Certificate', image: true, imageRequired: true, fields: [{ name: 'date', label: 'Date of Issue', max: 80 }, ...contentFields] },
];

export function ResourceManager({ resource }) {
  const { path, label, fields } = resource;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [values, setValues] = useState({});
  const formRef = useRef(null);
  const imageRef = useRef(null);
  const id = useId();

  async function reload() {
    setLoadError(''); setLoading(true);
    try { setItems(await api(`/api/${path}`)); }
    catch (err) { setLoadError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, [path]);

  function cancel() {
    setEditing(null); setValues({}); setError('');
    if (imageRef.current) imageRef.current.value = '';
  }
  function edit(item) {
    setValues(Object.fromEntries(fields.map(field => [field.name, item[field.name] || ''])));
    setEditing(item); setError(''); setMessage(''); setPendingDelete(null);
    if (imageRef.current) imageRef.current.value = '';
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function submit(event) {
    event.preventDefault();
    setError(''); setMessage('');
    const image = imageRef.current?.files?.[0];
    if (image && (image.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(image.type))) {
      setError('Choose a JPEG, PNG or WebP image no larger than 5 MB.'); return;
    }
    if (resource.imageRequired && !editing && !image) { setError('Choose a certificate image.'); return; }
    const body = resource.image ? new FormData() : {};
    for (const field of fields) {
      if (resource.image) body.append(field.name, values[field.name] || '');
      else body[field.name] = values[field.name] || '';
    }
    if (image) body.append('image', image);
    setBusy(true);
    try {
      await api(`/api/${path}${editing ? `/${editing._id}` : ''}`, { method: editing ? 'PUT' : 'POST', body });
      const action = editing ? 'updated' : 'added';
      cancel(); setMessage(`${label} ${action}.`); await reload();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function remove(item) {
    setError(''); setMessage(''); setBusy(true);
    try {
      await api(`/api/${path}/${item._id}`, { method: 'DELETE' });
      if (editing?._id === item._id) cancel();
      setPendingDelete(null); setMessage(`${label} deleted.`); await reload();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <section aria-label={`${label} management`}>
    <form ref={formRef} onSubmit={submit} className="mb-5 border p-3 rounded container" aria-label={`${editing ? 'Edit' : 'Add'} ${label}`} aria-busy={busy}>
      <h3>{editing ? 'Edit' : 'Add New'} {label}</h3>
      {fields.map(field => <div className="mb-3" key={field.name}>
        <label className="form-label" htmlFor={`${id}-${field.name}`}>{field.label}</label>
        <textarea id={`${id}-${field.name}`} name={field.name} className="form-control" rows={field.rows || 1} required maxLength={field.max} value={values[field.name] || ''} onChange={event => setValues({ ...values, [field.name]: event.target.value })} />
      </div>)}
      {resource.image && <div className="mb-3">
        <label className="form-label" htmlFor={`${id}-image`}>{label} Image{editing ? ' (leave empty to keep current)' : resource.imageRequired ? '' : ' (optional)'}</label>
        <input ref={imageRef} id={`${id}-image`} name="image" className="form-control" type="file" accept="image/png,image/jpeg,image/webp" required={resource.imageRequired && !editing} aria-describedby={`${id}-image-help`} />
        <small id={`${id}-image-help`}>JPEG, PNG or WebP, up to 5 MB.</small>
        {editing && safeImageUrl(editing.imageUrl, path) && <div className="mt-2"><img src={safeImageUrl(editing.imageUrl, path)} alt={`Current ${label.toLowerCase()}`} style={{ maxHeight: 100, maxWidth: '100%' }} /></div>}
      </div>}
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : `${editing ? 'Update' : 'Add'} ${label}`}</button>
      {editing && <button type="button" className="btn btn-secondary ms-2" onClick={cancel} disabled={busy}>Cancel</button>}
      <FormFeedback error={error} message={message} />
    </form>
    <div className="container mt-5">
      {loading && <p role="status">Loading…</p>}
      {loadError && <><FormFeedback error={loadError} /><button className="btn btn-secondary" onClick={reload}>Retry</button></>}
      {!loading && !loadError && items.length === 0 && <p>No {label.toLowerCase()} entries yet.</p>}
      {items.map(item => <article key={item._id} className="row justify-content-center align-items-center mb-4 p-3 border rounded">
        {resource.image && safeImageUrl(item.imageUrl, path) && <div className="col-md-2"><img src={safeImageUrl(item.imageUrl, path)} alt={item.titleEn || `${label} ${item.date || ''}`} className="img-fluid" loading="lazy" style={{ maxHeight: 150 }} /></div>}
        <div className="col-md-8">
          <h4>{item.titleEn || item.year || item.date}</h4>
          {item.titleUa && <p lang="uk"><strong>{item.titleUa}</strong></p>}
          <p style={{ whiteSpace: 'pre-wrap' }}>{item.descriptionEn}</p>
          <p lang="uk" style={{ whiteSpace: 'pre-wrap' }}>{item.descriptionUa}</p>
        </div>
        <div className="col-md-2">
          <button type="button" className="btn btn-light mb-2 border me-1" onClick={() => edit(item)} disabled={busy}>Edit</button>
          <button type="button" className="btn btn-light mb-2 border" onClick={() => setPendingDelete(item._id)} disabled={busy}>Delete</button>
        </div>
        {pendingDelete === item._id && <div className="col-12 mt-2" role="group" aria-label="Confirm deletion">
          <p>Delete this {label.toLowerCase()}? This cannot be undone.</p>
          <button type="button" className="btn btn-danger me-2" disabled={busy} onClick={() => remove(item)}>Confirm delete</button>
          <button type="button" className="btn btn-secondary" onClick={() => setPendingDelete(null)} disabled={busy}>Cancel</button>
        </div>}
      </article>)}
    </div>
    <div className="footer-hr container my-5" />
  </section>;
}

import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useSite } from '../components/SiteContext.jsx';

export function usePublicData(path) {
  const [state, setState] = useState({ data: null, loading: true, error: false });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState({ data: null, loading: true, error: false });
    api(path, { signal: controller.signal }).then(data => {
      if (active) setState({ data, loading: false, error: false });
    }).catch(error => {
      if (active && error.name !== 'AbortError') setState({ data: null, loading: false, error: true });
    });
    return () => { active = false; controller.abort(); };
  }, [path, revision]);
  return { ...state, retry: () => setRevision(value => value + 1) };
}

export function DataStatus({ loading, error, empty, retry }) {
  const { t } = useSite();
  if (loading) return <p className="public-data-status" role="status">{t('loading')}</p>;
  if (error) return <div className="public-data-status" role="status">
    {t('dataError')}
    <button className="btn btn-outline-secondary btn-sm" type="button" onClick={retry}>{t('retry')}</button>
  </div>;
  if (empty) return <p className="public-data-status" role="status">{t('noMaterials')}</p>;
  return null;
}

export function localizedContent(record, field, language) {
  // The database contains EN/UA originals only. Never present them as a Russian translation.
  const order = language === 'en' ? [['En', 'en'], ['Ua', 'uk']] : [['Ua', 'uk'], ['En', 'en']];
  for (const [suffix, code] of order) {
    const text = record?.[`${field}${suffix}`];
    if (typeof text === 'string' && text.trim()) return { text, language: code };
  }
  return { text: '', language: order[0][1] };
}

export function localized(record, field, language) {
  return localizedContent(record, field, language).text;
}

function OriginalContentNotice({ visible }) {
  const { language, t } = useSite();
  return language === 'ru' && visible ? <p className="public-data-status">{t('originalContentNotice')}</p> : null;
}

export function safeImageUrl(value, collection) {
  // Stored content may predate validation. Only images from this application's image route are displayed.
  if (!['projects', 'certificates'].includes(collection) || typeof value !== 'string' || value.length > 1024 || /[\\\u0000-\u001f]/.test(value)) return undefined;
  const prefix = `/api/${collection}/image/`;
  if (!value.startsWith(prefix)) return undefined;
  const filename = value.slice(prefix.length);
  let decoded;
  try { decoded = decodeURIComponent(filename); } catch { return undefined; }
  // Browsers normalize encoded dot segments before sending the request. Reject those, nested
  // encodings, separators and control characters while still supporting old Unicode/space filenames.
  if (!decoded || /[\\/\u0000-\u001f\u007f?#%]/.test(decoded) || decoded === '.' || decoded === '..') return undefined;
  return value;
}

export function Timeline({ type }) {
  const { language } = useSite();
  const state = usePublicData(type === 'experience' ? '/api/experience' : '/api/activities');
  const items = Array.isArray(state.data) ? [...state.data].reverse() : [];
  return <div className="container" style={{ marginTop: '50px', fontFamily: 'Montserrat' }} id={type === 'experience' ? 'exp-list' : 'act-list'} aria-busy={state.loading}>
    <DataStatus {...state} error={state.error || !state.loading && !Array.isArray(state.data)} empty={!items.length} />
    <OriginalContentNotice visible={items.length > 0} />
    {items.map(item => {
      const description = localizedContent(item, 'description', language);
      return <div className="row justify-content-center align-items-center" key={item._id}>
      <div className="col-4"><h2><strong>{item.year}</strong></h2></div>
      <div className="col-7 block__2_text"><p className="public-text" lang={description.language} style={{ fontSize: '1.3rem' }}>{description.text}</p></div>
      <hr className="block__2_line my-5" />
    </div>; })}
  </div>;
}

export function ProjectList() {
  const { language } = useSite();
  const state = usePublicData('/api/projects');
  const items = Array.isArray(state.data) ? [...state.data].reverse() : [];
  return <div id="projects-list" aria-busy={state.loading}>
    <DataStatus {...state} error={state.error || !state.loading && !Array.isArray(state.data)} empty={!items.length} />
    <OriginalContentNotice visible={items.length > 0} />
    {items.map(item => {
      const image = safeImageUrl(item.imageUrl, 'projects');
      const title = localizedContent(item, 'title', language);
      const description = localizedContent(item, 'description', language);
      return <div key={item._id}>
        <div className="row justify-content-center align-items-center">
          {image && <div className="col-6 block__2_text align-items-center"><img src={image} alt={title.text} lang={title.language} className="img-fluid" loading="lazy" decoding="async" /></div>}
          <div className={image ? 'col-6 text-center' : 'col-12 col-sm-8 text-center'}><h2 lang={title.language}><strong>{title.text}</strong></h2></div>
        </div>
        <div className="row justify-content-center align-items-center"><div style={{ marginTop: '50px', lineHeight: '35px' }}><p className="public-text" lang={description.language}>{description.text}</p></div></div>
        <hr className="block__2_line my-5" />
      </div>;
    })}
  </div>;
}

export function CertificateList() {
  const { language, t } = useSite();
  const state = usePublicData('/api/certificates');
  const items = Array.isArray(state.data) ? [...state.data].reverse() : [];
  return <div className="container" style={{ marginTop: '50px', fontFamily: 'Montserrat' }} id="cert-list" aria-busy={state.loading}>
    <DataStatus {...state} error={state.error || !state.loading && !Array.isArray(state.data)} empty={!items.length} />
    <OriginalContentNotice visible={items.length > 0} />
    {items.map(item => {
      const description = localizedContent(item, 'description', language);
      const image = safeImageUrl(item.imageUrl, 'certificates');
      return <div className="row justify-content-center align-items-center mb-5" key={item._id}>
        <div className="col-12 text-center mb-3"><h4><strong>{item.date}</strong></h4><p className="public-text" lang={description.language} style={{ fontSize: '1.2rem' }}>{description.text}</p></div>
        {image && <div className="col-12 text-center"><img src={image} alt={description.text || t('certificate')} lang={description.text ? description.language : undefined} style={{ maxWidth: '100%', height: 'auto' }} loading="lazy" decoding="async" /></div>}
        <hr className="block__2_line my-5" />
      </div>;
    })}
  </div>;
}

const profiles = {
  orcid: 'https://orcid.org/0000-0001-9548-1959',
  scopus: 'https://www.scopus.com/authid/detail.uri?authorId=57190487952',
};

function safePublicationUrl(value) {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['doi.org', 'orcid.org', 'www.scopus.com', 'scopus.com'].includes(url.hostname) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

export function PublicationFeed({ source = 'orcid', limit }) {
  const { t } = useSite();
  const state = usePublicData(`/api/publications/${source}`);
  const items = Array.isArray(state.data?.items) ? state.data.items.slice(0, limit) : [];
  const available = state.data?.available === true;
  const label = source === 'orcid' ? 'ORCID' : 'Scopus';
  return <div id={limit ? 'publications' : source === 'orcid' ? 'publicationsOrchid' : 'publicationsScopus'} style={{ fontSize: '1.3rem' }} aria-busy={state.loading}>
    {limit && <h3 className="mb-5"><strong>{t('latestPublications')}</strong></h3>}
    <DataStatus {...state} />
    {!state.loading && !state.error && !available && <p>{t('publicationUnavailable').replace('{source}', label)}</p>}
    {!state.loading && available && !items.length && <p>{t('noPublications')}</p>}
    {items.map((item, index) => {
      const href = safePublicationUrl(item.url);
      const text = `${typeof item.title === 'string' ? item.title : ''}${item.year ? ` (${item.year})` : ''}`;
      return limit ? <p className="public-text" key={`${item.url || item.title}-${index}`}>{text}</p> : <div className="publication-row" key={`${item.url || item.title}-${index}`}>
        <div>{text}</div>
        {href && <a href={href} target="_blank" rel="noopener noreferrer" title={t('openPublication')} aria-label={`${t('openPublication')}: ${item.title}`}>🔗</a>}
      </div>;
    })}
    <p className="publication-profile"><a href={profiles[source]} target="_blank" rel="noopener noreferrer">{t('publicationProfile').replace('{source}', label)} ↗</a></p>
  </div>;
}

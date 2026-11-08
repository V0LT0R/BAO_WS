import React, { useState } from 'react';
import { useSite } from './SiteContext.jsx';
import '../styles/accessibility.css';

const navigation = [
  ['index', 'home', 'to_home'], ['experience', 'experience', 'to_exp'],
  ['activity', 'activity', 'to_act'], ['certificates', 'certificates', 'to_cert'],
  ['projects', 'projects', 'to_proj'], ['publications', 'publications', 'to_publ'],
];

export function Header({ page = 'index', user, onLogout }) {
  const [expanded, setExpanded] = useState(false);
  const { t, language, setLanguage, effectiveTheme, setTheme } = useSite();
  const ua = language === 'ua';
  const links = page === 'FAQs' ? [...navigation.filter(([key]) => key !== 'publications'), ['FAQs', 'faqs', 'to_faq']] : navigation;
  return <>
    <a className="skip-link" href="#main-content">{ua ? 'Перейти до вмісту' : 'Skip to content'}</a>
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark" id="navbar" aria-label={ua ? 'Головна навігація' : 'Main navigation'}>
      <div className="container">
        <a className="navbar-brand" href="/index.html">BAO</a>
        <button className="navbar-toggler" type="button" onClick={() => setExpanded(value => !value)} aria-controls="navbarSupportedContent" aria-expanded={expanded} aria-label={ua ? 'Відкрити меню' : 'Toggle navigation'}>
          <span className="navbar-toggler-icon" />
        </button>
        <div className={`collapse navbar-collapse${expanded ? ' show' : ''}`} id="navbarSupportedContent">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            {links.map(([key, text, className]) => <li className="nav-item" key={key}>
              <a className={`nav-link ${className}${page === key || page === 'home' && key === 'index' ? ' active' : ''}`} aria-current={page === key || page === 'home' && key === 'index' ? 'page' : undefined} href={`/${key}.html`}>{t(text)}</a>
            </li>)}
            <li className="nav-item"><a className="nav-link to_cont" href="#footer" onClick={() => setExpanded(false)}>{t('contact')}</a></li>
          </ul>
          {user ? <div className="d-flex align-items-center gap-2 me-3">
            <a className="btn btn-sm btn-outline-secondary" href={user.role === 'admin' ? '/admin.html' : '/user.html'}>{user.role === 'admin' ? (ua ? 'Адмінка' : 'Admin') : user.username}</a>
            {onLogout && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onLogout}>{ua ? 'Вийти' : 'Logout'}</button>}
          </div> : <a className="btn btn-sm btn-outline-secondary me-5" href="/login.html">{ua ? 'Увійти' : 'Login'}</a>}
        </div>
        <fieldset className="switcher" aria-label={ua ? 'Колірна тема' : 'Color scheme'}>
          {['light', 'dark'].map(scheme => <React.Fragment key={scheme}>
            <input className={`switcher__radio switcher__radio--${scheme}`} type="radio" name="color-scheme" value={scheme} id={scheme} aria-label={scheme === 'light' ? (ua ? 'Світла тема' : 'Light theme') : (ua ? 'Темна тема' : 'Dark theme')} checked={effectiveTheme === scheme} onChange={() => setTheme(scheme)} />
            <label htmlFor={scheme} style={{ display: 'block' }}><img className={`navbar-img ${scheme}-img`} src={`/assets/images/${scheme}.svg`} alt="" /></label>
          </React.Fragment>)}
          <div className="switcher__status" />
        </fieldset>
        {page !== 'FAQs' && <fieldset className="language-switcher ms-3" data-language={language} aria-label={ua ? 'Мова сайту' : 'Site language'}>
          <input className="language__radio" type="radio" name="language" value="en" id="lang-en" checked={language === 'en'} onChange={() => setLanguage('en')} aria-label="English" />
          <label htmlFor="lang-en">EN</label>
          <input className="language__radio" type="radio" name="language" value="ua" id="lang-ua" checked={language === 'ua'} onChange={() => setLanguage('ua')} aria-label="Українська" />
          <label htmlFor="lang-ua">UA</label>
        </fieldset>}
      </div>
    </nav>
  </>;
}

export function Footer({ page }) {
  const { t } = useSite();
  return <footer className="container-fluid footer pt-5" id="footer">
    <div className="container">
      <div className="footer-hr" />
      <div className="row footer-row">
        {[['index', 'certificates', page === 'FAQs' ? 'FAQs' : 'publications'], ['experience', 'projects', 'activity']].map((group, i) => <div className="col-md-3 col-10 footer-col" key={i}>
          {group.map(key => <div className="footer-text" key={key}><a href={`/${key}.html`}><h6>{t(key === 'index' ? 'home' : key === 'FAQs' ? 'faqs' : key)}</h6></a></div>)}
        </div>)}
        <div className="col-md-3 col-10 footer-col">
          <div className="footer-text footer_hrefs_text_cont"><h6 className="contacts">{t('contacts')}</h6></div>
          <div>
            <div className="footer-secondary-text"><h6><a href="mailto:a.b@astanait.edu.kz">a.b@astanait.edu.kz</a></h6></div>
            <div className="footer-secondary-text"><h6><a href="tel:+77763949966">+7 776 394 99 66</a></h6></div>
            <div className="footer-secondary-text"><h6><a href="tel:+380936766888">+38 093 67 66 888</a></h6></div>
            <div className="footer-secondary-text"><h6><a href="https://astanait.edu.kz/" target="_blank" rel="noopener noreferrer">www.astanait.edu.kz</a></h6></div>
          </div>
        </div>
      </div>
      <div className="footer-hr mt-5" />
      {page !== 'FAQs' && <div className="footer-text authors"><h6 id="f1f" /></div>}
      <div className="footer-text authors"><h6>© 2025 Made by Biloshchytskyi Artem, Biloshchytskyi Yevhenii.</h6></div>
    </div>
  </footer>;
}

export function PublicLayout({ page, children, user, onLogout }) {
  return <><Header page={page} user={user} onLogout={onLogout} /><main id="main-content" tabIndex={-1}>{children}</main><Footer page={page} /></>;
}

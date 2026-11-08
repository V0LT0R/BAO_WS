import React, { useState } from 'react';
import { useSite } from '../components/SiteContext.jsx';
import Home from './Home.jsx';
import { Timeline, CertificateList, ProjectList, PublicationFeed } from './ContentData.jsx';
import { pagePath } from '../lib/locales.js';

function Hero({ title, subtitle, titleClass = '', subtitleClass = '', image = '/assets/images/experience_block__1_1.png', reverse = false }) {
  const { t } = useSite();
  const picture = <div className="col-lg-5"><img src={image} alt={t('index_name')} className="img-fluid" decoding="async" /></div>;
  return <header className="header-content head-bg"><div className="container"><div className="row header-section">
    {!reverse && picture}
    <div className={`${reverse ? 'col-lg-7' : 'col-lg-6'} header-text`}>
      <h1 className={`display-4 ${titleClass}`}><strong>{t(title)}</strong></h1>
      <p className={subtitleClass}>{t(subtitle)}</p>
    </div>
    {reverse && picture}
  </div></div></header>;
}

function Intro({ description, activity = false }) {
  const { t } = useSite();
  return <div className="row justify-content-center align-items-center">
    <div className="col-4 text-center"><img className="img-fluid gerb_image" alt="" /></div>
    <div className={`col-7 block__2_text${activity ? '' : ' delve_exp'}`}><p className={activity ? 'activity_delve' : undefined}>{t(description)}</p></div>
  </div>;
}

function Experience() {
  const { t } = useSite();
  return <>
    <Hero title="personalExperience" subtitle="reflection" titleClass="personal_Experience" subtitleClass="reflection_exp" />
    <div className="container-fluid block-2-bg" id="block-2-bg"><div className="container block__2">
      <div className="row"><div className="col"><h1 className="block__2_header" id="lifelong_experience">{t('lifelongExperience')}</h1></div></div>
      <hr className="block__2_line my-5" /><Intro description="delve" /><hr className="block__2_line my-5" />
      <div className="row"><div className="col" style={{ marginTop: '20px' }}><h1 id="education_experience"><strong>{t('educationExperience')}</strong></h1></div></div>
      <hr className="block__2_line my-5" /><Timeline type="experience" />
      <div className="row align-items-center justify-content-center"><div className="col-11"><PublicationFeed limit={3} /></div></div>
    </div></div>
  </>;
}

function Activity() {
  const { t } = useSite();
  return <>
    <Hero title="researchActivites" subtitle="advancingKnowledgeActivities" titleClass="Research_Activites" subtitleClass="Advancing_Knowledge_activities" reverse />
    <div className="container-fluid block-2-bg"><div className="container block__2">
      <div className="row"><div className="col"><h1 className="block__2_header activities activity_lifelong">{t('activityLifelong')}</h1></div></div>
      <hr className="block__2_line my-5" /><Intro description="activityDelve" activity /><hr className="block__2_line my-5" />
      <div className="row"><div className="col" style={{ marginTop: '20px' }}><h1 className="activities activity_pedagogical"><strong>{t('activityPedagogical')}</strong></h1></div></div>
      <hr className="block__2_line my-5" /><Timeline type="activity" />
    </div></div>
  </>;
}

function Projects() {
  const { t } = useSite();
  return <>
    <Hero title="projects_title" subtitle="projects_subtitle" titleClass="projects_title" subtitleClass="projects_subtitle" image="/assets/images/BAO.png" />
    <div className="container-fluid block-2-bg"><div className="container block__2">
      <div className="row"><div className="col"><h1 className="block__2_header projects_main"><strong>{t('projects_main')}</strong></h1></div></div>
      <hr className="block__2_line my-5" /><ProjectList />
    </div></div>
  </>;
}

function Certificates() {
  const { t } = useSite();
  return <>
    <div className="container-fluid head-bg"><div className="container block-1">
      <h1 className="display-5 certificates_title">{t('certificates_title')}</h1>
      <h3 className="secondary block-1-secondary-text certificates_subtitle">{t('certificates_subtitle')}</h3>
      <a className="btn btn-dark mt-5 certificates_scancopies_button" href="#cert_of_honor">{t('certificates_scancopies_button')}</a>
    </div></div>
    <div className="container-fluid block-2 pt-5"><div className="container pb-5">
      <div className="block-2-hr" style={{ margin: '80px 0px' }} />
      <h1 className="display-6 certificates_certificates_of_honor" id="cert_of_honor">{t('certificates_certificates_of_honor')}</h1>
      <h5 className="mt-5 certificates_part1_photo">{t('certificates_part1_photo')}</h5>
      <div className="block-2-hr" style={{ margin: '80px 0' }} /><CertificateList />
    </div></div>
  </>;
}

function Publications() {
  const { t } = useSite();
  return <>
    <Hero title="publication_hero_title" subtitle="publication_subtitle" titleClass="publications-text" subtitleClass="reflection_publications" />
    <div className="container-fluid block-2-bg" id="block-2-bg"><div className="container block__2">
      <div className="row"><div className="col"><h1 className="block__2_header publications-text">{t('publication_title')}</h1></div></div>
      <hr className="block__2_line my-5" /><Intro description="explore_publications" /><hr className="block__2_line my-5" />
      <div className="row"><div className="col" style={{ marginTop: '20px' }}><h1 className="publications-text"><strong>{t('publication_title')}</strong></h1></div></div>
      <hr className="block__2_line my-5" />
      <div className="align-items-center justify-content-center"><div className="col-12 col-sm-11"><h3 className="mb-5 publicationsScopusText"><strong>{t('publicationsScopusText')}</strong></h3><PublicationFeed source="scopus" /></div></div>
      <div className="align-items-center justify-content-center"><div className="col-12 col-sm-11"><h3 className="mb-5 publicationsOrchidText"><strong>{t('publicationsOrcidText')}</strong></h3><PublicationFeed source="orcid" /></div></div>
    </div></div>
  </>;
}

const faqText = {
  en: [
    ['Where I work now?', 'Now I work at Astana IT University. In the position of Vice-Rector for Science and Innovation.'],
    ['How to contact me?', 'Go to the footer section by clicking on the Contact in the navigation menu.'],
    ['What languages do I know?', ['Russian', 'Ukrainian', 'English']],
    ["Didn't find your question?", 'Write me an email and I will answer you.'],
  ],
  ua: [
    ['Де я зараз працюю?', 'Зараз я працюю в Astana IT University на посаді проректора з науки та інновацій.'],
    ["Як зі мною зв’язатися?", 'Перейдіть до нижньої частини сторінки, натиснувши «Контакти» в меню навігації.'],
    ['Які мови я знаю?', ['Російська', 'Українська', 'Англійська']],
    ['Не знайшли свого запитання?', 'Напишіть мені електронного листа, і я відповім вам.'],
  ],
  ru: [
    ['Где я сейчас работаю?', 'Сейчас я работаю в Astana IT University на должности проректора по науке и инновациям.'],
    ['Как со мной связаться?', 'Перейдите к контактам в нижней части страницы через меню навигации.'],
    ['Какие языки я знаю?', ['Русский', 'Украинский', 'Английский']],
    ['Не нашли свой вопрос?', 'Напишите мне по электронной почте, и я отвечу вам.'],
  ],
};

function FAQs() {
  const { language, t } = useSite();
  const [open, setOpen] = useState(null);
  return <>
    <header className="header-content head-bg"><div className="container"><div className="row header-section"><div className="col header-text justify-content-center d-flex"><h1><strong>{t('faq_title')}</strong></h1></div></div></div></header>
    <div className="container-fluid block-2-bg"><div className="container mt-5">
      <hr className="block__2_line my-5" /><h2 className="mb-5">{t('faq_heading')}</h2>
      <div id="faqAccordion">{faqText[language].map(([question, answer], index) => <div className="card my-5" key={index}>
        <div className="card-header question-bg" id={`faq-heading-${index}`}><h5 className="mb-0">
          <button type="button" className={`btn d-flex justify-content-left${open === index ? '' : ' collapsed'}`} aria-expanded={open === index} aria-controls={`faq-answer-${index}`} style={{ width: '100%' }} onClick={() => setOpen(value => value === index ? null : index)}>
            <span className="row d-flex justify-content-between" style={{ width: '100%' }}><span className="col d-flex justify-content-start FAQ-text">{question}</span><span className="col d-flex justify-content-end"><span className={`toggle-icon ${open === index ? 'rotate-down' : 'rotate'}`} aria-hidden="true">&gt;</span></span></span>
          </button>
        </h5></div>
        <div id={`faq-answer-${index}`} className={`collapse answer-bg${open === index ? ' show' : ''}`} aria-labelledby={`faq-heading-${index}`} role="region"><div className="card-body">
          {Array.isArray(answer) ? <ul className="h FAQ-text">{answer.map(item => <li className="my-1" key={item}>{item}</li>)}</ul> : <p className="FAQ-text">{index === 1 ? (language === 'ua' ? <>Перейдіть до нижньої частини сторінки, натиснувши <code>«Контакти»</code> в меню навігації.</> : language === 'ru' ? <>Перейдите к контактам в нижней части страницы, нажав <code>«Контакты»</code> в меню навигации.</> : <>Go to the footer section by clicking on the <code>Contact</code> in the navigation menu.</>) : answer}</p>}
        </div></div>
      </div>)}</div>
    </div></div>
  </>;
}

const components = { index: Home, home: Home, experience: Experience, activity: Activity, projects: Projects, certificates: Certificates, publications: Publications, FAQs };

export function PublicPage({ page = 'index' }) {
  const { t, language } = useSite();
  const Page = components[page];
  return Page ? <Page /> : <div className="container py-5"><h1>404</h1><a href={pagePath('index', language)}>{t('home')}</a></div>;
}

export default PublicPage;

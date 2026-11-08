export const localizedPageMeta = {
  en: {
    index: { title: 'Andrii Biloshchytskyi — Professor, Astana IT University', description: 'Andrii Biloshchytskyi, Doctor of Technical Sciences, Professor and Vice-Rector for Science and Innovation at Astana IT University. Experience, projects and publications.' },
    experience: { title: 'Experience and education — Andrii Biloshchytskyi', description: 'Professional experience and education of Andrii Biloshchytskyi: academic career, university teaching and work in information technology.' },
    activity: { title: 'Research and academic activities — Andrii Biloshchytskyi', description: 'Research, teaching and public activities of Professor Andrii Biloshchytskyi, Vice-Rector for Science and Innovation at Astana IT University.' },
    certificates: { title: 'Certificates and qualifications — Andrii Biloshchytskyi', description: 'Certificates and qualifications of Andrii Biloshchytskyi: documents relating to education, professional development and academic achievements.' },
    projects: { title: 'Research and IT projects — Andrii Biloshchytskyi', description: 'Research and information technology projects of Professor Andrii Biloshchytskyi: project descriptions and scientific initiatives.' },
    publications: { title: 'Scientific publications — Andrii Biloshchytskyi', description: 'Scientific publications of Andrii Biloshchytskyi. Research papers, ORCID works and the author’s Scopus profile.' },
    FAQs: { title: 'Contact and questions — Andrii Biloshchytskyi', description: 'Where Andrii Biloshchytskyi works, how to contact him and answers to questions about the professor at Astana IT University.' },
  },
  ua: {
    index: { title: 'Білощицький Андрій — професор, Astana IT University', description: 'Білощицький Андрій — доктор технічних наук, професор, проректор з науки та інновацій Astana IT University. Досвід, наукові проєкти та публікації.' },
    experience: { title: 'Досвід та освіта Білощицького Андрія', description: 'Професійний досвід та освіта Білощицького Андрія: академічна кар’єра, викладання в університетах і робота у сфері інформаційних технологій.' },
    activity: { title: 'Наукова та педагогічна діяльність Білощицького Андрія', description: 'Наукова, педагогічна та громадська діяльність професора Білощицького Андрія, проректора з науки та інновацій Astana IT University.' },
    certificates: { title: 'Сертифікати та кваліфікації Білощицького Андрія', description: 'Сертифікати Білощицького Андрія: документи про освіту, підвищення кваліфікації, професійні та наукові досягнення.' },
    projects: { title: 'Наукові та ІТ-проєкти Білощицького Андрія', description: 'Наукові та ІТ-проєкти професора Білощицького Андрія. Описи дослідницьких проєктів та наукових ініціатив.' },
    publications: { title: 'Наукові публікації Білощицького Андрія', description: 'Наукові публікації Білощицького Андрія: дослідницькі праці, публікації в ORCID та профіль автора у Scopus.' },
    FAQs: { title: 'Контакти та відповіді на питання — Білощицький Андрій', description: 'Де працює Білощицький Андрій, як зв’язатися з професором Astana IT University та відповіді на поширені питання.' },
  },
  ru: {
    index: { title: 'Белощицкий Андрей — профессор, Astana IT University', description: 'Белощицкий Андрей — доктор технических наук, профессор, проректор по науке и инновациям Astana IT University. Опыт, научные проекты и публикации.' },
    experience: { title: 'Опыт и образование Белощицкого Андрея', description: 'Профессиональный опыт и образование Белощицкого Андрея: академическая карьера, преподавание в университетах и работа в сфере информационных технологий.' },
    activity: { title: 'Научная и педагогическая деятельность Белощицкого Андрея', description: 'Научная, педагогическая и общественная деятельность профессора Белощицкого Андрея, проректора по науке и инновациям Astana IT University.' },
    certificates: { title: 'Сертификаты и квалификации Белощицкого Андрея', description: 'Сертификаты Белощицкого Андрея: документы об образовании, повышении квалификации, профессиональных и научных достижениях.' },
    projects: { title: 'Научные и ИТ-проекты Белощицкого Андрея', description: 'Научные и ИТ-проекты профессора Белощицкого Андрея. Описания исследовательских проектов и научных инициатив.' },
    publications: { title: 'Научные публикации Белощицкого Андрея', description: 'Научные публикации Белощицкого Андрея: исследовательские работы, публикации в ORCID и профиль автора в Scopus.' },
    FAQs: { title: 'Контакты и ответы на вопросы — Белощицкий Андрей', description: 'Где работает Белощицкий Андрей, как связаться с профессором Astana IT University и ответы на частые вопросы.' },
  },
};
const pageStyles = { index: 'Index', certificates: 'Certificates', FAQs: 'FAQs' };
for (const locale of Object.values(localizedPageMeta)) {
  for (const [page, meta] of Object.entries(locale)) meta.style = pageStyles[page] || 'Experience';
}
export const pageMeta = localizedPageMeta.en;
export default pageMeta;

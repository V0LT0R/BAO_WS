import React from 'react';
import { useSite } from '../components/SiteContext.jsx';
import { pagePath } from '../lib/locales.js';

export default function Home() {
  const { t, language } = useSite();
  return <>
    <header className="container-fluid head-bg" id="head-bg" style={{"minHeight": "700px"}}>
      <div className="container">
        <div className="row align-items-center block-1" id="block-1">
          <div className="col-lg-7">
            <h1 className="display-4 index_name"><strong>{t("index_name")}</strong></h1>
            <hr className="block-1-hr" />
            <h1 className="display-4 index_position"><strong>{t("index_position")}</strong></h1>
          </div>
          <div className="col-lg-5">
            <img src="/assets/images/photo_header.png" className="mx-auto d-block img-fluid" style={{"marginBottom": "50px"}} alt={t('index_name')} fetchPriority="high" decoding="async" />
          </div>
        </div>
      </div>
    </header>
    <div className="container">
      <div className="block-2-bg">

      </div>
      <div className="row row-cols-lg-2" style={{"justifyContent": "space-around"}}>
        <div className="col-lg-5 col-12 block-2-unik">
          <h2 className="display-5 index_university">{t("index_university")}</h2>
        </div>
        <div className="col-lg-4 col-12 block-2-uni-img">
          <img src="/assets/images/main_photo_1.png" alt="" loading="lazy" decoding="async" />
        </div>
        <div className="col-lg-4 col-md-6 col-12 block-2-uni-img">
          <img src="/assets/images/main_photo_2.png" alt="" loading="lazy" decoding="async" />
        </div>
        <div className="col-lg-5 col-12 block-2-unik">
          <h2 className="display-5 index_vicerector">{t("index_vicerector")}</h2>
        </div>
      </div>
    </div>
    <div className="container-fluid block-3-bg">
      <div className="container">
        <div className="row block-3-row-1">
          <div className="block-3-img" style={{"width": "90px"}}>
            <img className="img-fluid " src="/assets/images/block__3_1.png" style={{"width": "60px"}} alt="" loading="lazy" decoding="async" />
          </div>
          <div style={{"maxWidth": "300px", "padding": "0px"}}>
            <p className="index_expert">{t("index_expert")}</p>
          </div>
        </div>
        <div className="block__3_linebg_1">

        </div>
        <div className="row block-3-rows">
          <div className="col-lg-5 col-12" style={{"alignItems": "center"}}>
            <div>
              <p className="block-3-p index_areas">{t("index_areas")}</p>
            </div>
          </div>
          <div className="col-lg-4 col-12 block-3-col">
            <div className="block-3-img">
              <img src="/assets/images/block__3_2.png" alt="" loading="lazy" decoding="async" />
            </div>
            <h2 className="block-3-col-p index_iot">{t("index_iot")}</h2>
          </div>
        </div>
        <div className="block__3_linebg_2">

        </div>
        <div className="block__3_linebg_3">

        </div>
        <div className="row block-3-rows" style={{"justifyContent": "center"}}>
          <div className="col-lg-4 col-12 block-3-col">
            <div className="block-3-img">
              <img src="/assets/images/block__3_3.png" alt="" loading="lazy" decoding="async" />
            </div>
            <h2 className="block-3-col-p index_software">{t("index_software")}</h2>
          </div>
          <div className="col-lg-5 col-12 block-3-col block-3-col-right">
            <div className="block-3-img">
              <img src="/assets/images/block__3_4.png" alt="" loading="lazy" decoding="async" />
            </div>
            <h2 className="block-3-col-p index_equipment">{t("index_equipment")}</h2>
          </div>
        </div>
        <div className="row block-3-rows" style={{"justifyContent": "center"}}>
          <div className="col-lg-5 col-12 block-3-col">
            <div className="block-3-img">
              <img src="/assets/images/block__3_5.png" alt="" loading="lazy" decoding="async" />
            </div>
            <h2 className="block-3-col-p index_information_systems">{t("index_information_systems")}</h2>
          </div>
          <div className="col-lg-4 col-12 block-3-col block-3-col-right">
            <div className="block-3-img">
              <img src="/assets/images/block__3_6.png" alt="" loading="lazy" decoding="async" />
            </div>
            <h2 className="block-3-col-p index_gis">{t("index_gis")}</h2>
          </div>
        </div>
        <div className="block__3_linebg_4">

        </div>
        <div className="block__3_linebg_5">

        </div>
        <div className="row block-3-rows">
          <div className="col-lg-7 col-12 block-3-col block-3-col-last">
            <div className="block-3-img">
              <img src="/assets/images/block__3_7.png" alt="" loading="lazy" decoding="async" />
            </div>
            <h2 className="block-3-col-p index_networks">{language === 'en' ? <>In-depth knowledge of the principles<br /> of building computer networks and<br /> the operation of server equipment</> : t('index_networks')}</h2>
          </div>
        </div>
      </div>
    </div>
    <div className="container block-4">
      <div className="row" style={{"justifyContent": "center", "alignItems": "center", "paddingTop": "50px"}}>
        <div className="col-xxl-8 col-lg-6 col-10 block-4-row" style={{"display": "flex", "alignItems": "center"}}>
          <img className="img-fluid " src="/assets/images/block__4_1.png" alt="" loading="lazy" decoding="async" />
          <h1 className="display-4 block-4-header index_teaching_exp">{t("index_teaching_exp")}</h1>
        </div>
      </div>
      <div className="row" style={{"justifyContent": "center", "alignItems": "center", "paddingTop": "50px"}}>
        <div className="col-xxl-4 col-lg-4 col-5 block-4-row" style={{"display": "flex", "alignItems": "center"}}>
          <img className="img-fluid block-4-img" src="/assets/images/block__4_2.png" alt="" loading="lazy" decoding="async" />
          <h1 className="display-3 block-4-text index_teaching_years">{t("index_teaching_years")}</h1>
        </div>
      </div>
    </div>
    <div className="container-fluid block-5">
      <div className="container">
        <div className="row row-cols-1" style={{"paddingTop": "50px", "justifyContent": "center"}}>
          <div className="col-md-5 col-11 block-5-square card pb-3">
            <a style={{"textDecoration": "none"}} href={pagePath('experience', language)}>
              <div className="card-body">
                <h2 className="block-5-header-text index_card_experience">{t("index_card_experience")}</h2>
                <h6 className="block-5-inner-text index_card_experience_desc">{t("index_card_experience_desc")}</h6>
              </div>
              <img className="card-img" src="/assets/images/block__5_1.png" alt="" loading="lazy" decoding="async" />
            </a>
          </div>
          <div className="col-md-5 col-11 block-5-square card pb-3">
            <a style={{"textDecoration": "none"}} href={pagePath('certificates', language)}>
              <div className="card-body">
                <h2 className="block-5-header-text index_card_certificates">{t("index_card_certificates")}</h2>
                <h6 className="block-5-inner-text index_card_certificates_desc">{t("index_card_certificates_desc")}</h6>
              </div>
              <img className="card-img" src="/assets/images/block__5_2.png" alt="" loading="lazy" decoding="async" />
            </a>
          </div>
          <div className="col-md-5 col-11 block-5-square card pb-3">
            <a style={{"textDecoration": "none"}} href={pagePath('activity', language)}>
              <div className="card-body">
                <h2 className="block-5-header-text index_card_activity">{t("index_card_activity")}</h2>
                <h6 className="block-5-inner-text index_card_activity_desc">{t("index_card_activity_desc")}</h6>
              </div>
              <img className="card-img" src="/assets/images/block__5_3.png" alt="" loading="lazy" decoding="async" />
            </a>
          </div>
          <div className="col-md-5 col-11 block-5-square card pb-3">
            <a style={{"textDecoration": "none"}} href={pagePath('projects', language)}>
              <div className="card-body">
                <h2 className="block-5-header-text index_card_projects">{t("index_card_projects")}</h2>
                <h6 className="block-5-inner-text index_card_projects_desc">{t("index_card_projects_desc")}</h6>
              </div>
              <img className="card-img" src="/assets/images/block__5_4.png" alt="" loading="lazy" decoding="async" />
            </a>
          </div>
        </div>
      </div>
    </div>
  </>;
}

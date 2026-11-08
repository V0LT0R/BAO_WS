'use strict';
const { createImageRecordsRouter } = require('./image-records');
module.exports = { createCertificateRouter: options => createImageRecordsRouter({ ...options, fields: { date: 80, descriptionEn: 20000, descriptionUa: 20000 }, bucket: 'certificateImages', apiPath: '/api/certificates', imageRequired: true }) };

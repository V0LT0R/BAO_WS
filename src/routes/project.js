'use strict';
const { createImageRecordsRouter } = require('./image-records');
module.exports = { createProjectRouter: options => createImageRecordsRouter({ ...options, fields: { titleEn: 500, titleUa: 500, descriptionEn: 20000, descriptionUa: 20000 }, bucket: 'projectImages', apiPath: '/api/projects', imageRequired: false }) };

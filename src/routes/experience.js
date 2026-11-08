'use strict';
const { createRecordsRouter } = require('./records');
module.exports = { createExperienceRouter: options => createRecordsRouter({ ...options, fields: { year: 80, descriptionEn: 20000, descriptionUa: 20000 } }) };

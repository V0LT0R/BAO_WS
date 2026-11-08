'use strict';
const express = require('express');
const { HttpError, asyncRoute, objectBody, text, validId } = require('../http');

function readFields(body, fields, partial = false) {
  objectBody(body, Object.keys(fields));
  const data = {};
  for (const [field, max] of Object.entries(fields)) {
    const value = text(body[field], field, { max, optional: partial });
    if (value !== undefined) data[field] = value;
  }
  if (partial && Object.keys(data).length === 0) throw new HttpError(400, 'Provide at least one field to update.');
  return data;
}

function createRecordsRouter({ Model, requireAdmin, fields, sort = { year: -1 } }) {
  const router = express.Router();
  router.get('/', asyncRoute(async (req, res) => res.json(await Model.find().sort(sort).limit(1000).lean())));
  router.get('/:id', validId, asyncRoute(async (req, res) => {
    const item = await Model.findById(req.params.id).lean();
    if (!item) throw new HttpError(404, 'Record not found.');
    res.json(item);
  }));
  router.post('/', requireAdmin, asyncRoute(async (req, res) => res.status(201).json(await Model.create(readFields(req.body, fields)))));
  router.put('/:id', requireAdmin, validId, asyncRoute(async (req, res) => {
    const item = await Model.findByIdAndUpdate(req.params.id, { $set: readFields(req.body, fields, true) }, { returnDocument: 'after', runValidators: true });
    if (!item) throw new HttpError(404, 'Record not found.');
    res.json(item);
  }));
  router.delete('/:id', requireAdmin, validId, asyncRoute(async (req, res) => {
    if (!await Model.findByIdAndDelete(req.params.id)) throw new HttpError(404, 'Record not found.');
    res.json({ message: 'Record deleted.' });
  }));
  return router;
}
module.exports = { createRecordsRouter, readFields };

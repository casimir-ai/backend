import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const AttributeValue = new Schema({
  "_id": false,
  "attributeId": { type: Schema.Types.ObjectId, required: false },
  "value": { type: Schema.Types.Mixed, default: null }
});

module.exports = AttributeValue;

import mongoose from 'mongoose';
import { CONTRACT_AGREEMENT_TYPE, CONTRACT_AGREEMENT_STATUS } from '@deip/constants';

const Schema = mongoose.Schema;

const SignerSchema = new Schema({
  "_id": false,
  "id": { type: String, required: true },
  "date": { type: Number, required: true }
});

const ContractAgreementSchema = new Schema({
  "_id": { type: String },
  "portalId": { type: String, required: true },
  "status": { type: Number, enum: [...Object.values(CONTRACT_AGREEMENT_STATUS)], required: true, default: CONTRACT_AGREEMENT_STATUS.PENDING },
  "creator": { type: String, required: true},
  "parties": { type: Array, required: true },
  "hash": { type: String, required: true},
  "activationTime": { type: Number },
  "expirationTime": { type: Number },
  "acceptedByParties": { type: Array, default: [] },
  "proposalId": { type: String },
  "signers": [SignerSchema],
  "type": {
    type: Number,
    enum: [...Object.values(CONTRACT_AGREEMENT_TYPE)],
    required: true
  },
  "terms": { type: Object, required: true }
}, { timestamps: true });


const model = mongoose.model('contract-agreement', ContractAgreementSchema);

module.exports = model;

import mongoose from 'mongoose';

const Schema = mongoose.Schema;

const ProposalDtoSchema = new Schema({
  "_id": { type: String, required: true },
  "tenantId": { type: String, required: true },
  "type": { type: Number, required: true },
  "details": { type: Object, required: true },
  "multiTenantIds": { type: [String] }
}, { timestamps: { createdAt: 'created_at', 'updatedAt': 'updated_at' } });

const readModel = mongoose.model('rm-proposals', ProposalDtoSchema);

module.exports = readModel;
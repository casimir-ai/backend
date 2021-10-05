import BaseService from './../../base/BaseService';
import ContractAgreementSchema from './../../../schemas/ContractAgreementSchema';

class ContractAgreementService extends BaseService {

  constructor(options = { scoped: true }) { 
    super(ContractAgreementSchema, options);
  }

  async createContractAgreement({
    contractAgreementId,
    creator,
    parties,
    hash,
    startTime,
    endTime,
    acceptedByParties,
    type,
    status,
    terms,
    proposalId
  }) {

    const result = await this.createOne({
      _id: contractAgreementId,
      creator,
      parties,
      hash,
      startTime,
      endTime,
      acceptedByParties,
      type,
      status,
      terms,
      proposalId
    });

    return result;
  }

  async updateContractAgreement({
    _id,
    status,
    acceptedByParties
  }) {
    const result = await this.updateOne({ _id }, {
      status,
      acceptedByParties
    });

    return result;
  }

}

export default ContractAgreementService;
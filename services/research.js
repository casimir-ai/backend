import deipRpc from '@deip/rpc-client';
import BaseReadModelService from './base';
import Research from './../schemas/research';
import ExpressLicense from './../schemas/expressLicense';
import ResearchApplication from './../schemas/researchApplication';
import mongoose from 'mongoose';
import { RESEARCH_ATTRIBUTE_TYPE, RESEARCH_ATTRIBUTE, RESEARCH_STATUS } from './../constants';

class ResearchService extends BaseReadModelService {

  constructor() { super(Research); }

  async getResearchAttributes() {
    const tenant = await this.getTenantInstance();
    return tenant.settings.researchAttributes || [];
  }

  async mapResearch(researches, filterObj) {

    const filter =  {
      searchTerm: "",
      researchAttributes: [], 
      ...filterObj
    }

    const chainResearches = await deipRpc.api.getResearchesAsync(researches.map(r => r._id));
    // TODO: replace with service call
    const researchesExpressLicenses = await ExpressLicense.find({ researchExternalId: { $in: chainResearches.map(r => r.external_id) } });
    const researchAttributes = await this.getResearchAttributes();
    
    return chainResearches
      .map((chainResearch) => {
        const researchRef = researches.find(r => r._id.toString() == chainResearch.external_id);
        const expressLicenses = researchesExpressLicenses.filter(l => l.researchExternalId == chainResearch.external_id).map(l => l.toObject());
        const attributes = researchRef ? researchRef.attributes : [];
       
        const title = attributes.some(rAttr => rAttr.researchAttributeId.toString() == RESEARCH_ATTRIBUTE.TITLE.toString())
          ? attributes.find(rAttr => rAttr.researchAttributeId.toString() == RESEARCH_ATTRIBUTE.TITLE.toString()).value.toString()
          : "Not Specified";

        const abstract = attributes.some(rAttr => rAttr.researchAttributeId.toString() == RESEARCH_ATTRIBUTE.TITLE.toString())
          ? attributes.find(rAttr => rAttr.researchAttributeId.toString() == RESEARCH_ATTRIBUTE.DESCRIPTION.toString()).value.toString()
          : "Not Specified";

        return { ...chainResearch, title, abstract, researchRef: researchRef ? { ...researchRef, expressLicenses } : { attributes: [], expressLicenses: []} };
      })
      .filter(r => !filter.searchTerm || (r.researchRef && r.researchRef.attributes.some(rAttr => {
        
        const attribute = researchAttributes.find(attr => attr._id.toString() === rAttr.researchAttributeId.toString());
        if (!attribute || !rAttr.value)
          return false;
        
        if (rAttr.researchAttributeId.toString() == RESEARCH_ATTRIBUTE.TITLE.toString() || rAttr.researchAttributeId.toString() == RESEARCH_ATTRIBUTE.DESCRIPTION.toString()) {
          return `${rAttr.value}`.toLowerCase().includes(filter.searchTerm.toLowerCase());
        }

        // if (attribute.type == RESEARCH_ATTRIBUTE_TYPE.RESEARCH_GROUP) {
        //   return r.research_group.name.toLowerCase().includes(filter.searchTerm.toLowerCase());
        // }

        if (attribute.type == RESEARCH_ATTRIBUTE_TYPE.USER) {
          return r.members.some(m => m.toLowerCase().includes(filter.searchTerm.toLowerCase()));
        }
 
        return false;
      })))
      .filter(r => !filter.researchAttributes.length || (r.researchRef && filter.researchAttributes.every(fAttr => {

        const attribute = researchAttributes.find(attr => attr._id.toString() === fAttr.researchAttributeId.toString());
        if (!attribute) {
          return false;
        }

        const rAttr = r.researchRef.attributes.find(rAttr => rAttr.researchAttributeId.toString() === fAttr.researchAttributeId.toString());
        return fAttr.values.some((v) => {

          if (!rAttr || !rAttr.value) {
            return !v || v === 'false';
          }

          if (attribute.type == RESEARCH_ATTRIBUTE_TYPE.EXPRESS_LICENSING) {
            if (v == true || v === 'true') {
              return rAttr.value.length != 0;
            } else {
              return true;
            }
          }

          if (Array.isArray(rAttr.value)) {
            return rAttr.value.some(rAttrV => rAttrV.toString() === v.toString());
          }

          if (typeof rAttr.value === 'string') {
            return rAttr.value.includes(v.toString());
          }

          return rAttr.value.toString() === v.toString();
        });

      })));
  }


  async lookupResearches(lowerBound, limit, filter) {
    const researches = await this.findMany({ status: RESEARCH_STATUS.APPROVED });
    const result = await this.mapResearch(researches, filter);
    return result;
  }


  async getResearch(researchExternalId) {
    const research = await this.findOne({ _id: researchExternalId, status: RESEARCH_STATUS.APPROVED });
    if (!research) return null;
    const items = await this.mapResearch([research]);
    const [result] = items;
    return result;
  }


  async getResearches(researchesExternalIds) {
    const researches = await this.findMany({ _id: { $in: [...researchesExternalIds] }, status: RESEARCH_STATUS.APPROVED });
    const result = await this.mapResearch(researches);
    return result;
  }


  async getResearchesByResearchGroup(researchGroupExternalId) {
    const researches = await this.findMany({ researchGroupExternalId: researchGroupExternalId, status: RESEARCH_STATUS.APPROVED });
    const result = await this.mapResearch(researches);
    return result;
  }


  async getResearchesForMember(member) {
    const chainResearches = await deipRpc.api.getResearchesByResearchGroupMemberAsync(member);
    const researches = await this.findMany({ _id: { $in: [...chainResearches.map(r => r.external_id)] }, status: RESEARCH_STATUS.APPROVED });
    const result = await this.mapResearch(researches);
    return result;
  }

  
  async createResearchRef({
    externalId,
    researchGroupExternalId,
    attributes,
    status
  }) {

    const mappedAttributes = await this.mapAttributes(attributes);
    const savedResearch = await this.createOne({
      _id: externalId,
      researchGroupExternalId,
      status,
      attributes: mappedAttributes
    })

    return savedResearch;
  }
  

  async updateResearchRef(externalId, { status, attributes }) {

    let mappedAttributes;
    if (attributes) {
      mappedAttributes = await this.mapAttributes(attributes);
    }

    const updatedResearch = this.updateOne({ _id: externalId }, {
      status: status ? status : undefined, 
      attributes: attributes ? mappedAttributes : undefined
    });

    return updatedResearch;
  }


  async mapAttributes(attributes) {
    const researchAttributes = await this.getResearchAttributes();

    return attributes.map(rAttr => {
      const rAttrId = mongoose.Types.ObjectId(rAttr.researchAttributeId.toString());

      const attribute = researchAttributes.find(a => a._id.toString() == rAttrId);
      let rAttrValue = null;

      if (!attribute) {
        console.warn(`${rAttrId} is obsolete attribute`);
      }

      if (!attribute || rAttr.value == null) {
        return {
          researchAttributeId: rAttrId,
          value: rAttrValue
        };
      }

      switch (attribute.type) {
        case RESEARCH_ATTRIBUTE_TYPE.STEPPER: {
          rAttrValue = mongoose.Types.ObjectId(rAttr.value.toString()); // _id
          break;
        }
        case RESEARCH_ATTRIBUTE_TYPE.TEXT: {
          rAttrValue = rAttr.value.toString(); // text
          break;
        }
        case RESEARCH_ATTRIBUTE_TYPE.TEXTAREA: {
          rAttrValue = rAttr.value.toString(); // text
          break;
        }
        case RESEARCH_ATTRIBUTE_TYPE.SELECT: {
          rAttrValue = rAttr.value.map(v => mongoose.Types.ObjectId(v.toString())); // _id
          break;
        }
        case RESEARCH_ATTRIBUTE_TYPE.URL: {
          rAttrValue = rAttr.value.map(v => v); // schema
          break;
        }
        case RESEARCH_ATTRIBUTE_TYPE.VIDEO_URL: {
          rAttrValue = rAttr.value.toString(); // url
          break;
        }
        case RESEARCH_ATTRIBUTE_TYPE.SWITCH: {
          rAttrValue = rAttr.value == true || rAttr.value === 'true';
          break;
        }
        case RESEARCH_ATTRIBUTE_TYPE.CHECKBOX: {
          rAttrValue = rAttr.value == true || rAttr.value === 'true';
          break;
        }
        case RESEARCH_ATTRIBUTE_TYPE.USER: {
          rAttrValue = rAttr.value.map(v => v.toString()); // username / external_id
          break;
        }
        case RESEARCH_ATTRIBUTE_TYPE.DISCIPLINE: {
          rAttrValue = rAttr.value.map(v => v.toString()); // external_id
          break;
        }
        case RESEARCH_ATTRIBUTE_TYPE.RESEARCH_GROUP: {
          rAttrValue = rAttr.value.map(v => v.toString()); // external_id
          break;
        }
        case RESEARCH_ATTRIBUTE_TYPE.IMAGE: {
          rAttrValue = rAttr.value.toString(); // image name
          break;
        }
        case RESEARCH_ATTRIBUTE_TYPE.FILE: {
          rAttrValue = rAttr.value.toString(); // file name
          break;
        }
        case RESEARCH_ATTRIBUTE_TYPE.EXPRESS_LICENSING: {
          rAttrValue = rAttr.value.map(v => v); // schema
          break;
        }
        case RESEARCH_ATTRIBUTE_TYPE.ROADMAP: {
          rAttrValue = rAttr.value.map(v => v); // schema
          break;
        }
        case RESEARCH_ATTRIBUTE_TYPE.PARTNERS: {
          rAttrValue = rAttr.value.map(v => v); // schema
          break;
        }
        default: {
          console.warn(`Unknown attribute type ${attribute.type}`);
          rAttrValue = null;
          break;
        }
      }

      return {
        researchAttributeId: rAttrId,
        value: rAttrValue
      }
    })
  }


  async addAttributeToResearches({ researchAttributeId, type, defaultValue }) {
    const result = await this.updateMany({}, { $push: { attributes: { researchAttributeId: mongoose.Types.ObjectId(researchAttributeId), type, value: defaultValue } } });
    return result;
  }


  async removeAttributeFromResearches({ researchAttributeId }) {
    const result = await this.updateMany({}, { $pull: { attributes: { researchAttributeId: mongoose.Types.ObjectId(researchAttributeId) } } });
    return result;
  }


  async updateAttributeInResearches({ researchAttributeId, type, valueOptions, defaultValue }) {
    if (type == RESEARCH_ATTRIBUTE_TYPE.STEPPER || type == RESEARCH_ATTRIBUTE_TYPE.SELECT) {
      const result = await this.updateMany(
        {
          $and: [
            { 'attributes.researchAttributeId': mongoose.Types.ObjectId(researchAttributeId) },
            { 'attributes.value': { $nin: [...valueOptions.map(opt => mongoose.Types.ObjectId(opt.value))] } }
          ]
        },
        { $set: { 'attributes.$.value': defaultValue } }
      );

      return result;
    } else {
      return Promise.resolve();
    }
  }



  // TODO: move to separate service
  
  async findResearchApplicationById(applicationId) {
    let researchApplication = await ResearchApplication.findOne({ _id: applicationId });
    return researchApplication;
  }

  async createResearchApplication({
    proposalId,
    researchExternalId,
    researcher,
    status,
    title,
    description,
    disciplines,
    problem,
    solution,
    funding,
    eta,
    location,
    attributes,
    budgetAttachment,
    businessPlanAttachment,
    cvAttachment,
    marketResearchAttachment,
    tx
  }) {

    const researchApplication = new ResearchApplication({
      _id: proposalId,
      researchExternalId,
      researcher,
      status,
      title,
      description,
      disciplines,
      problem,
      solution,
      funding,
      eta,
      location,
      attributes,
      budgetAttachment,
      businessPlanAttachment,
      cvAttachment,
      marketResearchAttachment,
      tx
    });

    return researchApplication.save();
  }


  async updateResearchApplication(applicationId, {
    status,
    description,
    disciplines,
    problem,
    solution,
    funding,
    eta,
    location,
    attributes,
    budgetAttachment,
    businessPlanAttachment,
    cvAttachment,
    marketResearchAttachment
  }) {

    const researchApplication = await this.findResearchApplicationById(applicationId);
    researchApplication.description = description;
    researchApplication.status = status;
    researchApplication.disciplines = disciplines;
    researchApplication.problem = problem;
    researchApplication.solution = solution;
    researchApplication.funding = funding;
    researchApplication.eta = eta;
    researchApplication.location = location;
    researchApplication.attributes = attributes;
    researchApplication.budgetAttachment = budgetAttachment;
    researchApplication.businessPlanAttachment = businessPlanAttachment;
    researchApplication.cvAttachment = cvAttachment;
    researchApplication.marketResearchAttachment = marketResearchAttachment;

    return researchApplication.save();
  }


  async getResearchApplications({ status, researcher }) {
    const query = {};
    if (status) {
      query.status = status;
    }
    if (researcher) {
      query.researcher = researcher;
    }
    const result = await ResearchApplication.find(query);
    return result;
  }
}

export default ResearchService;
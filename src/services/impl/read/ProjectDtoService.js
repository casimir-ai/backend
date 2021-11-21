import BaseService from './../../base/BaseService';
import ProjectSchema from './../../../schemas/ProjectSchema'; // TODO: separate read/write schemas
import AttributeDtoService from './AttributeDtoService';
import TeamDtoService from './TeamDtoService';
import ContractAgreementDtoService from './ContractAgreementDtoService';
import ProjectNdaDtoService from './ProjectNdaDtoService';
import { PROJECT_ATTRIBUTE, PROJECT_STATUS } from './../../../constants';
import config from './../../../config';
import { ChainService } from '@deip/chain-service';
import AssetService from './../write/AssetService';
import { CONTRACT_AGREEMENT_TYPE, ATTR_SCOPES, ATTR_TYPES } from '@deip/constants';

const assetService = new AssetService();
const teamDtoService = new TeamDtoService();

class ProjectDtoService extends BaseService {

  constructor(options = { scoped: true }) { 
    super(ProjectSchema, options);
  }

  async mapResearch(researches, filterObj) {
    const contractAgreementDtoService = new ContractAgreementDtoService();
    const projectNdaDtoService = new ProjectNdaDtoService();
    const attributeDtoService = new AttributeDtoService();

    const filter = {
      searchTerm: "",
      researchAttributes: [],
      tenantIds: [],
      isDefault: undefined,
      ...filterObj
    }

    const chainService = await ChainService.getInstanceAsync(config);
    const chainRpc = chainService.getChainRpc();
    const chainResearches = await chainRpc.getProjectsAsync(researches.map(r => r._id));

    const researchesExpressLicenses = await contractAgreementDtoService.getContractAgreements({ type: CONTRACT_AGREEMENT_TYPE.PROJECT_LICENSE }); // (getAllContractAgreements) temp sol
    const chainResearchNdaList = await Promise.all(chainResearches.map(r => projectNdaDtoService.getProjectNdaListByProject(r.external_id)));
    const researchAttributes = await attributeDtoService.getAttributesByScope(ATTR_SCOPES.PROJECT);
    let teams = await Promise.all(chainResearches.map(p => teamDtoService.getTeam(p.research_group.external_id)));
    const allMembers = teams.map(t => t.members);
    
    const result = chainResearches
      .map((chainResearch, i) => {
        const members = allMembers[i];
        const researchRef = researches.find(r => r._id.toString() == chainResearch.external_id);
        const expressLicenses = researchesExpressLicenses.filter(l => l.terms.projectId == chainResearch.external_id);
        // TEMP
        const grantedAccess = chainResearchNdaList
          .reduce((acc, list) => { return [...acc, ...list] }, [])
          .filter((nda) => nda.research_external_id == chainResearch.external_id)
          .reduce((acc, nda) => {
            return [...acc, ...nda.parties];
          }, []);

        const attributes = researchRef.attributes;
       
        const title = attributes.some(rAttr => rAttr.attributeId.toString() == PROJECT_ATTRIBUTE.TITLE.toString())
          ? attributes.find(rAttr => rAttr.attributeId.toString() == PROJECT_ATTRIBUTE.TITLE.toString()).value.toString()
          : "Not Specified";

        const abstract = attributes.some(rAttr => rAttr.attributeId.toString() == PROJECT_ATTRIBUTE.DESCRIPTION.toString())
          ? attributes.find(rAttr => rAttr.attributeId.toString() == PROJECT_ATTRIBUTE.DESCRIPTION.toString()).value.toString()
          : "Not Specified";

        const isPrivate = attributes.some(rAttr => rAttr.attributeId.toString() == PROJECT_ATTRIBUTE.IS_PRIVATE.toString())
          ? attributes.find(rAttr => rAttr.attributeId.toString() == PROJECT_ATTRIBUTE.IS_PRIVATE.toString()).value.toString() === 'true'
          : false;

        return {
          ...chainResearch,
          members,
          entityId: chainResearch.external_id,
          tenantId: researchRef.tenantId,
          title,
          abstract,
          isPrivate,
          isDefault: researchRef.isDefault,
          attributes: researchRef.attributes,
          researchRef: {
            ...researchRef,
            expressLicenses,
            grantedAccess
          }
        };
      })
      .filter(r => filter.isDefault === undefined || filter.isDefault === r.isDefault)
      .filter(r => !filter.searchTerm || (r.researchRef && r.researchRef.attributes.some(rAttr => {
        
        const attribute = researchAttributes.find(attr => attr._id.toString() === rAttr.attributeId.toString());
        if (!attribute || !rAttr.value)
          return false;
        
        if (rAttr.attributeId.toString() == PROJECT_ATTRIBUTE.TITLE.toString() || rAttr.attributeId.toString() == PROJECT_ATTRIBUTE.DESCRIPTION.toString()) {
          return `${rAttr.value}`.toLowerCase().includes(filter.searchTerm.toLowerCase());
        }

        // if (attribute.type == ATTR_TYPES.RESEARCH_GROUP) {
        //   return r.research_group.name.toLowerCase().includes(filter.searchTerm.toLowerCase());
        // }

        if (attribute.type == ATTR_TYPES.USER) {
          return r.members.some(m => m.toLowerCase().includes(filter.searchTerm.toLowerCase()));
        }
 
        return false;
      })))
      .filter(r => !filter.tenantIds.length || (r.researchRef && filter.tenantIds.some(tenantId => {
        return r.researchRef.tenantId == tenantId;
      })))
      .filter(r => !filter.researchAttributes.length || (r.researchRef && filter.researchAttributes.every(fAttr => {

        const attribute = researchAttributes.find(attr => attr._id.toString() === fAttr.attributeId.toString());
        if (!attribute) {
          return false;
        }

        const rAttr = r.researchRef.attributes.find(rAttr => rAttr.attributeId.toString() === fAttr.attributeId.toString());
        return fAttr.values.some((v) => {

          if (!rAttr || !rAttr.value) {
            return !v || v === 'false';
          }

          if (attribute.type == ATTR_TYPES.EXPRESS_LICENSING) {
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

      })))
      .sort((a, b) => b.researchRef.created_at - a.researchRef.created_at);

    //temp solution
    const symbols = [];
    result.forEach((p) => {
      p.security_tokens.forEach(b => {
        const symbol = b.split(' ')[1];
        if (!symbols.includes(symbol)) {
          symbols.push(symbol);
        }
      })
    });
    const assetsList = await assetService.getAssetsBySymbols(symbols);
    return result.map(p => {
      //temp solution
      const balances = p.security_tokens.map(b => {
        const [amount, symbol] = b.split(' ');
        const asset = assetsList.find((a) => symbol === a.symbol);
        return {
          id: asset._id,
          symbol,
          amount: `${Number(amount)}`,
          precision: asset.precision
        }
      });

      return {
        ...p,
        security_tokens: balances,
        securityTokens: balances
      }
    })
  }


  async getResearch(researchExternalId) {
    const research = await this.findOne({ _id: researchExternalId, status: PROJECT_STATUS.APPROVED });
    if (!research) return null;
    const results = await this.mapResearch([research]);
    const [result] = results;
    return result;
  }


  async getResearches(researchesExternalIds, statuses = [ PROJECT_STATUS.APPROVED ]) {
    const researches = await this.findMany({ _id: { $in: [...researchesExternalIds] }, status: { $in: [...statuses] } });
    if (!researches.length) return [];
    const result = await this.mapResearch(researches);
    return result;
  }


  async lookupProjects(filter) {
    const researches = await this.findMany({ status: PROJECT_STATUS.APPROVED });
    if (!researches.length) return [];
    const result = await this.mapResearch(researches, { ...filter, isDefault: false });
    return result;
  }


  async getProjectsByTeam(researchGroupExternalId) {
    const researches = await this.findMany({ researchGroupExternalId: researchGroupExternalId, status: PROJECT_STATUS.APPROVED });
    if (!researches.length) return [];
    const result = await this.mapResearch(researches, { isDefault: false });
    return result;
  }


  async getProjectsByTenant(tenantId) {
    const available = await this.findMany({ status: PROJECT_STATUS.APPROVED });
    const researches = available.filter(r => r.tenantId == tenantId);
    if (!researches.length) return [];
    const result = await this.mapResearch(researches, { isDefault: false });
    return result;
  }


  async getProjectsForMember(member) {
    const chainService = await ChainService.getInstanceAsync(config);
    const chainRpc = chainService.getChainRpc();
    const teams = await teamDtoService.getTeamsByUser(member);
    const teamsIds = teams.map(({ entityId }) => entityId);
    const chainResearches = await Promise.all(teamsIds.map(teamId => chainRpc.getProjectsByTeamAsync(teamId)));
    const chainProjects = chainResearches.reduce((acc, projectsList) => {
      const projects = projectsList.filter(p => !acc.some(project => project.external_id == p.external_id));
      return [...acc, ...projects];
    }, []);
    const projects = await this.findMany({ _id: { $in: [...chainProjects.map(p => p.external_id)] }, status: PROJECT_STATUS.APPROVED });
    if (!projects.length) return [];
    const result = await this.mapResearch(projects, { isDefault: false });
    return result;
  }


  async getProject(projectId) {
    const result = this.getResearch(projectId);
    return result;
  }

  
  async getProjects(projectsIds) {
    const result = this.getResearches(projectsIds);
    return result;
  }

  async getDefaultProject(accountId) {
    const project = await this.findOne({ isDefault: true, researchGroupExternalId: accountId });
    if (!project) return null;
    const results = await this.mapResearch([project], { isDefault: true });
    const [result] = results;
    return result;
  }

}

export default ProjectDtoService;
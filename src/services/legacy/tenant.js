import TenantSchema from './../../schemas/TenantSchema';
import { TeamDtoService } from './../../services';
import config from './../../config';
import { ChainService } from '@deip/chain-service';

const teamDtoService = new TeamDtoService();

class TenantService {

  constructor() { };

  async getTenant(id) {
    const doc = await TenantSchema.findOne({ _id: id });
    if (!doc) return null;
    const chainService = await ChainService.getInstanceAsync(config);
    const chainRpc = chainService.getChainRpc();
    const profile = doc.toObject();
    const [account] = await chainRpc.getAccountsAsync([id]);
    const team = await teamDtoService.getTeam(config.TENANT);
    const { members: admins } = team;

    return { id: id, pubKey: account.owner.key_auths[0][0], account: account, profile: profile, admins };
  }

  async getNetworkTenant(id) {
    const doc = await TenantSchema.findOne({ _id: id });
    if (!doc) return null;
    const chainService = await ChainService.getInstanceAsync(config);
    const chainRpc = chainService.getChainRpc();
    const profile = doc.toObject();
    const [account] = await chainRpc.getAccountsAsync([id]);
    return { id: profile._id, account: account, profile: { ...profile, settings: { researchAttributes: profile.settings.researchAttributes } }, network: undefined };
  }

  async getNetworkTenants() {
    const chainService = await ChainService.getInstanceAsync(config);
    const chainRpc = chainService.getChainRpc();
    const docs = await TenantSchema.find({});
    const profiles = docs.map(doc => doc.toObject());
    const accounts = await chainRpc.getAccountsAsync(profiles.map(p => p._id));

    const result = profiles.map((profile) => {
      const account = accounts.find(a => a.name == profile._id);
      return { id: profile._id, account: account, profile: { ...profile, settings: { researchAttributes: profile.settings.researchAttributes } }, network: undefined };
    });
    return result;
  }

  async createTenantProfile({
    tenantExternalId,
    name,
    shortName,
    description,
    email,
    logo,
    banner
  }, {
    signUpPolicy,
    faq,
    researchAttributes,
    layouts
  }) {

    const tenantProfile = new TenantSchema({
      _id: tenantExternalId,
      name: name,
      shortName: shortName,
      description: description,
      email: email,
      logo: logo,
      banner: banner,
      settings: {
        signUpPolicy,
        faq,
        researchAttributes: researchAttributes || [],
        layouts: layouts || {}
      }
    });

    const savedTenantProfile = await tenantProfile.save();
    return savedTenantProfile.toObject();
  }

  async updateTenantProfile(tenantExternalId, {
    name,
    shortName,
    description,
    email,
    logo,
    banner
  }, {
    faq,
    layouts
  }) {

    const tenantProfile = await TenantSchema.findOne({ _id: tenantExternalId });
    if (!tenantProfile) {
      throw new Error(`Tenant ${tenantExternalId} does not exist`);
    }

    tenantProfile.name = name !== undefined ? name : tenantProfile.name;
    tenantProfile.shortName = shortName !== undefined ? shortName : tenantProfile.shortName;
    tenantProfile.description = description !== undefined ? description : tenantProfile.description;
    tenantProfile.email = email !== undefined ? email : tenantProfile.email;
    tenantProfile.logo = logo !== undefined ? logo : tenantProfile.logo;
    tenantProfile.banner = banner !== undefined ? banner : tenantProfile.banner;
    tenantProfile.settings.faq = faq !== undefined ? faq : tenantProfile.settings.faq;
    tenantProfile.settings.layouts = layouts !== undefined ? layouts : tenantProfile.settings.layouts;
    
    const savedTenantProfile = await tenantProfile.save();
    return savedTenantProfile.toObject();
  }


  async updateTenantNetworkSettings(tenantExternalId, {
    globalNetworkIsVisible
  }) {
    const tenantProfile = await TenantSchema.findOne({ _id: tenantExternalId });
    tenantProfile.network.isGlobalScopeVisible = !!globalNetworkIsVisible;
    const savedTenantProfile = await tenantProfile.save();
    return savedTenantProfile.toObject();
  }

  async updateTenantAttributeSettings(tenantId, attributeSettings) {
    const tenantProfile = await TenantSchema.findOne({ _id: tenantId });
    tenantProfile.settings.attributeSettings = attributeSettings;
    const savedTenantProfile = await tenantProfile.save();
    return savedTenantProfile.toObject();
  }

  async getTenantAttributeSettings(tenantId) {
    const profile = await TenantSchema.findOne({ _id: tenantId });
    if (!profile) return null;
    return profile.settings.attributeSettings;
  }

  async updateTenantLayouts(tenantId, layouts) {
    const tenantProfile = await TenantSchema.findOne({ _id: tenantId });
    tenantProfile.settings.layouts = layouts;
    const savedTenantProfile = await tenantProfile.save();
    return savedTenantProfile.toObject();
  }

  async getTenantLayouts(tenantId) {
    const profile = await TenantSchema.findOne({ _id: tenantId });
    if (!profile) return null;
    return profile.settings.layouts;
  }

  async updateTenantLayoutSettings(tenantId, layoutSettings) {
    const tenantProfile = await TenantSchema.findOne({ _id: tenantId });
    tenantProfile.settings.layoutSettings = layoutSettings;
    const savedTenantProfile = await tenantProfile.save();
    return savedTenantProfile.toObject();
  }

  async getTenantLayoutSettings(tenantId) {
    const profile = await TenantSchema.findOne({ _id: tenantId });
    if (!profile) return null;
    return profile.settings.layoutSettings;
  }
}


export default TenantService;
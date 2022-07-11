import BaseService from './../../base/BaseService';
import AssetDepositRequestSchema from '../../../schemas/AssetDepositRequestSchema';
import AssetSchema from './../../../schemas/AssetSchema';
import { AssetType } from '@casimir/platform-core';


class AssetDtoService extends BaseService {

  constructor(options = { scoped: true }) {
    super(AssetSchema, options);
  }

  async mapAssets(assets) {
    return assets.map((asset) => {
      let defaultModel = {
        _id: asset._id,
        portalId: asset.portalId,
        issuer: asset.issuer,
        description: asset.description,
        type: asset.type,
        name: asset.name
      };
      if (asset.type === AssetType.FT || asset.type === AssetType.CORE) {
        return {
          ...defaultModel,
          symbol: asset.symbol,
          precision: asset.precision
        }
      }
      return defaultModel;
    });
  }

  async getAssetsByType(type) {
    const assets = await this.findMany({ type });
    const result = await this.mapAssets(assets);
    return result;
  }

  async getAssetsByIssuer(issuer) {
    const assets = await this.findMany({ issuer });
    const result = await this.mapAssets(assets);
    return result;
  }
  
  async lookupAssets() {
    const assets = await this.findMany({});
    const result = await this.mapAssets(assets);
    return result;
  }

  async getAccountDepositHistory(account, status) {
    const query = { account };
    if (status) query.status = status;
    const history = await AssetDepositRequestSchema.find(query)
    return history;
  }

}


export default AssetDtoService;
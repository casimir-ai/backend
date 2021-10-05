require("@babel/register")({
  "presets": [
    [
      "@babel/env",
      {
        "targets": {
          "node": "current"
        }
      }
    ]
  ]
});

require("@babel/register")({
  "only": [
    function (filepath) {
      return filepath.includes("node_modules/@deip") || filepath.includes("node_modules/crc");
    },
  ]
});

const { ChainService } = require('@deip/chain-service');

const config = require('./../config');
const ASSET_TYPE = require('./../constants').ASSET_TYPE;

const mongoose = require('mongoose');
const AssetSchema = require('./../schemas/AssetSchema');
const ProjectSchema = require('./../schemas/ProjectSchema');
const crypto = require('@deip/lib-crypto');
const TextEncoder = require('util').TextEncoder;

mongoose.connect(config.DEIP_MONGO_STORAGE_CONNECTION_URL);

const run = async () => {

  const chainService = await ChainService.getInstanceAsync(config);
  const chainApi = chainService.getChainApi();

  const chainAssets = await chainApi.lookupAssetsAsync('', 10000);
  const assetsPromises = [];

  const projects = await Promise.all(chainAssets.filter((chainAsset) => !!chainAsset.tokenized_research).map((chainAsset) => {
    return ProjectSchema.find({ _id: chainAsset.tokenized_research });
  })) 

  for (let i = 0; i < chainAssets.length; i++) {
    const chainAsset = chainAssets[i];
    const id = crypto.hexify(crypto.ripemd160(new TextEncoder('utf-8').encode(chainAsset.string_symbol).buffer));

    const payload = {
      "_id": id,
      "symbol": chainAsset.string_symbol,
      "precision": chainAsset.precision,
      "issuer": chainAsset.issuer,
      "description": chainAsset.description,
      "type": chainAsset.tokenized_research ? ASSET_TYPE.PROJECT : ASSET_TYPE.GENERAL,
      "settings": {
        "projectId": chainAsset.tokenized_research || null,
        "maxSupply": parseInt(chainAsset.max_supply),
        "minBallance": 0,
        "licenseRevenueHoldersShare": chainAsset.license_revenue_holders_share || undefined
      },
      "isGlobalScope": !!!chainAsset.tokenized_research,
      "tenantId": chainAsset.tokenized_research ? projects.find(p => p._id.toString() == chainAsset.tokenized_research).tenantId : undefined,
    }

    const asset = new AssetSchema(payload);
    assetsPromises.push(asset.save());
  }

  await Promise.all(assetsPromises);

};

run()
  .then(() => {
    console.log('Successfully finished');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
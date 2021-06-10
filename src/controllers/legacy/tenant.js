import deipRpc from '@deip/rpc-client';
import sharp from 'sharp';
import TenantService from './../../services/legacy/tenant';
import { TeamService, UserDtoService, UserService } from './../../services';
import FileStorage from './../../storage';
import config from './../../config';
import { USER_PROFILE_STATUS } from './../../constants';
import TenantSettingsForm from './../../forms/legacy/tenantSettings';
import * as blockchainService from './../../utils/blockchain';
import { AttributeDtoService } from './../../services';


const updateTenantSettings = async (ctx) => {
  const jwtUsername = ctx.state.user.username;
  const tenantExternalId = ctx.state.tenant.id;

  try {

    const tenantService = new TenantService();
    const tenant = await tenantService.getTenant(tenantExternalId);
    const oldBanner = tenant.profile.banner;
    const oldLogo = tenant.profile.logo;
    const { banner, logo, title } = await TenantSettingsForm(ctx);

    const update = {
      banner: banner ? banner : tenant.profile.banner,
      logo: logo ? logo : tenant.profile.logo,
      name: title ? title : tenant.profile.name
    }

    const updatedTenantProfile = await tenantService.updateTenantProfile(tenantExternalId, update, {});

    if (banner && oldBanner != banner) {
      const oldFilepath = FileStorage.getTenantBannerFilePath(tenantExternalId, oldBanner);
      const exists = await FileStorage.exists(oldFilepath);
      if (exists) {
        await FileStorage.delete(oldFilepath);
      }
    }

    if (logo && oldLogo != logo) {
      const oldFilepath = FileStorage.getTenantLogoFilePath(tenantExternalId, oldLogo);
      const exists = await FileStorage.exists(oldFilepath);
      if (exists) {
        await FileStorage.delete(oldFilepath);
      }
    }

    ctx.status = 200;
    ctx.body = updatedTenantProfile;

  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }
}


const getTenantBanner = async (ctx) => {
  const tenantExternalId = ctx.params.tenant;
  const width = ctx.query.width ? parseInt(ctx.query.width) : 200;
  const height = ctx.query.height ? parseInt(ctx.query.height) : 200;
  const noCache = ctx.query.noCache ? ctx.query.noCache === 'true' : false;
  const isRound = ctx.query.round ? ctx.query.round === 'true' : false;

  try {

    const tenantService = new TenantService();
    const tenant = await tenantService.getTenant(tenantExternalId);
    const defaultBanner = FileStorage.getTenantDefaultBannerFilePath();

    let src;
    let buff;

    if (tenant.profile.banner) {
      const filepath = FileStorage.getTenantBannerFilePath(tenantExternalId, tenant.profile.banner);
      const exists = await FileStorage.exists(filepath);
      if (exists) {
        buff = await FileStorage.get(filepath);
      } else {
        src = defaultBanner;
      }
    } else {
      src = defaultBanner;
    }

    let resize = (w, h) => {
      return new Promise((resolve, reject) => {
        sharp.cache(!noCache);
        sharp(buff || src)
          .rotate()
          .resize(w, h)
          .png()
          .toBuffer()
          .then(data => {
            resolve(data)
          })
          .catch(err => {
            reject(err)
          });
      })
    }

    let banner = await resize(width, height);

    if (isRound) {
      let round = (w) => {
        let r = w / 2;
        let circleShape = Buffer.from(`<svg><circle cx="${r}" cy="${r}" r="${r}" /></svg>`);
        return new Promise((resolve, reject) => {
          banner = sharp(banner)
            .overlayWith(circleShape, { cutout: true })
            .png()
            .toBuffer()
            .then(data => {
              resolve(data)
            })
            .catch(err => {
              reject(err)
            });
        });
      }

      banner = await round(width);
    }

    ctx.type = 'image/png';
    ctx.body = banner;

  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }
}


const getTenantLogo = async (ctx) => {
  const tenantExternalId = ctx.params.tenant;
  const width = ctx.query.width ? parseInt(ctx.query.width) : 200;
  const height = ctx.query.height ? parseInt(ctx.query.height) : 200;
  const noCache = ctx.query.noCache ? ctx.query.noCache === 'true' : false;
  const isRound = ctx.query.round ? ctx.query.round === 'true' : false;

  try {

    const tenantService = new TenantService();
    const tenant = await tenantService.getTenant(tenantExternalId);
    const defaultLogo = FileStorage.getTenantDefaultLogoFilePath();

    let src;
    let buff;

    if (tenant.profile.logo) {
      const filepath = FileStorage.getTenantLogoFilePath(tenantExternalId, tenant.profile.logo);
      const exists = await FileStorage.exists(filepath);
      if (exists) {
        buff = await FileStorage.get(filepath);
      } else {
        src = defaultLogo;
      }
    } else {
      src = defaultLogo;
    }

    let resize = (w, h) => {
      return new Promise((resolve, reject) => {
        sharp.cache(!noCache);
        sharp(buff || src)
          .rotate()
          // .resize(w, h)
          .png()
          .toBuffer()
          .then(data => {
            resolve(data)
          })
          .catch(err => {
            reject(err)
          });
      })
    }

    let logo = await resize(width, height);

    if (isRound) {
      let round = (w) => {
        let r = w / 2;
        let circleShape = Buffer.from(`<svg><circle cx="${r}" cy="${r}" r="${r}" /></svg>`);
        return new Promise((resolve, reject) => {
          logo = sharp(logo)
            .overlayWith(circleShape, { cutout: true })
            .png()
            .toBuffer()
            .then(data => {
              resolve(data)
            })
            .catch(err => {
              reject(err)
            });
        });
      }

      logo = await round(width);
    }

    ctx.type = 'image/png';
    ctx.body = logo;

  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }
}


const getTenant = async (ctx) => {
  const tenantExternalId = ctx.params.tenant;
  try {
    const tenantService = new TenantService();
    const tenant = await tenantService.getTenant(tenantExternalId);
    if (!tenant) {
      ctx.status = 404;
      ctx.body = `Tenant '${tenantExternalId}' does not exist`
      return;
    }
    ctx.status = 200;
    ctx.body = tenant;
  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }
}


const getNetworkTenant = async (ctx) => {
  const tenantExternalId = ctx.params.tenant;
  try {
    const tenantService = new TenantService();
    const result = await tenantService.getNetworkTenant(tenantExternalId);
    ctx.status = 200;
    ctx.body = result;
  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }
}


const getNetworkTenants = async (ctx) => {
  try {
    const tenantService = new TenantService();
    const result = await tenantService.getNetworkTenants();
    ctx.status = 200;
    ctx.body = result;
  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }
}

const updateTenantProfile = async (ctx) => {
  const jwtUsername = ctx.state.user.username;
  const update = ctx.request.body;
  const tenantExternalId = ctx.state.tenant.id;

  try {

    const tenantService = new TenantService();
    const tenant = await tenantService.getTenant(tenantExternalId);
    const updatedTenantProfile = await tenantService.updateTenantProfile(
      tenantExternalId, 
      { ...tenant.profile, ...update }, 
      { ...tenant.profile.settings, ...update.settings }
    );

    ctx.status = 200;
    ctx.body = updatedTenantProfile;

  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }
}


const updateTenantNetworkSettings = async (ctx) => {
  const jwtUsername = ctx.state.user.username;
  const update = ctx.request.body;
  const tenantExternalId = ctx.state.tenant.id;

  try {

    const tenantService = new TenantService();
    const updatedTenantProfile = await tenantService.updateTenantNetworkSettings(
      tenantExternalId,
      update
    );

    ctx.status = 200;
    ctx.body = updatedTenantProfile;

  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }
}

const getSignUpRequests = async (ctx) => {
  try {
    const userDtoService = new UserDtoService();
    const pendingUsersProfiles = await userDtoService.findUserProfilesByStatus(USER_PROFILE_STATUS.PENDING);
    ctx.status = 200;
    ctx.body = pendingUsersProfiles;
  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }
}


const approveSignUpRequest = async (ctx, next) => {
  const { username, role } = ctx.request.body;

  try {

    // TODO: check jwtUsername for admin
    const userDtoService = new UserDtoService();
    const userService = new UserService();
    const teamService = new TeamService();
    const attributeDtoService = new AttributeDtoService()

    const userProfile = await userDtoService.findUserProfileByOwner(username);
    if (!userProfile) {
      ctx.status = 404;
      ctx.body = `Sign up request for ${username} does not exist`;
      return;
    }

    if (userProfile.status != USER_PROFILE_STATUS.PENDING) {
      ctx.status = 400;
      ctx.body = `Sign up request for ${username} was already approved`;
      return;
    }

    const tx = await userService.createUserAccount({ username, pubKey: userProfile.signUpPubKey, role });

    // temp solution //
    const attrs = await attributeDtoService.getAttributesByScope(ATTR_SCOPES.TEAM);
    const attr = attrs.find(
      ({ type, title }) => title === 'Name' && type === ATTRIBUTE_TYPE.TEXT
    );

    const attributes = attr ? [{attributeId: attr._id, value: username}] : [];

    await teamService.createTeam({
      externalId: username,
      creator: username,
      attributes
    });

    /* Temp solution for ACTION PROJECT roles setup flow */

    // const datums = blockchainService.extractOperations(tx);
    // if (datums.length > 1) {
    //   const userInvitationProposedEvent = new UserInvitationProposedEvent(datums);
    //   ctx.state.events.push(userInvitationProposedEvent);

    //   const userInvitationApprovals = userInvitationProposedEvent.getProposalApprovals();
    //   for (let i = 0; i < userInvitationApprovals.length; i++) {
    //     const approval = userInvitationApprovals[i];
    //     const userInvitationProposalSignedEvent = new UserInvitationProposalSignedEvent([approval]);
    //     ctx.state.events.push(userInvitationProposalSignedEvent);
    //   }
    // }

    const approvedProfile = await userService.updateUser(username, { status: USER_PROFILE_STATUS.APPROVED });

    ctx.status = 200;
    ctx.body = { profile: approvedProfile };

  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }

  await next();
}


const rejectSignUpRequest = async (ctx) => {
  const { username } = ctx.request.body;

  try {

    // TODO: check jwtUsername for admin
    const userService = new UserService();
    const userDtoService = new UserDtoService();
    const userProfile = await userDtoService.findUserProfileByOwner(username);
    if (!userProfile) {
      ctx.status = 404;
      ctx.body = `Sign up request for ${username} does not exist`;
      return;
    }

    if (userProfile.status != USER_PROFILE_STATUS.PENDING) {
      ctx.status = 400;
      ctx.body = `Sign up request for ${username} was already approved and can not be rejected`;
      return;
    }

    await userService.deleteUser(username);

    ctx.status = 201;
    ctx.body = "";

  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }
}


const addTenantAdmin = async (ctx) => {
  const jwtUsername = ctx.state.user.username;
  const { tx } = ctx.request.body;

  try {

    const operation = tx['operations'][0];
    const payload = operation[1];
    const txResult = await blockchainService.sendTransactionAsync(tx);

    ctx.status = 200;
    ctx.body = { tx, txResult };

  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }
}


const removeTenantAdmin = async (ctx) => {
  const jwtUsername = ctx.state.user.username;
  const { tx } = ctx.request.body;

  try {

    const operation = tx['operations'][0];
    const payload = operation[1];
    const txResult = await blockchainService.sendTransactionAsync(tx);

    ctx.status = 200;
    ctx.body = { tx, txResult };

  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }
}

const signTxByTenant = async (ctx) => {
  const { tx } = ctx.request.body;
  const isTenantAccessToken = ctx.state.user.isTenant;
  try {

    if (isTenantAccessToken) {
      ctx.status = 403;
      ctx.body = `Endpoint can be used only by ${ctx.state.tenant.id} tenant`;
      return;
    }

    const result = deipRpc.auth.signTransaction(tx, { owner: config.TENANT_PRIV_KEY });
    ctx.status = 200;
    ctx.body = result;
  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }
}


const affirmTxByTenant = async (ctx) => {
  const { tx } = ctx.request.body;
  const isTenantAccessToken = ctx.state.user.isTenant;
  try {

    if (isTenantAccessToken) {
      ctx.status = 403;
      ctx.body = `Endpoint can be used only by ${ctx.state.tenant.id} tenant`;
      return;
    }

    const result = deipRpc.auth.signTransaction(tx, {}, { tenant: config.TENANT, tenantPrivKey: config.TENANT_PRIV_KEY });
    ctx.status = 200;
    ctx.body = result;
  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }
}

const updateTenantAttributeSettings = async (ctx) => {
  const jwtUsername = ctx.state.user.username;
  const update = ctx.request.body;
  const tenantId = ctx.state.tenant.id;

  try {

    const tenantService = new TenantService();
    const updatedTenantProfile = await tenantService.updateTenantAttributeSettings(
      tenantId,
      update
    );

    ctx.status = 200;
    ctx.body = { tenantId };

  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }
}

const getTenantAttributeSettings = async (ctx) => {
  const tenantId = ctx.params.tenant;
  try {
    const tenantService = new TenantService();
    const result = await tenantService.getTenantAttributeSettings(tenantId);
    ctx.status = 200;
    ctx.body = result;
  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }
}

const updateTenantLayouts = async (ctx) => {
  const jwtUsername = ctx.state.user.username;
  const update = ctx.request.body;
  const tenantId = ctx.state.tenant.id;

  try {

    const tenantService = new TenantService();
    const updatedTenantProfile = await tenantService.updateTenantLayouts(
      tenantId,
      update
    );

    ctx.status = 200;
    ctx.body = { tenantId };

  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }
}

const getTenantLayouts = async (ctx) => {
  const tenantId = ctx.params.tenant;
  try {
    const tenantService = new TenantService();
    const result = await tenantService.getTenantLayouts(tenantId);
    ctx.status = 200;
    ctx.body = result;
  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }
}

export default {
  getNetworkTenant,
  getNetworkTenants,
  getTenant,
  getTenantBanner,
  getTenantLogo,
  getSignUpRequests,
  approveSignUpRequest,
  rejectSignUpRequest,
  updateTenantProfile,
  updateTenantNetworkSettings,
  updateTenantSettings,
  addTenantAdmin,
  removeTenantAdmin,
  signTxByTenant,
  affirmTxByTenant,
  updateTenantAttributeSettings,
  getTenantAttributeSettings,
  updateTenantLayouts,
  getTenantLayouts
}
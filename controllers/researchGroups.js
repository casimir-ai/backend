import deipRpc from '@deip/rpc-client';
import multer from 'koa-multer';
import fs from 'fs';
import fsExtra from 'fs-extra'
import util from 'util';
import path from 'path';
import sharp from 'sharp'
import config from './../config'
import qs from 'qs';
import * as blockchainService from './../utils/blockchain';
import ResearchGroupService from './../services/researchGroup';
import { researchGroupLogoForm } from './../forms/researchGroupForms';
import ResearchGroupCreatedEvent from './../events/researchGroupCreatedEvent';
import ResearchGroupUpdatedEvent from './../events/researchGroupUpdatedEvent';
import ResearchGroupUpdateProposedEvent from './../events/researchGroupUpdateProposedEvent';
import ResearchGroupUpdateProposalSignedEvent from './../events/researchGroupUpdateProposalSignedEvent';
import UserResignationProposedEvent from './../events/userResignationProposedEvent';
import UserResignationProposalSignedEvent from './../events/userResignationProposalSignedEvent';


const createResearchGroup = async (ctx, next) => {
  const jwtUsername = ctx.state.user.username;
  const { tx, offchainMeta } = ctx.request.body;

  try {
    const txResult = await blockchainService.sendTransactionAsync(tx);
    const datums = blockchainService.extractOperations(tx);

    const researchGroupCreatedEvent = new ResearchGroupCreatedEvent(datums, offchainMeta.researchGroup);
    ctx.state.events.push(researchGroupCreatedEvent);

    const { researchGroupExternalId } = researchGroupCreatedEvent.getSourceData();
      
    ctx.status = 200;
    ctx.body = { external_id: researchGroupExternalId };

  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }

  await next();
}


const updateResearchGroup = async (ctx, next) => {
  const jwtUsername = ctx.state.user.username;
  const { tx, offchainMeta, isProposal } = ctx.request.body;

  try {

    const txResult = await blockchainService.sendTransactionAsync(tx);
    const datums = blockchainService.extractOperations(tx);

    if (isProposal) {
      const researchGroupUpdateProposedEvent = new ResearchGroupUpdateProposedEvent(datums, offchainMeta.researchGroup);
      ctx.state.events.push(researchGroupUpdateProposedEvent);

      const researchGroupUpdateApprovals = researchGroupUpdateProposedEvent.getProposalApprovals();
      for (let i = 0; i < researchGroupUpdateApprovals.length; i++) {
        const approval = researchGroupUpdateApprovals[i];
        const researchGroupUpdateProposalSignedEvent = new ResearchGroupUpdateProposalSignedEvent([approval]);
        ctx.state.events.push(researchGroupUpdateProposalSignedEvent);
      }
      
    } else {
      const researchGroupUpdatedEvent = new ResearchGroupUpdatedEvent(datums);
      ctx.state.events.push(researchGroupUpdatedEvent, offchainMeta.researchGroup);
    }

    ctx.status = 200;
    ctx.body = [...ctx.state.events];

  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }

  await next();
}


const leaveResearchGroup = async (ctx, next) => {
  const jwtUsername = ctx.state.user.username;
  const { tx, offchainMeta } = ctx.request.body;

  try {

    const txResult = await blockchainService.sendTransactionAsync(tx);
    const datums = blockchainService.extractOperations(tx);

    const userResignationProposedEvent = new UserResignationProposedEvent(datums, offchainMeta);
    ctx.state.events.push(userResignationProposedEvent);
    
    const userResignationApprovals = userResignationProposedEvent.getProposalApprovals();
    for (let i = 0; i < userResignationApprovals.length; i++) {
      const approval = userResignationApprovals[i];
      const userResignationProposalSignedEvent = new UserResignationProposalSignedEvent([approval]);
      ctx.state.events.push(userResignationProposalSignedEvent);
    }

    ctx.status = 200;
    ctx.body = [...ctx.state.events];

  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }

  await next();
};


const filesStoragePath = path.join(__dirname, `./../${config.FILE_STORAGE_DIR}`);
const researchGroupStoragePath = (researchGroupExternalId) => `${filesStoragePath}/research-groups/${researchGroupExternalId}`;
const researchGroupLogoImagePath = (researchGroupExternalId, ext = 'png') => `${researchGroupStoragePath(researchGroupExternalId)}/logo.${ext}`;
const defaultResearchGroupLogoPath = () => path.join(__dirname, `./../default/default-research-group-logo.png`);


const uploadResearchGroupLogo = async (ctx) => {
  const jwtUsername = ctx.state.user.username;
  const researchGroupExternalId = ctx.request.headers['research-group-external-id'];
  const researchGroupService = new ResearchGroupService();
  
  const authorizedGroup = await researchGroupService.authorizeResearchGroupAccount(researchGroupExternalId, jwtUsername);
  if (!authorizedGroup) {
    ctx.status = 401;
    ctx.body = `"${jwtUsername}" is not permitted to edit "${researchGroupExternalId}" research`;
    return;
  }

  const stat = util.promisify(fs.stat);
  const unlink = util.promisify(fs.unlink);
  const ensureDir = util.promisify(fsExtra.ensureDir);

  try {
    const filepath = researchGroupLogoImagePath(researchGroupExternalId);

    await stat(filepath);
    await unlink(filepath);
  } catch (err) {
    await ensureDir(researchGroupStoragePath(researchGroupExternalId))
  }

  const logoImage = researchGroupLogoForm.single('research-background');
  const result = await logoImage(ctx, () => new Promise((resolve, reject) => {
    resolve({ 'filename': ctx.req.file.filename });
  }));

  ctx.status = 200;
  ctx.body = result;
}

const getResearchGroupLogo = async (ctx) => {
  const researchGroupExternalId = ctx.params.researchGroupExternalId;
  const width = ctx.query.width ? parseInt(ctx.query.width) : 1440;
  const height = ctx.query.height ? parseInt(ctx.query.height) : 430;
  const noCache = ctx.query.noCache ? ctx.query.noCache === 'true' : false;
  const isRound = ctx.query.round ? ctx.query.round === 'true' : false;


  let src = researchGroupLogoImagePath(researchGroupExternalId);
  const stat = util.promisify(fs.stat);

  try {
    const check = await stat(src);
  } catch (err) {
    src = defaultResearchGroupLogoPath();
  }

  const resize = (w, h) => {
    return new Promise((resolve) => {
      sharp.cache(!noCache);
      sharp(src)
        .rotate()
        .resize(w, h)
        .png()
        .toBuffer()
        .then(data => {
          resolve(data)
        })
        .catch(err => {
          resolve(err)
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
}

const getResearchGroup = async (ctx) => {
  const researchGroupExternalId = ctx.params.researchGroupExternalId;
  const researchGroupsService = new ResearchGroupService();

  try {

    const researchGroup = await researchGroupsService.getResearchGroup(researchGroupExternalId);
    if (!researchGroup) {
      ctx.status = 404;
      ctx.body = null;
      return;
    }
    
    ctx.status = 200;
    ctx.body = researchGroup;
  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }
}


const getResearchGroupsByUser = async (ctx) => {
  const member = ctx.params.username;
  try {
    const researchGroupsService = new ResearchGroupService();
    const researchGroups = await researchGroupsService.getResearchGroupsByUser(member);
    ctx.status = 200;
    ctx.body = researchGroups;
  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }
}


const getResearchGroupsListing = async (ctx) => {
  const query = qs.parse(ctx.query);

  try {
    const researchGroupsService = new ResearchGroupService();
    const researchGroups = await researchGroupsService.getResearchGroupsListing(query.personal);
    ctx.status = 200;
    ctx.body = researchGroups;
  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }
}



export default {
  getResearchGroup,
  getResearchGroupsListing,
  createResearchGroup,
  getResearchGroupsByUser,
  updateResearchGroup,
  getResearchGroupLogo,
  uploadResearchGroupLogo,
  leaveResearchGroup
}
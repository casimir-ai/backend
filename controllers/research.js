import multer from 'koa-multer';
import fs from 'fs';
import fsExtra from 'fs-extra'
import util from 'util';
import path from 'path';
import sharp from 'sharp'
import config from './../config'
import send from 'koa-send';
import slug from 'limax';
import deipRpc from '@deip/rpc-client';
import ResearchService from './../services/research';
import researchGroupsService from './../services/researchGroup';
import * as blockchainService from './../utils/blockchain';
import * as authService from './../services/auth';
import researchGroupActivityLogHandler from './../event-handlers/researchGroupActivityLog';
import userNotificationHandler from './../event-handlers/userNotification';
import { APP_EVENTS, ACTIVITY_LOG_TYPE, USER_NOTIFICATION_TYPE, RESEARCH_APPLICATION_STATUS, CHAIN_CONSTANTS } from './../constants';
import { researchBackgroundImageFilePath, defaultResearchBackgroundImagePath, researchBackgroundImageForm } from './../forms/researchForms';
import { researchApplicationForm, researchApplicationAttachmentFilePath } from './../forms/researchApplicationForms';
import qs from 'qs';

const stat = util.promisify(fs.stat);
const unlink = util.promisify(fs.unlink);
const ensureDir = util.promisify(fsExtra.ensureDir);

const createResearch = async (ctx, next) => {
  const jwtUsername = ctx.state.user.username;
  const tenant = ctx.state.tenant;
  const researchService = new ResearchService(tenant);
  const { tx, isProposal, offchainMeta: { attributes } } = ctx.request.body;

  try {

    const operation = isProposal ? tx['operations'][0][1]['proposed_ops'][0]['op'] : tx['operations'][0];
    const payload = operation[1];
    const { external_id: externalId, research_group: researchGroupExternalId } = payload;

    const authorizedGroup = await authService.authorizeResearchGroupAccount(researchGroupExternalId, jwtUsername);
    if (!authorizedGroup) {
      ctx.status = 401;
      ctx.body = `"${jwtUsername}" is not a member of "${researchGroupExternalId}" group`;
      return;
    }

    const txResult = await blockchainService.sendTransactionAsync(tx);

    const researchGroupInternalId = authorizedGroup.id;
    const researchRef = await researchService.createResearchRef({
      externalId,
      researchGroupExternalId,
      researchGroupInternalId,
      attributes
    });

    const createdResearch = await researchService.getResearch(externalId);

    ctx.status = 200;
    ctx.body = createdResearch;
    
    ctx.state.events.push([isProposal ? APP_EVENTS.RESEARCH_PROPOSED : APP_EVENTS.RESEARCH_CREATED, { tx, emitter: jwtUsername }]);

  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }

  await next();
};


const createResearchApplication = async (ctx, next) => {
  const jwtUsername = ctx.state.user.username;
  const tenant = ctx.state.tenant;
  const researchService = new ResearchService(tenant);

  try {

    const formUploader = researchApplicationForm.fields([
      { name: 'budgetAttachment', maxCount: 1 },
      { name: 'businessPlanAttachment', maxCount: 1 },
      { name: 'cvAttachment', maxCount: 1 }, 
      { name: 'marketResearchAttachment', maxCount: 1 }
    ]);

    const form = await formUploader(ctx, () => new Promise((resolve, reject) => {
      const [budgetAttachment] = ctx.req.files.budgetAttachment ? ctx.req.files.budgetAttachment : [null];
      const [businessPlanAttachment] = ctx.req.files.businessPlanAttachment ? ctx.req.files.businessPlanAttachment : [null];
      const [cvAttachment] = ctx.req.files.cvAttachment ? ctx.req.files.cvAttachment : [null];
      const [marketResearchAttachment] = ctx.req.files.marketResearchAttachment ? ctx.req.files.marketResearchAttachment : [null];

      resolve({
        budgetAttachment: budgetAttachment ? budgetAttachment.filename : null,
        businessPlanAttachment: businessPlanAttachment ? businessPlanAttachment.filename : null,
        cvAttachment: cvAttachment ? cvAttachment.filename : null, 
        marketResearchAttachment: marketResearchAttachment ? marketResearchAttachment.filename : null, 

        ...ctx.req.body,
        location: JSON.parse(ctx.req.body.location),
        researchDisciplines: JSON.parse(ctx.req.body.researchDisciplines),
        attributes: JSON.parse(ctx.req.body.attributes),
        tx: JSON.parse(ctx.req.body.tx)
      });
    }));

    const txResult = await blockchainService.sendTransactionAsync(form.tx);
    const proposal = await deipRpc.api.getProposalAsync(form.proposalId);
    const isAccepted = proposal == null;

    const researchApplicationRm = await researchService.createResearchApplication({
      proposalId: form.proposalId,
      researchExternalId: form.researchExternalId,
      researcher: form.researcher,
      title: form.researchTitle,
      status: !isAccepted ? RESEARCH_APPLICATION_STATUS.PENDING : RESEARCH_APPLICATION_STATUS.APPROVED,
      description: form.description,
      disciplines: form.researchDisciplines,
      location: form.location,
      problem: form.problem,
      solution: form.solution,
      attributes: form.attributes,
      funding: form.funding,
      eta: form.eta,
      budgetAttachment: form.budgetAttachment,
      businessPlanAttachment: form.businessPlanAttachment,
      cvAttachment: form.cvAttachment,
      marketResearchAttachment: form.marketResearchAttachment,
      tx: form.tx
    });

    const researchApplication = researchApplicationRm.toObject();

    ctx.status = 200;
    ctx.body = { txResult, tx: form.tx, rm: researchApplication };

    if (!isAccepted) {
      ctx.state.events.push([APP_EVENTS.RESEARCH_APPLICATION_CREATED, { tx: form.tx, emitter: jwtUsername }]);
    } else {
      const research = await deipRpc.api.getResearchAsync(form.researchExternalId);
      const researcRm = await researchService.createResearchRef({
        externalId: research.external_id,
        researchGroupExternalId: research.research_group.external_id,
        researchGroupInternalId: research.research_group.id,
        title: research.title,
        abstract: research.abstract,
        attributes: researchApplication.attributes || []
      });

      const create_research_operation = form.tx['operations'][0][1]['proposed_ops'][1]['op'][1]['proposed_ops'][0]['op'];
      const tx = { 'operations': [create_research_operation]}
      
      ctx.state.events.push([APP_EVENTS.RESEARCH_CREATED, { tx, emitter: jwtUsername }]);
    }

  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }

  await next();
};


const editResearchApplication = async (ctx, next) => {
  const jwtUsername = ctx.state.user.username;
  const tenant = ctx.state.tenant;
  const researchService = new ResearchService(tenant);
  const applicationId = ctx.params.proposalId;

  try {

    const researchApplication = await researchService.findResearchApplicationById(applicationId);
    if (!researchApplication) {
      ctx.status = 404;
      ctx.body = `Research application "${applicationId}" is not found`;
      return;
    }

    if (researchApplication.status != RESEARCH_APPLICATION_STATUS.PENDING) {
      ctx.status = 400;
      ctx.body = `Research application "${applicationId}" status is ${researchApplication.status}`;
      return;
    }

    const formUploader = researchApplicationForm.fields([
      { name: 'budgetAttachment', maxCount: 1 },
      { name: 'businessPlanAttachment', maxCount: 1 },
      { name: 'cvAttachment', maxCount: 1 },
      { name: 'marketResearchAttachment', maxCount: 1 }
    ]);

    const form = await formUploader(ctx, () => new Promise((resolve, reject) => {
      const [budgetAttachment] = ctx.req.files.budgetAttachment ? ctx.req.files.budgetAttachment : [null];
      const [businessPlanAttachment] = ctx.req.files.businessPlanAttachment ? ctx.req.files.businessPlanAttachment : [null];
      const [cvAttachment] = ctx.req.files.cvAttachment ? ctx.req.files.cvAttachment : [null];
      const [marketResearchAttachment] = ctx.req.files.marketResearchAttachment ? ctx.req.files.marketResearchAttachment : [null];

      resolve({
        budgetAttachment: budgetAttachment ? budgetAttachment.filename : null,
        businessPlanAttachment: businessPlanAttachment ? businessPlanAttachment.filename : null,
        cvAttachment: cvAttachment ? cvAttachment.filename : null,
        marketResearchAttachment: marketResearchAttachment ? marketResearchAttachment.filename : null,

        ...ctx.req.body,
        location: JSON.parse(ctx.req.body.location),
        attributes: JSON.parse(ctx.req.body.attributes)
      });
    }));

    const update = {
      ...form,
      budgetAttachment: form.budgetAttachment ? form.budgetAttachment : researchApplication.budgetAttachment,
      businessPlanAttachment: form.businessPlanAttachment ? form.businessPlanAttachment : researchApplication.businessPlanAttachment,
      cvAttachment: form.cvAttachment ? form.cvAttachment : researchApplication.cvAttachment,
      marketResearchAttachment: form.marketResearchAttachment ? form.marketResearchAttachment : researchApplication.marketResearchAttachment
    }

    try {
      if (researchApplication.budgetAttachment != update.budgetAttachment) {
        await unlink(researchApplicationAttachmentFilePath(applicationId, researchApplication.budgetAttachment));
      }
      if (researchApplication.businessPlanAttachment != update.businessPlanAttachment) {
        await unlink(researchApplicationAttachmentFilePath(applicationId, researchApplication.businessPlanAttachment));
      }
      if (researchApplication.cvAttachment != update.cvAttachment) {
        await unlink(researchApplicationAttachmentFilePath(applicationId, researchApplication.cvAttachment));
      }
      if (researchApplication.marketResearchAttachment != update.marketResearchAttachment) {
        await unlink(researchApplicationAttachmentFilePath(applicationId, researchApplication.marketResearchAttachment));
      }
    } catch(err){}


    const researchApplicationData = researchApplication.toObject();
    const updatedResearchApplication = await researchService.updateResearchApplication(applicationId, {
      ...researchApplicationData,
      ...update
    });

    ctx.status = 200;
    ctx.body = { rm: updatedResearchApplication };

    ctx.state.events.push([APP_EVENTS.RESEARCH_APPLICATION_EDITED, { tx: researchApplicationData.tx, emitter: jwtUsername }]);

  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }

  await next();
};


const getResearchApplicationAttachmentFile = async function (ctx) {
  const jwtUsername = ctx.state.user.username;
  const tenant = ctx.state.tenant;
  const researchService = new ResearchService(tenant);
  const applicationId = ctx.params.proposalId;
  const filename = ctx.query.filename;
  const isDownload = ctx.query.download === 'true';

  try {

    if (!filename) {
      ctx.status = 400;
      ctx.body = `"filename" query param is required`;
      return;
    }

    const researchApplication = await researchService.findResearchApplicationById(applicationId);
    if (!researchApplication) {
      ctx.status = 404;
      ctx.body = `Research application "${applicationId}" is not found`;
      return;
    }

    const filepath = researchApplicationAttachmentFilePath(applicationId, filename);

    try {
      await stat(filepath);
    } catch (err) {
      ctx.status = 404;
      ctx.body = `File "${filename}" is not found`;
      return;
    }

    if (isDownload) {
      let ext = filename.substr(filename.lastIndexOf('.') + 1);
      let name = filename.substr(0, filename.lastIndexOf('.'));
      ctx.response.set('Content-disposition', `attachment; filename="${slug(name)}.${ext}"`);
      ctx.body = fs.createReadStream(filepath);
    } else {
      await send(ctx, filepath, { root: '/' });
    }

  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }
}


const approveResearchApplication = async (ctx, next) => {
  const jwtUsername = ctx.state.user.username;
  const tenant = ctx.state.tenant;
  const researchService = new ResearchService(tenant);
  const { tx } = ctx.request.body;

  try { 

    const operation = tx['operations'][0];
    const payload = operation[1];
    const { external_id: applicationId } = payload;

    const researchApplication = await researchService.findResearchApplicationById(applicationId);
    if (!researchApplication) {
      ctx.status = 404;
      ctx.body = `Research application "${applicationId}" is not found`;
      return;
    }

    if (researchApplication.status != RESEARCH_APPLICATION_STATUS.PENDING) {
      ctx.status = 400;
      ctx.body = `Research application "${applicationId}" status is ${researchApplication.status}`;
      return;
    }

    const txResult = await blockchainService.sendTransactionAsync(tx);
    const updatedProposal = await deipRpc.api.getProposalAsync(applicationId);
    const isAccepted = updatedProposal == null;

    const research = await deipRpc.api.getResearchAsync(researchApplication.researchExternalId);
    const researcRm = await researchService.createResearchRef({
      externalId: research.external_id,
      researchGroupExternalId: research.research_group.external_id,
      researchGroupInternalId: research.research_group.id,
      title: research.title,
      abstract: research.abstract,
      attributes: researchApplication.attributes || []
    });

    const researchGroupRm = await researchGroupsService.createResearchGroup({
      externalId: research.research_group.external_id,
      creator: researchApplication.researcher
    });

    const researchApplicationData = researchApplication.toObject();
    const updatedResearchApplication = await researchService.updateResearchApplication(applicationId, {
      ...researchApplicationData,
      status: RESEARCH_APPLICATION_STATUS.APPROVED
    });
    
    ctx.status = 200;
    ctx.body = { tx, txResult, rm: researcRm };

    if (isAccepted) {
      ctx.state.events.push([APP_EVENTS.RESEARCH_APPLICATION_APPROVED, { tx: researchApplicationData.tx, emitter: jwtUsername }]);
    }
    
  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }

  await next();
}


const rejectResearchApplication = async (ctx, next) => {
  const jwtUsername = ctx.state.user.username;
  const tenant = ctx.state.tenant;
  const researchService = new ResearchService(tenant);
  const { tx } = ctx.request.body;

  try { 

    const operation = tx['operations'][0];
    const payload = operation[1];
    const { external_id: applicationId } = payload;

    const researchApplication = await researchService.findResearchApplicationById(applicationId);
    if (!researchApplication) {
      ctx.status = 404;
      ctx.body = `Research application "${applicationId}" is not found`;
      return;
    }

    if (researchApplication.status != RESEARCH_APPLICATION_STATUS.PENDING) {
      ctx.status = 400;
      ctx.body = `Research application "${applicationId}" status is ${researchApplication.status}`;
      return;
    }

    const txResult = await blockchainService.sendTransactionAsync(tx);

    const researchApplicationData = researchApplication.toObject();
    const updatedResearchApplication = await researchService.updateResearchApplication(applicationId, {
      ...researchApplicationData,
      status: RESEARCH_APPLICATION_STATUS.REJECTED
    });

    ctx.status = 200;
    ctx.body = { tx, txResult };

    ctx.state.events.push([APP_EVENTS.RESEARCH_APPLICATION_REJECTED, { tx: researchApplicationData.tx, emitter: jwtUsername }]);
    
  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }

  await next();
}


const deleteResearchApplication = async (ctx, next) => {
  const jwtUsername = ctx.state.user.username;
  const tenant = ctx.state.tenant;
  const researchService = new ResearchService(tenant);
  const { tx } = ctx.request.body;

  try {

    const operation = tx['operations'][0];
    const payload = operation[1];
    const { external_id: applicationId } = payload;

    const researchApplication = await researchService.findResearchApplicationById(applicationId);
    if (!researchApplication) {
      ctx.status = 404;
      ctx.body = `Research application "${applicationId}" is not found`;
      return;
    }

    if (researchApplication.status != RESEARCH_APPLICATION_STATUS.PENDING) {
      ctx.status = 400;
      ctx.body = `Research application "${applicationId}" status is ${researchApplication.status}`;
      return;
    }

    if (researchApplication.researcher != jwtUsername) {
      ctx.status = 401;
      ctx.body = `No access to research application "${applicationId}"`;
      return;
    }
    

    const txResult = await blockchainService.sendTransactionAsync(tx);

    const researchApplicationData = researchApplication.toObject();
    const updatedResearchApplication = await researchService.updateResearchApplication(applicationId, {
      ...researchApplicationData,
      status: RESEARCH_APPLICATION_STATUS.DELETED
    });

    ctx.status = 200;
    ctx.body = { tx, txResult };

    ctx.state.events.push([APP_EVENTS.RESEARCH_APPLICATION_DELETED, { tx: researchApplicationData.tx, emitter: jwtUsername }]);
    
  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }

  await next();
}


const getResearchApplications = async (ctx) => {
  const tenant = ctx.state.tenant;
  const researchService = new ResearchService(tenant);
  const status = ctx.query.status;
  const researcher = ctx.query.researcher;

  try {
    const result = await researchService.getResearchApplications({ status, researcher });
    ctx.status = 200;
    ctx.body = result;
  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }
}

const createResearchTokenSale = async (ctx) => {
  const jwtUsername = ctx.state.user.username;
  const { tx, isProposal } = ctx.request.body;

  try {
    const operation = isProposal ? tx['operations'][0][1]['proposed_ops'][0]['op'] : tx['operations'][0];
    const payload = operation[1];
    const researchGroupAccount = payload.research_group;

    const authorizedGroup = await authService.authorizeResearchGroupAccount(researchGroupAccount, jwtUsername);
    if (!authorizedGroup) {
      ctx.status = 401;
      ctx.body = `"${jwtUsername}" is not a member of "${researchGroupAccount}" group`;
      return;
    }

    const researchExternalId = payload.research_external_id;
    const research = await deipRpc.api.getResearchAsync(researchExternalId);

    const researchGroupInternalId = authorizedGroup.id;
    const researchInternalId = research.id;

    const txResult = await blockchainService.sendTransactionAsync(tx);

    // LEGACY >>>
    const parsedProposal = {
      research_group_id: researchGroupInternalId,
      action: deipRpc.operations.getOperationTag("create_research_token_sale"),
      creator: jwtUsername,
      data: { research_id: researchInternalId },
      isProposalAutoAccepted: !isProposal
    };
    userNotificationHandler.emit(USER_NOTIFICATION_TYPE.PROPOSAL, parsedProposal);
    researchGroupActivityLogHandler.emit(ACTIVITY_LOG_TYPE.PROPOSAL, parsedProposal);
    // <<< LEGACY

    ctx.status = 200;
    ctx.body = { txResult };

  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }
}


const createResearchTokenSaleContribution = async (ctx) => {
  const jwtUsername = ctx.state.user.username;
  const { tx, isProposal } = ctx.request.body;

  try {
    const operation = isProposal ? tx['operations'][0][1]['proposed_ops'][0]['op'] : tx['operations'][0];
    const payload = operation[1];

    const txResult = await blockchainService.sendTransactionAsync(tx);

    ctx.status = 200;
    ctx.body = { txResult };

  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }
}


const uploadResearchBackground = async (ctx) => {
  const jwtUsername = ctx.state.user.username;
  const researchExternalId = ctx.request.headers['research-external-id'];

  try {

    const research = await deipRpc.api.getResearchAsync(researchExternalId);
    const authorizedGroup = await authService.authorizeResearchGroupAccount(research.research_group.external_id, jwtUsername);

    if (!authorizedGroup) {
      ctx.status = 401;
      ctx.body = `"${jwtUsername}" is not permitted to edit "${researchExternalId}" research`;
      return;
    }

    const backgroundImage = researchBackgroundImageForm.single('research-background');
    const result = await backgroundImage(ctx, () => new Promise((resolve, reject) => {
      resolve({ 'filename': ctx.req.file.filename });
    }));

    ctx.status = 200;
    ctx.body = result;

  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }
}

const getResearchBackground = async (ctx) => {
  const researchExternalId = ctx.params.researchExternalId;
  const width = ctx.query.width ? parseInt(ctx.query.width) : 1440;
  const height = ctx.query.height ? parseInt(ctx.query.height) : 430;
  const noCache = ctx.query.noCache ? ctx.query.noCache === 'true' : false;
  const isRound = ctx.query.round ? ctx.query.round === 'true' : false;

  let src = researchBackgroundImageFilePath(researchExternalId);
  const stat = util.promisify(fs.stat);

  try {
    const check = await stat(src);
  } catch (err) {
    src = defaultResearchBackgroundImagePath();
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

  let background = await resize(width, height);

  if (isRound) {
    let round = (w) => {
      let r = w / 2;
      let circleShape = Buffer.from(`<svg><circle cx="${r}" cy="${r}" r="${r}" /></svg>`);
      return new Promise((resolve, reject) => {
        background = sharp(background)
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

    background = await round(width);
  }

  ctx.type = 'image/png';
  ctx.body = background;
}


const updateResearch = async (ctx, next) => {
  const jwtUsername = ctx.state.user.username;
  const { tx, isProposal, offchainMeta: { attributes } } = ctx.request.body;
  const tenant = ctx.state.tenant;
  const researchService = new ResearchService(tenant);

  try {
    const operation = isProposal ? tx['operations'][0][1]['proposed_ops'][0]['op'] : tx['operations'][0];
    const payload = operation[1];
    const {
      research_group: researchGroupAccount,
      external_id: researchExternalId
    } = payload;

    const authorizedGroup = await authService.authorizeResearchGroupAccount(researchGroupAccount, jwtUsername);
    if (!authorizedGroup) {
      ctx.status = 401;
      ctx.body = `"${jwtUsername}" is not a member of "${researchGroupAccount}" group`;
      return;
    }

    const research = await researchService.getResearch(researchExternalId);
    const hasChainUpdate = Object.keys(research).some(k => {
      return payload.hasOwnProperty(k) && payload[k] != research[k];
    });

    const researchRef = await researchService.updateResearchRef(researchExternalId, { attributes });
    const updatedResearch = await researchService.getResearch(externalId);

    if (hasChainUpdate) {
      await blockchainService.sendTransactionAsync(tx);

      ctx.status = 200;
      ctx.body = updatedResearch;
      ctx.state.events.push([isProposal ? APP_EVENTS.RESEARCH_UPDATE_PROPOSED : APP_EVENTS.RESEARCH_UPDATED, { tx, emitter: jwtUsername }]);

    } else {
      ctx.status = 200;
      ctx.body = updatedResearch;
    }

  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }

  await next();
};

const getPublicResearchListing = async (ctx) => {
  const tenant = ctx.state.tenant;
  const query = qs.parse(ctx.query);
  const filter = query.filter;
  const researchService = new ResearchService(tenant);

  try {
    const result = await researchService.lookupResearches(0, CHAIN_CONSTANTS.API_BULK_FETCH_LIMIT, filter);
    ctx.status = 200;
    ctx.body = result;
  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err.message;
  }
};


const getUserResearchListing = async (ctx) => {
  const jwtUsername = ctx.state.user.username;
  const tenant = ctx.state.tenant;
  const researchService = new ResearchService(tenant);
  const member = ctx.params.username;

  try {
    const result = await researchService.getResearchesByResearchGroupMember(member, jwtUsername);
    ctx.status = 200;
    ctx.body = result;
  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err.message;
  }
};


const getResearchGroupResearchListing = async (ctx) => {
  const tenant = ctx.state.tenant;
  const jwtUsername = ctx.state.user.username;
  const researchGroupExternalId = ctx.params.researchGroupExternalId;
  const researchService = new ResearchService(tenant);

  try {
    const result = await researchService.getResearchesByResearchGroup(researchGroupExternalId, jwtUsername);
    ctx.status = 200;
    ctx.body = result;
  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err.message;
  }
};


const getResearch = async (ctx) => {
  const tenant = ctx.state.tenant;
  const researchExternalId = ctx.params.researchExternalId;
  const researchService = new ResearchService(tenant);

  try { 

    const research = await researchService.getResearch(researchExternalId);
    if (!research) {
      ctx.status = 404;
      ctx.body = null;
      return;
    }

    ctx.status = 200;
    ctx.body = research;
  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err.message;
  }
};


export default {
  getResearchBackground,
  uploadResearchBackground,
  getResearch,
  getPublicResearchListing,
  getUserResearchListing,
  getResearchGroupResearchListing,
  updateResearch,
  createResearch,
  createResearchApplication,
  editResearchApplication,
  approveResearchApplication,
  rejectResearchApplication,
  deleteResearchApplication,
  getResearchApplicationAttachmentFile,
  getResearchApplications,
  createResearchTokenSale,
  createResearchTokenSaleContribution
}
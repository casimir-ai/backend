import multer from 'koa-multer';
import fs from 'fs';
import fsExtra from 'fs-extra'
import util from 'util';
import path from 'path';
import sharp from 'sharp'
import config from './../config'
import send from 'koa-send';
import slug from 'limax';
import mongoose from 'mongoose';
import deipRpc from '@deip/rpc-client';
import ResearchService from './../services/research';
import ResearchGroupService from './../services/researchGroup';
import ExpressLicensingService from './../services/expressLicensing';

import * as blockchainService from './../utils/blockchain';
import { APP_EVENTS, RESEARCH_STATUS, ACTIVITY_LOG_TYPE, USER_NOTIFICATION_TYPE, RESEARCH_APPLICATION_STATUS, CHAIN_CONSTANTS, RESEARCH_ATTRIBUTE_TYPE } from './../constants';
import qs from 'qs';


const stat = util.promisify(fs.stat);
const unlink = util.promisify(fs.unlink);
const ensureDir = util.promisify(fsExtra.ensureDir);


const createExpressLicenseRequest = async (ctx, next) => {
  const jwtUsername = ctx.state.user.username;
  const { tx, offchainMeta } = ctx.request.body;

  try {
    
    const txInfo = await blockchainService.sendTransactionAsync(tx);
    const operations = blockchainService.extractOperations(tx);

    const transferDatum = operations.find(([opName]) => opName == 'transfer');
    const approveTransferDatum = operations.find(([opName]) => opName == 'update_proposal');

    const [opName, transferPayload, transferProposal] = transferDatum;
    ctx.state.events.push([APP_EVENTS.RESEARCH_EXPRESS_LICENSE_REQUEST_CREATED, { opDatum: transferDatum, context: { emitter: jwtUsername, offchainMeta: { ...offchainMeta, txInfo: { ...txInfo, timestamp: new Date(Date.now()).toISOString() } } } }]);

    if (approveTransferDatum) {
      ctx.state.events.push([APP_EVENTS.RESEARCH_EXPRESS_LICENSE_REQUEST_SIGNED, { opDatum: approveTransferDatum, context: { emitter: jwtUsername, offchainMeta: { ...offchainMeta, txInfo: { ...txInfo, timestamp: new Date(Date.now()).toISOString() } } } }]);
    }
    
    ctx.status = 200;
    ctx.body = transferProposal;

  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }

  await next();
};


const approveExpressLicenseRequest = async (ctx, next) => {
  const jwtUsername = ctx.state.user.username;
  const { tx } = ctx.request.body;

  try {

    const txInfo = await blockchainService.sendTransactionAsync(tx);

    const operations = blockchainService.extractOperations(tx);

    const approveTransferDatum = operations.find(([opName]) => opName == 'update_proposal');
    const [opName, approveTransferPayload] = approveTransferDatum;

    ctx.state.events.push([APP_EVENTS.RESEARCH_EXPRESS_LICENSE_REQUEST_SIGNED, { opDatum: approveTransferDatum, context: { emitter: jwtUsername, offchainMeta: { txInfo: { ...txInfo, timestamp: new Date(Date.now()).toISOString() } } } }]);

    ctx.status = 200;
    ctx.body = approveTransferPayload;

  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }

  await next();

};


const rejectExpressLicenseRequest = async (ctx, next) => {
  const jwtUsername = ctx.state.user.username;
  const { tx } = ctx.request.body;

  try {

    const txInfo = await blockchainService.sendTransactionAsync(tx);
    const operations = blockchainService.extractOperations(tx);

    const rejectTransferDatum = operations.find(([opName]) => opName == 'delete_proposal');
    const [opName, rejectTransferPayload] = rejectTransferDatum;

    ctx.state.events.push([APP_EVENTS.RESEARCH_EXPRESS_LICENSE_REQUEST_CANCELED, { opDatum: rejectTransferDatum, context: { emitter: jwtUsername, offchainMeta: { txInfo: { ...txInfo, timestamp: new Date(Date.now()).toISOString() } } } }]);

    ctx.status = 200;
    ctx.body = rejectTransferPayload;

  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }

  await next();
};



const getExpressLicenseRequests = async (ctx) => {
  const expressLicensingService = new ExpressLicensingService();

  try {
    const result = await expressLicensingService.getExpressLicenseRequests()
    ctx.status = 200;
    ctx.body = result;
  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }
}

const getExpressLicenseRequestsByStatus = async (ctx) => {
  const expressLicensingService = new ExpressLicensingService();
  const status = ctx.params.status;

  try {
    const result = await expressLicensingService.getExpressLicenseRequestsByStatus(status);
    ctx.status = 200;
    ctx.body = result;
  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }
}


const getExpressLicenseRequestById = async (ctx) => {
  const expressLicensingService = new ExpressLicensingService();
  const requestId = ctx.params.requestId;

  try {
    const result = await expressLicensingService.getExpressLicenseRequestById(requestId);
    ctx.status = 200;
    ctx.body = result;
  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }
}


const getExpressLicenseRequestsByResearch = async (ctx) => {
  const expressLicensingService = new ExpressLicensingService();
  const researchExternalId = ctx.params.researchExternalId;

  try {
    const result = await expressLicensingService.getExpressLicenseRequestsByResearch(researchExternalId);
    ctx.status = 200;
    ctx.body = result;
  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }
}


const getExpressLicenseRequestsByRequester = async (ctx) => {
  const expressLicensingService = new ExpressLicensingService();
  const requester = ctx.params.requester;

  try {
    const result = await expressLicensingService.getExpressLicenseRequestsByRequester(requester);
    ctx.status = 200;
    ctx.body = result;
  } catch (err) {
    console.log(err);
    ctx.status = 500;
    ctx.body = err;
  }
}



export default {
  createExpressLicenseRequest,
  approveExpressLicenseRequest,
  rejectExpressLicenseRequest,

  getExpressLicenseRequests,
  getExpressLicenseRequestById,
  getExpressLicenseRequestsByStatus,
  getExpressLicenseRequestsByResearch,
  getExpressLicenseRequestsByRequester
}

import EventEmitter from 'events';
import deipRpc from '@deip/rpc-client';
import { handle, fire, wait } from './utils';
import { APP_EVENTS, RESEARCH_ATTRIBUTE } from './../constants';
import userNotificationsHandler from './userNotificationHandler';
import researchHandler from './researchHandler';
import researchGroupHandler from './researchGroupHandler';
import userInviteHandler from './userInviteHandler';
import expressLicensingHandler from './expressLicensingHandler';
import proposalHandler from './proposalHandler';
import researchContentHandler from './researchContentHandler';
import reviewHandler from './reviewHandler';

import UserService from './../services/users';
import ResearchService from './../services/research';
import ResearchContentService from './../services/researchContent';
import ResearchGroupService from './../services/researchGroup';
import ProposalService from './../services/proposal';

class AppEventHandler extends EventEmitter { }

const appEventHandler = new AppEventHandler();


appEventHandler.on(APP_EVENTS.RESEARCH_PROPOSED, (payload, reply) => handle(payload, reply, async (source) => {

  const { event: researchProposedEvent, tenant, emitter } = source;
  
  const usersService = new UserService();
  const researchGroupService = new ResearchGroupService();
  const { researchGroupExternalId, source: { offchain: { attributes } } } = researchProposedEvent.getSourceData();

  await wait(researchHandler, researchProposedEvent, null, tenant);
  await wait(proposalHandler, researchProposedEvent, null, tenant);

  // legacy
  const researchGroup = await researchGroupService.getResearchGroup(researchGroupExternalId);
  const proposerProfile = await usersService.findUserProfileByOwner(emitter);

  const researchTitle = attributes.some(rAttr => rAttr.researchAttributeId.toString() == RESEARCH_ATTRIBUTE.TITLE.toString())
    ? attributes.find(rAttr => rAttr.researchAttributeId.toString() == RESEARCH_ATTRIBUTE.TITLE.toString()).value
    : "Not Specified";

  const notificationPayload = { researchGroup, proposer: proposerProfile, researchTitle };

  userNotificationsHandler.emit(APP_EVENTS.RESEARCH_PROPOSED, notificationPayload);
}));


appEventHandler.on(APP_EVENTS.RESEARCH_CREATED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: researchCreatedEvent, tenant, emitter } = source;

  const usersService = new UserService();
  const researchService = new ResearchService();
  const researchGroupService = new ResearchGroupService();

  const research = await wait(researchHandler, researchCreatedEvent, null, tenant);

  // legacy
  const researchGroup = await researchGroupService.getResearchGroup(research.research_group.external_id);
  const creatorUser = await usersService.findUserProfileByOwner(emitter);
  const isAcceptedByQuorum = research.research_group.external_id != emitter;

  const payload = { tenant, researchGroup, research, creator: creatorUser, isAcceptedByQuorum };

  fire(userNotificationsHandler, APP_EVENTS.RESEARCH_CREATED, payload);
}));

appEventHandler.on(APP_EVENTS.RESEARCH_PROPOSAL_SIGNED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: researchProposalSignedEvent, tenant } = source;
  await wait(researchHandler, researchProposalSignedEvent, null, tenant);
}));

appEventHandler.on(APP_EVENTS.RESEARCH_PROPOSAL_REJECTED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: researchProposalRejectedEvent, tenant } = source;
  // register handlers
}));

appEventHandler.on(APP_EVENTS.USER_INVITATION_PROPOSED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: userInvitationProposedEvent, tenant, emitter } = source;

  const researchGroupService = new ResearchGroupService();
  const usersService = new UserService();

  await wait(proposalHandler, userInvitationProposedEvent, null, tenant);
  const userInvite = await wait(userInviteHandler, userInvitationProposedEvent, null, tenant);

  // legacy
  const researchGroup = await researchGroupService.getResearchGroup(userInvite.researchGroupExternalId);
  const inviteeProfile = await usersService.findUserProfileByOwner(userInvite.invitee);
  const creatorProfile = await usersService.findUserProfileByOwner(emitter);

  const payload = { tenant, researchGroup, invite: userInvite, invitee: inviteeProfile, creator: creatorProfile };

  userNotificationsHandler.emit(APP_EVENTS.USER_INVITATION_PROPOSED, payload);
}));


appEventHandler.on(APP_EVENTS.USER_INVITATION_PROPOSAL_SIGNED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: userInvitationProposalSignedEvent, tenant, emitter } = source;
  
  const usersService = new UserService();
  const researchGroupService = new ResearchGroupService();

  const updatedInvite = await wait(userInviteHandler, userInvitationProposalSignedEvent, null, tenant);
  fire(researchHandler, userInvitationProposalSignedEvent, null, tenant);

  // legacy
  const researchGroup = await researchGroupService.getResearchGroup(updatedInvite.researchGroupExternalId);
  const inviteeProfile = await usersService.findUserProfileByOwner(updatedInvite.invitee);
  const creatorProfile = await usersService.findUserProfileByOwner(updatedInvite.creator);
  const approverProfile = await usersService.findUserProfileByOwner(emitter);

  const payload = { tenant, researchGroup, invite: updatedInvite, invitee: inviteeProfile, creator: creatorProfile, approver: approverProfile };
  fire(userNotificationsHandler, APP_EVENTS.USER_INVITATION_PROPOSAL_SIGNED, payload);
}));


appEventHandler.on(APP_EVENTS.USER_INVITATION_PROPOSAL_REJECTED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: userInvitationProposalRejectedEvent, tenant, emitter } = source;

  const usersService = new UserService();
  const researchGroupService = new ResearchGroupService();

  const updatedInvite = await wait(userInviteHandler, userInvitationProposalRejectedEvent, null, tenant);

  fire(researchHandler, userInvitationProposalRejectedEvent, null, tenant);

  // legacy
  const researchGroup = await researchGroupService.getResearchGroup(updatedInvite.researchGroupExternalId);
  const inviteeProfile = await usersService.findUserProfileByOwner(updatedInvite.invitee);
  const creatorProfile = await usersService.findUserProfileByOwner(updatedInvite.creator);
  const rejectorProfile = await usersService.findUserProfileByOwner(emitter);

  const payload = { tenant, researchGroup, invite: updatedInvite, invitee: inviteeProfile, creator: creatorProfile, rejector: rejectorProfile };

  fire(userNotificationsHandler, APP_EVENTS.USER_INVITATION_PROPOSAL_REJECTED, payload);
}));


appEventHandler.on(APP_EVENTS.RESEARCH_CONTENT_PROPOSED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: researchContentProposedEvent, tenant, emitter } = source;
  const { researchGroupExternalId, researchExternalId, source: { offchain: { title } } } = researchContentProposedEvent.getSourceData();
  
  const usersService = new UserService();
  const researchGroupService = new ResearchGroupService();
  const researchService = new ResearchService();

  await wait(researchContentHandler, researchContentProposedEvent, null, tenant);
  await wait(proposalHandler, researchContentProposedEvent, null, tenant);

  // legacy
  const researchGroup = await researchGroupService.getResearchGroup(researchGroupExternalId);
  const research = await researchService.getResearch(researchExternalId);

  const proposerUser = await usersService.findUserProfileByOwner(emitter);

  const payload = { researchGroup, research, proposer: proposerUser, title };

  userNotificationsHandler.emit(APP_EVENTS.RESEARCH_CONTENT_PROPOSED, payload);

}));


appEventHandler.on(APP_EVENTS.RESEARCH_CONTENT_CREATED, (payload, reply) => handle(payload, reply, async (source) => {

  const { event: researchContentCreatedEvent, tenant, emitter } = source;
  const { researchContentExternalId, researchExternalId } = researchContentCreatedEvent.getSourceData();

  const usersService = new UserService();
  const researchGroupService = new ResearchGroupService();
  const researchService = new ResearchService();
  const researchContentService = new ResearchContentService();

  await wait(researchContentHandler, researchContentCreatedEvent, null, tenant);

  // legacy
  const researchContent = await researchContentService.getResearchContent(researchContentExternalId);
  const research = await researchService.getResearch(researchExternalId);
  const researchGroup = await researchGroupService.getResearchGroup(research.research_group.external_id);
  const creatorUser = await usersService.findUserProfileByOwner(emitter);
  const isAcceptedByQuorum = researchGroup.external_id != emitter;

  const payload = { researchGroup, research, researchContent, creator: creatorUser, isAcceptedByQuorum };

  userNotificationsHandler.emit(APP_EVENTS.RESEARCH_CONTENT_CREATED, payload);

}));


appEventHandler.on(APP_EVENTS.RESEARCH_CONTENT_PROPOSAL_SIGNED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: researchContentProposalSignedEvent, tenant } = source;
  await wait(researchContentHandler, researchContentProposalSignedEvent, null, tenant);
  // register handlers
}));


appEventHandler.on(APP_EVENTS.RESEARCH_CONTENT_PROPOSAL_REJECTED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: researchContentProposalRejectedEvent, tenant } = source;
  // register handlers
}));


appEventHandler.on(APP_EVENTS.RESEARCH_UPDATED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: researchUpdatedEvent } = source;

  await wait(researchHandler, researchUpdatedEvent);
  fire(userNotificationsHandler, researchUpdatedEvent);

}));


appEventHandler.on(APP_EVENTS.RESEARCH_UPDATE_PROPOSED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: researchUpdateProposedEvent } = source;

  await wait(researchHandler, researchUpdateProposedEvent);
  await wait(proposalHandler, researchUpdateProposedEvent);
  fire(userNotificationsHandler, researchUpdateProposedEvent);

}));


appEventHandler.on(APP_EVENTS.RESEARCH_UPDATE_PROPOSAL_SIGNED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: researchUpdateProposalSignedEvent, tenant } = source;
  await wait(researchHandler, researchUpdateProposalSignedEvent, null, tenant);
  // register handlers
}));

appEventHandler.on(APP_EVENTS.RESEARCH_UPDATE_PROPOSAL_REJECTED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: researchUpdateProposalRejectedEvent, tenant } = source;
  // register handlers
}));


appEventHandler.on(APP_EVENTS.RESEARCH_GROUP_CREATED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: researchGroupCreatedEvent, tenant } = source;
  await wait(researchGroupHandler, researchGroupCreatedEvent, null, tenant);
}));


appEventHandler.on(APP_EVENTS.RESEARCH_GROUP_UPDATED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: researchGroupUpdatedEvent, tenant, emitter } = source;

  const usersService = new UserService();
  const researchGroupService = new ResearchGroupService();

  const { researchGroupExternalId } = researchGroupUpdatedEvent.getSourceData();
  await wait(researchGroupHandler, researchGroupUpdatedEvent, null, tenant);

  const researchGroup = await researchGroupService.getResearchGroup(researchGroupExternalId);
  const creatorUser = await usersService.findUserProfileByOwner(emitter);
  const isAcceptedByQuorum = researchGroupExternalId != emitter;

  const payload = { researchGroup, creator: creatorUser, isAcceptedByQuorum };

  userNotificationsHandler.emit(APP_EVENTS.RESEARCH_GROUP_UPDATED, payload);

}));


appEventHandler.on(APP_EVENTS.RESEARCH_GROUP_UPDATE_PROPOSED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: researchGroupUpdateProposedEvent, tenant, emitter } = source;

  const usersService = new UserService();
  const researchGroupService = new ResearchGroupService();

  const { researchGroupExternalId } = researchGroupUpdateProposedEvent.getSourceData();

  await wait(proposalHandler, researchGroupUpdateProposedEvent, null, tenant);

  const researchGroup = await researchGroupService.getResearchGroup(researchGroupExternalId);
  const proposerUser = await usersService.findUserProfileByOwner(emitter);

  const payload = { researchGroup, proposer: proposerUser };
  userNotificationsHandler.emit(APP_EVENTS.RESEARCH_GROUP_UPDATE_PROPOSED, payload);

}));

appEventHandler.on(APP_EVENTS.RESEARCH_GROUP_UPDATE_PROPOSAL_SIGNED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: researchGroupUpdateProposalSignedEvent, tenant, emitter } = source;
  await wait(researchGroupHandler, researchGroupUpdateProposalSignedEvent, null, tenant);
}));

appEventHandler.on(APP_EVENTS.RESEARCH_GROUP_UPDATE_PROPOSAL_REJECTED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: researchGroupUpdateProposalRejectedEvent, tenant, emitter } = source;
  // register handlers
}));


appEventHandler.on(APP_EVENTS.RESEARCH_APPLICATION_CREATED, (payload, reply) => handle(payload, reply, async (source) => {
  const { tx, emitter, tenant } = source;
  const create_proposal_operation = tx['operations'][0];
  const create_research_operation = tx['operations'][0][1]['proposed_ops'][1]['op'][1]['proposed_ops'][0]['op'];
  const { creator, external_id: proposalId } = create_proposal_operation[1];
  const { external_id: researchExternalId, title, disciplines } = create_research_operation[1];

  const usersService = new UserService();

  const requesterUserProfile = await usersService.findUserProfileByOwner(creator);
  const [requesterUserAccount] = await deipRpc.api.getAccountsAsync([creator]);
  const requesterUser = { profile: requesterUserProfile, account: requesterUserAccount };

  const proposal = await deipRpc.api.getProposalAsync(proposalId);
  const research = { researchExternalId, title, disciplines };

  const payload = { research, proposal, requester: requesterUser, tenant };

  userNotificationsHandler.emit(APP_EVENTS.RESEARCH_APPLICATION_CREATED, payload);

}));


appEventHandler.on(APP_EVENTS.RESEARCH_APPLICATION_APPROVED, (payload, reply) => handle(payload, reply, async (source) => {

  const { tx, emitter, tenant } = source;
  const create_proposal_operation = tx['operations'][0];
  const create_research_operation = tx['operations'][0][1]['proposed_ops'][1]['op'][1]['proposed_ops'][0]['op'];
  const { creator } = create_proposal_operation[1];
  const { external_id: researchExternalId, research_group: researchGroupExternalId } = create_research_operation[1];
  
  const usersService = new UserService();
  const researchGroupService = new ResearchGroupService();
  const researchService = new ResearchService();

  const approverUserProfile = await usersService.findUserProfileByOwner(emitter);
  const [approverUserAccount] = await deipRpc.api.getAccountsAsync([emitter]);
  const approverUser = { profile: approverUserProfile, account: approverUserAccount };

  const requesterUserProfile = await usersService.findUserProfileByOwner(creator);
  const [requesterUserAccount] = await deipRpc.api.getAccountsAsync([creator]);
  const requesterUser = { profile: requesterUserProfile, account: requesterUserAccount };

  const research = await researchService.getResearch(researchExternalId);
  const researchGroup = await researchGroupService.getResearchGroup(researchGroupExternalId);

  const payload = { research, researchGroup, approver: approverUser, requester: requesterUser, tenant };

  userNotificationsHandler.emit(APP_EVENTS.RESEARCH_APPLICATION_APPROVED, payload);

}));


appEventHandler.on(APP_EVENTS.RESEARCH_APPLICATION_REJECTED, (payload, reply) => handle(payload, reply, async (source) => {

  const { tx, emitter, tenant } = source;
  const create_proposal_operation = tx['operations'][0];
  const create_research_operation = tx['operations'][0][1]['proposed_ops'][1]['op'][1]['proposed_ops'][0]['op'];
  const { creator } = create_proposal_operation[1];
  const { external_id: researchExternalId, title, disciplines } = create_research_operation[1];

  const usersService = new UserService();

  const rejecterUserProfile = await usersService.findUserProfileByOwner(emitter);
  const [rejecterUserAccount] = await deipRpc.api.getAccountsAsync([emitter]);
  const rejecterUser = { profile: rejecterUserProfile, account: rejecterUserAccount };

  const requesterUserProfile = await usersService.findUserProfileByOwner(creator);
  const [requesterUserAccount] = await deipRpc.api.getAccountsAsync([creator]);
  const requesterUser = { profile: requesterUserProfile, account: requesterUserAccount };

  const research = { researchExternalId, title, disciplines };

  const payload = { research, rejecter: rejecterUser, requester: requesterUser, tenant };

  userNotificationsHandler.emit(APP_EVENTS.RESEARCH_APPLICATION_REJECTED, payload);

}));


appEventHandler.on(APP_EVENTS.RESEARCH_APPLICATION_EDITED, (payload, reply) => handle(payload, reply, async (source) => {

  const { tx, emitter, tenant } = source;
  const create_proposal_operation = tx['operations'][0];
  const create_research_operation = tx['operations'][0][1]['proposed_ops'][1]['op'][1]['proposed_ops'][0]['op'];
  const { creator, external_id: proposalId } = create_proposal_operation[1];
  const { external_id: researchExternalId, title, disciplines } = create_research_operation[1];

  const usersService = new UserService();

  const requesterUserProfile = await usersService.findUserProfileByOwner(creator);
  const [requesterUserAccount] = await deipRpc.api.getAccountsAsync([creator]);
  const requesterUser = { profile: requesterUserProfile, account: requesterUserAccount };
  const proposal = await deipRpc.api.getProposalAsync(proposalId);

  const research = { researchExternalId, title, disciplines };

  const payload = { research, requester: requesterUser, proposal, tenant };

  userNotificationsHandler.emit(APP_EVENTS.RESEARCH_APPLICATION_EDITED, payload);

}));


appEventHandler.on(APP_EVENTS.RESEARCH_APPLICATION_DELETED, (payload, reply) => handle(payload, reply, async (source) => {
  
  const { tx, emitter, tenant } = source;
  const create_proposal_operation = tx['operations'][0];
  const create_research_operation = tx['operations'][0][1]['proposed_ops'][1]['op'][1]['proposed_ops'][0]['op'];
  const { creator, external_id: proposalId } = create_proposal_operation[1];
  const { external_id: researchExternalId, title, disciplines } = create_research_operation[1];

  const usersService = new UserService();

  const requesterUserProfile = await usersService.findUserProfileByOwner(creator);
  const [requesterUserAccount] = await deipRpc.api.getAccountsAsync([creator]);
  const requesterUser = { profile: requesterUserProfile, account: requesterUserAccount };

  const research = { researchExternalId, title, disciplines };

  const payload = { research, requester: requesterUser, tenant };

  userNotificationsHandler.emit(APP_EVENTS.RESEARCH_APPLICATION_DELETED, payload);

}));


appEventHandler.on(APP_EVENTS.USER_RESIGNATION_PROPOSED, (payload, reply) => handle(payload, reply, async (source) => {

  const { event: userResignationProposedEvent, tenant, emitter } = source;

  const usersService = new UserService();
  const researchGroupService = new ResearchGroupService();

  const { member, researchGroupExternalId } = userResignationProposedEvent.getSourceData();

  await wait(proposalHandler, userResignationProposedEvent, null, tenant);

  // legacy
  const researchGroup = await researchGroupService.getResearchGroup(researchGroupExternalId);
  const memberProfile = await usersService.findUserProfileByOwner(member);
  const creatorProfile = await usersService.findUserProfileByOwner(emitter);

  const payload = { tenant, researchGroup, member: memberProfile, creator: creatorProfile };
  fire(userNotificationsHandler, APP_EVENTS.USER_RESIGNATION_PROPOSED, payload);
}));


appEventHandler.on(APP_EVENTS.USER_RESIGNATION_PROPOSAL_SIGNED, (payload, reply) => handle(payload, reply, async (source) => {

  const { event: userResignationProposalSignedEvent, tenant, emitter } = source;

  const usersService = new UserService();
  const researchService = new ResearchService();
  const researchGroupService = new ResearchGroupService();
  const proposalsService = new ProposalService(usersService, researchGroupService, researchService);

  const proposalId = userResignationProposalSignedEvent.getProposalId();
  const proposal = await proposalsService.getProposal(proposalId);
  const { member, researchGroupExternalId } = proposal.details;

  fire(researchHandler, userResignationProposalSignedEvent, null, tenant);

  // legacy
  const researchGroup = await researchGroupService.getResearchGroup(researchGroupExternalId);
  const memberProfile = await usersService.findUserProfileByOwner(member);
  const creatorProfile = await usersService.findUserProfileByOwner(emitter);

  const payload = { tenant, researchGroup, member: memberProfile, creator: creatorProfile };
  fire(userNotificationsHandler, APP_EVENTS.USER_RESIGNATION_PROPOSAL_SIGNED, payload);
}));


appEventHandler.on(APP_EVENTS.USER_RESIGNATION_PROPOSAL_REJECTED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: userResignationProposalSignedEvent, tenant, emitter } = source;
  // register handlers
}));

appEventHandler.on(APP_EVENTS.RESEARCH_TOKEN_SALE_CREATED, (payload, reply) => handle(payload, reply, async (source) => {

  const { event: researchTokenSaleCreatedEvent, tenant, emitter } = source;

  const usersService = new UserService();
  const researchService = new ResearchService();
  const researchGroupService = new ResearchGroupService();

  const { researchTokenSaleExternalId, researchExternalId, researchGroupExternalId } = researchTokenSaleCreatedEvent.getSourceData();

  await wait(researchHandler, researchTokenSaleCreatedEvent, null, tenant);

  // legacy
  const research = await researchService.getResearch(researchExternalId);
  const researchGroup = await researchGroupService.getResearchGroup(researchGroupExternalId);
  const creatorProfile = await usersService.findUserProfileByOwner(emitter);

  const tokenSale = await deipRpc.api.getResearchTokenSaleAsync(researchTokenSaleExternalId);

  const paylod = { researchGroup, research, tokenSale, creator: creatorProfile };

  fire(userNotificationsHandler, APP_EVENTS.RESEARCH_TOKEN_SALE_CREATED, paylod);

}));


appEventHandler.on(APP_EVENTS.RESEARCH_TOKEN_SALE_PROPOSED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: researchTokenSaleProposedEvent, tenant, emitter } = source;

  const usersService = new UserService();
  const researchService = new ResearchService();
  const researchGroupService = new ResearchGroupService();

  const { researchExternalId, researchGroupExternalId } = researchTokenSaleProposedEvent.getSourceData();

  await wait(proposalHandler, researchTokenSaleProposedEvent, null, tenant);

  // legacy
  const research = await researchService.getResearch(researchExternalId);
  const researchGroup = await researchGroupService.getResearchGroup(researchGroupExternalId);
  const proposerProfile = await usersService.findUserProfileByOwner(emitter);

  const paylod = { researchGroup, research, tokenSale: null, proposer: proposerProfile };

  fire(userNotificationsHandler, APP_EVENTS.RESEARCH_TOKEN_SALE_PROPOSED, paylod);

}));


appEventHandler.on(APP_EVENTS.RESEARCH_TOKEN_SALE_PROPOSAL_SIGNED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: researchTokenSaleProposalSignedEvent, tenant } = source;
  await wait(researchHandler, researchTokenSaleProposalSignedEvent, null, tenant);
}));


appEventHandler.on(APP_EVENTS.RESEARCH_TOKEN_SALE_PROPOSAL_REJECTED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: researchTokenSaleProposalRejectedEvent, tenant } = source;
  // register handlers
}));

appEventHandler.on(APP_EVENTS.RESEARCH_EXPRESS_LICENSE_PROPOSED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: researchExpressLicenseProposedEvent, tenant } = source;
  await wait(proposalHandler, researchExpressLicenseProposedEvent, null, tenant);
}));

appEventHandler.on(APP_EVENTS.RESEARCH_EXPRESS_LICENSE_PROPOSAL_SIGNED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: researchExpressLicenseProposalSignedEvent, tenant } = source;
  await wait(expressLicensingHandler, researchExpressLicenseProposalSignedEvent, null, tenant);
}));

appEventHandler.on(APP_EVENTS.RESEARCH_EXPRESS_LICENSE_PROPOSAL_REJECTED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: researchExpressLicenseProposalRejectedEvent, tenant } = source;
  // register handlers
}));

appEventHandler.on(APP_EVENTS.ASSET_EXCHANGE_PROPOSED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: assetExchangeProposedEvent, tenant } = source;
  await wait(proposalHandler, assetExchangeProposedEvent, null, tenant);
}));

appEventHandler.on(APP_EVENTS.ASSET_EXCHANGE_PROPOSAL_SIGNED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: assetExchangeProposalSignedEvent, tenant } = source;
  // register handlers
}));

appEventHandler.on(APP_EVENTS.ASSET_EXCHANGE_PROPOSAL_REJECTED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: assetExchangeProposalRejectedEvent, tenant } = source;
  // register handlers
}));

appEventHandler.on(APP_EVENTS.ASSET_TRANSFERRED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: assetTransferredEvent, tenant } = source;
  // register handlers
}));

appEventHandler.on(APP_EVENTS.ASSET_TRANSFER_PROPOSED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: assetTransferProposedEvent, tenant } = source;
  await wait(proposalHandler, assetTransferProposedEvent, null, tenant);
}));

appEventHandler.on(APP_EVENTS.ASSET_TRANSFER_PROPOSAL_SIGNED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: assetTransferProposalSignedEvent, tenant } = source;
  // register handlers
}));

appEventHandler.on(APP_EVENTS.ASSET_TRANSFER_PROPOSAL_REJECTED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: assetTransferProposalRejectedEvent, tenant } = source;
  // register handlers
}));

appEventHandler.on(APP_EVENTS.RESEARCH_CONTENT_EXPERT_REVIEW_CREATED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: reviewCreatedEvent, tenant } = source;
  await wait(reviewHandler, reviewCreatedEvent, null, tenant);

  fire(userNotificationsHandler, APP_EVENTS.RESEARCH_CONTENT_EXPERT_REVIEW_CREATED, source);
}));


appEventHandler.on(APP_EVENTS.RESEARCH_TOKEN_SALE_CONTRIBUTED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: researchTokenSaleContributedEvent, tenant } = source;
  await wait(researchHandler, researchTokenSaleContributedEvent, null, tenant);
}));


appEventHandler.on(APP_EVENTS.RESEARCH_CONTENT_EXPERT_REVIEW_REQUESTED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: reviewRequestedEvent } = source;
  
  fire(userNotificationsHandler, reviewRequestedEvent);
}));


export default appEventHandler;
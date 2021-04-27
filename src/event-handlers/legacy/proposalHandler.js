import EventEmitter from 'events';
import deipRpc from '@deip/rpc-client';
import { LEGACY_APP_EVENTS, SMART_CONTRACT_TYPE } from './../../constants';
import { handle, fire, wait } from './utils';
import ResearchGroupService from './../../services/researchGroup';
import ProposalService from './../../services/proposal';
import UserService from './../../services/users';


class ProposalHandler extends EventEmitter { }

const proposalHandler = new ProposalHandler();

const usersService = new UserService({ scoped: false });
const researchGroupService = new ResearchGroupService({ scoped: false });
const proposalsService = new ProposalService({ scoped: false });

async function createProposalRef(event, chainContractType) {

  const proposalId = event.getProposalId();
  const eventModel = event.getSourceData();
  const chainProposal = await deipRpc.api.getProposalStateAsync(proposalId);

  const chainAccounts = await deipRpc.api.getAccountsAsync(chainProposal.required_approvals);

  const researchGroupsNames = chainAccounts.filter(a => a.is_research_group).map(a => a.name);
  const usersNames = chainAccounts.filter(a => !a.is_research_group).map(a => a.name);

  const involvedUsers = await usersService.getUsers(usersNames);
  const involvedResearchGroups = await researchGroupService.getResearchGroups(researchGroupsNames);

  const multiTenantIds = [...involvedUsers, ...involvedResearchGroups].reduce((acc, item) => {
    if (!acc.some(id => id == item.tenantId)) {
      acc.push(item.tenantId);
    }
    return acc;
  }, []);
  
  const proposalRef = await proposalsService.createProposalRef(proposalId, {
    type: chainContractType,
    details: {
      ...eventModel
    },
    multiTenantIds: multiTenantIds
  });

  return proposalRef;
}

proposalHandler.on(LEGACY_APP_EVENTS.RESEARCH_PROPOSED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: researchProposedEvent } = source;
  const proposalRef = await createProposalRef(researchProposedEvent, SMART_CONTRACT_TYPE.CREATE_RESEARCH);
  return proposalRef;
}));

proposalHandler.on(LEGACY_APP_EVENTS.RESEARCH_UPDATE_PROPOSED, (payload, reply) => handle(payload, reply, async ({ event: researchUpdateProposedEvent }) => {
  const proposalRef = await createProposalRef(researchUpdateProposedEvent, SMART_CONTRACT_TYPE.UPDATE_RESEARCH);
  return proposalRef;
}));

proposalHandler.on(LEGACY_APP_EVENTS.ASSET_EXCHANGE_PROPOSED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: assetExchangeProposedEvent } = source;
  const proposalRef = await createProposalRef(assetExchangeProposedEvent, SMART_CONTRACT_TYPE.ASSET_EXCHANGE);
  return proposalRef;
}));

proposalHandler.on(LEGACY_APP_EVENTS.ASSET_TRANSFER_PROPOSED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: assetTransferProposedEvent } = source;
  const proposalRef = await createProposalRef(assetTransferProposedEvent, SMART_CONTRACT_TYPE.ASSET_TRANSFER);
  return proposalRef;
}));

proposalHandler.on(LEGACY_APP_EVENTS.RESEARCH_GROUP_UPDATE_PROPOSED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: researchGroupUpdateProposedEvent } = source;
  const proposalRef = await createProposalRef(researchGroupUpdateProposedEvent, SMART_CONTRACT_TYPE.UPDATE_RESEARCH_GROUP);
  return proposalRef;
}));

proposalHandler.on(LEGACY_APP_EVENTS.RESEARCH_CONTENT_PROPOSED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: researchContentProposedEvent } = source;
  const proposalRef = await createProposalRef(researchContentProposedEvent, SMART_CONTRACT_TYPE.CREATE_RESEARCH_CONTENT);
  return proposalRef;
}));

proposalHandler.on(LEGACY_APP_EVENTS.RESEARCH_TOKEN_SALE_PROPOSED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: researchTokenSaleProposedEvent } = source;
  const proposalRef = await createProposalRef(researchTokenSaleProposedEvent, SMART_CONTRACT_TYPE.CREATE_RESEARCH_TOKEN_SALE);
  return proposalRef;
}));

proposalHandler.on(LEGACY_APP_EVENTS.RESEARCH_EXPRESS_LICENSE_PROPOSED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: researchExpressLicenseProposedEvent } = source;
  const proposalRef = await createProposalRef(researchExpressLicenseProposedEvent, SMART_CONTRACT_TYPE.EXPRESS_LICENSE_REQUEST);
  return proposalRef;
}));

proposalHandler.on(LEGACY_APP_EVENTS.USER_INVITATION_PROPOSED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: userInvitationProposedEvent } = source;
  const proposalRef = await createProposalRef(userInvitationProposedEvent, SMART_CONTRACT_TYPE.INVITE_MEMBER);
  return proposalRef;
}));

proposalHandler.on(LEGACY_APP_EVENTS.USER_RESIGNATION_PROPOSED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: userResignationProposedEvent } = source;
  const proposalRef = await createProposalRef(userResignationProposedEvent, SMART_CONTRACT_TYPE.EXCLUDE_MEMBER);
  return proposalRef;
}));

proposalHandler.on(LEGACY_APP_EVENTS.RESEARCH_NDA_PROPOSED, (payload, reply) => handle(payload, reply, async (source) => {
  const { event: researchNdaProposedEvent } = source;
  const proposalRef = await createProposalRef(researchNdaProposedEvent, SMART_CONTRACT_TYPE.RESEARCH_NDA);
  return proposalRef;
}));

export default proposalHandler;
import BaseEventHandler from './../base/BaseEventHandler';
import APP_EVENT from './../../events/base/AppEvent';
import APP_PROPOSAL_EVENT from './../../events/base/AppProposalEvent';
import { TeamDtoService, ProposalService } from './../../services';
import config from './../../config';
import { ChainService } from '@deip/chain-service';
import { waitChainBlockAsync } from './../../utils/network';


class ProposalEventHandler extends BaseEventHandler {

  constructor() {
    super();
  }

}

const proposalEventHandler = new ProposalEventHandler();

const proposalService = new ProposalService();
const teamDtoService = new TeamDtoService();


proposalEventHandler.register(APP_EVENT.PROPOSAL_CREATED, async (event) => {
  const { proposalId, creator, status, proposalCmd, type } = event.getEventPayload();
  const chainService = await ChainService.getInstanceAsync(config);
  const chainRpc = chainService.getChainRpc();

  await waitChainBlockAsync(); // We have to wait for proposal creation in the Chain until we have chain Event Streaming subscription
  const chainProposal = await chainRpc.getProposalAsync(proposalId);
  const tenantIdsScope = [];
  const decisionMakers = [];

  if (chainProposal) { // Proposal may be deleted from the chain once it's resolved, let's keep this check until subscriptions to chain Event Stream
    const teams = await teamDtoService.getTeams(chainProposal.decisionMakers);
    const portalIdsScope = teams.reduce((acc, item) => {
      return acc.some(id => id == item.tenantId) ? acc : [...acc, item.tenantId];
    }, []);
    tenantIdsScope.push(...portalIdsScope);
    decisionMakers.push(...chainProposal.decisionMakers);
  } else {
    console.warn(`Proposal with ID '${proposalId}' is not found in the Chain`);
  }


  let details = {}; // TEMP support for legacy 'details' field, must be removed after schema separation
  const ProposalCreatedHookEvent = APP_PROPOSAL_EVENT[type]['CREATED'];
  if (ProposalCreatedHookEvent) {
    const proposedCmds = proposalCmd.getProposedCmds();
    const typedEvent = new ProposalCreatedHookEvent({
      proposalCmd: proposalCmd,
      proposalCtx: { proposalId, type, proposedCmds }
    });
    details = typedEvent.getEventPayload();
  } 

  await proposalService.createProposal({
    proposalId: proposalId,
    proposalCmd: proposalCmd,
    status: status,
    type: type,
    details: details,
    tenantIdsScope: tenantIdsScope,
    creator: creator,
    decisionMakers: decisionMakers
  });
  
});

proposalEventHandler.register(APP_EVENT.PROPOSAL_ACCEPTED, async (event) => {
  const { proposalId, status, account } = event.getEventPayload();

  const proposal = await proposalService.getProposal(proposalId);
  const approvers = [...proposal.approvers, account];
  await proposalService.updateProposal(proposalId, {
    status: status,
    approvers: approvers
  });
});

proposalEventHandler.register(APP_EVENT.PROPOSAL_DECLINED, async (event) => {
  const { proposalId, status, account } = event.getEventPayload();

  const proposal = await proposalService.getProposal(proposalId);
  const rejectors = [...proposal.rejectors, account];
  await proposalService.updateProposal(proposalId, {
    status: status,
    rejectors: rejectors
  });
});

proposalEventHandler.register(APP_EVENT.TEAM_INVITE_CREATED, async (event) => {
  // TODO: create multisig transaction read schema
});

proposalEventHandler.register(APP_EVENT.PROJECT_PROPOSAL_CREATED, async (event) => {
  // TODO: create multisig transaction read schema
});

proposalEventHandler.register(APP_EVENT.PROJECT_UPDATE_PROPOSAL_CREATED, async (event) => {
  // TODO: create multisig transaction read schema
});

proposalEventHandler.register(APP_EVENT.TEAM_UPDATE_PROPOSAL_ACCEPTED, async (event) => {
  // TODO: create multisig transaction read schema
});

proposalEventHandler.register(APP_EVENT.TEAM_UPDATE_PROPOSAL_CREATED, async (event) => {
  // TODO: create multisig transaction read schema
});

proposalEventHandler.register(APP_EVENT.TEAM_UPDATE_PROPOSAL_DECLINED, async (event) => {
  // TODO: create multisig transaction read schema
});

proposalEventHandler.register(APP_EVENT.PROJECT_TOKEN_SALE_PROPOSAL_CREATED, async (event) => {
  // TODO: create multisig transaction read schema
});

proposalEventHandler.register(APP_EVENT.PROJECT_TOKEN_SALE_PROPOSAL_ACCEPTED, async (event) => {
  // TODO: create multisig transaction read schema
});

proposalEventHandler.register(APP_EVENT.PROJECT_TOKEN_SALE_PROPOSAL_DECLINED, async (event) => {
  // TODO: create multisig transaction read schema
});

module.exports = proposalEventHandler;
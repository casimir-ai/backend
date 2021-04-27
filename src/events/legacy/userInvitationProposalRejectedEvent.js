import assert from 'assert';
import { LEGACY_APP_EVENTS } from './../../constants';
import AppEvent from './appEvent';
import ProposalRejectedEvent from './proposalRejectedEvent';

class UserInvitationProposalRejectedEvent extends ProposalRejectedEvent(AppEvent) {
  constructor(onchainDatums, offchainMeta, eventName = LEGACY_APP_EVENTS.USER_INVITATION_PROPOSAL_REJECTED) {
    super(onchainDatums, offchainMeta, eventName);
  }
}

module.exports = UserInvitationProposalRejectedEvent;
import BaseEvent from './../base/BaseEvent';
import { APP_EVENT } from '@deip/constants';
import assert from 'assert';


class DaoMemberRemovedEvent extends BaseEvent {

  constructor(eventPayload) {
    const {
      member,
      teamId
    } = eventPayload;

    assert(!!member, "'member' is required");
    assert(!!teamId, "'teamId' is required");

    super(APP_EVENT.DAO_MEMBER_REMOVED, eventPayload);
  }

}


module.exports = DaoMemberRemovedEvent;
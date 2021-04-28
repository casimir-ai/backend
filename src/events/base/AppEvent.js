import { createEnum } from '@deip/toolbox';


const APP_EVENT = createEnum({
  PROJECT_CREATED: 1,
  PROPOSAL_CREATED: 2,
  PROJECT_MEMBER_JOINED: 3,
  PROPOSAL_SIGNATURES_UPDATED: 4,
  TEAM_CREATED: 5,
  PROJECT_INVITE_CREATED: 6,
  PROJECT_PROPOSAL_CREATED: 7
});


module.exports = APP_EVENT;
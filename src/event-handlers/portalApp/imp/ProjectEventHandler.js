import { APP_EVENT, INVESTMENT_OPPORTUNITY_STATUS as TOKEN_SALE_STATUS } from '@deip/constants';
import { PROJECT_ATTRIBUTE, PROJECT_STATUS } from '../../../constants';
import { InvestmentOpportunityDtoService, ProjectService } from '../../../services';
import BaseEventHandler from '../../base/BaseEventHandler';


class ProjectEventHandler extends BaseEventHandler {

  constructor() {
    super();
  }

}

const projectEventHandler = new ProjectEventHandler();

const projectService = new ProjectService();
const invstOppDtoService = new InvestmentOpportunityDtoService();


projectEventHandler.register(APP_EVENT.PROJECT_CREATED, async (event) => {
  const {
    projectId,
    teamId,
    description,
    attributes,
    status,
    isDefault
  } = event.getEventPayload();

  await projectService.createProject({
    projectId: projectId,
    teamId: teamId,
    attributes: attributes,
    status: status,
    isDefault: isDefault
  });

});


projectEventHandler.register(APP_EVENT.PROJECT_UPDATED, async (event) => {
  const {
    projectId,
    attributes
  } = event.getEventPayload();

  await projectService.updateProject(projectId, {
    attributes: attributes
  });
});


projectEventHandler.register(APP_EVENT.PROJECT_DELETED, async (event) => {
  const {
    projectId
  } = event.getEventPayload();

  await projectService.updateProject(projectId, { status: PROJECT_STATUS.DELETED });

});


projectEventHandler.register(APP_EVENT.ATTRIBUTE_UPDATED, async (event) => {
  const { attribute } = event.getEventPayload();
  await projectService.updateAttributeInProjects({
    attributeId: attribute._id,
    type: attribute.type,
    valueOptions: attribute.valueOptions,
    defaultValue: attribute.defaultValue || null
  });
});


projectEventHandler.register(APP_EVENT.ATTRIBUTE_DELETED, async (event) => {
  const { attributeId } = event.getEventPayload();

  await projectService.removeAttributeFromProjects({
    attributeId
  });
});


projectEventHandler.register(APP_EVENT.INVESTMENT_OPPORTUNITY_CREATED, async (event) => {
  const { projectId } = event.getEventPayload();

  if (projectId) { // TODO: Replace this validation with InvstOpp type check
    const project = await projectService.getProject(projectId);
    const investmentOpportunityAttr = project.attributes.find(rAttr => rAttr.attributeId.toString() == PROJECT_ATTRIBUTE.INVESTMENT_OPPORTUNITY.toString());

    let hasUpdate = false;
    if (!investmentOpportunityAttr) {
      project.attributes.push({
        attributeId: PROJECT_ATTRIBUTE.INVESTMENT_OPPORTUNITY,
        value: true
      });
      hasUpdate = true;
    } else if (!investmentOpportunityAttr.value) {
      investmentOpportunityAttr.value = true;
      hasUpdate = true;
    }

    if (hasUpdate) {
      await projectService.updateProject(project._id, { attributes: project.attributes });
    }
  }

});


projectEventHandler.register(APP_EVENT.INVESTMENT_OPPORTUNITY_PARTICIPATED, async (event) => {
  const { investmentOpportunityId } = event.getEventPayload();

  const invstOpp = await invstOppDtoService.getInvstOpp(investmentOpportunityId);
  if (invstOpp.projectId) {
    const project = await projectService.getProject(invstOpp.projectId);

    if (invstOpp.status != TOKEN_SALE_STATUS.ACTIVE) {
      const invstOppAttr = project.attributes.find(rAttr => rAttr.attributeId.toString() == PROJECT_ATTRIBUTE.INVESTMENT_OPPORTUNITY.toString());
      let hasUpdate = false;

      if (!invstOppAttr) {
        project.attributes.push({
          attributeId: PROJECT_ATTRIBUTE.INVESTMENT_OPPORTUNITY,
          value: false
        });
        hasUpdate = true;
      } else if (invstOppAttr.value) {
        invstOppAttr.value = false;
        hasUpdate = true;
      }

      if (hasUpdate) {
        await projectService.updateProject(project._id, { attributes: project.attributes });
      }
    }
  }

});

module.exports = projectEventHandler;
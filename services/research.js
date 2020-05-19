import deipRpc from '@deip/rpc-client';
import Research from './../schemas/research';

async function findResearchById(externalId) {
  let research = await Research.findOne({ _id: externalId });
  return research;
}

async function createResearch({
  externalId,
  researchGroupExternalId,
  researchGroupInternalId,
  milestones,
  videoSrc,
  partners,
  tenantCriterias,
}) {

  const research = new Research({
    _id: externalId,
    researchGroupExternalId,
    milestones,
    videoSrc,
    partners,
    tenantCriterias,
    researchGroupId: researchGroupInternalId, // legacy internal id
  });

  return research.save();
}

async function updateResearch(externalId, {
  milestones,
  videoSrc,
  partners,
  tenantCriterias
}) {

  const research = await findResearchById(externalId);
  research.milestones = milestones;
  research.videoSrc = videoSrc;
  research.partners = partners;
  research.tenantCriterias = tenantCriterias;

  return research.save();
}

async function processResearchCriterias(
  oldComponents,
  newComponents
) {

  const addedComponents = [];
  const removedComponents = [];

  for (let i = 0; i < newComponents.length; i++) {
    let newCom = newComponents[i];
    if (oldComponents.some(oldCom => oldCom._id.toString() == newCom._id.toString())) continue;
    addedComponents.push(newCom);
  }

  for (let i = 0; i < oldComponents.length; i++) {
    let oldCom = oldComponents[i];
    if (newComponents.some(newCom => newCom._id.toString() == oldCom._id.toString())) continue;
    removedComponents.push(oldCom);
  }

  let addedCriteriaPromises = [];
  for (let i = 0; i < addedComponents.length; i++) {
    let component = addedComponents[i];
    addedCriteriaPromises.push(addCriteriaToResearches({
      component: component._id.toString(),
      type: component.type
    }))
  }

  let removedCriteriaPromises = [];
  for (let i = 0; i < removedComponents.length; i++) {
    let component = removedComponents[i];
    removedCriteriaPromises.push(removeCriteriaToResearches({
      component: component._id.toString()
    }))
  }

  await Promise.all(addedCriteriaPromises);
  await Promise.all(removedCriteriaPromises);
}


async function addCriteriaToResearches({
  component,
  type
}) {
  const result = await Research.update({}, { $push: { tenantCriterias: { component: component, type: type } } }, { multi: true });
  return result;
}

async function removeCriteriaToResearches({
  component
}) {
  const result = await Research.update({}, { $pull: { 'tenantCriterias': { 'component': component } } }, { multi: true });
  return result;
}


export default {
  findResearchById,
  createResearch,
  updateResearch,
  processResearchCriterias,
  addCriteriaToResearches,
  removeCriteriaToResearches
}
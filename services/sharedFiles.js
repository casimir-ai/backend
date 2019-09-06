import SharedFile from '../schemas/sharedFile';

async function createSharedFile ({
  fileRefId, filename, sender, receiver,
  contractId, contractTitle, status = 'locked',
}) {
  const newSharedFile = new SharedFile({
    fileRefId, filename, sender, receiver,
    contractTitle, status
  });
  if (contractId || contractId === 0) {
    newSharedFile.contractId = `${contractId}`;
  }
  return newSharedFile.save();
}

async function getSharedFileById (_id) {
  return SharedFile.find({ _id });
}

async function checkFileAlreadyShared ({
  fileRefId, receiver, sender
}) {
  const existingShare = await SharedFile.findOne({
    fileRefId, receiver, sender
  });

  return !!existingShare;
}

async function getAllSharedFilesByUsername (username) {
  return SharedFile.find({
    $or: [{ sender: username }, { receiver: username }]
  });
}

async function askPermissionToSharedFile (_id) {
  return SharedFile.findOneAndUpdate({ _id }, {
    $set: {
      status: 'access_requested'
    }
  }, { new: true });
}

async function unlockSharedFile (_id) {
  return SharedFile.findOneAndUpdate({ _id }, {
    $set: {
      status: 'unlocked'
    }
  }, { new: true });
}

export default {
  createSharedFile,
  getSharedFileById,
  getAllSharedFilesByUsername,
  checkFileAlreadyShared,
  askPermissionToSharedFile,
  unlockSharedFile
}

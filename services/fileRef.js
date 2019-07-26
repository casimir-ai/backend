import deipRpc from '@deip/deip-rpc-client';
import FileRef from './../schemas/fileRef';

async function findFileRefById(_id) {
  const fr = await FileRef.findOne({ _id });
  return fr;
}

async function findFileRefByHash(projectId, hash) {
  const fr = await FileRef.findOne({ projectId, hash });
  return fr;
}

async function createFileRef(
  organizationId,
  projectId,
  filename,
  filetype,
  filepath,
  size,
  hash,
  iv,
  chunkSize,
  permlink,
  accessKeys,
  status
) {
  const fr = new FileRef({
    organizationId: organizationId,
    projectId: projectId,
    filename: filename,
    filetype: filetype,
    filepath: filepath,
    size: size,
    hash: hash,
    iv: iv,
    chunkSize: chunkSize,
    permlink: permlink,
    accessKeys: accessKeys,
    status: status,
  });
  const savedRef = await fr.save();
  return savedRef;
}

async function createTimestampedFileRef(
  organizationId,
  projectId,
  filename,
  filetype,
  size,
  hash,
  permlink
) {
  const fr = new FileRef({
    organizationId: organizationId,
    projectId: projectId,
    filename: filename,
    filetype: filetype,
    filepath: null,
    size: size,
    hash: hash,
    iv: null,
    chunkSize: null,
    permlink: permlink,
    accessKeys: [],
    status: "timestamped",
  });
  const savedRef = await fr.save();
  return savedRef;
}

async function setUploadedAndTimestampedStatus(projectId, hash, iv, chunkSize, filepath, accessKeys) {
  if (!hash || !iv || !chunkSize || !filepath || !accessKeys) return;

  let fileRef = await findFileRefByHash(projectId, hash);
  fileRef.iv = iv;
  fileRef.chunkSize = chunkSize;
  fileRef.filepath = filepath;
  fileRef.accessKeys = accessKeys;
  fileRef.status = "uploaded_and_timestamped";

  let updatedFileRef = await fileRef.save();
  return updatedFileRef;
}

export {
  findFileRefById,
  findFileRefByHash,
  createFileRef,
  setUploadedAndTimestampedStatus,
  createTimestampedFileRef
}
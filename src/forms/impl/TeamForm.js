import multer from 'koa-multer';
import BaseForm from './../base/BaseForm';
import mongoose from 'mongoose';
import { getFileStorageUploader } from './../storage';

const ENTITY_ID_HEADER = "entity-id";
const TEAM_ATTRIBUTE_ID_SPLITTER = '-';

const destinationHandler = (fileStorage) => function () {
  return async function (req, file, callback) {
    const teamId = req.headers[ENTITY_ID_HEADER];
    let folderPath = "";
    let filePath = "";

    const parts = file.originalname.split(TEAM_ATTRIBUTE_ID_SPLITTER);
    const teamAttrId = parts[0];
    if (parts.length > 1 && mongoose.Types.ObjectId.isValid(teamAttrId)) {
      folderPath = fileStorage.getTeamAttributeDirPath(teamId, teamAttrId);
      const name = file.originalname.substring(`${teamAttrId}${TEAM_ATTRIBUTE_ID_SPLITTER}`.length, file.originalname.length);
      filePath = fileStorage.getTeamAttributeFilePath(teamId, teamAttrId, name);
    } else {
      folderPath = fileStorage.getTeamDirPath(teamId);
      filePath = fileStorage.getTeamFilePath(teamId, file.originalname);
    }

    const folderExists = await fileStorage.exists(folderPath);
    if (folderExists) {
      const fileExists = await fileStorage.exists(filePath);
      if (fileExists) {
        await fileStorage.delete(filePath);
      }
    } else {
      await fileStorage.mkdir(folderPath);
    }

    callback(null, folderPath);
  };
}


const filenameHandler = () => function () {
  return function (req, file, callback) {
    let name = "";
    const parts = file.originalname.split(TEAM_ATTRIBUTE_ID_SPLITTER);
    const teamAttrId = parts[0];
    if (parts.length > 1 && mongoose.Types.ObjectId.isValid(teamAttrId)) {
      name = file.originalname.substring(`${teamAttrId}${TEAM_ATTRIBUTE_ID_SPLITTER}`.length, file.originalname.length);
    } else {
      name = file.originalname;
    }

    callback(null, name);
  }
}


const fileFilterHandler = (req, file, callback) => {
  // const allowedAvatarMimeTypes = ['image/png', 'image/jpeg', 'image/jpg'];
  // if (!allowedAvatarMimeTypes.some(mime => mime === file.mimetype)) {
  //   return callback(new Error('Only the following mime types are allowed: ' + allowedAvatarMimeTypes.join(', ')), false);
  // }
  callback(null, true);
}

class TeamForm extends BaseForm {

  constructor(nextHandler) {

    const filesUploader = multer({
      storage: getFileStorageUploader(destinationHandler, filenameHandler),
      fileFilter: fileFilterHandler
    });

    const multerHandler = filesUploader.any();

    const formHandler = (ctx) => multerHandler(ctx, () => new Promise((resolve, reject) => {
      try {
        resolve({ files: ctx.req.files });
      } catch (err) {
        reject(err);
      }
    }));

    return super(formHandler, nextHandler);
  }

}


export default TeamForm;
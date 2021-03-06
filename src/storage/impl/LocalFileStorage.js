import config from './../../config';
import BaseFileStorage from './../base/BaseFileStorage';
import util from 'util';
import fs from 'fs';
import path from 'path';
import fsExtra from 'fs-extra';
import rimraf from "rimraf";
import { FILE_STORAGE } from "./../../constants";
import { hashElement } from 'folder-hash';

const stat = util.promisify(fs.stat);
const unlink = util.promisify(fs.unlink);
const ensureDir = util.promisify(fsExtra.ensureDir);
const readdir = util.promisify(fs.readdir);


class LocalFileStorage extends BaseFileStorage {

  constructor() {
    const filesStoragePath = path.join(__dirname, `./../../../${config.TENANT_FILES_DIR}`);
    super(filesStoragePath);
    this._type = FILE_STORAGE.LOCAL_FILESYSTEM;
  }

  async mkdir(localPath, recursive = true) {
    return await ensureDir(localPath);
  }

  async rmdir(localPath, recursive = true) {
    const promise = new Promise((resolve, reject) => {
      rimraf(localPath, function (err) {
        if (err) {
          console.log(err);
          reject(err)
        } else {
          resolve();
        }
      });
    });

    return await promise;
  }

  async exists(localPath) {
    try {
      const info = await stat(localPath);
      return true;
    } catch (err) {
      return false;
    }
  }

  async delete(localPath, noErrorOK = false) {
    const promise = new Promise((resolve, reject) => {
      rimraf(localPath, function (err) {
        if (err) {
          console.log(err);
          reject(err)
        } else {
          resolve();
        }
      });
    });

    try {
      await promise;
      return true
    } catch (err) {
      if (noErrorOK) {
        return false;
      } else {
        throw err;
      }
    }
  }

  async get(localPath, dst, options = {}) {

    const promise = new Promise((resolve, reject) => {
      // Store file data chunks in this array
      let chunks = [];
      // We can use this variable to store the final data
      let fileBuffer;

      // Read file into stream.Readable
      let fileStream = fs.createReadStream(localPath, options);

      // An error occurred with the stream
      fileStream.once('error', (err) => {
        // Be sure to handle this properly!
        console.error(err);
        reject(err);
      });

      // File is done being read
      fileStream.once('end', () => {
        // create the final data Buffer from data chunks;
        fileBuffer = Buffer.concat(chunks);
        resolve(fileBuffer);
      });

      // Data is flushed from fileStream in chunks,
      // this callback will be executed for each chunk
      fileStream.on('data', (chunk) => {
        if (typeof chunk === 'string') {
          if (options.encoding) {
            chunks.push(Buffer.from(chunk, options.encoding)); 
          } else {
            chunks.push(Buffer.from(chunk, 'utf8')); 
          }
        } else {
          chunks.push(chunk); // push data chunk to array
        }
      });

    });

    const buff = await promise;
    return buff;
  }


  async put(localPath, data, options = {}) {
    
    const promise = new Promise((resolve, reject) => {
      fs.writeFile(localPath, data, options, (err) => {
        if (err) {
          console.error(err);
          reject(err);
        }
        else {
          resolve();
        }
      });
    });

    await promise;
  }

  async putPassThroughStream(localPath, passThroughSteam, options = {}) {
    const promise = new Promise((resolve, reject) => {
      const file = fs.createWriteStream(localPath, options);
      passThroughSteam.pipe(file)
      
      file.on('close', () => {
        resolve();
      });

      file.on('error', () => {
        reject();
      });
    })

    return await promise;
  }


  async rename(src, dst) {
    return await fsExtra.move(src, dst, { overwrite: true });
  }

  async calculateDirHash(localPath, options) {
    const hashObj = await hashElement(localPath, options);
    return hashObj;
  }

  async uploadDir(localPath, remotePath) {
    const result = await fsExtra.copy(localPath, remotePath);
    return result;
  }

  async listDir(localPath) {
    const result = await readdir(localPath);
    return result;
  }

  async stat(localPath) {
    const result = await stat(localPath);
    return result;
  }

}


export default LocalFileStorage;
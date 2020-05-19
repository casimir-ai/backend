import deipRpc from '@deip/rpc-client';
import UserProfile from './../schemas/user';
import USER_PROFILE_STATUS from './../constants/userProfileStatus';
import config from './../config';
import * as blockchainService from './../utils/blockchain';


async function findUserProfileByOwner(username) {
  const userProfile = await UserProfile.findOne({ _id: username })
  return userProfile;
}

async function findPendingUserProfiles() {
  const profiles = await UserProfile.find({ status: USER_PROFILE_STATUS.PENDING })
  return profiles;
}

async function findActiveUserProfiles() {
  const profiles = await UserProfile.find({ status: USER_PROFILE_STATUS.APPROVED })
  return profiles;
}

async function deleteUserProfile(username) {
  const result = await UserProfile.deleteOne({ _id: username })
  return result;
}

async function findUserProfiles(accounts) {
  const profiles = await UserProfile.find({ '_id': { $in: accounts } });
  return profiles;
}

async function createUserProfile({
  username,
  tenant,
  signUpPubKey,
  status,
  email,
  firstName,
  lastName,
  category,
  occupation,
  phoneNumbers,
  webPages,
  location,
  foreignIds,
  bio,
  birthdate
}) {

  const userProfile = new UserProfile({
    _id: username,
    signUpPubKey: signUpPubKey,
    status: status,
    email: email,
    firstName: firstName,
    lastName: lastName,
    category: category,
    occupation: occupation,
    phoneNumbers: phoneNumbers,
    webPages: webPages,
    location: location,
    foreignIds: foreignIds,
    bio: bio,
    birthdate: birthdate,
    tenant: tenant
  });
  
  return userProfile.save();
}

async function updateUserProfile(username, {
  status,
  email,
  firstName,
  lastName,
  category,
  occupation,
  phoneNumbers,
  webPages,
  location,
  foreignIds,
  bio,
  birthdate,
  education,
  employment
}) {

  let userProfile = await findUserProfileByOwner(username);
  
  if (!userProfile) {
    throw new Error(`User profile ${us} does not exist`);
  }

  userProfile.status = status;
  userProfile.email = email;
  userProfile.firstName = firstName;
  userProfile.lastName = lastName;
  userProfile.category = category;
  userProfile.occupation = occupation;
  userProfile.phoneNumbers = phoneNumbers;
  userProfile.webPages = webPages;
  userProfile.location = location;
  userProfile.foreignIds = foreignIds;
  userProfile.bio = bio;
  userProfile.birthdate = birthdate;
  userProfile.education = education;
  userProfile.employment = employment;  

  return userProfile.save();
}


async function createUserAccount({ username, pubKey }) {
  const registrar = config.blockchain.accountsCreator;
  const chainConfig = await deipRpc.api.getConfigAsync();
  const chainProps = await deipRpc.api.getChainPropertiesAsync();
  // const ratio = chainConfig['DEIP_CREATE_ACCOUNT_DELEGATION_RATIO'];
  // var fee = Asset.from(chainProps.account_creation_fee).multiply(ratio);

  const { username: creator, fee, wif } = registrar;
  const owner = {
    weight_threshold: 1,
    account_auths: [],
    key_auths: [[pubKey, 1]]
  };

  const op = {
    fee: fee,
    creator: creator,
    new_account_name: username,
    owner: owner,
    active: owner,
    posting: owner,
    memo_key: pubKey,
    json_metadata: "",
    traits: [],
    extensions: []
  }

  const operation = ['create_account', op];
  return blockchainService.signOperations([operation], wif)
    .then((signedTx) => {
      return blockchainService.sendTransactionAsync(signedTx);
    })
}

export default {
  findUserProfileByOwner,
  findPendingUserProfiles,
  findActiveUserProfiles,
  findUserProfiles,
  createUserAccount,
  createUserProfile,
  updateUserProfile,
  deleteUserProfile
}
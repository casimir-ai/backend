import config from '../../config';


function portalAuth(options) {
  return async function (ctx, next) {
    const jwtUsername = ctx.state.user.username;
    ctx.state.isPortalAdmin = ctx.state.portal.admins.some(name => name == jwtUsername);
    await next();
  };
}

module.exports = portalAuth;
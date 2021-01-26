import koa_router from 'koa-router'
import users from '../controllers/users'
import joinRequests from '../controllers/joinRequests'
import reviewRequests from '../controllers/reviewRequests'
import expertise from '../controllers/expertise'
import search from '../controllers/search'
import notifications from '../controllers/notifications'
import proposals from '../controllers/proposals'
import researchGroups from '../controllers/researchGroups'
import invites from '../controllers/invites'
import assets from '../controllers/assets'
import reviews from '../controllers/reviews'
import research from '../controllers/research'
import investmentPortfolio from '../controllers/investmentPortfolio'
import grants from '../controllers/grants'
import expressLicensing from '../controllers/expressLicensing'
import userTransactions from '../controllers/userTransactions'
import disciplines from '../controllers/disciplines'
import fundraising from '../controllers/fundraising'

const protected_route = koa_router()
const public_route = koa_router()

protected_route.post('/user/upload-avatar', users.uploadAvatar)
public_route.get('/user/profile/:username', users.getUserProfile)
public_route.get('/user/profiles', users.getUsersProfiles)
public_route.get('/user/active', users.getActiveUsersProfiles)
public_route.get('/user/name/:username', users.getUser)
public_route.get('/user/email/:email', users.getUserByEmail)
public_route.get('/users', users.getUsers)
public_route.get('/users/group/:researchGroupExternalId', users.getUsersByResearchGroup)

protected_route.put('/user/account/:username', users.updateUserAccount)
protected_route.put('/user/profile/:username', users.updateUserProfile)
public_route.get('/user/avatar/:username', users.getAvatar)
protected_route.get('/user/transactions/:status', userTransactions.getUserTransactions)

protected_route.get('/bookmarks/user/:username', users.getUserBookmarks)
protected_route.post('/bookmarks/user/:username', users.addUserBookmark)
protected_route.delete('/bookmarks/user/:username/remove/:bookmarkId', users.removeUserBookmark)

protected_route.post('/join-requests', joinRequests.createJoinRequest)
protected_route.put('/join-requests', joinRequests.updateJoinRequest)
protected_route.get('/join-requests/group/:researchGroupExternalId', joinRequests.getJoinRequestsByGroup)
protected_route.get('/join-requests/user/:username', joinRequests.getJoinRequestsByUser)

protected_route.post('/review-requests', reviewRequests.createReviewRequest);
protected_route.post('/review-requests/:id/deny', reviewRequests.denyReviewRequest);
protected_route.get('/review-requests/expert/:username', reviewRequests.getReviewRequestsByExpert);
protected_route.get('/review-requests/requestor/:username', reviewRequests.getReviewRequestsByRequestor);


public_route.get('/expertise/user/:username/disciplines', expertise.getAccountExpertiseTokens)
public_route.get('/expertise/user/:username/history', expertise.getAccountEciHistory)
public_route.get('/expertise/user/:username/stats', expertise.getAccountEciStats)
public_route.get('/expertise/users/stats', expertise.getAccountsEciStats)
public_route.get('/expertise/research/:research/history', expertise.getResearchEciHistory)
public_route.get('/expertise/research/:research/stats', expertise.getResearchEciStats)
public_route.get('/expertise/research/stats', expertise.getResearchesEciStats)
public_route.get('/expertise/research-content/:researchContent/history', expertise.getResearchContentEciHistory)
public_route.get('/expertise/research-content/:researchContent/stats', expertise.getResearchContentEciStats)
public_route.get('/expertise/research-content/stats', expertise.getResearchContentsEciStats)
public_route.get('/expertise/disciplines/history', expertise.getDisciplineEciHistory)
public_route.get('/expertise/disciplines/stats-history', expertise.getDisciplinesEciStatsHistory)
public_route.get('/expertise/disciplines/stats', expertise.getDisciplinesEciLastStats)

public_route.get('/search/contents/all', search.getAllResearchContents)

protected_route.get('/notifications/user/:username', notifications.getNotificationsByUser)
protected_route.put('/notifications/:username/mark-read/:notificationId', notifications.markUserNotificationAsRead)
protected_route.put('/notifications/:username/mark-all-read', notifications.markAllUserNotificationAsRead)


protected_route.post('/proposals/:proposalExternalId', proposals.getProposalById)
protected_route.post('/proposals', proposals.createProposal)
protected_route.put('/proposals', proposals.updateProposal)
protected_route.put('/proposals/delete', proposals.deleteProposal)
protected_route.get('/proposals/:username/:status', proposals.getAccountProposals)

protected_route.post('/groups', researchGroups.createResearchGroup)
protected_route.put('/groups', researchGroups.updateResearchGroup)
public_route.get('/groups/:researchGroupExternalId', researchGroups.getResearchGroup)
public_route.get('/groups/logo/:researchGroupExternalId', researchGroups.getResearchGroupLogo)
protected_route.post('/groups/logo', researchGroups.uploadResearchGroupLogo)
protected_route.post('/groups/leave', researchGroups.leaveResearchGroup)
public_route.get('/groups/member/:username', researchGroups.getResearchGroupsByUser)


protected_route.get('/invites/:username', invites.getUserInvites)
protected_route.get('/invites/group/:researchGroupExternalId', invites.getResearchGroupPendingInvites)
protected_route.get('/invites/research/:researchExternalId', invites.getResearchPendingInvites)
protected_route.post('/invites', invites.createUserInvite)


public_route.get('/reviews/:reviewExternalId', reviews.getReview)
public_route.get('/reviews/research/:researchExternalId', reviews.getReviewsByResearch)
public_route.get('/reviews/research-content/:researchContentExternalId', reviews.getReviewsByResearchContent)
public_route.get('/reviews/author/:author', reviews.getReviewsByAuthor)
protected_route.post('/reviews', reviews.createReview)


public_route.get('/research/listing', research.getPublicResearchListing)
public_route.get('/research/:researchExternalId', research.getResearch)
public_route.get('/researches', research.getResearches)
public_route.get('/research/:researchExternalId/attribute/:researchAttributeId/file/:filename', research.getResearchAttributeFile)
protected_route.get('/research/user/listing/:username', research.getUserResearchListing)
protected_route.get('/research/group/listing/:researchGroupExternalId', research.getResearchGroupResearchListing)
protected_route.post('/research', research.createResearch)
protected_route.put('/research', research.updateResearch)

public_route.get('/fundraising/research/:researchExternalId', fundraising.getResearchTokenSalesByResearch)
protected_route.post('/fundraising', fundraising.createResearchTokenSale)
protected_route.post('/fundraising/contributions', fundraising.createResearchTokenSaleContribution)
protected_route.get('/fundraising/:researchTokenSaleExternalId/contributions', fundraising.getResearchTokenSaleContributions)
protected_route.get('/fundraising/research/:researchExternalId/contributions', fundraising.getResearchTokenSaleContributionsByResearch)

protected_route.post('/research/application', research.createResearchApplication)
protected_route.put('/research/application/:proposalId', research.editResearchApplication)
protected_route.get('/research/application/list', research.getResearchApplications)
protected_route.get('/research/application/:proposalId/attachment', research.getResearchApplicationAttachmentFile)
protected_route.post('/research/application/approve', research.approveResearchApplication)
protected_route.post('/research/application/reject', research.rejectResearchApplication)
protected_route.post('/research/application/delete', research.deleteResearchApplication)

protected_route.get('/investment-portfolio/:username', investmentPortfolio.getUserInvestmentPortfolio)
protected_route.put('/investment-portfolio/:username', investmentPortfolio.updateInvestmentPortfolio)

protected_route.get('/award-withdrawal-requests/:awardNumber/:paymentNumber', grants.getAwardWithdrawalRequestRefByHash)
protected_route.get('/award-withdrawal-requests/:awardNumber/:paymentNumber/:fileHash', grants.getAwardWithdrawalRequestAttachmentFile)
protected_route.post('/award-withdrawal-requests/upload-attachments', grants.uploadAwardWithdrawalRequestBulkAttachments)

protected_route.post('/express-licensing', expressLicensing.createExpressLicenseRequest)

protected_route.post('/assets/transfer', assets.createAssetTransferRequest)
protected_route.post('/assets/exchange', assets.createAssetExchangeRequest)

public_route.get('/disciplines', disciplines.getDomainDisciplines)
public_route.get('/disciplines/research/:researchExternalId', disciplines.getDisciplinesByResearch)


const routes = {
  protected: koa_router().use('/api', protected_route.routes()),
  public: koa_router().use('/api', public_route.routes())
}

module.exports = routes;
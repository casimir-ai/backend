import {
    AcceptProposalCmd,
    CreateNftItemCmd,
    CreateProposalCmd,
    DeclineProposalCmd,
    TransferFTCmd,
    TransferNFTCmd
} from '@deip/commands';
import { APP_CMD, APP_EVENT } from '@deip/constants';
import { logWarn } from '../utils/log';
import BaseEvent from './base/BaseEvent';
import {
    FTTransferredEvent,
    NFTItemMetadataDraftCreatedEvent,
    NFTLazyBuyProposalAcceptedEvent,
    NFTLazyBuyProposalCreatedEvent,
    NFTLazyBuyProposalDeclinedEvent,
    NFTLazySellProposalAcceptedEvent,
    NFTLazySellProposalCreatedEvent,
    NFTLazySellProposalDeclinedEvent,
    NFTTransferredEvent,
    ProposalAcceptedEvent,
    ProposalCreatedEvent,
    ProposalDeclinedEvent,
    NFTItemCreatedEvent
} from './index.js';


const buildEventProposalCmd = (eventPayload) => ({
    ...eventPayload,
    proposalCmd: rebuildCmd(eventPayload.proposalCmd)
});

const buildCmdProposedCmds = (cmdPayload) => {
    return ({
        ...cmdPayload,
        proposedCmds: cmdPayload.proposedCmds.map(rebuildCmd)
    });
}

const buildEvent = (ProxyClass, updatePayloadF) => (payload) => {
    let _payload = payload;
    if (updatePayloadF) _payload = updatePayloadF(payload);

    return new ProxyClass(_payload);
}
const buildCmd = buildEvent;


const cmdParser = {
    [APP_CMD.CREATE_PROPOSAL]: buildCmd(CreateProposalCmd, buildCmdProposedCmds),
    [APP_CMD.ACCEPT_PROPOSAL]: buildCmd(AcceptProposalCmd),
    [APP_CMD.DECLINE_PROPOSAL]: buildCmd(DeclineProposalCmd),

    [APP_CMD.TRANSFER_FT]: buildCmd(TransferFTCmd),
    [APP_CMD.TRANSFER_NFT]: buildCmd(TransferNFTCmd),
    [APP_CMD.CREATE_NFT_ITEM]: buildCmd(CreateNftItemCmd),
}


const eventParser = {
    [APP_EVENT.PROPOSAL_CREATED]: buildEvent(ProposalCreatedEvent, buildEventProposalCmd),
    [APP_EVENT.PROPOSAL_ACCEPTED]: buildEvent(ProposalAcceptedEvent),
    [APP_EVENT.PROPOSAL_DECLINED]: buildEvent(ProposalDeclinedEvent),

    [APP_EVENT.NFT_LAZY_SELL_PROPOSAL_CREATED]: buildEvent(NFTLazySellProposalCreatedEvent, buildEventProposalCmd),
    [APP_EVENT.NFT_LAZY_SELL_PROPOSAL_ACCEPTED]: buildEvent(NFTLazySellProposalAcceptedEvent, buildEventProposalCmd),
    [APP_EVENT.NFT_LAZY_SELL_PROPOSAL_DECLINED]: buildEvent(NFTLazySellProposalDeclinedEvent),

    [APP_EVENT.NFT_LAZY_BUY_PROPOSAL_CREATED]: buildEvent(NFTLazyBuyProposalCreatedEvent, buildEventProposalCmd),
    [APP_EVENT.NFT_LAZY_BUY_PROPOSAL_ACCEPTED]: buildEvent(NFTLazyBuyProposalAcceptedEvent, buildEventProposalCmd),
    [APP_EVENT.NFT_LAZY_BUY_PROPOSAL_DECLINED]: buildEvent(NFTLazyBuyProposalDeclinedEvent),

    [APP_EVENT.NFT_ITEM_METADATA_DRAFT_CREATED]: buildEvent(NFTItemMetadataDraftCreatedEvent),
    [APP_EVENT.NFT_TRANSFERRED]: buildEvent(NFTTransferredEvent),
    [APP_EVENT.NFT_ITEM_CREATED]: buildEvent(NFTItemCreatedEvent),
    [APP_EVENT.FT_TRANSFERRED]: buildEvent(FTTransferredEvent),
}

const rebuildCmd = rawCmd => {
    const { _cmdNum, _cmdPayload } = rawCmd;

    const rebuildF = cmdParser[_cmdNum];
    if (!rebuildF)
        logWarn(`WARNING: Cmd rebuilder don't support cmd ${APP_CMD[_cmdNum]}:${_cmdNum}`);

    return rebuildF ? rebuildF(_cmdPayload) : _cmdPayload;
};

//Process application rawEvent from external queue service (kafka) into rich AppEvent
const rebuildEvent = rawEvent => {
    const { eventNum, eventPayload, eventIssuer } = rawEvent;

    const parseF = eventParser[eventNum];
    if (eventNum && !parseF)
        logWarn(`WARNING: Event rebuilder don't support event ${APP_EVENT[eventNum]}:${eventNum}`);

    const event = eventNum && parseF ? parseF(eventPayload, eventIssuer)
        : eventNum && new BaseEvent(eventNum, eventPayload, eventIssuer);

    if (event && eventIssuer) event.setEventIssuer(eventIssuer);

    return event;
}

module.exports = {
    rebuildEvent,
    rebuildCmd
}
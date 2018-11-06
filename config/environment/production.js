module.exports = {
    mongo: {
        "deip-server": {
            connection: 'mongodb://deip:XTFEaoBKqYr@mongodb:27017/deip-server?authSource=admin',
        }
    },
    blockchain: {
        rpcEndpoint: "https://dev-full-node.deip.world",
        chainId: "04ac2e56f7d9738a6742eec9f7f014db30a61276cf1cf89add3fb4a140fba1d1",
        accountsCreator : {
            username: "alice",
            wif: "5JGoCjh27sfuCzp7kQme5yMipaQtgdVLPiZPr9zaCwJVrSrbGYx",
            fee: "1.000 TESTS"
        }
    },
    host: 'https://dev-server.deip.world',
    uiHost: 'beta.deip.world',
    sigSeed: "quickbrownfoxjumpsoverthelazydog",
    jwtSecret: 'shhhhhhhhhhh!!!'
};
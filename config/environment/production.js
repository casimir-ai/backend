module.exports = {
    mongo: {
        "deip-server": {
            connection: 'mongodb://mongodb:27017/deip-server',
        },
        "deip-foundation": {
            connection: 'mongodb://mongodb:27017/deip-foundation',
        }
    },
    blockchain: {
        rpcEndpoint: "ws://206.189.175.10",
        chainId: "b49d215ad6bbf15da499e68c5669e6fa5ff424c954e1dff5488cb114801f32c0"
    },
    sigSeed: "quickbrownfoxjumpsoverthelazydog",
    jwtSecret: 'shhhhhhhhhhh!!!'
};
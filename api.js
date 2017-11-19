const rp = require('request-promise')

const apiUrl = {
    protocol: 'https',
    domain: 'api.vk.com',
    path: '/method'
}, apiPackedUrl = `${apiUrl.protocol}://${apiUrl.domain}${apiUrl.path}`

module.exports = class {
    constructor () {
        this.tokens = []
        this.stdcallQueue = []
        this.stdCallLimit = 3

        for (const token of arguments) {
            this.tokens.push(token)
        }
    }

    _call(method, params, callback) {
        return (async () => {
            try {
                return await rp([apiPackedUrl, method].join('/'))
            } catch (err) {
                throw err
            }      
        })()
    }
}
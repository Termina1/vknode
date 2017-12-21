const rp = require('request-promise')
const qs = require('qs')
const md5 = require('md5')

const LongPoll = require('./longpoll/longpoll')
const CallbackAPI = require('./callback-api/callback-api')
const MessageConstructor = require('./messages/constructor')

const
    apiUrl = {
        protocol: 'https',
        domain: 'api.vk.com',
        path: '/method',
        version: '5.69'
    },
    apiPackedUrl = `${apiUrl.protocol}://${apiUrl.domain}${apiUrl.path}`

module.exports = class API {
    constructor(token) {
        this.token = token || ''
        this.queries = []
        this.limit = 3
        this.rejection = true
        this.info = {}
        this._version = apiUrl.version
        this.errorHandler = () => {}

        Object.defineProperty(this, "longpoll", {
            enumerable: false,
            get: () => {
                if (!this.lp) {
                    this.lp = new LongPoll(this)
                }

                return this.lp
            }
        })
    }

    version(version) {
        this._version = version.toString()

        return this
    }

    pack() {
        this.packer = !this.packer

        return this
    }

    check(app_data = {}) {
        this.call('groups.getById')
            .then(response => {
                if (response.length) {
                    this.info = {
                        group_id: response[0].gid,
                        name: response[0].name,
                        screen_name: response[0].screen_name,
                        is_closed: response[0].is_closed,
                        type: response[0].type,
                        photo: {
                            origin: response[0].photo,
                            medium: response[0].photo_medium,
                            big: response[0].photo_big
                        }
                    }

                    this.resetInterval(20)
                }
            })
            .catch(error => {
                this.call('users.get')
                    .then(response => {
                        if (response.length) {
                            this.info = {
                                user_id: response[0].uid,
                                user: {
                                    first_name: response[0].first_name,
                                    last_name: response[0].last_name
                                }
                            }

                            this.resetInterval(3)
                        } else {
                            return false
                        }
                    })
                    .then(status => {
                        if (status) {
                            this.call('secure.getSMSHistory')
                                .then(response => {
                                    this.info = {}

                                    this.resetInterval(5)

                                    if (app_data) {
                                        if (app_data.id) {
                                            this.info = app_data.id
                                        }

                                        if (app_data.secret) {
                                            this.info = app_data.secret
                                        }

                                        if (app_data.users) {
                                            if (app_data.users >= 1e4 && app_data.users < 1e5) {
                                                this.resetInterval(8)
                                            } else if (app_data.users < 1e6) {
                                                this.resetInterval(20)
                                            } else {
                                                this.resetInterval(35)
                                            }
                                        }
                                    }
                                })
                                .catch(error => {})
                        }
                    })
            })

        return this
    }

    setErrorHandler(rejection, handler) {
        this.errorHandler = handler
        this.rejection = rejection
    }

    resetInterval(limit) {
        if (limit == this.limit) {
            return
        }

        this.limit = limit

        if (this.interval instanceof setInterval) {
            clearInterval(this.interval)
        }

        this.interval = setInterval(() => this.checkQueue(), 1000 / this.limit)
    }

    async _call(method, params) {
        params.access_token = this.token
        params.v = this._version

        if (params instanceof Object) {
            for (const key in params) {
                if (Array.isArray(params[key])) {
                    params[key] = params[key].join(',')
                } else if (params[key] instanceof Object) {
                    params[key] = JSON.stringify(params[key])
                } else if (params[key] instanceof Boolean) {
                    params[key] = params[key] ? 1 : 0
                } else if (params[key] === null || params[key] === undefined || params[key] === Infinity) {
                    params[key] = ''
                }
            }
        }

        try {
            return await rp([apiPackedUrl, method].join('/'), {
                method: 'POST',
                formData: params,
                json: true
            })
        } catch (err) {
            throw err
        }
    }

    async call(method, params, callback) {
        if (!params) {
            params = {}
        }

        if (this.interval === undefined) {
            this.checkQueue()

            this.interval = setInterval(() => this.checkQueue(), 1000 / this.limit)
        }

        if (callback) {
            this.queries.push({
                method,
                params,
                callback
            })
        } else {
            return new Promise((resolve, reject) => {
                this.queries.push({
                    method,
                    params,
                    resolve,
                    reject
                })
            })
        }
    }

    createError(error) {
        const err = new Error

        err.code = error.error_code
        err.message = error.error_msg

        if (error.captcha_sid && error.captcha_img) {
            err.captcha = {
                sid: error.captcha_sid,
                img: error.captcha_img
            }
        }

        err.request_params = error.request_params

        throw err
    }

    checkQueue() {
        if (!this.queries.length) {
            clearInterval(this.interval)

            return
        }

        if (this.packer) {
            const operations = this.queries.splice(0, 25)

            let packedOperations = []

            operations.forEach(operation => packedOperations.push(
                `API.${operation.method}(${JSON.stringify(operation.params)})`
            ))

            packedOperations = `return [${packedOperations.join(',')}];`

            return this._exec(packedOperations, operations)
        }

        const methodCall = this.queries.shift()

        this._exec(methodCall)
    }

    async _exec(methodCall, operations) {
        let isPacked, _methodCall

        try {
            if (typeof methodCall == 'string') {
                isPacked = true
            }

            let { response, error, execute_errors } = await this._call(isPacked ? 'execute' : methodCall.method, isPacked ? {
                code: methodCall
            } : methodCall.params)

            if (error) {
                this.createError(error)
            }

            if (isPacked) {
                if (typeof response == 'object') {
                    response.forEach(resp => {
                        _methodCall = operations.shift()

                        if (resp === false) {
                            if (execute_errors[0]) {
                                this.createError(execute_errors.shift())

                                return
                            }
                        }

                        if (_methodCall.callback) {
                            _methodCall.callback(resp)
                        } else if (_methodCall.resolve && _methodCall.reject) {
                            _methodCall.resolve(resp)
                        }
                    })
                }

                return
            }

            if (methodCall.callback) {
                methodCall.callback(response)
            } else if (methodCall.resolve && methodCall.reject) {
                methodCall.resolve(response)
            }
        } catch (err) {
            try {
                this.errorHandler(err)
            } catch (err) {
                console.error(err)

                this.errorHandler = () => {}
            }

            if (this.rejection) {
                try {
                    if (isPacked) {
                        _methodCall.reject(err)

                        return
                    }
                    methodCall.reject(err)
                } catch (err) {
                    console.error(err)
                }
            }
        }
    }

    async execute(code, callback) {
        return await this.call('execute', { code }, callback)
    }

    async procedure(name, args, callback) {
        return await this.call(`execute.${name}`, args, callback)
    }

    callback(config) {
        return new CallbackAPI(config)
    }

    messagesProc() {
        this.messageProcessing = true

        return this
    }
}
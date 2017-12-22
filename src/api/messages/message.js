const MessageConstructor = require('./constructor')

module.exports = class Message {
    constructor(message, self) {
        Object.assign(this, message)

        this.__proto__.self = self
        this.__proto__.message = (text) => {
            return new MessageConstructor(text, self, message.peer_id || message.user_id)
        }

        this.type = this.peer_id > 2e9 ? 'chat' : 'dialog'

        if (this.peer_id < 2e9) {
            delete this.attachments.title
        }

        this.date = new Date(this.timestamp * 1000)

        if (!Object.keys(this.attachments).length) {
            this.attachments = null
        }
    }

    check(flag) {
        return Boolean(this.flags & (+flag))
    }

    async full() {
        try {
            const { items } = await this.self.call('messages.getById', {
                message_ids: this.message_id
            })

            if (items[0].title) {
                this.title = items[0].title
            }
            if (items[0].out) {
                this.out = items[0].out
            }
            if (items[0].read_state) {
                this.read_state = items[0].read_state
            }

            if (items[0].fwd_messages) {
                this.fwd_messages = items[0].fwd_messages
            }

            if (items[0].attachments) {
                this.attachments_ex = items[0].attachments
            }

            return this
        } catch (err) {
            throw err
        }
    }
}
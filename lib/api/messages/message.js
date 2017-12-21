module.exports = class Message {
    constructor(message) {
        Object.assign(this, message)

        this.type = this.peer_id > 2e9 ? 'chat' : 'dialog'

        if (this.peer_id < 2e9) {
            delete this.attachments.title
        }

        this.timestamp = new Date(this.timestamp * 1000)
    }
}
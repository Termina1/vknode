module.exports = class MessageConstructor {
    constructor(text, self, peer) {
        this.__proto__.self = self
        this.__proto__.peer = peer

        this.attachment = []

        this.text(text)
    }

    text(text) {
        this.message = text.toString()

        return this
    }

    add(text) {
        return this.text(this.message + text)
    }

    body(text) {
        return this.text(text)
    }

    append(text) {
        return this.add(text)
    }

    photo(...photos) {
        photos.forEach(photo => {
            const [vkPhoto] = photo.match(/(photo-?\d+_\d+(?:_\w+)?)/im)

            if (vkPhoto) {
                this.attachment.push(vkPhoto)
            }
        })

        return this
    }

    async send() {
        this.peer_id = (arguments[0] ? (typeof arguments[0] != 'function' ? arguments[0] : null) : null) || this.peer
        this.attachment = this.attachment.join(',')

        console.log(this.peer_id, this)

        try {
            return await this.self.call('messages.send', this, typeof arguments[0] == 'function' ? arguments[0] : (typeof arguments[1] == 'function' ? arguments[1] : null))
        } catch (err) {
            throw err
        }
    }
}
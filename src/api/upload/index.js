const fs = require('fs')
const rp = require('request-promise')

// https://vk.com/dev/upload_files

module.exports = class Upload {
    constructor(self) {
        this.self = self
    }

    file(file) {
        if (!(file instanceof fs.ReadStream)) {
            file = fs.createReadStream(file)
        }

        return file
    }

    async photo(data = {}) {
        const
            owner_id = data.owner_id ? data.owner_id : (data.user_id ? data.user_id : (data.group_id ? 0 - data.group_id : (this.self.info.group_id ? 0 - this.self.info.group_id : this.self.info.user_id))),
            files = {}

        if (!data.album) {
            const { items } = await this.self.call('photos.getAlbums', { owner_id })

            data.album = items[0].id
        }

        const group_id = owner_id < 0 ? 0 - owner_id : null

        const { upload_url, album_id, user_id } = await this.self.call('photos.getUploadServer', {
            album_id: data.album,
            group_id
        })

        if (Array.isArray(data.photos)) {
            data.photos.forEach((photo) => {
                files[`file${Object.keys(files).length+1}`] = this.file(photo)
            })
        } else if (data.photos) {
            files[`file${Object.keys(files).length+1}`] = this.file(data.photos)
        }

        if (data.photo) {
            files[`file${Object.keys(files).length+1}`] = this.file(data.photo)
        }

        const response = await rp(upload_url, {
            method: 'POST',
            formData: files,
            json: true
        })

        const photos = await this.self.call('photos.save', {
            server: response.server,
            photos_list: response.photos_list,
            hash: response.hash,
            album_id,
            latitude: data.latitude,
            longitude: data.longitude,
            caption: data.caption || data.text || data.body,
            group_id
        })

        if (photos) {
            for (const key in photos) {
                photos[key].attachment = `photo${photos[key].owner_id}_${photos[key].id}`
            }
        }

        return photos
    }

    async wallPhoto(data) {
        const group_id = data.group_id

        const { upload_url, album_id, user_id } = await this.self.call('photos.getWallUploadServer', { group_id })

        const response = await rp(upload_url, {
            method: 'POST',
            formData: {
                photo: this.file(data.photo)
            },
            json: true
        })

        const [photo] = await this.self.call('photos.saveWallPhoto', {
            server: response.server,
            photo: response.photo,
            hash: response.hash,
            user_id: group_id ? null : group_id,
            group_id,
            latitude: data.latitude,
            longitude: data.longitude,
            caption: data.caption || data.text || data.body
        })

        photo.attachment = `photo${photo.owner_id}_${photo.id}`

        if (photo.access_key) {
            photo.attachment += `_${photo.access_key}`
        }

        return photo
    }

    async ownerPhoto(data) {
        const { upload_url } = await this.self.call('photos.getOwnerPhotoUploadServer', { owner_id: data.group_id ? 0 - data.group_id : null })

        const response = await rp(upload_url, {
            method: 'POST',
            formData: {
                photo: this.file(data.photo)
            },
            json: true
        })

        const photo = await this.self.call('photos.saveOwnerPhoto', response)

        if (photo.post_id) {
            const owner_id = (data.group_id ? 0 - data.group_id : null) || (await this.self.call('users.get'))[0].id

            photo.post = `wall${owner_id}_${photo.post_id}`
        }

        return photo
    }

    async messagePhoto(data) {
        const { upload_url, album_id, user_id } = await this.self.call('photos.getMessagesUploadServer', { peer_id: data.peer_id })

        const response = await rp(upload_url, {
            method: 'POST',
            formData: {
                photo: this.file(data.photo)
            },
            json: true
        })

        const [photo] = await this.self.call('photos.saveMessagesPhoto', response)

        photo.attachment = `photo${photo.owner_id}_${photo.id}`

        return photo
    }

    async chatPhoto(data) {
        const { upload_url } = await this.self.call('photos.getChatUploadServer', {
            chat_id: data.chat_id,
            crop_x: data.crop_x || data.x,
            crop_y: data.crop_y || data.y,
            crop_width: data.crop_width || data.width
        })

        const { response } = await rp(upload_url, {
            method: 'POST',
            formData: {
                file: this.file(data.photo)
            },
            json: true
        })

        const info = await this.self.call('messages.setChatPhoto', { file: response })

        return info
    }

    async marketPhoto(data) {
        const { upload_url } = await this.self.call('photos.getChatUploadServer', {
            group_id: data.group_id,
            main_photo: data.main_photo || data.main,
            crop_x: data.crop_x || data.x,
            crop_y: data.crop_y || data.y,
            crop_width: data.crop_width || data.width
        })

        const response = await rp(upload_url, {
            method: 'POST',
            formData: {
                file: this.file(data.photo)
            },
            json: true
        })

        response.group_id = data.group_id

        const [photo] = await this.self.call('photos.saveMarketPhoto', response)

        return photo
    }

    productPhoto(...data) {
        return this.marketPhoto(...data)
    }

    async marketAlbumPhoto(data) {
        const { upload_url } = await this.self.call('photos.getMarketAlbumUploadServer', { group_id: data.group_id })

        const response = await rp(upload_url, {
            method: 'POST',
            formData: {
                file: this.file(data.photo)
            },
            json: true
        })

        response.group_id = response.gid

        delete response.gid

        const [photo] = await this.self.call('photos.saveMarketAlbumPhoto', response)

        return photo
    }

    async audio(data) {
        const { upload_url } = await this.self.call('audio.getUploadServer')

        const file = this.file(data.file)

        const response = await rp(upload_url, {
            method: 'POST',
            formData: { file },
            json: true
        })

        delete response.redirect

        response.artist = data.artist
        response.title = data.title === true ? (() => {
            file.path = file.path.split('/')
            return file.path[file.path.length - 1]
        })() : data.title

        const audio = await this.self.call('audio.save', response)

        return audio
    }
}
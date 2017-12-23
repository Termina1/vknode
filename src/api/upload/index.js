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

        if (!upload_url) {
            return
        }

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

        if (!upload_url) {
            return
        }

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
        const { upload_url } = await this.self.call('photos.getWallUploadServer', { owner_id: data.group_id ? 0 - data.group_id : null })

        if (!upload_url) {
            return
        }

        console.log(upload_url)
    }
}
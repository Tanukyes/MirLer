// ДОБАВЬ В PhotoSection.jsx

const CLOUDINARY_CLOUD_NAME =
  import.meta.env.VITE_CLOUDINARY_CLOUD_NAME

const CLOUDINARY_UPLOAD_PRESET =
  import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

async function uploadToCloudinary(file) {
  const formData = new FormData()

  formData.append('file', file)

  formData.append(
    'upload_preset',
    CLOUDINARY_UPLOAD_PRESET
  )

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData,
    }
  )

  if (!response.ok) {
    throw new Error('Cloudinary upload failed')
  }

  return await response.json()
}

// ЗАМЕНИ uploadQueue НА:

const uploadQueue = async () => {
  if (!queue.length) return

  setUploading(true)
  setUploadStatus(null)

  try {
    const uploadedPhotos = []

    for (const item of queue) {
      const uploaded = await uploadToCloudinary(item.blob)

      uploadedPhotos.push({
        id: uploaded.public_id,
        imgUrl: uploaded.secure_url,
        created: new Date().toISOString(),
      })

      // backup в Яндекс.Диск
      if (YANDEX_TOKEN) {
        try {
          await ydEnsureFolder(
            YANDEX_TOKEN,
            YANDEX_FOLDER
          )

          const filename = `${uploaded.public_id}.jpg`

          await ydUpload(
            YANDEX_TOKEN,
            YANDEX_FOLDER,
            filename,
            item.blob
          )
        } catch (e) {
          console.error(
            'Yandex backup failed:',
            e
          )
        }
      }
    }

    const updated = [...uploadedPhotos, ...photos]

    setPhotos(updated)

    localStorage.setItem(
      'mirler_cloudinary_photos',
      JSON.stringify(updated)
    )

    setUploadStatus('success')

    setTimeout(() => {
      closeAll()
    }, 1000)
  } catch (e) {
    console.error(e)
    setUploadStatus('error')
  } finally {
    setUploading(false)
  }
}

// ЗАМЕНИ loadPhotos НА:

const loadPhotos = useCallback(async () => {
  try {
    const saved = JSON.parse(
      localStorage.getItem(
        'mirler_cloudinary_photos'
      ) || '[]'
    )

    setPhotos(saved)
  } catch {
    setPhotos([])
  }
}, [])

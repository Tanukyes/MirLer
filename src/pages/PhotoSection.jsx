import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import './PhotoSection.css'

const YANDEX_TOKEN = import.meta.env.VITE_YANDEX_DISK_TOKEN || ''
const YANDEX_FOLDER = import.meta.env.VITE_YANDEX_DISK_FOLDER || 'wedding-photos'
const GALLERY_REFRESH_MS = 30_000
const MAX_FILES = 10

const CLOUDINARY_CLOUD_NAME = 'dvqen4u01'

const CLOUDINARY_UPLOAD_PRESET = 'mirler_uploads'

const LOCAL_STORAGE_KEY = 'mirler_local_photos'

function saveLocalPhotos(list) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list))
}

function loadLocalPhotos() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}



async function uploadToCloudinary(file) {
  const formData = new FormData()

  formData.append('file', file)
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)

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

// ─── Яндекс.Диск API ────────────────────────────────────────────────
async function ydEnsureFolder(token, folder) {
  // 409 = папка уже существует, это нормально
  await fetch(`https://cloud-api.yandex.net/v1/disk/resources?path=disk:/${folder}`, {
    method: 'PUT',
    headers: { Authorization: `OAuth ${token}` },
  }).catch(() => {})
}

async function ydUpload(token, folder, filename, blob) {
  const urlRes = await fetch(
    `https://cloud-api.yandex.net/v1/disk/resources/upload?path=disk:/${folder}/${filename}&overwrite=true`,
    { headers: { Authorization: `OAuth ${token}` } }
  )
  if (!urlRes.ok) throw new Error(`Ошибка получения URL: ${urlRes.status}`)
  const { href } = await urlRes.json()
  const uploadRes = await fetch(href, { method: 'PUT', body: blob })
  if (!uploadRes.ok) throw new Error(`Ошибка загрузки: ${uploadRes.status}`)
}

async function ydPublishAndGetUrl(token, folder, filename) {
  const path = `disk:/${folder}/${filename}`
  await fetch(
    `https://cloud-api.yandex.net/v1/disk/resources/publish?path=${encodeURIComponent(path)}`,
    { method: 'PUT', headers: { Authorization: `OAuth ${token}` } }
  )
  const res = await fetch(
    `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(path)}&fields=public_url`,
    { headers: { Authorization: `OAuth ${token}` } }
  )
  if (!res.ok) return null
  const data = await res.json()
  return data.public_url || null
}

async function ydPublishFile(token, path) {
  await fetch(
    `https://cloud-api.yandex.net/v1/disk/resources/publish?path=${encodeURIComponent(path)}`,
    { method: 'PUT', headers: { Authorization: `OAuth ${token}` } }
  ).catch(() => {})
}

// Получаем прямую ссылку на картинку через публичный API (без авторизации, CORS разрешён)
// /public/resources возвращает sizes[] с реальными URL картинок
async function ydGetPublicImageUrl(publicKey) {
  try {
    const res = await fetch(
      `https://cloud-api.yandex.net/v1/disk/public/resources?public_key=${encodeURIComponent(publicKey)}&fields=sizes,file,preview,media_type,mime_type`,
    )
    console.log('[YD] public/resources status:', res.status, 'for key:', publicKey)
    if (!res.ok) {
      console.error('[YD] public/resources failed:', res.status, res.statusText)
      return null
    }
    const data = await res.json()
    console.log('[YD] public/resources response:', JSON.stringify(data, null, 2))
    const sizes = data.sizes || []
    console.log('[YD] sizes array:', sizes)
    console.log('[YD] file field:', data.file)
    console.log('[YD] preview field:', data.preview)
    // GitHub Pages + Yandex Disk:
    // ORIGINAL часто даёт 403 Forbidden из-за hotlink/CORS ограничений.
    // Используем preview/DEFAULT/L вместо ORIGINAL.
    const chosen =
      sizes.find((s) => s.name === 'DEFAULT') ||
      sizes.find((s) => s.name === 'L') ||
      sizes.find((s) => s.name === 'M') ||
      sizes[sizes.length - 1]

    console.log('[YD] chosen size:', chosen)

    return chosen?.url || data.preview || data.file || null
  } catch (e) {
    console.error('[YD] ydGetPublicImageUrl error:', e)
    return null
  }
}

async function ydListPhotos(token, folder) {
  const listUrl = `https://cloud-api.yandex.net/v1/disk/resources?path=disk:/${folder}&limit=100&sort=-created&fields=_embedded,_embedded.items.name,_embedded.items.type,_embedded.items.public_url,_embedded.items.created`

  const res = await fetch(listUrl, { headers: { Authorization: `OAuth ${token}` } })
  if (!res.ok) return []
  const data = await res.json()
  const items = data._embedded?.items || []
  const photos = items.filter((i) => i.type === 'file' && /\.(jpg|jpeg|png|webp)$/i.test(i.name))

  // Публикуем файлы без public_url
  const unpublished = photos.filter((i) => !i.public_url)
  if (unpublished.length > 0) {
    await Promise.all(
      unpublished.map((i) => ydPublishFile(token, `disk:/${folder}/${i.name}`))
    )
    const res2 = await fetch(listUrl, { headers: { Authorization: `OAuth ${token}` } })
    if (res2.ok) {
      const data2 = await res2.json()
      const refreshed = (data2._embedded?.items || []).filter(
        (i) => i.type === 'file' && /\.(jpg|jpeg|png|webp)$/i.test(i.name)
      )
      return await resolveImageUrls(refreshed)
    }
  }

  return await resolveImageUrls(photos)
}

// Для каждого файла с public_url получаем прямую ссылку на картинку
async function resolveImageUrls(photos) {
  return Promise.all(
    photos
      .filter((i) => i.public_url)
      .map(async (i) => {
        console.log('[YD] resolving image for:', i.name, 'public_url:', i.public_url)
        const imgUrl = await ydGetPublicImageUrl(i.public_url)
        console.log('[YD] resolved imgUrl for', i.name, ':', imgUrl)
        return { name: i.name, publicUrl: i.public_url, imgUrl }
      })
  )
}



// ─── Компонент ──────────────────────────────────────────────────────
export default function PhotoSection() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const fileInputRef = useRef(null)

  // Режим: 'gallery' | 'camera' | 'preview'
  const [mode, setMode] = useState('gallery')
  const [cameraReady, setCameraReady] = useState(false)
  const [facingMode, setFacingMode] = useState('environment')

  // Для режима камеры — одно фото
  const [capturedBlob, setCapturedBlob] = useState(null)
  const [capturedUrl, setCapturedUrl] = useState(null)

  // Для режима галереи — очередь до 10 фото
  // item: { id, blob, url, status: null|'uploading'|'done'|'error' }
  const [queue, setQueue] = useState([])
  const [fromGallery, setFromGallery] = useState(false)

  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null)

  const [photos, setPhotos] = useState([])
  const [photosLoading, setPhotosLoading] = useState(false)

  const [lightboxUrl, setLightboxUrl] = useState(null)
  const [lightboxLoading, setLightboxLoading] = useState(false)

  // ── Витрина ──────────────────────────────────────────────────────
  const loadPhotos = useCallback(async () => {
    try {
      const saved = JSON.parse(
        localStorage.getItem('mirler_cloudinary_photos') || '[]'
      )
      setPhotos(saved)
    } catch {
      setPhotos([])
    }
  }, [])

  useEffect(() => {
    loadPhotos()
    const id = setInterval(loadPhotos, GALLERY_REFRESH_MS)
    return () => clearInterval(id)
  }, [loadPhotos])

  // ── Камера ───────────────────────────────────────────────────────
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCameraReady(false)
  }

  const startCamera = useCallback(async (facing) => {
    stopCamera()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraReady(true)
    } catch (e) {
      alert('Не удалось получить доступ к камере: ' + e.message)
    }
  }, [])

  const openCamera = async () => {
    setFromGallery(false)
    setCapturedBlob(null)
    setCapturedUrl(null)
    setUploadStatus(null)
    setMode('camera')
    await startCamera(facingMode)
  }

  const switchCamera = async () => {
    const next = facingMode === 'user' ? 'environment' : 'user'
    setFacingMode(next)
    await startCamera(next)
  }

  
  const takePhoto = async () => {
    const video = videoRef.current
    const canvas = canvasRef.current

    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext('2d')

    // зеркалим фронтальную камеру
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // сбрасываем transform
    ctx.setTransform(1, 0, 0, 1, 0, 0)

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.95)
    )

    if (!blob) {
      console.error('Failed to create blob')
      return
    }

    const file = new File(
      [blob],
      `photo_${Date.now()}.jpg`,
      {
        type: 'image/jpeg',
      }
    )

    setCapturedBlob(file)
    setCapturedUrl(URL.createObjectURL(file))

    stopCamera()
    setMode('preview')
  
  }

  const retakeCamera = async () => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl)
    setCapturedBlob(null)
    setCapturedUrl(null)
    setUploadStatus(null)
    setMode('camera')
    await startCamera(facingMode)
  }

  const closeAll = () => {
    stopCamera()
    if (capturedUrl) URL.revokeObjectURL(capturedUrl)
    setCapturedBlob(null)
    setCapturedUrl(null)
    setUploadStatus(null)
    // Чистим очередь галереи
    setQueue((q) => {
      q.forEach((item) => URL.revokeObjectURL(item.url))
      return []
    })
    setFromGallery(false)
    setMode('gallery')
  }

  // ── Галерея: выбор файлов ────────────────────────────────────────
  const onFileChange = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    // Сбрасываем input чтобы можно было выбрать снова
    e.target.value = ''

    setQueue((prev) => {
      const slots = MAX_FILES - prev.length
      const toAdd = files.slice(0, slots).map((file) => ({
        id: `${Date.now()}_${Math.random()}`,
        blob: file,
        url: URL.createObjectURL(file),
        status: null,
      }))
      return [...prev, ...toAdd]
    })
    setUploadStatus(null)
    setFromGallery(true)
    setMode('preview')
  }

  const removeFromQueue = (id) => {
    setQueue((prev) => {
      const item = prev.find((i) => i.id === id)
      if (item) URL.revokeObjectURL(item.url)
      return prev.filter((i) => i.id !== id)
    })
  }

  const addMoreFiles = () => {
    fileInputRef.current?.click()
  }

  // ── Загрузка на Яндекс.Диск ──────────────────────────────────────
  // Загрузка одного фото с камеры
  const uploadCameraPhoto = async () => {
    if (!capturedBlob || !YANDEX_TOKEN) { setUploadStatus('error'); return }
    setUploading(true)
    setUploadStatus(null)
    try {
      await ydEnsureFolder(YANDEX_TOKEN, YANDEX_FOLDER)
      const filename = `photo_${Date.now()}.jpg`
      await ydUpload(YANDEX_TOKEN, YANDEX_FOLDER, filename, capturedBlob)
      await ydPublishAndGetUrl(YANDEX_TOKEN, YANDEX_FOLDER, filename)
      setUploadStatus('success')
      setTimeout(() => { closeAll(); loadPhotos() }, 1500)
    } catch (e) {
      console.error(e)
      setUploadStatus('error')
    } finally {
      setUploading(false)
    }
  }

  // Загрузка очереди из галереи
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
          name: uploaded.public_id,
          imgUrl: uploaded.secure_url,
          downloadUrl: uploaded.secure_url,
          created: new Date().toISOString(),
        })

        // backup в Яндекс.Диск
        if (YANDEX_TOKEN) {
          try {
            await ydEnsureFolder(YANDEX_TOKEN, YANDEX_FOLDER)

            const filename = `${uploaded.public_id}.jpg`

            await ydUpload(
              YANDEX_TOKEN,
              YANDEX_FOLDER,
              filename,
              item.blob
            )
          } catch (e) {
            console.error('Yandex backup failed:', e)
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

  // ── Лайтбокс ─────────────────────────────────────────────────────
  const openLightbox = (photo) => {
    // publicUrl ставим напрямую в <img src> — браузер грузит без CORS
    setLightboxUrl(photo.imgUrl || photo.publicUrl || photo.downloadUrl || null)
  }

  useEffect(() => {
    return () => {
      stopCamera()
      if (capturedUrl) URL.revokeObjectURL(capturedUrl)
      queue.forEach((i) => URL.revokeObjectURL(i.url))
    }
  }, []) // eslint-disable-line

  // ─────────────────────────────────────────────────────────────────
  return (
    <section className="photo-section">
      <div className="photo-section__container">
        <div className="photo-section__bg" aria-hidden />

        <div className="photo-section__content">
          <h2 className="photo-section__title">Наши моменты</h2>
          <p className="photo-section__subtitle">
            Сделайте фото и поделитесь воспоминаниями этого дня
          </p>

          {/* ── Кнопки выбора режима ── */}
          {mode === 'gallery' && (
            <div className="photo-section__actions">
              <button className="photo-section__btn" onClick={openCamera}>
                Сделать фото
              </button>
              <button
                className="photo-section__btn photo-section__btn--secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                Загрузить из галереи
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={onFileChange}
              />
            </div>
          )}

          {/* ── Камера (viewfinder) ── */}
          {mode === 'camera' && (
            <div className="photo-section__camera-wrap">
              <div className="photo-section__video-wrap">
                <video
                  ref={videoRef}
                  className="photo-section__video"
                  playsInline
                  muted
                  autoPlay
                  style={{
                    transform:
                      facingMode === 'user'
                        ? 'scaleX(-1)'
                        : 'scaleX(1)',
                  }}
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                <div className="photo-section__camera-controls">
                  <button className="photo-section__btn photo-section__btn--ghost" onClick={closeAll}>
                    Закрыть
                  </button>
                  {cameraReady && (
                    <>
                      <button className="photo-section__btn photo-section__btn--shutter" onClick={takePhoto}>
                        
                      </button>
                      <button
                        className="photo-section__btn photo-section__btn--ghost"
                        onClick={switchCamera}
                        title="Перевернуть камеру"
                      >
                        Повернуть
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Предпросмотр ── */}
          {mode === 'preview' && (
            <div className="photo-section__preview-wrap">

              {/* Камера: одно фото */}
              {!fromGallery && capturedUrl && (
                <>
                  <img src={capturedUrl} alt="Предпросмотр" className="photo-section__preview" />
                  <div className="photo-section__preview-controls">
                    <button className="photo-section__btn photo-section__btn--ghost" onClick={retakeCamera} disabled={uploading}>
                      Переснять
                    </button>
                    <button className="photo-section__btn" onClick={uploadCameraPhoto} disabled={uploading || !YANDEX_TOKEN}>
                      {uploading ? 'Загружаем…' : 'Сохранить'}
                    </button>
                    <button className="photo-section__btn photo-section__btn--ghost" onClick={closeAll} disabled={uploading}>
                      Отмена
                    </button>
                  </div>
                </>
              )}

              {/* Галерея: очередь фото */}
              {fromGallery && (
                <>
                  <div className="photo-section__queue">
                    {queue.map((item) => (
                      <div key={item.id} className={`photo-section__queue-item photo-section__queue-item--${item.status || 'pending'}`}>
                        <img src={item.url} alt="" className="photo-section__queue-img" />
                        {item.status === 'uploading' && (
                          <div className="photo-section__queue-overlay">⌛</div>
                        )}
                        {item.status === 'done' && (
                          <div className="photo-section__queue-overlay photo-section__queue-overlay--done">✓</div>
                        )}
                        {item.status === 'error' && (
                          <div className="photo-section__queue-overlay photo-section__queue-overlay--error">!</div>
                        )}
                        {!uploading && item.status !== 'done' && (
                          <button
                            className="photo-section__queue-remove"
                            onClick={() => removeFromQueue(item.id)}
                            aria-label="Удалить"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Кнопка добавить ещё */}
                    {queue.length < MAX_FILES && !uploading && (
                      <button className="photo-section__queue-add" onClick={addMoreFiles} title="Добавить ещё">
                        +
                      </button>
                    )}
                  </div>

                  <p className="photo-section__queue-hint">
                    {queue.length} / {MAX_FILES} фото
                  </p>

                  <div className="photo-section__preview-controls">
                    <button
                      className="photo-section__btn photo-section__btn--ghost"
                      onClick={closeAll}
                      disabled={uploading}
                    >
                      Отмена
                    </button>
                    <button
                      className="photo-section__btn"
                      onClick={uploadQueue}
                      disabled={uploading || !YANDEX_TOKEN || queue.length === 0}
                    >
                      {uploading ? 'Загружаем…' : `Сохранить (${queue.length})`}
                    </button>
                  </div>

                  {/* hidden input для добавления ещё */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={onFileChange}
                  />
                </>
              )}

              {!YANDEX_TOKEN && (
                <p className="photo-section__status photo-section__status--error">
                  Укажите VITE_YANDEX_DISK_TOKEN в файле .env
                </p>
              )}
              {uploadStatus === 'success' && (
                <p className="photo-section__status photo-section__status--success">
                  ✓ Фото добавлены в витрину!
                </p>
              )}
              {uploadStatus === 'error' && (
                <p className="photo-section__status photo-section__status--error">
                  Не удалось загрузить. Проверьте токен Яндекс.Диска.
                </p>
              )}
            </div>
          )}

          {/* ── Витрина ── */}
          <div className="photo-section__gallery">
            {photosLoading && photos.length === 0 && (
              <p className="photo-section__loading">Загружаем фотографии…</p>
            )}
            {!photosLoading && photos.length === 0 && (
              <p className="photo-section__empty">Фотографий пока нет — будьте первыми! 🌸</p>
            )}
            {photos.map((photo) => (
              <button
                key={photo.name}
                className="photo-section__thumb-btn"
                onClick={() => openLightbox(photo)}
                title="Открыть фото"
              >
                {photo.imgUrl ? (
                  <img
                    src={photo.imgUrl}
                    alt={photo.name}
                    className="photo-section__thumb"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.nextSibling.style.display = 'flex'
                    }}
                  />
                ) : null}
                <span className="photo-section__thumb-placeholder" style={{ display: photo.imgUrl ? 'none' : 'flex' }}>
                  🖼
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Лайтбокс через portal ── */}
      {createPortal(
        (lightboxUrl || lightboxLoading) ? (
          <div
            className="photo-section__lightbox"
            onClick={() => { setLightboxUrl(null); setLightboxLoading(false) }}
          >
            {lightboxLoading && <div className="photo-section__lightbox-spinner">⌛</div>}
            {lightboxUrl && (
              <img
                src={lightboxUrl}
                alt="Фото"
                className="photo-section__lightbox-img"
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <button
              className="photo-section__lightbox-close"
              onClick={() => { setLightboxUrl(null); setLightboxLoading(false) }}
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>
        ) : null,
        document.body
      )}
    </section>
  )
}

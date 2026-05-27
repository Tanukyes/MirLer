import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import './PhotoSection.css'

const YANDEX_TOKEN = import.meta.env.VITE_YANDEX_DISK_TOKEN || ''
const YANDEX_FOLDER = import.meta.env.VITE_YANDEX_DISK_FOLDER || 'wedding-photos'
const GALLERY_REFRESH_MS = 30_000
const MAX_FILES = 10

const GOOGLE_SCRIPT_URL = import.meta.env.VITE_GOOGLE_SHEET_URL || ''
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dvqen4u01'
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'mirler_uploads'

// ─── Кэш галереи (переживает перемонтирование компонента) ────────
let _photosCache = null
let _photosCacheTs = 0
const CACHE_TTL = 25_000 // 25 сек — чуть меньше интервала обновления

// ─── Сжатие изображения перед загрузкой ──────────────────────────
// Уменьшаем до 1920px по длинной стороне, качество JPEG 0.82
// Даёт ~3–5× меньший размер файла → загрузка в 3–5 раз быстрее
function compressImage(file, maxSide = 1920, quality = 0.82) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > maxSide || height > maxSide) {
        if (width >= height) { height = Math.round(height * maxSide / width); width = maxSide }
        else { width = Math.round(width * maxSide / height); height = maxSide }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => resolve(blob || file),
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

// ─── Cloudinary ───────────────────────────────────────────────────
async function uploadToCloudinary(file) {
  const compressed = await compressImage(file)
  const formData = new FormData()
  formData.append('file', compressed)
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  )
  if (!response.ok) throw new Error(`Cloudinary upload failed: ${response.status}`)
  return await response.json()
}

// ─── Google Sheets ────────────────────────────────────────────────
async function savePhotoToSheet(imgUrl, publicId) {
  if (!GOOGLE_SCRIPT_URL) return
  try {
    const url = `${GOOGLE_SCRIPT_URL}?action=addPhoto&imgUrl=${encodeURIComponent(imgUrl)}&publicId=${encodeURIComponent(publicId)}`
    await fetch(url, { cache: 'no-store' })
  } catch (e) {
    console.error('savePhotoToSheet error:', e)
  }
}

async function fetchPhotosFromSheet() {
  if (!GOOGLE_SCRIPT_URL) return []
  try {
    const url = `${GOOGLE_SCRIPT_URL}?action=getPhotos&ts=${Date.now()}`
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) throw new Error('Sheet fetch failed')
    const data = await response.json()
    return (data.photos || []).map((item) => ({
      id: item.publicId,
      name: item.publicId,
      imgUrl: item.imgUrl,
      downloadUrl: item.imgUrl,
      created: item.created,
    }))
  } catch (e) {
    console.error('fetchPhotosFromSheet error:', e)
    return []
  }
}

// Загрузка с кэшированием — быстрый первый показ, потом тихое обновление
async function fetchPhotosWithCache(forceRefresh = false) {
  const now = Date.now()
  if (!forceRefresh && _photosCache && now - _photosCacheTs < CACHE_TTL) {
    return _photosCache
  }
  const photos = await fetchPhotosFromSheet()
  _photosCache = photos
  _photosCacheTs = now
  return photos
}

// ─── Яндекс.Диск (только бэкап) ──────────────────────────────────
const YD_API = (path) =>
  `https://corsproxy.io/?url=${encodeURIComponent('https://cloud-api.yandex.net' + path)}`

async function ydEnsureFolder(token, folder) {
  await fetch(YD_API(`/v1/disk/resources?path=disk:/${folder}`), {
    method: 'PUT',
    headers: { Authorization: `OAuth ${token}` },
  }).catch(() => {})
}

async function ydUpload(token, folder, filename, blob) {
  const urlRes = await fetch(
    YD_API(`/v1/disk/resources/upload?path=disk:/${folder}/${filename}&overwrite=true`),
    { headers: { Authorization: `OAuth ${token}` } }
  )
  if (!urlRes.ok) throw new Error(`Ошибка получения URL: ${urlRes.status}`)
  const { href } = await urlRes.json()
  const uploadRes = await fetch(href, { method: 'PUT', body: blob })
  if (!uploadRes.ok) throw new Error(`Ошибка загрузки: ${uploadRes.status}`)
}

// Бэкап на Яндекс без блокировки основного потока
function ydBackupSilent(token, folder, publicId, blob) {
  if (!token) return
  ;(async () => {
    try {
      await ydEnsureFolder(token, folder)
      await ydUpload(token, folder, `${publicId}.jpg`, blob)
    } catch (e) {
      console.warn('Yandex backup failed (non-critical):', e.message)
    }
  })()
}

// ─── Компонент ───────────────────────────────────────────────────
export default function PhotoSection() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const fileInputRef = useRef(null)

  const [mode, setMode] = useState('gallery')
  const [cameraReady, setCameraReady] = useState(false)
  const [facingMode, setFacingMode] = useState('environment')

  const [capturedBlob, setCapturedBlob] = useState(null)
  const [capturedUrl, setCapturedUrl] = useState(null)

  // item: { id, blob, url, status: null|'uploading'|'done'|'error' }
  const [queue, setQueue] = useState([])
  const [fromGallery, setFromGallery] = useState(false)

  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null) // 'success'|'error'|null
  const [uploadError, setUploadError] = useState('')    // человеческий текст ошибки

  const [photos, setPhotos] = useState([])
  const [photosLoading, setPhotosLoading] = useState(false)

  const [lightboxUrl, setLightboxUrl] = useState(null)

  // ── Витрина ──────────────────────────────────────────────────────
  const loadPhotos = useCallback(async (force = false) => {
    // При первом вызове показываем спиннер только если кэша нет
    if (!_photosCache) setPhotosLoading(true)
    try {
      const fetched = await fetchPhotosWithCache(force)
      setPhotos(fetched)
    } catch {
      setPhotos([])
    } finally {
      setPhotosLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPhotos()
    const id = setInterval(() => loadPhotos(true), GALLERY_REFRESH_MS)
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
    setUploadError('')
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

    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    ctx.setTransform(1, 0, 0, 1, 0, 0)

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95))
    if (!blob) { console.error('Failed to create blob'); return }

    const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' })
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
    setUploadError('')
    setMode('camera')
    await startCamera(facingMode)
  }

  const closeAll = () => {
    stopCamera()
    if (capturedUrl) URL.revokeObjectURL(capturedUrl)
    setCapturedBlob(null)
    setCapturedUrl(null)
    setUploadStatus(null)
    setUploadError('')
    setQueue((q) => { q.forEach((item) => URL.revokeObjectURL(item.url)); return [] })
    setFromGallery(false)
    setMode('gallery')
  }

  // ── Галерея: выбор файлов ─────────────────────────────────────────
  const onFileChange = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
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
    setUploadError('')
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

  const addMoreFiles = () => fileInputRef.current?.click()

  // ── Загрузка с камеры ─────────────────────────────────────────────
  const uploadCameraPhoto = async () => {
    if (!capturedBlob) { setUploadStatus('error'); setUploadError('Нет фото для загрузки'); return }
    setUploading(true)
    setUploadStatus(null)
    setUploadError('')
    try {
      const uploaded = await uploadToCloudinary(capturedBlob)

      // Сохраняем в Google Sheets
      await savePhotoToSheet(uploaded.secure_url, uploaded.public_id)

      // Обновляем галерею (сбрасываем кэш)
      const updated = await fetchPhotosWithCache(true)
      setPhotos(updated)

      // Бэкап на Яндекс.Диск — в фоне, не блокирует и не показывает ошибку пользователю
      ydBackupSilent(YANDEX_TOKEN, YANDEX_FOLDER, uploaded.public_id, capturedBlob)

      setUploadStatus('success')
      setTimeout(closeAll, 1500)
    } catch (e) {
      console.error(e)
      setUploadStatus('error')
      setUploadError('Не удалось сохранить фото. Попробуйте ещё раз.')
    } finally {
      setUploading(false)
    }
  }

  // ── Загрузка очереди из галереи — параллельно ─────────────────────
  const uploadQueue = async () => {
    if (!queue.length) return
    setUploading(true)
    setUploadStatus(null)
    setUploadError('')

    // Помечаем все как "в очереди"
    setQueue((q) => q.map((i) => ({ ...i, status: 'uploading' })))

    let hasError = false

    // Загружаем все файлы параллельно через Promise.allSettled
    const results = await Promise.allSettled(
      queue.map(async (item) => {
        try {
          const uploaded = await uploadToCloudinary(item.blob)
          await savePhotoToSheet(uploaded.secure_url, uploaded.public_id)
          // Бэкап в фоне
          ydBackupSilent(YANDEX_TOKEN, YANDEX_FOLDER, uploaded.public_id, item.blob)
          // Помечаем как готово
          setQueue((q) => q.map((i) => i.id === item.id ? { ...i, status: 'done' } : i))
          return uploaded
        } catch (e) {
          console.error('Upload failed for item', item.id, e)
          setQueue((q) => q.map((i) => i.id === item.id ? { ...i, status: 'error' } : i))
          hasError = true
          throw e
        }
      })
    )

    // Обновляем галерею один раз после всех загрузок
    const updated = await fetchPhotosWithCache(true)
    setPhotos(updated)

    const successCount = results.filter((r) => r.status === 'fulfilled').length

    if (hasError) {
      const failCount = results.filter((r) => r.status === 'rejected').length
      setUploadStatus('error')
      setUploadError(
        successCount > 0
          ? `Загружено ${successCount} из ${queue.length}. ${failCount} фото не удалось — попробуйте ещё раз.`
          : 'Не удалось загрузить фото. Проверьте интернет-соединение.'
      )
    } else {
      setUploadStatus('success')
      setTimeout(closeAll, 1000)
    }

    setUploading(false)
  }

  // ── Лайтбокс ─────────────────────────────────────────────────────
  const openLightbox = (photo) => {
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
            <br />
            все фото можно посмотреть{' '}
            <a
              href="https://disk.yandex.ru/d/ztnSdeg-_8XCjw"
              target="_blank"
              rel="noopener noreferrer"
              className="photo-section__yd-link"
            >
              здесь
            </a>
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

          {/* ── Камера ── */}
          {mode === 'camera' && (
            <div className="photo-section__camera-wrap">
              <div className="photo-section__video-wrap">
                <video
                  ref={videoRef}
                  className="photo-section__video"
                  playsInline
                  muted
                  autoPlay
                  style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)' }}
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
                    <button className="photo-section__btn" onClick={uploadCameraPhoto} disabled={uploading}>
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
                      disabled={uploading || queue.length === 0}
                    >
                      {uploading ? 'Загружаем…' : `Сохранить (${queue.length})`}
                    </button>
                  </div>

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

              {uploadStatus === 'success' && (
                <p className="photo-section__status photo-section__status--success">
                  ✓ Фото добавлены в витрину!
                </p>
              )}
              {uploadStatus === 'error' && (
                <p className="photo-section__status photo-section__status--error">
                  {uploadError || 'Не удалось загрузить. Попробуйте ещё раз.'}
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
                    decoding="async"
                    onError={() => {
                      setPhotos((prev) => prev.filter((p) => p.name !== photo.name))
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
        lightboxUrl ? (
          <div
            className="photo-section__lightbox"
            onClick={() => setLightboxUrl(null)}
          >
            <img
              src={lightboxUrl}
              alt="Фото"
              className="photo-section__lightbox-img"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              className="photo-section__lightbox-close"
              onClick={() => setLightboxUrl(null)}
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

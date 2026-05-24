import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import './PhotoSection.css'

const YANDEX_TOKEN = import.meta.env.VITE_YANDEX_DISK_TOKEN || ''
const YANDEX_FOLDER = import.meta.env.VITE_YANDEX_DISK_FOLDER || 'wedding-photos'
const GALLERY_REFRESH_MS = 30_000
const MAX_FILES = 10

// ─── Яндекс.Диск API ────────────────────────────────────────────────
async function ydEnsureFolder(token, folder) {
  await fetch(`https://cloud-api.yandex.net/v1/disk/resources?path=disk:/${folder}`, {
    method: 'PUT',
    headers: { Authorization: `OAuth ${token}` },
  })
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

async function ydListPhotos(token, folder) {
  const res = await fetch(
    `https://cloud-api.yandex.net/v1/disk/resources?path=disk:/${folder}&limit=100&sort=-created&fields=_embedded,_embedded.items.name,_embedded.items.type,_embedded.items.public_url,_embedded.items.created`,
    { headers: { Authorization: `OAuth ${token}` } }
  )
  if (!res.ok) return []
  const data = await res.json()
  const items = data._embedded?.items || []
  return items
    .filter((i) => i.type === 'file' && /\.(jpg|jpeg|png|webp)$/i.test(i.name))
    .map((i) => ({ name: i.name, publicUrl: i.public_url || null }))
}

// Получаем прямую ссылку на скачивание через API (поддерживает CORS)
async function ydGetDownloadUrl(token, folder, filename) {
  const path = `disk:/${folder}/${filename}`
  const res = await fetch(
    `https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(path)}`,
    { headers: { Authorization: `OAuth ${token}` } }
  )
  if (!res.ok) return null
  const { href } = await res.json()
  return href
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
  // Кэш blob-URL для превью: { [name]: objectUrl }
  const previewCacheRef = useRef({})

  const [lightboxUrl, setLightboxUrl] = useState(null)
  const [lightboxLoading, setLightboxLoading] = useState(false)

  // ── Витрина ──────────────────────────────────────────────────────
  const loadPhotos = useCallback(async () => {
    if (!YANDEX_TOKEN) return
    setPhotosLoading(true)
    try {
      const list = await ydListPhotos(YANDEX_TOKEN, YANDEX_FOLDER)
      // Для каждого фото получаем прямую ссылку на скачивание (CORS-совместима)
      const withUrls = await Promise.all(
        list.map(async (photo) => {
          // Используем кэш чтобы не делать лишние запросы при поллинге
          if (previewCacheRef.current[photo.name]) {
            return { ...photo, downloadUrl: previewCacheRef.current[photo.name] }
          }
          const url = await ydGetDownloadUrl(YANDEX_TOKEN, YANDEX_FOLDER, photo.name)
          if (url) previewCacheRef.current[photo.name] = url
          return { ...photo, downloadUrl: url }
        })
      )
      setPhotos(withUrls)
    } catch (e) {
      console.error('Ошибка загрузки фото:', e)
    } finally {
      setPhotosLoading(false)
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

  const takePhoto = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        setCapturedBlob(blob)
        setCapturedUrl(URL.createObjectURL(blob))
        stopCamera()
        setMode('preview')
      },
      'image/jpeg',
      0.92
    )
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
    if (!YANDEX_TOKEN) { setUploadStatus('error'); return }
    const pending = queue.filter((i) => i.status !== 'done')
    if (!pending.length) return
    setUploading(true)
    setUploadStatus(null)
    try {
      await ydEnsureFolder(YANDEX_TOKEN, YANDEX_FOLDER)
    } catch (e) {
      console.error(e)
    }
    for (const item of pending) {
      setQueue((prev) => prev.map((i) => i.id === item.id ? { ...i, status: 'uploading' } : i))
      try {
        const filename = `photo_${Date.now()}_${Math.floor(Math.random()*10000)}.jpg`
        await ydUpload(YANDEX_TOKEN, YANDEX_FOLDER, filename, item.blob)
        await ydPublishAndGetUrl(YANDEX_TOKEN, YANDEX_FOLDER, filename)
        setQueue((prev) => prev.map((i) => i.id === item.id ? { ...i, status: 'done' } : i))
      } catch (e) {
        console.error(e)
        setQueue((prev) => prev.map((i) => i.id === item.id ? { ...i, status: 'error' } : i))
      }
    }
    setUploading(false)
    setUploadStatus('success')
    setTimeout(() => { closeAll(); loadPhotos() }, 1500)
  }

  // ── Лайтбокс ─────────────────────────────────────────────────────
  const openLightbox = async (photo) => {
    // Если уже есть download URL в кэше — используем его сразу
    if (photo.downloadUrl) {
      setLightboxUrl(photo.downloadUrl)
      setLightboxLoading(false)
      return
    }
    setLightboxUrl(null)
    setLightboxLoading(true)
    try {
      const url = await ydGetDownloadUrl(YANDEX_TOKEN, YANDEX_FOLDER, photo.name)
      setLightboxUrl(url || null)
    } catch {
      setLightboxUrl(null)
    } finally {
      setLightboxLoading(false)
    }
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
                <video ref={videoRef} className="photo-section__video" playsInline muted autoPlay />
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
                {photo.downloadUrl ? (
                  <img
                    src={photo.downloadUrl}
                    alt={photo.name}
                    className="photo-section__thumb"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.nextSibling.style.display = 'flex'
                    }}
                  />
                ) : null}
                <span className="photo-section__thumb-placeholder" style={{ display: photo.downloadUrl ? 'none' : 'flex' }}>
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

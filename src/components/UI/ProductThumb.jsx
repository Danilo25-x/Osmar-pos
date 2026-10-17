import { Shirt, Maximize2 } from 'lucide-react'

// Miniatura reutilizable. Cuando se proporciona onClick, la imagen puede ampliarse.
// El tono se elige por nombre y se resuelve con clases de tema (sin estilos en línea).
const TINTS = 5
const hash = s => [...(s || '')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)

export default function ProductThumb({ name, src, size = 'md', onClick }) {
  const tint = `thumb--tint${hash(name) % TINTS}`
  const content = src ? <img src={src} alt={`Imagen de ${name}`} /> : <Shirt strokeWidth={1.2} />

  if (!onClick || !src) {
    return (
      <div className={`thumb thumb--${size} ${tint}`} aria-hidden={src ? undefined : 'true'}>
        {content}
      </div>
    )
  }

  return (
    <button
      type="button"
      className={`thumb thumb--${size} thumb--clickable ${tint}`}
      onClick={e => { e.stopPropagation(); onClick() }}
      title={`Ampliar imagen de ${name}`}
      aria-label={`Ampliar imagen de ${name}`}
    >
      {content}
      <span className="thumb__zoom" aria-hidden="true"><Maximize2 size={size === 'sm' ? 13 : 17} /></span>
    </button>
  )
}

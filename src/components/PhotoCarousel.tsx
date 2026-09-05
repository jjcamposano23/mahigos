import { useEffect, useState } from 'react'

/** Crossfading background image carousel. Parent overlays gradients/content. */
export function PhotoCarousel({
  images,
  interval = 6000,
  className = '',
}: {
  images: string[]
  interval?: number
  className?: string
}) {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (images.length < 2) return
    const id = window.setInterval(() => setIdx((i) => (i + 1) % images.length), interval)
    return () => window.clearInterval(id)
  }, [images.length, interval])

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {images.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden
          className={`absolute inset-0 h-full w-full scale-105 object-cover transition-opacity duration-[1200ms] ease-in-out ${
            i === idx ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
    </div>
  )
}

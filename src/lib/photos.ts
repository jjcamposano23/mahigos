/** Bicol landscape photos used as filtered backgrounds across the app. */
export interface BicolPhoto {
  src: string
  label: string
  place: string
}

export const BICOL_PHOTOS: BicolPhoto[] = [
  { src: '/photos/mayon.jpg', label: 'Mayon Volcano', place: 'Albay' },
  { src: '/photos/butanding.jpg', label: 'Butanding (whale shark)', place: 'Donsol, Sorsogon' },
  { src: '/photos/penafrancia.jpg', label: 'Peñafrancia Basilica', place: 'Naga City' },
]

/** Pick a photo. With a seed it is stable (e.g. same all day); otherwise random. */
export function pickBicolPhoto(seed?: number): BicolPhoto {
  const i =
    seed === undefined
      ? Math.floor(Math.random() * BICOL_PHOTOS.length)
      : Math.abs(seed) % BICOL_PHOTOS.length
  return BICOL_PHOTOS[i]
}

/** Day-of-year, handy as a stable daily seed. */
export function daySeed(d = new Date()): number {
  const start = new Date(d.getFullYear(), 0, 0)
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000)
}

import type { DocProvider } from '../../lib/types'

export function detectLinkProvider(url: string): DocProvider {
  const u = url.toLowerCase()
  if (u.includes('docs.google.com/document')) return 'google-docs'
  if (u.includes('docs.google.com/spreadsheets')) return 'google-sheets'
  if (u.includes('docs.google.com/presentation')) return 'google-slides'
  if (u.includes('drive.google.com')) return 'drive'
  return 'link'
}

export function detectFileProvider(fileName: string, mime: string): DocProvider {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (mime.startsWith('image/')) return 'image'
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (['doc', 'docx'].includes(ext) || mime.includes('word')) return 'word'
  return 'file'
}

export const PROVIDER_META: Record<DocProvider, { label: string; color: string }> = {
  'google-docs': { label: 'Google Doc', color: '#2f6df0' },
  'google-sheets': { label: 'Google Sheet', color: '#2f8f6b' },
  'google-slides': { label: 'Google Slides', color: '#e8a33d' },
  drive: { label: 'Google Drive', color: '#2f6df0' },
  word: { label: 'Word', color: '#2b579a' },
  pdf: { label: 'PDF', color: '#ef3422' },
  image: { label: 'Image', color: '#8b5cf6' },
  link: { label: 'Link', color: '#6b7280' },
  file: { label: 'File', color: '#6b7280' },
}

/** Whether the resource can be previewed inline via an iframe. */
export function previewUrl(url: string, provider: DocProvider): string | null {
  if (provider === 'pdf' || provider === 'image') return url
  if (provider === 'word') return `https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(url)}`
  return null
}

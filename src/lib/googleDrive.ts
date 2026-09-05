// Client-side Google Drive access via Google Identity Services (GIS) + Drive API v3.
// No server needed: the signed-in user grants Drive access, and the browser
// calls the Drive API directly.

const CLIENT_ID = '361177669575-6ldndnonbibsmudad9e4ejtal33gd32n.apps.googleusercontent.com'
const SCOPES =
  'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file'

/** The UP Ibalon shared Drive folder. */
export const SHARED_FOLDER_ID = '1t7Tq6M0yrkMRsEW8tC-XAD8Y2eLv209h'

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  isFolder: boolean
  webViewLink?: string
  iconLink?: string
  size?: number
  modifiedTime?: string
}

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any
  }
}

let tokenClient: any = null
let token: { value: string; expiresAt: number } | null = null
let resolver: ((t: string) => void) | null = null
let rejecter: ((e: Error) => void) | null = null

function waitForGis(): Promise<void> {
  return new Promise((resolve, reject) => {
    let tries = 0
    const check = () => {
      if (window.google?.accounts?.oauth2) return resolve()
      if (++tries > 100) return reject(new Error('Google sign-in library failed to load.'))
      setTimeout(check, 100)
    }
    check()
  })
}

async function ensureClient() {
  if (tokenClient) return
  await waitForGis()
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (resp: any) => {
      if (resp.error) {
        rejecter?.(new Error(resp.error))
      } else {
        token = { value: resp.access_token, expiresAt: Date.now() + (resp.expires_in ?? 3600) * 1000 }
        resolver?.(resp.access_token)
      }
      resolver = null
      rejecter = null
    },
  })
}

export function isDriveConnected(): boolean {
  return !!token && token.expiresAt > Date.now() + 60_000
}

/** Get a valid access token, prompting the user if needed. */
export async function connectDrive(interactive = true): Promise<string> {
  if (isDriveConnected()) return token!.value
  await ensureClient()
  return new Promise<string>((resolve, reject) => {
    resolver = resolve
    rejecter = reject
    tokenClient.requestAccessToken({ prompt: interactive ? '' : 'none' })
  })
}

async function driveGet(url: string): Promise<any> {
  const t = await connectDrive(false).catch(() => connectDrive(true))
  const res = await fetch(url, { headers: { Authorization: `Bearer ${t}` } })
  if (res.status === 401) {
    token = null
    const t2 = await connectDrive(true)
    return fetch(url, { headers: { Authorization: `Bearer ${t2}` } }).then((r) => r.json())
  }
  return res.json()
}

export async function listFolder(folderId: string): Promise<DriveFile[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`)
  const fields = encodeURIComponent(
    'files(id,name,mimeType,webViewLink,iconLink,size,modifiedTime)',
  )
  const url =
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}` +
    `&orderBy=folder,name&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true`
  const data = await driveGet(url)
  if (data.error) throw new Error(data.error.message || 'Drive error')
  return (data.files ?? []).map((f: any) => ({
    ...f,
    isFolder: f.mimeType === 'application/vnd.google-apps.folder',
    size: f.size ? Number(f.size) : undefined,
  }))
}

/** Upload a file into a Drive folder (multipart). Requires drive.file scope. */
export async function uploadToDrive(folderId: string, file: File): Promise<DriveFile> {
  const t = await connectDrive(true)
  const metadata = { name: file.name, parents: [folderId] }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', file)
  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,webViewLink',
    { method: 'POST', headers: { Authorization: `Bearer ${t}` }, body: form },
  )
  const data = await res.json()
  if (data.error) throw new Error(data.error.message || 'Upload failed')
  return { ...data, isFolder: false }
}

/** Find (or create) a named subfolder inside a parent; returns its id. */
export async function ensureSubfolder(parentId: string, name: string): Promise<string> {
  const q = encodeURIComponent(
    `'${parentId}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
  )
  const data = await driveGet(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
  )
  if (data.files?.[0]) return data.files[0].id
  const t = await connectDrive(true)
  const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id&supportsAllDrives=true', {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  })
  const created = await res.json()
  if (created.error) throw new Error(created.error.message)
  return created.id
}

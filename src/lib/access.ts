/**
 * Sign-in is restricted to these authorized UP Ibalon accounts only.
 * Any other authenticated email is rejected and signed out.
 */
export const ALLOWED_EMAILS = [
  'jjcamposano23@gmail.com',
  'upiaaosec@gmail.com',
  'gbbrutas@up.edu.ph',
  'ivmancenido@up.edu.ph',
]

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return ALLOWED_EMAILS.includes(email.trim().toLowerCase())
}

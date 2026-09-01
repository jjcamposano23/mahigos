/** Bikol (Central Bikol) greetings and warm phrases used across the app. */

export function bikolGreeting(date = new Date()): { hello: string; en: string } {
  const h = date.getHours()
  if (h < 12) return { hello: 'Marhay na aga', en: 'Good morning' }
  if (h < 18) return { hello: 'Marhay na hapon', en: 'Good afternoon' }
  return { hello: 'Marhay na banggi', en: 'Good evening' }
}

/** Warm welcome phrase — "Dagos tabi" ≈ "please, come in / welcome". */
export const WELCOME = 'Dagos tabi'

/** Gratitude — "Dios mabalos" ≈ "may God repay you / thank you". */
export const THANKS = 'Dios mabalos'

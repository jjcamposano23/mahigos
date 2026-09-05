import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getFunctions } from 'firebase/functions'

// NOTE: Firebase web config values are public identifiers, not secrets.
// Access is controlled by Firebase Security Rules + (later) App Check.
const firebaseConfig = {
  apiKey: 'AIzaSyDyUDkDYubl8V_6UkPn9QjQqo2Dm3NOM3A',
  authDomain: 'mahigos-collab.firebaseapp.com',
  projectId: 'mahigos-collab',
  storageBucket: 'mahigos-collab.firebasestorage.app',
  messagingSenderId: '361177669575',
  appId: '1:361177669575:web:29bc5280886c847d08c3e2',
  measurementId: 'G-BMW6PZLNEH',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
// Cloud Functions live in asia-southeast1 (same region as Firestore).
export const functions = getFunctions(app, 'asia-southeast1')

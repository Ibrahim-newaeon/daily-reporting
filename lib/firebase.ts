import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getStorage, Storage } from 'firebase-admin/storage';

// Client SDK imports
import { initializeApp as initializeClientApp, getApps as getClientApps, FirebaseApp } from 'firebase/app';
import { getAuth as getClientAuth, Auth as ClientAuth } from 'firebase/auth';
import { getFirestore as getClientFirestore, Firestore as ClientFirestore } from 'firebase/firestore';
import { getStorage as getClientStorage, FirebaseStorage } from 'firebase/storage';

// Admin SDK (server-side)
let adminApp: App | undefined;
let adminDb: Firestore | undefined;
let adminAuth: Auth | undefined;
let adminStorage: Storage | undefined;

function initializeAdminApp(): App {
  if (getApps().length === 0) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SDK_KEY || '{}');

    adminApp = initializeApp({
      credential: cert(serviceAccount),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  } else {
    adminApp = getApps()[0];
  }

  return adminApp;
}

export function getAdminDb(): Firestore {
  if (!adminDb) {
    initializeAdminApp();
    adminDb = getFirestore();
  }
  return adminDb;
}

export function getAdminAuth(): Auth {
  if (!adminAuth) {
    initializeAdminApp();
    adminAuth = getAuth();
  }
  return adminAuth;
}

export function getAdminStorage(): Storage {
  if (!adminStorage) {
    initializeAdminApp();
    adminStorage = getStorage();
  }
  return adminStorage;
}

// Client SDK (browser-side)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let clientApp: FirebaseApp | undefined;
let clientAuth: ClientAuth | undefined;
let clientDb: ClientFirestore | undefined;
let clientStorage: FirebaseStorage | undefined;

function initializeClientFirebaseApp(): FirebaseApp {
  if (getClientApps().length === 0) {
    clientApp = initializeClientApp(firebaseConfig);
  } else {
    clientApp = getClientApps()[0];
  }
  return clientApp;
}

export function getClientAuthInstance(): ClientAuth {
  if (!clientAuth) {
    const app = initializeClientFirebaseApp();
    clientAuth = getClientAuth(app);
  }
  return clientAuth;
}

export function getClientDbInstance(): ClientFirestore {
  if (!clientDb) {
    const app = initializeClientFirebaseApp();
    clientDb = getClientFirestore(app);
  }
  return clientDb;
}

export function getClientStorageInstance(): FirebaseStorage {
  if (!clientStorage) {
    const app = initializeClientFirebaseApp();
    clientStorage = getClientStorage(app);
  }
  return clientStorage;
}

// Export getters for convenience
export const db = () => getClientDbInstance();
export const auth = () => getClientAuthInstance();
export const storage = () => getClientStorageInstance();

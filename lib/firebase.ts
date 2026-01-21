// Server-side only - Firebase Admin SDK
// DO NOT import this file in client components ('use client')
// For client components, use '@/lib/firebase-client' instead
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getStorage, Storage } from 'firebase-admin/storage';

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

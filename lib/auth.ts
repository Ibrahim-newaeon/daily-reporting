import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from './firebase';
import { User } from './types';

export interface AuthenticatedRequest extends NextRequest {
  user?: User;
  userId?: string;
}

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  user?: User;
  error?: string;
}

export async function verifyAuthToken(token: string): Promise<AuthResult> {
  try {
    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(token);

    const adminDb = getAdminDb();
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();

    if (!userDoc.exists) {
      return {
        authenticated: true,
        userId: decodedToken.uid,
      };
    }

    const userData = userDoc.data() as User;

    return {
      authenticated: true,
      userId: decodedToken.uid,
      user: { ...userData, id: decodedToken.uid },
    };
  } catch (error) {
    console.error('Token verification error:', error);
    return {
      authenticated: false,
      error: 'Invalid or expired token',
    };
  }
}

export async function authenticateRequest(
  request: NextRequest
): Promise<AuthResult> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authenticated: false,
      error: 'Missing or invalid authorization header',
    };
  }

  const token = authHeader.substring(7);
  return verifyAuthToken(token);
}

export function withAuth(
  handler: (
    request: AuthenticatedRequest,
    context: { params: Record<string, string> }
  ) => Promise<NextResponse>
) {
  return async (
    request: NextRequest,
    context: { params: Record<string, string> }
  ): Promise<NextResponse> => {
    const authResult = await authenticateRequest(request);

    if (!authResult.authenticated) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: 401 }
      );
    }

    const authenticatedRequest = request as AuthenticatedRequest;
    authenticatedRequest.userId = authResult.userId;
    authenticatedRequest.user = authResult.user;

    return handler(authenticatedRequest, context);
  };
}

export async function createUser(
  userId: string,
  email: string,
  displayName: string,
  photoURL?: string
): Promise<User> {
  const adminDb = getAdminDb();

  const now = new Date();
  const user: Omit<User, 'id'> = {
    email,
    displayName,
    photoURL,
    createdAt: now,
    updatedAt: now,
    connectedAccounts: {},
    settings: {
      timezone: 'UTC',
      currency: 'USD',
      emailNotifications: true,
      whatsappNotifications: true,
    },
  };

  await adminDb.collection('users').doc(userId).set(user);

  return { ...user, id: userId };
}

export async function updateUser(
  userId: string,
  updates: Partial<User>
): Promise<void> {
  const adminDb = getAdminDb();

  await adminDb.collection('users').doc(userId).update({
    ...updates,
    updatedAt: new Date(),
  });
}

export async function getUser(userId: string): Promise<User | null> {
  const adminDb = getAdminDb();
  const doc = await adminDb.collection('users').doc(userId).get();

  if (!doc.exists) {
    return null;
  }

  return { ...doc.data(), id: doc.id } as User;
}

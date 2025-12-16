import { getServerSession } from 'next-auth';
import { authOptions } from './options';
import { errorResponse } from '@/lib/api/response';
import { UserRole } from '@prisma/client';
import { NextResponse } from 'next/server';

export interface AuthenticatedUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
}

/**
 * Get the current authenticated user or null
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return null;
  }
  return session.user;
}

/**
 * Require authentication - returns error response if not authenticated
 */
export async function requireAuth(): Promise<NextResponse | null> {
  const user = await getCurrentUser();
  if (!user) {
    return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  }
  return null;
}

/**
 * Require specific role(s) - returns error response if not authorized
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<NextResponse | null> {
  const user = await getCurrentUser();

  if (!user) {
    return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
  }

  if (!allowedRoles.includes(user.role)) {
    return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
  }

  return null;
}

/**
 * Require manager role
 */
export async function requireManager(): Promise<NextResponse | null> {
  return requireRole(['MANAGER']);
}

/**
 * Check if user has manager role
 */
export async function isManager(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === 'MANAGER';
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return user !== null;
}

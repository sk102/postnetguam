import { NextRequest } from 'next/server';
import { requireAuth, requireManager, getCurrentUser } from '@/lib/auth/authorize';
import {
  successResponse,
  badRequestResponse,
  internalErrorResponse,
} from '@/lib/api/response';
import { StoreSettingsService } from '@/lib/services/store-settings.service';
import { updateStoreSettingsSchema } from '@/lib/validations/store-settings';

/**
 * GET /api/settings/store
 * Get current store settings (any authenticated user)
 */
export async function GET(): Promise<Response> {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const settings = await StoreSettingsService.getSettingsWithUser();
    return successResponse(settings);
  } catch (error) {
    console.error('Store settings GET error:', error);
    return internalErrorResponse('Failed to fetch store settings');
  }
}

/**
 * PUT /api/settings/store
 * Update store settings (MANAGER only)
 */
export async function PUT(request: NextRequest): Promise<Response> {
  const authError = await requireManager();
  if (authError) return authError;

  try {
    const user = await getCurrentUser();
    if (!user) {
      return internalErrorResponse('User not found');
    }

    const body: unknown = await request.json();

    // Validate input
    const validationResult = updateStoreSettingsSchema.safeParse(body);
    if (!validationResult.success) {
      return badRequestResponse(
        'Invalid store settings data',
        validationResult.error.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }))
      );
    }

    const input = validationResult.data;
    const updated = await StoreSettingsService.updateSettings(input, user.id);

    return successResponse(StoreSettingsService.serializeSettings(updated));
  } catch (error) {
    console.error('Store settings PUT error:', error);
    return internalErrorResponse('Failed to update store settings');
  }
}

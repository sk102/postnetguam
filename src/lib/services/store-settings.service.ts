import { prisma } from '@/lib/db/prisma';
import { STORE } from '@/constants/app';
import type {
  StoreSettings,
  SerializedStoreSettings,
  UpdateStoreSettingsInput,
} from '@/types/store-settings';

// In-memory cache for store settings - loaded once, only invalidated on update
let cachedSettings: StoreSettings | null = null;

/**
 * Service for managing store settings
 */
export const StoreSettingsService = {
  /**
   * Get current store settings with permanent in-memory caching.
   * Settings are loaded once from DB and kept in memory until explicitly
   * invalidated via an update. Falls back to STORE constant if no DB record.
   */
  async getSettings(): Promise<StoreSettings> {
    // Return cached settings if available (no TTL - permanent until invalidated)
    if (cachedSettings) {
      return cachedSettings;
    }

    // Fetch from database (single row)
    const settings = await prisma.storeSettings.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    if (settings) {
      cachedSettings = settings;
      return settings;
    }

    // Fallback to constant if no DB record
    return {
      id: 'fallback',
      name: STORE.NAME,
      street1: STORE.STREET1,
      street2: STORE.STREET2,
      city: STORE.CITY,
      zip: STORE.ZIP,
      phone: STORE.PHONE,
      email: STORE.EMAIL,
      hours: STORE.HOURS,
      updatedById: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },

  /**
   * Get settings with updatedBy user info (for admin view)
   */
  async getSettingsWithUser(): Promise<SerializedStoreSettings> {
    const settings = await prisma.storeSettings.findFirst({
      orderBy: { createdAt: 'asc' },
      include: {
        updatedBy: {
          select: { id: true, username: true },
        },
      },
    });

    if (settings) {
      return this.serializeSettings(settings);
    }

    // Return fallback (serialized)
    return {
      id: 'fallback',
      name: STORE.NAME,
      street1: STORE.STREET1,
      street2: STORE.STREET2,
      city: STORE.CITY,
      zip: STORE.ZIP,
      phone: STORE.PHONE,
      email: STORE.EMAIL,
      hours: STORE.HOURS,
      updatedById: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      updatedBy: null,
    };
  },

  /**
   * Update store settings (creates if not exists)
   */
  async updateSettings(
    input: UpdateStoreSettingsInput,
    userId: string
  ): Promise<StoreSettings> {
    const existing = await prisma.storeSettings.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    let result: StoreSettings;

    if (existing) {
      result = await prisma.storeSettings.update({
        where: { id: existing.id },
        data: {
          ...input,
          updatedById: userId,
        },
      });
    } else {
      result = await prisma.storeSettings.create({
        data: {
          ...input,
          updatedById: userId,
        },
      });
    }

    // Invalidate cache
    this.invalidateCache();

    return result;
  },

  /**
   * Invalidate the settings cache.
   * Called automatically after updates to force a fresh load on next access.
   */
  invalidateCache(): void {
    cachedSettings = null;
  },

  /**
   * Serialize settings for API response
   */
  serializeSettings(
    settings: StoreSettings & {
      updatedBy?: { id: string; username: string } | null;
    }
  ): SerializedStoreSettings {
    return {
      id: settings.id,
      name: settings.name,
      street1: settings.street1,
      street2: settings.street2,
      city: settings.city,
      zip: settings.zip,
      phone: settings.phone,
      email: settings.email,
      hours: settings.hours,
      updatedById: settings.updatedById,
      createdAt: settings.createdAt.toISOString(),
      updatedAt: settings.updatedAt.toISOString(),
      updatedBy: settings.updatedBy ?? null,
    };
  },
};

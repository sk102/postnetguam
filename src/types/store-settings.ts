/**
 * StoreSettings types
 */

/**
 * StoreSettings model from database
 */
export interface StoreSettings {
  id: string;
  name: string;
  street1: string;
  street2: string | null;
  city: string;
  zip: string;
  phone: string;
  email: string;
  hours: string;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Serialized StoreSettings for API responses
 */
export interface SerializedStoreSettings {
  id: string;
  name: string;
  street1: string;
  street2: string | null;
  city: string;
  zip: string;
  phone: string;
  email: string;
  hours: string;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy?: {
    id: string;
    username: string;
  } | null;
}

/**
 * Input for updating store settings
 */
export interface UpdateStoreSettingsInput {
  name: string;
  street1: string;
  street2?: string | null;
  city: string;
  zip: string;
  phone: string;
  email: string;
  hours: string;
}

import type {
  NoticeTypeCode,
  NoticeDeliveryMethod,
  NoticeStatus,
} from '@prisma/client';

/**
 * NoticeType model from database
 */
export interface NoticeType {
  id: string;
  code: NoticeTypeCode;
  name: string;
  description: string | null;
  template: string;
  subject: string | null;
  isActive: boolean;
  isSystem: boolean;
  createdById: string | null;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Serialized NoticeType for API responses
 */
export interface SerializedNoticeType {
  id: string;
  code: NoticeTypeCode;
  name: string;
  description: string | null;
  template: string;
  subject: string | null;
  isActive: boolean;
  isSystem: boolean;
  createdById: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for creating a new notice type
 */
export interface CreateNoticeTypeInput {
  code: NoticeTypeCode;
  name: string;
  description?: string | undefined;
  template: string;
  subject?: string | undefined;
  isActive?: boolean | undefined;
  isSystem?: boolean | undefined;
}

/**
 * Input for updating a notice type
 */
export interface UpdateNoticeTypeInput {
  name?: string | undefined;
  description?: string | undefined;
  template?: string | undefined;
  subject?: string | undefined;
  isActive?: boolean | undefined;
}

/**
 * NoticeHistory model from database
 */
export interface NoticeHistory {
  id: string;
  noticeTypeId: string;
  accountId: string;
  recipientId: string | null;
  renderedSubject: string | null;
  renderedContent: string;
  deliveryMethod: NoticeDeliveryMethod;
  status: NoticeStatus;
  emailAddress: string | null;
  sentAt: Date | null;
  errorMessage: string | null;
  variableSnapshot: Record<string, unknown> | null;
  generatedById: string | null;
  generatedAt: Date;
}

/**
 * Serialized NoticeHistory for API responses
 */
export interface SerializedNoticeHistory {
  id: string;
  noticeTypeId: string;
  accountId: string;
  recipientId: string | null;
  renderedSubject: string | null;
  renderedContent: string;
  deliveryMethod: NoticeDeliveryMethod;
  status: NoticeStatus;
  emailAddress: string | null;
  sentAt: string | null;
  errorMessage: string | null;
  variableSnapshot: Record<string, unknown> | null;
  generatedById: string | null;
  generatedAt: string;
  // Joined data
  noticeType?: {
    code: NoticeTypeCode;
    name: string;
  };
  account?: {
    id: string;
    mailbox: {
      number: number;
    };
  };
  recipient?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    businessName: string | null;
  } | null;
  generatedBy?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    username: string;
  } | null;
}

/**
 * Template variable definition
 */
export interface TemplateVariable {
  name: string;
  description: string;
  category: TemplateVariableCategory;
  example: string;
}

export type TemplateVariableCategory =
  | 'account'
  | 'recipient'
  | 'contact'
  | 'verification'
  | 'computed'
  | 'store';

/**
 * Context for template variable resolution
 */
export interface TemplateVariableContext {
  // Account info
  mailboxNumber: number;
  accountStatus: string;
  renewalPeriod: string;
  currentRate: string;
  nextRenewalDate: string;
  startDate: string;
  lastRenewalDate: string | null;

  // Primary recipient info
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  displayName: string;
  birthdate: string | null;
  businessName: string | null;
  businessAlias: string | null;

  // Contact info
  primaryPhone: string | null;
  primaryEmail: string | null;
  allPhones: string;
  allEmails: string;

  // Verification info
  idType: string | null;
  idExpirationDate: string | null;
  daysUntilIdExpiry: number | null;
  recipientsMissingId: string;

  // Computed values
  age: number | null;
  daysUntilRenewal: number;
  daysUntil18thBirthday: number | null;
  isMinor: boolean;

  // Store info (from constants)
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeEmail: string;
  storeHours: string;

  // Current date
  currentDate: string;
}

/**
 * Request to generate notices for multiple accounts
 */
export interface NoticeGenerationRequest {
  noticeTypeId: string;
  accountIds: string[];
  deliveryMethod: NoticeDeliveryMethod;
  recipientIds?: string[] | undefined; // Optional - if not provided, uses primary recipient
}

/**
 * Result of a single notice generation
 */
export interface NoticeGenerationResult {
  accountId: string;
  mailboxNumber: number;
  success: boolean;
  noticeHistoryId?: string;
  error?: string;
}

/**
 * Response from bulk notice generation
 */
export interface NoticeGenerationResponse {
  totalRequested: number;
  successful: number;
  failed: number;
  results: NoticeGenerationResult[];
}

/**
 * Request for template preview
 */
export interface NoticePreviewRequest {
  template: string;
  subject?: string | undefined;
  accountId: string;
  recipientId?: string | undefined;
}

/**
 * Response for template preview
 */
export interface NoticePreviewResponse {
  renderedContent: string;
  renderedSubject: string | null;
  variables: Record<string, unknown>;
}

/**
 * Filter options for notice history
 */
export interface NoticeHistoryFilter {
  noticeTypeId?: string;
  accountId?: string;
  status?: NoticeStatus;
  deliveryMethod?: NoticeDeliveryMethod;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

/**
 * Account summary for notice generation selection
 */
export interface AccountForNotice {
  id: string;
  mailboxNumber: number;
  status: string;
  nextRenewalDate: string;
  primaryRecipient: {
    id: string;
    displayName: string;
    email: string | null;
  } | null;
}

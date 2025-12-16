# CLAUDE.md - Universal Web Application Standards

> This file provides Claude with context and rules for maintaining clean, well-documented,
> production-ready code with minimal technical debt.

---

## Project Overview

<!-- Customize this section per project -->
- **Project Name**: [PROJECT_NAME]
- **Description**: [Brief description of what this application does]
- **Primary Language**: [e.g., Korean, English, Bilingual]
- **Target Users**: [Who uses this application]

---

## Tech Stack

<!-- Update based on project - common defaults listed -->
- **Framework**: Next.js 14+ (App Router) / React / Vue / etc.
- **Language**: TypeScript 5.x (strict mode required)
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL / MySQL / MongoDB
- **ORM**: Prisma / Drizzle / TypeORM
- **Testing**: Jest + React Testing Library / Vitest
- **Package Manager**: pnpm preferred, npm acceptable

---

## Code Philosophy

### Core Principles

1. **Readability over cleverness** - Code is read 10x more than written
2. **Explicit over implicit** - No magic; make behavior obvious
3. **Composition over inheritance** - Build from small, focused pieces
4. **Fail fast, fail loud** - Surface errors immediately with context
5. **DRY, but not at the cost of clarity** - Duplication is better than wrong abstraction

### SOLID Principles (Enforced)

- **S**ingle Responsibility: One reason to change per module/function
- **O**pen/Closed: Extend behavior without modifying existing code
- **L**iskov Substitution: Subtypes must be substitutable for base types
- **I**nterface Segregation: Many specific interfaces over one general
- **D**ependency Inversion: Depend on abstractions, not concretions

---

## Code Style & Conventions

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Variables | camelCase, descriptive | `userProfile`, `isAuthenticated` |
| Functions | camelCase, verb prefix | `getUserById()`, `validateInput()` |
| Components | PascalCase | `UserProfileCard`, `NavigationMenu` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_RETRY_COUNT`, `API_BASE_URL` |
| Types/Interfaces | PascalCase | `UserProfile`, `ApiResponse<T>` |
| Enums | PascalCase, singular | `UserRole`, `PaymentStatus` |
| Files (components) | PascalCase | `UserProfile.tsx` |
| Files (utilities) | camelCase or kebab-case | `formatDate.ts`, `api-client.ts` |
| CSS classes | kebab-case | `user-profile-card` |
| Database tables | snake_case, plural | `user_profiles`, `order_items` |
| Environment vars | SCREAMING_SNAKE_CASE | `DATABASE_URL`, `NEXT_PUBLIC_API_URL` |

### Naming Patterns

```typescript
// Booleans: is/has/should/can prefix
const isLoading = true;
const hasPermission = checkPermission(user);
const shouldRefetch = staleTime > MAX_STALE_TIME;
const canEdit = user.role === 'admin';

// Event handlers: handle prefix
const handleSubmit = () => {};
const handleInputChange = (e: ChangeEvent) => {};

// Async functions: indicate async nature when not obvious
const fetchUserData = async () => {};
const loadConfiguration = async () => {};

// Factories: create prefix
const createUserService = (deps: Dependencies) => {};

// Predicates: is/has prefix, returns boolean
const isValidEmail = (email: string): boolean => {};
const hasRequiredFields = (data: FormData): boolean => {};

// Transformers: to/from/format/parse prefix
const toDTO = (entity: User): UserDTO => {};
const formatCurrency = (amount: number): string => {};
const parseApiResponse = <T>(response: Response): T => {};
```

### Code Limits & Thresholds

| Metric | Limit | Action if Exceeded |
|--------|-------|-------------------|
| Function length | 20 lines | Decompose into smaller functions |
| Function parameters | 3 params | Use options/config object |
| File length | 200 lines | Split into modules |
| Nesting depth | 3 levels | Extract to functions or early return |
| Cyclomatic complexity | 10 | Simplify logic, extract functions |
| Import statements | 15 per file | Consider barrel exports or splitting |

---

## TypeScript Standards

### Strict Configuration Required

```jsonc
// tsconfig.json - minimum requirements
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### Type Rules

```typescript
// ❌ NEVER: any type
const data: any = response;

// ✅ ALWAYS: proper typing or unknown with guards
const data: unknown = response;
if (isUserResponse(data)) {
  // data is now typed
}

// ❌ NEVER: non-null assertion without justification
const name = user!.name;

// ✅ ALWAYS: handle null cases explicitly
const name = user?.name ?? 'Anonymous';

// ❌ NEVER: type assertions without validation
const user = data as User;

// ✅ ALWAYS: validate at runtime for external data
const user = userSchema.parse(data); // zod
const user = validateUser(data); // custom validator

// ❌ NEVER: implicit any in callbacks
items.map(item => item.name);

// ✅ ALWAYS: explicit types for complex callbacks
items.map((item: OrderItem): string => item.name);
```

### Preferred Patterns

```typescript
// Use discriminated unions for state machines
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

// Use branded types for IDs
type UserId = string & { readonly brand: unique symbol };
type OrderId = string & { readonly brand: unique symbol };

// Use const assertions for literals
const ROLES = ['admin', 'user', 'guest'] as const;
type Role = typeof ROLES[number];

// Use satisfies for type checking without widening
const config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
} satisfies Config;
```

---

## Documentation Standards

### File-Level Documentation

Every file must start with a JSDoc block:

```typescript
/**
 * @fileoverview User authentication service handling login, logout, and session management.
 * 
 * This service integrates with the OAuth2 provider and manages JWT tokens.
 * All methods are stateless and can be used in both client and server contexts.
 * 
 * @module services/auth
 * @see {@link https://docs.example.com/auth} for API documentation
 */
```

### Function Documentation

All exported functions require complete JSDoc:

```typescript
/**
 * Authenticates a user with email and password credentials.
 * 
 * Validates credentials against the database, generates JWT tokens,
 * and creates a new session record. Rate-limited to 5 attempts per minute.
 * 
 * @param credentials - User login credentials
 * @param credentials.email - User's registered email address
 * @param credentials.password - Plain text password (will be hashed for comparison)
 * @param options - Optional configuration
 * @param options.rememberMe - Extend session duration to 30 days (default: false)
 * 
 * @returns Authentication result with tokens and user profile
 * 
 * @throws {ValidationError} If email format is invalid
 * @throws {AuthenticationError} If credentials don't match
 * @throws {RateLimitError} If too many failed attempts
 * 
 * @example
 * // Basic login
 * const result = await authenticateUser({
 *   email: 'user@example.com',
 *   password: 'securePassword123'
 * });
 * 
 * @example
 * // Login with extended session
 * const result = await authenticateUser(
 *   { email: 'user@example.com', password: 'pass123' },
 *   { rememberMe: true }
 * );
 * 
 * @since 1.0.0
 * @see {@link logoutUser} for ending sessions
 */
export async function authenticateUser(
  credentials: LoginCredentials,
  options?: AuthOptions
): Promise<AuthResult> {
  // implementation
}
```

### Component Documentation

```typescript
/**
 * Displays a user's profile card with avatar, name, and role badge.
 * 
 * Supports loading and error states with appropriate skeleton/fallback UI.
 * Fully accessible with proper ARIA labels and keyboard navigation.
 * 
 * @component
 * @example
 * // Basic usage
 * <UserProfileCard userId="123" />
 * 
 * @example
 * // With custom actions
 * <UserProfileCard 
 *   userId="123" 
 *   showActions 
 *   onEdit={handleEdit}
 * />
 */
interface UserProfileCardProps {
  /** Unique identifier for the user to display */
  userId: string;
  /** Show edit/delete action buttons (default: false) */
  showActions?: boolean;
  /** Callback when edit button is clicked */
  onEdit?: (userId: string) => void;
  /** Additional CSS classes for the container */
  className?: string;
}

export function UserProfileCard({ 
  userId, 
  showActions = false,
  onEdit,
  className 
}: UserProfileCardProps) {
  // implementation
}
```

### Inline Comments

```typescript
// ✅ Good: Explains WHY, not what
// Rate limit check comes before auth to prevent timing attacks
if (isRateLimited(ip)) {
  throw new RateLimitError();
}

// ✅ Good: Documents business logic
// Users get 3 free trials before requiring payment
// See: JIRA-1234 for product requirements
const FREE_TRIAL_LIMIT = 3;

// ❌ Bad: States the obvious
// Increment the counter
counter++;

// ❌ Bad: Outdated comment
// TODO: Add validation (added in v1.2)
validateInput(data);
```

---

## Error Handling

### Custom Error Classes

```typescript
/**
 * Base error class for all application errors.
 * Provides consistent error structure for logging and API responses.
 */
export class AppError extends Error {
  public readonly timestamp: Date;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.isOperational = true; // vs programming errors
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      ...(process.env.NODE_ENV === 'development' && { 
        stack: this.stack,
        context: this.context 
      }),
    };
  }
}

// Specific error types
export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, context);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, identifier: string) {
    super(
      `${resource} not found: ${identifier}`,
      'NOT_FOUND',
      404,
      { resource, identifier }
    );
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(action: string, resource: string) {
    super(
      `Not authorized to ${action} ${resource}`,
      'FORBIDDEN',
      403,
      { action, resource }
    );
  }
}
```

### Error Handling Patterns

```typescript
// ✅ Always use try-catch with async operations
async function fetchUser(id: string): Promise<User> {
  try {
    const response = await api.get(`/users/${id}`);
    return userSchema.parse(response.data);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ValidationError('Invalid user data from API', { 
        issues: error.issues 
      });
    }
    if (isAxiosError(error) && error.response?.status === 404) {
      throw new NotFoundError('User', id);
    }
    // Re-throw unknown errors with context
    throw new AppError(
      `Failed to fetch user: ${id}`,
      'USER_FETCH_FAILED',
      500,
      { originalError: String(error) }
    );
  }
}

// ✅ Use Result pattern for expected failures
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

async function validatePayment(
  paymentId: string
): Promise<Result<Payment, PaymentError>> {
  const payment = await getPayment(paymentId);
  
  if (payment.status === 'expired') {
    return { success: false, error: new PaymentExpiredError(paymentId) };
  }
  
  if (payment.amount <= 0) {
    return { success: false, error: new InvalidAmountError(payment.amount) };
  }
  
  return { success: true, data: payment };
}

// ✅ Centralized error boundary for React
function ErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundaryPrimitive
      fallback={({ error, resetError }) => (
        <ErrorFallback error={error} onRetry={resetError} />
      )}
      onError={(error, errorInfo) => {
        // Log to monitoring service
        logger.error('React error boundary caught error', {
          error,
          componentStack: errorInfo.componentStack,
        });
      }}
    >
      {children}
    </ErrorBoundaryPrimitive>
  );
}
```

---

## Project Structure

### Recommended Directory Layout

```
src/
├── app/                      # Next.js App Router pages
│   ├── (auth)/              # Route groups for layouts
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── api/                 # API routes
│   │   └── v1/
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Home page
│   └── globals.css
│
├── components/              # Shared UI components
│   ├── ui/                  # Base UI primitives (Button, Input, etc.)
│   │   ├── Button/
│   │   │   ├── index.ts     # Re-exports
│   │   │   ├── Button.tsx
│   │   │   ├── Button.test.tsx
│   │   │   └── Button.types.ts
│   │   └── ...
│   ├── forms/               # Form-specific components
│   ├── layouts/             # Layout components
│   └── [Feature]/           # Feature-specific components
│
├── features/                # Feature modules (domain logic)
│   └── [feature-name]/
│       ├── api/             # API calls for this feature
│       ├── components/      # Feature-specific components
│       ├── hooks/           # Feature-specific hooks
│       ├── stores/          # State management
│       ├── types/           # Feature types
│       ├── utils/           # Feature utilities
│       └── index.ts         # Public API
│
├── hooks/                   # Shared custom hooks
│   ├── useDebounce.ts
│   ├── useLocalStorage.ts
│   └── index.ts
│
├── lib/                     # Core utilities and configurations
│   ├── api/                 # API client setup
│   ├── auth/                # Auth utilities
│   ├── db/                  # Database client
│   ├── validations/         # Zod schemas
│   └── utils/               # General utilities
│
├── services/                # External service integrations
│   ├── email/
│   ├── storage/
│   └── payment/
│
├── stores/                  # Global state management
│   └── useAuthStore.ts
│
├── types/                   # Shared TypeScript types
│   ├── api.types.ts
│   ├── database.types.ts
│   └── index.ts
│
├── constants/               # Application constants
│   ├── routes.ts
│   ├── config.ts
│   └── index.ts
│
├── i18n/                    # Internationalization
│   ├── locales/
│   │   ├── en/
│   │   └── ko/
│   └── config.ts
│
└── tests/                   # Test utilities and setup
    ├── setup.ts
    ├── factories/           # Test data factories
    ├── mocks/               # Mock implementations
    └── utils/               # Test helpers
```

### File Organization Rules

1. **Co-locate related files**: Tests, types, and styles live with their components
2. **One component per file**: Never export multiple components from one file
3. **Index files for re-exports only**: No logic in index.ts files
4. **Feature isolation**: Features should be self-contained and independently deployable
5. **Shared code in lib/**: Only truly shared utilities go in lib/

### Import Order (Enforced)

```typescript
// 1. React and framework imports
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 2. Third-party libraries
import { z } from 'zod';
import { format } from 'date-fns';

// 3. Internal aliases (@/)
import { Button } from '@/components/ui';
import { useAuth } from '@/hooks';
import { cn } from '@/lib/utils';

// 4. Relative imports (parent directories first)
import { UserContext } from '../../contexts';
import { formatUserName } from '../utils';
import { UserAvatar } from './UserAvatar';

// 5. Types (always last, with type keyword)
import type { User, UserRole } from '@/types';
import type { ComponentProps } from './types';
```

---

## Testing Standards

### Testing Philosophy

- **Test behavior, not implementation**: Tests should survive refactoring
- **Arrange-Act-Assert pattern**: Clear structure for every test
- **One assertion per test** (when practical): Easier debugging
- **Descriptive test names**: Read like documentation

### Test File Structure

```typescript
/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserProfileCard } from './UserProfileCard';
import { createMockUser } from '@/tests/factories';

// Group by feature/behavior, not by method
describe('UserProfileCard', () => {
  // Setup shared across tests
  const defaultProps = {
    userId: '123',
  };

  describe('rendering', () => {
    it('should display user name and avatar when loaded', async () => {
      // Arrange
      const user = createMockUser({ name: 'John Doe' });
      mockGetUser.mockResolvedValue(user);

      // Act
      render(<UserProfileCard {...defaultProps} />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
      expect(screen.getByRole('img', { name: /john doe/i })).toBeInTheDocument();
    });

    it('should show loading skeleton while fetching data', () => {
      render(<UserProfileCard {...defaultProps} />);
      
      expect(screen.getByTestId('profile-skeleton')).toBeInTheDocument();
    });

    it('should display error message when fetch fails', async () => {
      mockGetUser.mockRejectedValue(new Error('Network error'));

      render(<UserProfileCard {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/failed to load/i);
      });
    });
  });

  describe('interactions', () => {
    it('should call onEdit with userId when edit button is clicked', async () => {
      const user = userEvent.setup();
      const handleEdit = jest.fn();
      
      render(
        <UserProfileCard {...defaultProps} showActions onEdit={handleEdit} />
      );

      await user.click(screen.getByRole('button', { name: /edit/i }));

      expect(handleEdit).toHaveBeenCalledWith('123');
      expect(handleEdit).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<UserProfileCard {...defaultProps} />);
      
      await waitFor(async () => {
        const results = await axe(container);
        expect(results).toHaveNoViolations();
      });
    });
  });
});
```

### Test Coverage Requirements

| Category | Minimum Coverage | Notes |
|----------|------------------|-------|
| Business logic | 90% | Critical paths must be tested |
| API routes | 85% | Include error scenarios |
| UI components | 70% | Focus on user interactions |
| Utilities | 95% | Pure functions are easy to test |
| Overall | 80% | Project-wide minimum |

### What to Test

```typescript
// ✅ DO test:
// - User interactions and resulting state changes
// - Conditional rendering
// - Error states and boundaries
// - Accessibility requirements
// - Integration between components
// - API request/response handling

// ❌ DON'T test:
// - Implementation details (internal state, private methods)
// - Third-party library internals
// - Styling (unless critical for functionality)
// - Constants and static configurations
```

---

## Security Standards

### Input Validation

```typescript
import { z } from 'zod';

// ✅ Define schemas at API boundaries
const createUserSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  name: z.string().min(1).max(100).trim(),
});

// ✅ Validate in API route
export async function POST(request: Request) {
  const body = await request.json();
  
  const result = createUserSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { error: 'Validation failed', details: result.error.flatten() },
      { status: 400 }
    );
  }
  
  // result.data is now typed and validated
  return createUser(result.data);
}
```

### Authentication & Authorization

```typescript
// ✅ Always check authorization at the start of protected routes
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const resource = await getResource(params.id);
  
  if (resource.ownerId !== session.userId && session.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  return Response.json(resource);
}
```

### Data Protection

```typescript
// ❌ NEVER log sensitive data
logger.info('User logged in', { password: user.password }); // NEVER

// ✅ Sanitize before logging
logger.info('User logged in', { 
  userId: user.id, 
  email: maskEmail(user.email) 
});

// ❌ NEVER expose internal IDs directly
return { internalDbId: user._id }; // NEVER

// ✅ Use public identifiers
return { id: user.publicId };

// ❌ NEVER return sensitive fields
return user; // May include passwordHash, etc.

// ✅ Use DTOs to control what's exposed
return toUserDTO(user); // Only public fields
```

### SQL/Query Injection Prevention

```typescript
// ❌ NEVER concatenate strings for queries
const query = `SELECT * FROM users WHERE id = '${userId}'`; // NEVER

// ✅ Use parameterized queries
const user = await prisma.user.findUnique({
  where: { id: userId },
});

// ✅ Use ORM methods
const users = await db
  .select()
  .from(usersTable)
  .where(eq(usersTable.id, userId));
```

---

## Performance Guidelines

### React Performance

```typescript
// ✅ Memoize expensive computations
const sortedItems = useMemo(
  () => items.sort((a, b) => b.date - a.date),
  [items]
);

// ✅ Memoize callbacks passed to children
const handleSelect = useCallback(
  (id: string) => {
    setSelected(id);
    onSelect?.(id);
  },
  [onSelect]
);

// ✅ Use React.memo for pure components
export const ExpensiveList = memo(function ExpensiveList({ 
  items 
}: ExpensiveListProps) {
  return items.map(item => <ExpensiveItem key={item.id} {...item} />);
});

// ✅ Lazy load heavy components
const HeavyChart = lazy(() => import('./HeavyChart'));

function Dashboard() {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <HeavyChart data={data} />
    </Suspense>
  );
}
```

### API & Data Fetching

```typescript
// ✅ Always paginate list endpoints
interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

// ✅ Use cursor-based pagination for large datasets
interface CursorPaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ✅ Implement request deduplication
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000,   // 30 minutes
      refetchOnWindowFocus: false,
    },
  },
});
```

### Database Performance

```typescript
// ✅ Select only needed fields
const users = await prisma.user.findMany({
  select: {
    id: true,
    name: true,
    email: true,
  },
});

// ✅ Use indexes - document required indexes
/**
 * Required indexes:
 * - users: (email) UNIQUE
 * - users: (createdAt) for sorting
 * - orders: (userId, status) for filtered queries
 */

// ✅ Avoid N+1 queries
const orders = await prisma.order.findMany({
  include: {
    user: true,      // Eager load
    items: true,
  },
});
```

---

## Technical Debt Prevention

### Before Writing Code

1. **Search for existing solutions**: Check if similar functionality exists
2. **Design the interface first**: Write types and function signatures before implementation
3. **Consider future requirements**: Will this scale? Is it extensible?
4. **Discuss complex changes**: Get feedback before investing time

### Code Smell Detection

| Smell | Symptom | Refactoring |
|-------|---------|-------------|
| Long function | > 20 lines | Extract smaller functions |
| Long parameter list | > 3 params | Use options object |
| Repeated code | Copy-paste | Extract shared function/component |
| Deep nesting | > 3 levels | Early returns, extract functions |
| Feature envy | Accessing another object's data extensively | Move method to that object |
| Primitive obsession | Using primitives for domain concepts | Create value objects |
| Boolean parameters | `doThing(true, false)` | Use options object or separate functions |

### TODO/FIXME Rules

```typescript
// ❌ Never leave orphan TODOs
// TODO: Fix this later

// ✅ Always include context and tracking
// TODO(JIRA-1234): Implement retry logic for transient failures
// Deadline: 2024-03-01
// Owner: @samuel

// ✅ Or create a GitHub issue and reference it
// TODO: See https://github.com/org/repo/issues/123
```

### Dependency Management

1. **Audit before adding**: Check bundle size, maintenance status, security
2. **Prefer stdlib**: Use built-in solutions when sufficient
3. **Wrap third-party code**: Create adapters for easier replacement
4. **Update regularly**: Schedule monthly dependency updates
5. **Lock versions**: Use exact versions in production

```typescript
// ✅ Wrap external dependencies
// lib/email/index.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  // Wrapper allows easy replacement of email provider
  await resend.emails.send({
    from: options.from,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
}
```

---

## Internationalization (i18n)

### File Structure

```
i18n/
├── locales/
│   ├── en/
│   │   ├── common.json
│   │   ├── auth.json
│   │   └── errors.json
│   └── ko/
│       ├── common.json
│       ├── auth.json
│       └── errors.json
└── config.ts
```

### Translation Key Conventions

```json
{
  "auth": {
    "login": {
      "title": "Sign In",
      "subtitle": "Welcome back",
      "form": {
        "email": {
          "label": "Email Address",
          "placeholder": "Enter your email",
          "error": {
            "required": "Email is required",
            "invalid": "Please enter a valid email"
          }
        }
      },
      "button": {
        "submit": "Sign In",
        "loading": "Signing in..."
      }
    }
  }
}
```

### Usage in Components

```typescript
import { useTranslations } from 'next-intl';

function LoginForm() {
  const t = useTranslations('auth.login');
  
  return (
    <form>
      <h1>{t('title')}</h1>
      <label>{t('form.email.label')}</label>
      <input placeholder={t('form.email.placeholder')} />
      <button>{t('button.submit')}</button>
    </form>
  );
}
```

---

## Git Workflow

### Commit Message Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting, no code change
- `refactor`: Code change that neither fixes bug nor adds feature
- `perf`: Performance improvement
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, etc.

**Examples:**
```
feat(auth): add password reset functionality

- Add forgot password page
- Implement email sending with reset token
- Add token validation endpoint

Closes #123

---

fix(api): handle null response from payment provider

The payment API occasionally returns null for declined cards.
Added null check and proper error handling.

Fixes #456

---

refactor(users): extract validation logic to shared utility

No functional changes. Moved duplicated validation code
from UserForm and ProfileForm to shared validateUser function.
```

### Branch Naming

```
<type>/<ticket-id>-<short-description>

Examples:
feat/JIRA-123-user-authentication
fix/GH-456-payment-null-response
refactor/PROJ-789-extract-validation
```

---

## Claude-Specific Instructions

### When Generating Code

1. **Ask clarifying questions first** for complex features
2. **Propose file structure** before implementing multi-file changes
3. **Include tests** when writing new functions
4. **Show migration scripts** when suggesting schema changes
5. **Add i18n keys** for all user-facing strings

### Code Review Checklist

Before completing any code generation, verify:

- [ ] All functions have proper JSDoc documentation
- [ ] Error cases are handled with appropriate error types
- [ ] TypeScript types are explicit (no implicit any)
- [ ] No magic numbers or strings (use constants)
- [ ] Tests cover happy path, edge cases, and error cases
- [ ] No console.log statements (use proper logging)
- [ ] Sensitive data is not logged or exposed
- [ ] Input is validated at boundaries
- [ ] Performance considerations addressed (pagination, memoization)
- [ ] Accessibility requirements met for UI components

### Response Format

When suggesting code changes:

1. **Explain the approach** briefly before showing code
2. **Show complete files** or clear diffs, not fragments
3. **Highlight breaking changes** or migration requirements
4. **Suggest tests** for new functionality
5. **Note any trade-offs** in the chosen approach

### Red Flags to Call Out

Always warn about:
- Security vulnerabilities
- Performance anti-patterns
- Missing error handling
- Implicit any types
- Potential race conditions
- Memory leaks
- Missing accessibility features
- Hardcoded values that should be configurable

---

## Appendix: Quick Reference

### Common Patterns

```typescript
// API Response wrapper
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    timestamp: string;
    requestId: string;
  };
}

// Paginated list
interface PaginatedList<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Form state
interface FormState<T> {
  values: T;
  errors: Partial<Record<keyof T, string>>;
  touched: Partial<Record<keyof T, boolean>>;
  isSubmitting: boolean;
  isValid: boolean;
}
```

### Environment Variables

```bash
# .env.example - document all required variables
# Application
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/db

# Authentication
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000

# External Services
RESEND_API_KEY=re_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

---

*Last updated: [DATE]*
*Version: 1.0.0*

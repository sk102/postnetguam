import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/prisma';
import bcrypt from 'bcrypt';
import { PASSWORD } from '@/constants/app';

export async function GET(): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        middleName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        phoneNumbers: {
          orderBy: { isPrimary: 'desc' },
        },
        emailAddresses: {
          orderBy: { isPrimary: 'desc' },
        },
      },
      orderBy: { username: 'asc' },
    });

    return NextResponse.json({ data: users });
  } catch (error) {
    console.error('Users list API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

interface PhoneNumberInput {
  e164Format: string;
  isMobile: boolean;
  isPrimary: boolean;
}

interface EmailAddressInput {
  email: string;
  isPrimary: boolean;
}

interface CreateUserBody {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  role: 'STAFF' | 'MANAGER';
  phoneNumbers?: PhoneNumberInput[];
  emailAddresses?: EmailAddressInput[];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json() as CreateUserBody;

    // Validate required fields
    if (!body.username?.trim()) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    if (!body.email?.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!body.password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    if (body.password.length < PASSWORD.MIN_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${PASSWORD.MIN_LENGTH} characters` },
        { status: 400 }
      );
    }

    const validRoles = ['STAFF', 'MANAGER'];
    if (!validRoles.includes(body.role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Check for existing username
    const existingUsername = await prisma.user.findUnique({
      where: { username: body.username.trim() },
    });
    if (existingUsername) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
    }

    // Check for existing email
    const existingEmail = await prisma.user.findUnique({
      where: { email: body.email.trim().toLowerCase() },
    });
    if (existingEmail) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(body.password, PASSWORD.BCRYPT_ROUNDS);

    // Build create data
    const createData: Parameters<typeof prisma.user.create>[0]['data'] = {
      username: body.username.trim(),
      email: body.email.trim().toLowerCase(),
      passwordHash,
      firstName: body.firstName?.trim() ?? null,
      middleName: body.middleName?.trim() ?? null,
      lastName: body.lastName?.trim() ?? null,
      role: body.role,
    };

    // Add phone numbers if provided
    if (body.phoneNumbers && body.phoneNumbers.length > 0) {
      createData.phoneNumbers = {
        create: body.phoneNumbers.map((phone) => ({
          e164Format: phone.e164Format,
          isMobile: phone.isMobile,
          isPrimary: phone.isPrimary,
        })),
      };
    }

    // Add email addresses if provided
    if (body.emailAddresses && body.emailAddresses.length > 0) {
      createData.emailAddresses = {
        create: body.emailAddresses.map((email) => ({
          email: email.email.toLowerCase(),
          isPrimary: email.isPrimary,
        })),
      };
    }

    // Create user with related data
    const user = await prisma.user.create({
      data: createData,
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        middleName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        phoneNumbers: true,
        emailAddresses: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('Create user API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

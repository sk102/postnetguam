import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { prisma } from '@/lib/db/prisma';
import bcrypt from 'bcrypt';
import { PASSWORD } from '@/constants/app';

interface RouteParams {
  params: { id: string };
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
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
        updatedAt: true,
        phoneNumbers: {
          orderBy: { isPrimary: 'desc' },
        },
        emailAddresses: {
          orderBy: { isPrimary: 'desc' },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Get user API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

interface PhoneNumberInput {
  id?: string;
  e164Format: string;
  isMobile: boolean;
  isPrimary: boolean;
}

interface EmailAddressInput {
  id?: string;
  email: string;
  isPrimary: boolean;
}

interface UpdateUserBody {
  username?: string;
  email?: string;
  password?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  role?: 'STAFF' | 'MANAGER';
  isActive?: boolean;
  phoneNumbers?: PhoneNumberInput[];
  emailAddresses?: EmailAddressInput[];
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json() as UpdateUserBody;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (body.username !== undefined) {
      const username = body.username.trim();
      if (!username) {
        return NextResponse.json({ error: 'Username cannot be empty' }, { status: 400 });
      }
      // Check uniqueness if changed
      if (username !== existingUser.username) {
        const existing = await prisma.user.findUnique({ where: { username } });
        if (existing) {
          return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
        }
      }
      updateData.username = username;
    }

    if (body.email !== undefined) {
      const email = body.email.trim().toLowerCase();
      if (!email) {
        return NextResponse.json({ error: 'Email cannot be empty' }, { status: 400 });
      }
      // Check uniqueness if changed
      if (email !== existingUser.email) {
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
          return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
        }
      }
      updateData.email = email;
    }

    if (body.password !== undefined && body.password !== '') {
      if (body.password.length < PASSWORD.MIN_LENGTH) {
        return NextResponse.json(
          { error: `Password must be at least ${PASSWORD.MIN_LENGTH} characters` },
          { status: 400 }
        );
      }
      updateData.passwordHash = await bcrypt.hash(body.password, PASSWORD.BCRYPT_ROUNDS);
    }

    if (body.role !== undefined) {
      const validRoles = ['STAFF', 'MANAGER'];
      if (!validRoles.includes(body.role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      updateData.role = body.role;
    }

    if (body.isActive !== undefined) {
      // Prevent self-deactivation
      if (params.id === session.user.id && body.isActive === false) {
        return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 });
      }
      updateData.isActive = body.isActive;
    }

    if (body.firstName !== undefined) {
      updateData.firstName = body.firstName.trim() || null;
    }

    if (body.middleName !== undefined) {
      updateData.middleName = body.middleName.trim() || null;
    }

    if (body.lastName !== undefined) {
      updateData.lastName = body.lastName.trim() || null;
    }

    // Use a transaction to update user and related records
    const user = await prisma.$transaction(async (tx) => {
      // Handle phone numbers: delete all and recreate
      if (body.phoneNumbers !== undefined) {
        await tx.userPhoneNumber.deleteMany({
          where: { userId: params.id },
        });

        if (body.phoneNumbers.length > 0) {
          await tx.userPhoneNumber.createMany({
            data: body.phoneNumbers.map((phone) => ({
              userId: params.id,
              e164Format: phone.e164Format,
              isMobile: phone.isMobile,
              isPrimary: phone.isPrimary,
            })),
          });
        }
      }

      // Handle email addresses: delete all and recreate
      if (body.emailAddresses !== undefined) {
        await tx.userEmailAddress.deleteMany({
          where: { userId: params.id },
        });

        if (body.emailAddresses.length > 0) {
          await tx.userEmailAddress.createMany({
            data: body.emailAddresses.map((email) => ({
              userId: params.id,
              email: email.email.toLowerCase(),
              isPrimary: email.isPrimary,
            })),
          });
        }
      }

      // Update user
      return tx.user.update({
        where: { id: params.id },
        data: updateData,
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
          updatedAt: true,
          phoneNumbers: {
            orderBy: { isPrimary: 'desc' },
          },
          emailAddresses: {
            orderBy: { isPrimary: 'desc' },
          },
        },
      });
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('Update user API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'MANAGER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Prevent self-deletion
    if (params.id === session.user.id) {
      return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 });
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Soft delete - set isActive to false
    await prisma.user.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete user API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

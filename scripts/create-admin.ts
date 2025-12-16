import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as readline from 'readline';

const prisma = new PrismaClient();
const PASSWORD_ROUNDS = 12;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

async function main(): Promise<void> {
  console.log('Create Admin User');
  console.log('=================\n');

  const username = await question('Username: ');
  const email = await question('Email: ');
  const password = await question('Password (min 12 characters): ');

  if (password.length < 12) {
    console.error('Error: Password must be at least 12 characters');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, PASSWORD_ROUNDS);

  try {
    const user = await prisma.user.create({
      data: {
        username,
        email: email.toLowerCase(),
        passwordHash,
        role: 'MANAGER',
        isActive: true,
      },
    });

    console.log('\nAdmin user created successfully!');
    console.log(`Username: ${user.username}`);
    console.log(`Email: ${user.email}`);
    console.log(`Role: ${user.role}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      console.error('\nError: Username or email already exists');
    } else {
      console.error('\nError creating user:', error);
    }
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('Unexpected error:', e);
    process.exit(1);
  })
  .finally(() => {
    rl.close();
    void prisma.$disconnect();
  });

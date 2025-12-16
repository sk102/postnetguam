/**
 * Update Overdue Accounts Script
 *
 * Sets accounts with past renewal dates to ON_HOLD status.
 *
 * Run with: npm run db:update-overdue
 */

import { PrismaClient, AccountStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const now = new Date();

  console.log(`Current date: ${now.toISOString()}`);
  console.log('Finding overdue accounts...');

  // Find all active accounts with past renewal dates
  const overdueAccounts = await prisma.account.findMany({
    where: {
      status: AccountStatus.ACTIVE,
      nextRenewalDate: {
        lt: now,
      },
    },
    include: {
      mailbox: true,
    },
  });

  console.log(`Found ${overdueAccounts.length} overdue accounts`);

  if (overdueAccounts.length === 0) {
    console.log('No overdue accounts to update');
    return;
  }

  // Update all overdue accounts to ON_HOLD
  const result = await prisma.account.updateMany({
    where: {
      status: AccountStatus.ACTIVE,
      nextRenewalDate: {
        lt: now,
      },
    },
    data: {
      status: AccountStatus.HOLD,
    },
  });

  console.log(`Updated ${result.count} accounts to ON_HOLD status`);

  // Show sample of updated accounts
  console.log('\nSample of updated accounts:');
  overdueAccounts.slice(0, 10).forEach((account) => {
    console.log(`  Mailbox ${account.mailbox.number}: renewal was ${account.nextRenewalDate.toLocaleDateString()}`);
  });

  if (overdueAccounts.length > 10) {
    console.log(`  ... and ${overdueAccounts.length - 10} more`);
  }
}

main()
  .then(() => {
    console.log('\nUpdate completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Update failed:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });

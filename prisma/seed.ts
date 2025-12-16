import { PrismaClient, NoticeTypeCode } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { STORE } from '../src/constants/app';
import { DEFAULT_NOTICE_TYPES } from '../src/constants/notice';

const prisma = new PrismaClient();

const PASSWORD_ROUNDS = 12;

async function main(): Promise<void> {
  console.log('Seeding database...');

  // Create admin user
  const adminPasswordHash = await bcrypt.hash('ChangeMe123!', PASSWORD_ROUNDS);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@postnetguam.com',
      passwordHash: adminPasswordHash,
      role: 'MANAGER',
      isActive: true,
    },
  });
  console.log('Created admin user:', admin.username);

  // Create staff user
  const staffPasswordHash = await bcrypt.hash('StaffPass123!', PASSWORD_ROUNDS);
  const staff = await prisma.user.upsert({
    where: { username: 'staff' },
    update: {},
    create: {
      username: 'staff',
      email: 'staff@postnetguam.com',
      passwordHash: staffPasswordHash,
      role: 'STAFF',
      isActive: true,
    },
  });
  console.log('Created staff user:', staff.username);

  // Create initial rate history
  // Base monthly rate: $17
  // Business account fee: $4/month
  // Additional recipients (4th-7th): $2/month each
  // Minor recipient fee: $0/month
  const baseMonthlyRate = 17.0;
  const rateHistory = await prisma.rateHistory.create({
    data: {
      startDate: new Date('2023-01-01'),
      endDate: null, // Current effective rate
      baseRate3mo: baseMonthlyRate * 3,    // $51
      baseRate6mo: baseMonthlyRate * 6,    // $102
      baseRate12mo: baseMonthlyRate * 12,  // $204
      rate4thAdult: 2.0,
      rate5thAdult: 2.0,
      rate6thAdult: 2.0,
      rate7thAdult: 2.0,
      keyDeposit: 5.0,
      businessAccountFee: 4.0,
      minorRecipientFee: 0.0,
      createdById: admin.id,
      notes: 'Initial pricing configuration',
    },
  });
  console.log('Created rate history starting:', rateHistory.startDate.toISOString());

  // Create initial store settings
  const existingStoreSettings = await prisma.storeSettings.findFirst();
  if (!existingStoreSettings) {
    const storeSettings = await prisma.storeSettings.create({
      data: {
        name: STORE.NAME,
        street1: STORE.STREET1,
        street2: STORE.STREET2,
        city: STORE.CITY,
        zip: STORE.ZIP,
        phone: STORE.PHONE,
        email: STORE.EMAIL,
        hours: STORE.HOURS,
        updatedById: admin.id,
      },
    });
    console.log('Created store settings:', storeSettings.name);
  } else {
    console.log('Store settings already exist, skipping');
  }

  // Create mailboxes 1-2000
  let createdCount = 0;

  for (let i = 1; i <= 2000; i++) {
    await prisma.mailbox.upsert({
      where: { number: i },
      update: {},
      create: {
        number: i,
        status: 'AVAILABLE',
      },
    });
    createdCount++;
    if (createdCount % 500 === 0) {
      console.log(`Created ${createdCount.toString()} mailboxes...`);
    }
  }
  console.log(`Created ${createdCount.toString()} mailboxes (1-2000)`);

  // Create default notice types
  const existingNoticeTypes = await prisma.noticeType.count();
  if (existingNoticeTypes === 0) {
    console.log('Creating default notice types...');
    for (const noticeType of DEFAULT_NOTICE_TYPES) {
      await prisma.noticeType.create({
        data: {
          code: noticeType.code as NoticeTypeCode,
          name: noticeType.name,
          description: noticeType.description,
          subject: noticeType.subject,
          template: noticeType.template,
          isSystem: noticeType.isSystem,
          isActive: true,
          createdById: admin.id,
        },
      });
    }
    console.log(`Created ${DEFAULT_NOTICE_TYPES.length.toString()} notice types`);
  } else {
    console.log('Notice types already exist, skipping');
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });

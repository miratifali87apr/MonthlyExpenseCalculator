import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function upsertProperty(data: {
  name: string;
  address: string;
  tenantLiableForWater: boolean;
}) {
  const existing = await prisma.property.findFirst({ where: { name: data.name } });
  if (existing) {
    console.log(`Property exists: ${data.name}`);
    return existing;
  }
  const created = await prisma.property.create({ data });
  console.log(`Created property: ${data.name}`);
  return created;
}

async function main() {
  console.log('Starting seed...');

  // 1. Properties
  const props: Record<string, { id: number }> = {};

  const propertyData = [
    { name: 'Austral',  address: 'Austral NSW',       tenantLiableForWater: false },
    { name: 'Kirwan',   address: 'Kirwan QLD 4817',   tenantLiableForWater: true  },
    { name: 'Finley',   address: 'Finley NSW 2713',   tenantLiableForWater: true  },
    { name: 'Chigwell', address: 'Chigwell TAS 7011', tenantLiableForWater: false },
    { name: 'Temora',   address: 'Temora NSW 2666',   tenantLiableForWater: false },
  ];

  for (const prop of propertyData) {
    props[prop.name] = await upsertProperty(prop);
  }

  // 2. Recurring templates (real data)
  const templateData = [
    { name: 'Kirwan Home Loan',               category: 'loan',      amount: 2559.28, frequency: 'monthly', dayOfMonth: 1,  propertyId: props['Kirwan'].id   },
    { name: 'Temora Land Loan',               category: 'loan',      amount: 995.00,  frequency: 'monthly', dayOfMonth: 1,  propertyId: props['Temora'].id   },
    { name: 'Chigwell AAMI Landlord Insurance', category: 'insurance', amount: 97.74, frequency: 'monthly', dayOfMonth: 3,  propertyId: props['Chigwell'].id },
    { name: 'Austral Home Loan',              category: 'loan',      amount: 3474.11, frequency: 'monthly', dayOfMonth: 14, propertyId: props['Austral'].id  },
    { name: 'Finley Home Loan',               category: 'loan',      amount: 2635.01, frequency: 'monthly', dayOfMonth: 14, propertyId: props['Finley'].id   },
    { name: 'Finley Insurance',               category: 'insurance', amount: 121.64,  frequency: 'monthly', dayOfMonth: 14, propertyId: props['Finley'].id   },
    { name: 'Kirwan Landlord Insurance',      category: 'insurance', amount: 394.62,  frequency: 'monthly', dayOfMonth: 19, propertyId: props['Kirwan'].id   },
    { name: 'Austral Home Insurance',         category: 'insurance', amount: 202.68,  frequency: 'monthly', dayOfMonth: 20, propertyId: props['Austral'].id  },
    { name: 'Chigwell Loan',                  category: 'loan',      amount: 2477.00, frequency: 'monthly', dayOfMonth: 23, propertyId: props['Chigwell'].id },
    { name: 'Temora Build Loan',              category: 'loan',      amount: 1802.00, frequency: 'monthly', dayOfMonth: 25, propertyId: props['Temora'].id   },
    { name: 'Geely Car Loan',                 category: 'car',       amount: 1290.60, frequency: 'monthly', dayOfMonth: 1,  propertyId: null, notes: 'Exact day not confirmed' },
    { name: 'Geely Car Insurance',            category: 'car',       amount: 195.65,  frequency: 'monthly', dayOfMonth: 1,  propertyId: null, notes: 'Exact day not confirmed' },
  ];

  for (const template of templateData) {
    const existing = await prisma.recurringTemplate.findFirst({ where: { name: template.name } });
    if (existing) {
      console.log(`Template exists: ${template.name}`);
    } else {
      await prisma.recurringTemplate.create({ data: template });
      console.log(`Created template: ${template.name}`);
    }
  }

  // 3. Income items (recurring)
  const incomeData = [
    { name: 'Salary',        type: 'salary', amount: 10000.00, isRecurring: true, frequency: 'monthly', propertyId: null,                  notes: 'Primary income' },
    { name: 'Finley Rent',   type: 'rental', amount: 530.00,   isRecurring: true, frequency: 'weekly',  propertyId: props['Finley'].id,   notes: 'Gross rent' },
    { name: 'Kirwan Rent',   type: 'rental', amount: 600.00,   isRecurring: true, frequency: 'weekly',  propertyId: props['Kirwan'].id,   notes: 'Gross rent' },
    { name: 'Chigwell Rent', type: 'rental', amount: 580.00,   isRecurring: true, frequency: 'weekly',  propertyId: props['Chigwell'].id, notes: 'Gross rent' },
  ];

  for (const income of incomeData) {
    const existing = await prisma.incomeItem.findFirst({ where: { name: income.name } });
    if (existing) {
      console.log(`Income exists: ${income.name}`);
    } else {
      await prisma.incomeItem.create({ data: income });
      console.log(`Created income: ${income.name}`);
    }
  }

  // 4. Pending reimbursements
  const reimbursements = [
    { name: 'Water Reimbursement – Finley', type: 'reimbursement', amount: 102.30, propertyId: props['Finley'].id, reimbursementStatus: 'pending', notes: 'Recover from tenant' },
    { name: 'Water Reimbursement – Kirwan', type: 'reimbursement', amount: 278.32, propertyId: props['Kirwan'].id, reimbursementStatus: 'pending', notes: 'Recover from tenant' },
  ];

  for (const r of reimbursements) {
    const existing = await prisma.incomeItem.findFirst({ where: { name: r.name } });
    if (existing) {
      console.log(`Reimbursement exists: ${r.name}`);
    } else {
      await prisma.incomeItem.create({ data: r });
      console.log(`Created reimbursement: ${r.name}`);
    }
  }

  // 5. Upcoming one-off scheduled expenses
  const scheduledExpenses = [
    { name: 'BAS Instalment',       category: 'tax',         amount: 2665.00, dueDate: new Date('2026-03-20'), propertyId: null,                 notes: null },
    { name: 'Credit Card Bill',     category: 'credit_card', amount: 1258.21, dueDate: new Date('2026-03-28'), propertyId: null,                 notes: null },
    { name: 'Water Consumption',    category: 'utility',     amount: 102.30,  dueDate: new Date('2026-03-31'), propertyId: props['Finley'].id,   notes: 'Tenant liable – reimbursement expected' },
    { name: 'School Fees – Term 2', category: 'school_fees', amount: 1900.00, dueDate: new Date('2026-04-02'), propertyId: null,                 notes: null },
    { name: 'BAS Instalment',       category: 'tax',         amount: 2665.00, dueDate: new Date('2026-04-03'), propertyId: null,                 notes: null },
    { name: 'BAS Instalment',       category: 'tax',         amount: 2665.00, dueDate: new Date('2026-04-17'), propertyId: null,                 notes: null },
    { name: 'BAS Instalment',       category: 'tax',         amount: 2665.00, dueDate: new Date('2026-05-01'), propertyId: null,                 notes: null },
    { name: 'School Fees – Term 3', category: 'school_fees', amount: 1900.00, dueDate: new Date('2026-07-02'), propertyId: null,                 notes: null },
    { name: 'School Fees – Term 4', category: 'school_fees', amount: 1900.00, dueDate: new Date('2026-09-02'), propertyId: null,                 notes: null },
  ];

  for (const exp of scheduledExpenses) {
    const existing = await prisma.expenseItem.findFirst({
      where: { name: exp.name, dueDate: exp.dueDate, isRecurring: false },
    });
    if (existing) {
      console.log(`Expense exists: ${exp.name} (${exp.dueDate.toISOString().slice(0, 10)})`);
    } else {
      await prisma.expenseItem.create({
        data: { ...exp, status: 'pending', isRecurring: false },
      });
      console.log(`Created expense: ${exp.name} (${exp.dueDate.toISOString().slice(0, 10)})`);
    }
  }

  console.log('\nSeed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

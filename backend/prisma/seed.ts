import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Seed Admin User
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'adminpassword123';
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.adminUser.upsert({
    where: { username: adminUsername },
    update: {},
    create: {
      username: adminUsername,
      passwordHash,
    },
  });
  console.log(`👤 Admin user ready: ${admin.username}`);

  // 2. Seed Default System Prompt (Personal AI Secretary)
  const defaultPrompt = await prisma.systemPrompt.upsert({
    where: { name: 'default' },
    update: {
      content:
        'คุณคือ "คุณเลขา" (AI Personal Secretary & Executive Assistant) ผู้ช่วยส่วนตัวระดับมืออาชีพที่ฉลาด สุภาพ ละเอียดรอบคอบ และกระตือรือร้น คุณคอยช่วยเหลือเจ้านายในการจัดการตารางงาน สรุปงาน เตือนความจำ และจัดการบัญชีรายรับ-รายจ่ายบิลใบเสร็จ ให้คำตอบที่กระชับ ชัดเจน มีโครงสร้าง เข้าใจง่าย ลงท้ายอย่างสุภาพด้วย "ค่ะ" หรือ "นะคะ" และพร้อมสนับสนุนเจ้านายในทุกภารกิจ',
    },
    create: {
      name: 'default',
      content:
        'คุณคือ "คุณเลขา" (AI Personal Secretary & Executive Assistant) ผู้ช่วยส่วนตัวระดับมืออาชีพที่ฉลาด สุภาพ ละเอียดรอบคอบ และกระตือรือร้น คุณคอยช่วยเหลือเจ้านายในการจัดการตารางงาน สรุปงาน เตือนความจำ และจัดการบัญชีรายรับ-รายจ่ายบิลใบเสร็จ ให้คำตอบที่กระชับ ชัดเจน มีโครงสร้าง เข้าใจง่าย ลงท้ายอย่างสุภาพด้วย "ค่ะ" หรือ "นะคะ" และพร้อมสนับสนุนเจ้านายในทุกภารกิจ',
      isActive: true,
    },
  });
  console.log(`💬 AI Secretary System Prompt ready: "${defaultPrompt.name}"`);

  // 3. Seed Default Providers & Models
  const providersData = [
    {
      providerName: 'gemini',
      displayName: 'Google Gemini',
      priorityOrder: 1,
      models: [
        { modelId: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash', isDefault: true },
        { modelId: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash', isDefault: false },
        { modelId: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', isDefault: false },
      ],
    },
    {
      providerName: 'openai',
      displayName: 'OpenAI',
      priorityOrder: 2,
      models: [
        { modelId: 'gpt-4o-mini', displayName: 'GPT-4o Mini', isDefault: true },
        { modelId: 'gpt-4o', displayName: 'GPT-4o', isDefault: false },
        { modelId: 'o3-mini', displayName: 'o3-mini', isDefault: false },
      ],
    },
    {
      providerName: 'claude',
      displayName: 'Anthropic Claude',
      priorityOrder: 3,
      models: [
        { modelId: 'claude-3-5-haiku-latest', displayName: 'Claude 3.5 Haiku', isDefault: true },
        { modelId: 'claude-3-5-sonnet-latest', displayName: 'Claude 3.5 Sonnet', isDefault: false },
      ],
    },
    {
      providerName: 'openai_compatible',
      displayName: 'OpenAI-Compatible (DeepSeek / Groq)',
      priorityOrder: 4,
      baseUrl: 'https://api.deepseek.com/v1',
      models: [
        { modelId: 'deepseek-chat', displayName: 'DeepSeek Chat (V3)', isDefault: true },
        { modelId: 'deepseek-reasoner', displayName: 'DeepSeek Reasoner (R1)', isDefault: false },
      ],
    },
  ];

  for (const p of providersData) {
    const existing = await prisma.providerKey.findFirst({
      where: { providerName: p.providerName },
    });

    if (!existing) {
      await prisma.providerKey.create({
        data: {
          providerName: p.providerName,
          displayName: p.displayName,
          apiKeyEncrypted: '', // Initial empty key, to be filled in via Web UI
          baseUrl: p.baseUrl || null,
          isActive: false, // Inactive until API key is set in UI
          priorityOrder: p.priorityOrder,
          models: {
            create: p.models,
          },
        },
      });
      console.log(`🔑 Seeded provider: ${p.displayName}`);
    }
  }

  // 4. Seed Bot Channel Placeholders
  const platforms = ['line', 'telegram'];
  for (const platform of platforms) {
    await prisma.botChannel.upsert({
      where: { platform },
      update: {},
      create: {
        platform,
        isActive: false, // Inactive until configured via Web UI
      },
    });
  }
  console.log('🤖 Bot channels initialized (LINE & Telegram).');

  console.log('✅ Database seeding complete.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

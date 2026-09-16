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
  const conciseSecretaryPrompt = `คุณคือ "คุณเลขา" (AI Personal Secretary & Executive Assistant) ผู้ช่วยส่วนตัวระดับมืออาชีพที่ฉลาด สุภาพ ละเอียดรอบคอบ และกระตือรือร้น คุณคอยช่วยเหลือเจ้านายในการจัดการตารางงาน สรุปงาน เตือนความจำ และจัดการบัญชีรายรับ-รายจ่ายบิลใบเสร็จ

[กฎเหล็กและสไตล์การตอบ: สรุปสั้น กระชับ ไม่ตอบยาว]
1. สรุปสั้น กระชับ ตรงประเด็นที่สุด: ไม่ตอบเป็นเรียงความยาวๆ หรือใส่น้ำเยิ่นเย้อ
2. เปิดด้วยคำตอบหลักทันที: ให้ใจความสำคัญหรือข้อสรุปใน 1-2 บรรทัดแรก
3. จัดข้อความแบบสแกนอ่านง่าย: หากมีรายละเอียด ให้ใช้ Bullet points สั้นๆ ไม่เกิน 2-4 ข้อ เพื่อให้อ่านบนมือถือได้รวดเร็ว
4. ตัดคำฟุ่มเฟือย: ไม่ต้องทวนคำถาม ไม่ต้องเกริ่นนำยืดยาว เหลือเฉพาะข้อมูลที่เจ้านายต้องการใช้ตัดสินใจ
5. สุภาพและเป็นมืออาชีพ: นอบน้อม กระตือรือร้น ลงท้ายอย่างสุภาพด้วย "ค่ะ" หรือ "นะคะ" เสมอ
6. เรื่องที่มีรายละเอียดเยอะ: ให้สรุปเป็น Key Takeaway สั้นๆ ก่อน แล้วทิ้งท้ายว่า "หากเจ้านายต้องการดูรายละเอียดส่วนไหนเพิ่มเติม แจ้งได้เลยนะคะ"
7. การจัดเก็บข้อมูลและสิทธิ์เข้าถึง: ระบบเชื่อมต่อกับ Google Drive และ Database เรียบร้อยแล้ว หากเจ้านายส่งรูปใบเสร็จ ระบบ Backend จะทำการสแกน OCR, บันทึกข้อมูลลง Database, และจัดเก็บรูปเข้าโฟลเดอร์แยกตามเดือน (picture-YYYY-MM) ให้อัตโนมัติ "ห้ามตอบว่าตนเองไม่มีสิทธิ์เข้าถึงหรือจัดการไฟล์ไม่ได้เด็ดขาด" คุณสามารถสรุปยอดรายจ่าย ตอบคำถามจากข้อมูลบิล และทำงานร่วมกับระบบอัตโนมัติได้อย่างสมบูรณ์แบบ`;

  const defaultPrompt = await prisma.systemPrompt.upsert({
    where: { name: 'default' },
    update: {
      content: conciseSecretaryPrompt,
    },
    create: {
      name: 'default',
      content: conciseSecretaryPrompt,
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

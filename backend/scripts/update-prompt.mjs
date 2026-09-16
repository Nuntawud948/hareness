import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

const newPromptContent = `คุณคือ "คุณเลขา" (AI Personal Secretary & Executive Assistant) ผู้ช่วยส่วนตัวระดับมืออาชีพที่ฉลาด สุภาพ ละเอียดรอบคอบ และกระตือรือร้น คุณคอยช่วยเหลือเจ้านายในการจัดการตารางงาน สรุปงาน เตือนความจำ และจัดการบัญชีรายรับ-รายจ่ายบิลใบเสร็จ

[กฎเหล็กและสไตล์การตอบ: สรุปสั้น กระชับ ไม่ตอบยาว]
1. สรุปสั้น กระชับ ตรงประเด็นที่สุด: ไม่ตอบเป็นเรียงความยาวๆ หรือใส่น้ำเยิ่นเย้อ
2. เปิดด้วยคำตอบหลักทันที: ให้ใจความสำคัญหรือข้อสรุปใน 1-2 บรรทัดแรก
3. จัดข้อความแบบสแกนอ่านง่าย: หากมีรายละเอียด ให้ใช้ Bullet points สั้นๆ ไม่เกิน 2-4 ข้อ เพื่อให้อ่านบนมือถือได้รวดเร็ว
4. ตัดคำฟุ่มเฟือย: ไม่ต้องทวนคำถาม ไม่ต้องเกริ่นนำยืดยาว เหลือเฉพาะข้อมูลที่เจ้านายต้องการใช้ตัดสินใจ
5. สุภาพและเป็นมืออาชีพ: นอบน้อม กระตือรือร้น ลงท้ายอย่างสุภาพด้วย "ค่ะ" หรือ "นะคะ" เสมอ
6. เรื่องที่มีรายละเอียดเยอะ: ให้สรุปเป็น Key Takeaway สั้นๆ ก่อน แล้วทิ้งท้ายว่า "หากเจ้านายต้องการดูรายละเอียดส่วนไหนเพิ่มเติม แจ้งได้เลยนะคะ"`;

async function main() {
  console.log('🔄 Updating System Prompt in Neon DB...');

  // Update existing active prompts or default prompt
  const existing = await prisma.systemPrompt.findFirst({
    where: { isActive: true },
  });

  if (existing) {
    const updated = await prisma.systemPrompt.update({
      where: { id: existing.id },
      data: {
        content: newPromptContent,
      },
    });
    console.log(`✅ Updated existing active prompt "${updated.name}" (${updated.id})`);
  } else {
    const upserted = await prisma.systemPrompt.upsert({
      where: { name: 'default' },
      update: {
        content: newPromptContent,
        isActive: true,
      },
      create: {
        name: 'default',
        content: newPromptContent,
        isActive: true,
      },
    });
    console.log(`✅ Upserted default prompt "${upserted.name}" (${upserted.id})`);
  }

  // Also verify all prompts
  const allPrompts = await prisma.systemPrompt.findMany();
  console.log('📋 All System Prompts in DB:', allPrompts.map(p => ({ id: p.id, name: p.name, isActive: p.isActive })));

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('❌ Error updating system prompt:', err);
  process.exit(1);
});

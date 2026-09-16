import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateRichMenuImage() {
  const width = 2500;
  const height = 1686;

  // Modern SVG design with Clean Modern Light FinTech palette
  const svg = `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#F8FAFC" />
        <stop offset="100%" stop-color="#EDF2F7" />
      </linearGradient>

      <!-- Card 1 Teal -->
      <linearGradient id="tealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0D9488" />
        <stop offset="100%" stop-color="#0F766E" />
      </linearGradient>

      <!-- Card 2 Blue -->
      <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#2563EB" />
        <stop offset="100%" stop-color="#1D4ED8" />
      </linearGradient>

      <!-- Card 3 Amber -->
      <linearGradient id="amberGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#F59E0B" />
        <stop offset="100%" stop-color="#D97706" />
      </linearGradient>

      <!-- Card 4 Purple -->
      <linearGradient id="purpleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#6366F1" />
        <stop offset="100%" stop-color="#4F46E5" />
      </linearGradient>

      <!-- Card 5 Rose -->
      <linearGradient id="roseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#F43F5E" />
        <stop offset="100%" stop-color="#E11D48" />
      </linearGradient>

      <!-- Card 6 Cyan -->
      <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#06B6D4" />
        <stop offset="100%" stop-color="#0891B2" />
      </linearGradient>

      <!-- Card Shadow -->
      <filter id="shadow" x="-5%" y="-5%" width="110%" height="115%" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="8" stdDeviation="14" flood-color="#0F172A" flood-opacity="0.07" />
      </filter>
    </defs>

    <style>
      .title { font-family: 'Segoe UI', 'Leelawadee UI', 'Tahoma', 'Prompt', sans-serif; font-size: 56px; font-weight: 800; fill: #0F172A; }
      .desc { font-family: 'Segoe UI', 'Leelawadee UI', 'Tahoma', 'Prompt', sans-serif; font-size: 32px; font-weight: 500; fill: #64748B; }
      .badge-text { font-family: 'Segoe UI', 'Leelawadee UI', 'Tahoma', 'Prompt', sans-serif; font-size: 26px; font-weight: 700; }
      .btn-text { font-family: 'Segoe UI', 'Leelawadee UI', 'Tahoma', 'Prompt', sans-serif; font-size: 32px; font-weight: 700; }
    </style>

    <!-- Canvas Background -->
    <rect width="${width}" height="${height}" fill="url(#bgGrad)" />

    <!-- ═══════════════ ROW 1 ═══════════════ -->

    <!-- CARD 1: สรุปค่าใช้จ่าย -->
    <g transform="translate(24, 24)">
      <rect width="785" height="795" rx="36" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="3" filter="url(#shadow)" />
      <!-- Badge -->
      <rect x="510" y="44" width="230" height="52" rx="26" fill="#CCFBF1" />
      <text x="625" y="79" class="badge-text" fill="#0F766E" text-anchor="middle">Flex Dashboard</text>
      <!-- Icon Circle -->
      <circle cx="160" cy="220" r="80" fill="url(#tealGrad)" />
      <!-- Bar Chart Icon -->
      <path d="M120 260 L120 230 M145 260 L145 200 M170 260 L170 175 M195 260 L195 215" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" />
      <!-- Texts -->
      <text x="64" y="430" class="title">📊 สรุปค่าใช้จ่าย</text>
      <text x="64" y="500" class="desc">ดูยอดรวมประจำเดือนแยกหมวดหมู่</text>
      <text x="64" y="550" class="desc">พร้อมรายการบิลล่าสุดและลิงก์ Drive</text>
      <rect x="64" y="630" width="657" height="96" rx="24" fill="#F0FDFA" stroke="#99F6E4" stroke-width="2" />
      <text x="392" y="692" class="btn-text" fill="#0D9488" text-anchor="middle">กดเพื่อดูมินิแดชบอร์ด ➔</text>
    </g>

    <!-- CARD 2: ส่ง/สแกนบิล -->
    <g transform="translate(857, 24)">
      <rect width="786" height="795" rx="36" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="3" filter="url(#shadow)" />
      <!-- Badge -->
      <rect x="520" y="44" width="220" height="52" rx="26" fill="#DBEAFE" />
      <text x="630" y="79" class="badge-text" fill="#1D4ED8" text-anchor="middle">AI Vision OCR</text>
      <!-- Icon Circle -->
      <circle cx="160" cy="220" r="80" fill="url(#blueGrad)" />
      <!-- Receipt / Camera Icon -->
      <path d="M125 180 L195 180 L195 265 L180 255 L160 265 L140 255 L125 265 Z" fill="none" stroke="#FFFFFF" stroke-width="9" stroke-linejoin="round" />
      <line x1="140" y1="205" x2="180" y2="205" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" />
      <line x1="140" y1="225" x2="170" y2="225" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" />
      <!-- Texts -->
      <text x="64" y="430" class="title">🧾 ถ่าย/ส่งสแกนบิล</text>
      <text x="64" y="500" class="desc">ส่งรูปใบเสร็จเข้ามาในแชทนี้</text>
      <text x="64" y="550" class="desc">AI อ่านยอดเงินและลงบัญชีทันที</text>
      <rect x="64" y="630" width="658" height="96" rx="24" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="2" />
      <text x="393" y="692" class="btn-text" fill="#2563EB" text-anchor="middle">คำแนะนำส่งบิลใบเสร็จ ➔</text>
    </g>

    <!-- CARD 3: Google Drive -->
    <g transform="translate(1691, 24)">
      <rect width="785" height="795" rx="36" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="3" filter="url(#shadow)" />
      <!-- Badge -->
      <rect x="520" y="44" width="220" height="52" rx="26" fill="#FEF3C7" />
      <text x="630" y="79" class="badge-text" fill="#B45309" text-anchor="middle">Cloud Storage</text>
      <!-- Icon Circle -->
      <circle cx="160" cy="220" r="80" fill="url(#amberGrad)" />
      <!-- Folder / Drive Icon -->
      <path d="M120 195 L145 195 L160 210 L200 210 A 8 8 0 0 1 208 218 L208 250 A 8 8 0 0 1 200 258 L120 258 A 8 8 0 0 1 112 250 L112 203 A 8 8 0 0 1 120 195 Z" fill="none" stroke="#FFFFFF" stroke-width="9" stroke-linejoin="round" />
      <!-- Texts -->
      <text x="64" y="430" class="title">📂 Google Drive</text>
      <text x="64" y="500" class="desc">เปิดดูโฟลเดอร์ Receipt_Bills</text>
      <text x="64" y="550" class="desc">รวมไฟล์รูปถ่ายใบเสร็จทั้งหมดในคลาวด์</text>
      <rect x="64" y="630" width="657" height="96" rx="24" fill="#FFFBEB" stroke="#FDE68A" stroke-width="2" />
      <text x="392" y="692" class="btn-text" fill="#D97706" text-anchor="middle">แตะเพื่อเปิดโฟลเดอร์สด ➔</text>
    </g>

    <!-- ═══════════════ ROW 2 ═══════════════ -->

    <!-- CARD 4: สลับโมเดล AI -->
    <g transform="translate(24, 867)">
      <rect width="785" height="795" rx="36" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="3" filter="url(#shadow)" />
      <!-- Badge -->
      <rect x="500" y="44" width="240" height="52" rx="26" fill="#EEF2FF" />
      <text x="620" y="79" class="badge-text" fill="#4338CA" text-anchor="middle">Global Cascade</text>
      <!-- Icon Circle -->
      <circle cx="160" cy="220" r="80" fill="url(#purpleGrad)" />
      <!-- Bot / Brain Icon -->
      <rect x="125" y="185" width="70" height="60" rx="14" fill="none" stroke="#FFFFFF" stroke-width="9" />
      <circle cx="145" cy="210" r="6" fill="#FFFFFF" />
      <circle cx="175" cy="210" r="6" fill="#FFFFFF" />
      <line x1="145" y1="230" x2="175" y2="230" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" />
      <line x1="160" y1="185" x2="160" y2="170" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round" />
      <!-- Texts -->
      <text x="64" y="430" class="title">🤖 สลับโมเดล AI</text>
      <text x="64" y="500" class="desc">ตรวจสอบโมเดลที่ใช้งานอยู่</text>
      <text x="64" y="550" class="desc">สลับใช้ Gemini, Z.AI, DeepSeek</text>
      <rect x="64" y="630" width="657" height="96" rx="24" fill="#EEF2FF" stroke="#C7D2FE" stroke-width="2" />
      <text x="392" y="692" class="btn-text" fill="#4F46E5" text-anchor="middle">พิมพ์คำสั่ง /models ➔</text>
    </g>

    <!-- CARD 5: ล้างประวัติคุยใหม่ -->
    <g transform="translate(857, 867)">
      <rect width="786" height="795" rx="36" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="3" filter="url(#shadow)" />
      <!-- Badge -->
      <rect x="500" y="44" width="240" height="52" rx="26" fill="#FFE4E6" />
      <text x="620" y="79" class="badge-text" fill="#BE123C" text-anchor="middle">Reset Memory</text>
      <!-- Icon Circle -->
      <circle cx="160" cy="220" r="80" fill="url(#roseGrad)" />
      <!-- Broom / Sparkle Icon -->
      <path d="M130 250 L180 175 M170 165 L190 185" stroke="#FFFFFF" stroke-width="10" stroke-linecap="round" />
      <path d="M120 260 L145 235 L160 250 Z" fill="#FFFFFF" />
      <circle cx="130" cy="180" r="4" fill="#FFFFFF" />
      <circle cx="190" cy="220" r="5" fill="#FFFFFF" />
      <!-- Texts -->
      <text x="64" y="430" class="title">🧹 ล้างประวัติคุยใหม่</text>
      <text x="64" y="500" class="desc">ล้างบริบทบทสนทนาเก่า</text>
      <text x="64" y="550" class="desc">เริ่มคุยหัวข้อใหม่ได้อย่างสะอาดหมดจด</text>
      <rect x="64" y="630" width="658" height="96" rx="24" fill="#FFF1F2" stroke="#FECDD3" stroke-width="2" />
      <text x="393" y="692" class="btn-text" fill="#E11D48" text-anchor="middle">ล้างความจำบอท (/clear) ➔</text>
    </g>

    <!-- CARD 6: คู่มือ / วิธีใช้ -->
    <g transform="translate(1691, 867)">
      <rect width="785" height="795" rx="36" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="3" filter="url(#shadow)" />
      <!-- Badge -->
      <rect x="520" y="44" width="220" height="52" rx="26" fill="#CFFAFE" />
      <text x="630" y="79" class="badge-text" fill="#0E7490" text-anchor="middle">Help &amp; Guide</text>
      <!-- Icon Circle -->
      <circle cx="160" cy="220" r="80" fill="url(#cyanGrad)" />
      <!-- Question / Lightbulb Icon -->
      <circle cx="160" cy="210" r="35" fill="none" stroke="#FFFFFF" stroke-width="9" />
      <path d="M150 200 C150 185, 170 185, 170 200 C170 212, 160 215, 160 223" fill="none" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" />
      <circle cx="160" cy="235" r="5" fill="#FFFFFF" />
      <!-- Texts -->
      <text x="64" y="430" class="title">💡 คู่มือ / วิธีใช้</text>
      <text x="64" y="500" class="desc">คำสั่งทั้งหมดที่บอททำได้</text>
      <text x="64" y="550" class="desc">และวิธีใช้งานเลขา AI ให้เกิดประสิทธิภาพสูงสุด</text>
      <rect x="64" y="630" width="657" height="96" rx="24" fill="#ECFEFF" stroke="#A5F3FC" stroke-width="2" />
      <text x="392" y="692" class="btn-text" fill="#0891B2" text-anchor="middle">ดูคำสั่งช่วยเหลือ (/help) ➔</text>
    </g>
  </svg>
  `;

  const assetsDir = path.join(__dirname, '../assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  const frontendPublicDir = path.join(__dirname, '../../frontend/public');
  if (!fs.existsSync(frontendPublicDir)) {
    fs.mkdirSync(frontendPublicDir, { recursive: true });
  }

  const outputPngPath = path.join(assetsDir, 'richmenu.png');
  const outputJpgPath = path.join(assetsDir, 'richmenu.jpg');
  const frontendPngPath = path.join(frontendPublicDir, 'richmenu.png');
  const frontendJpgPath = path.join(frontendPublicDir, 'richmenu.jpg');

  console.log(`🎨 Generating 2500x1686 Clean Modern Light FinTech Rich Menu...`);

  // Render to PNG
  await sharp(Buffer.from(svg))
    .png({ quality: 100 })
    .toFile(outputPngPath);
  console.log(`✅ Saved PNG: ${outputPngPath}`);

  // Render to JPEG (< 1MB for LINE Rich Menu API)
  await sharp(Buffer.from(svg))
    .jpeg({ quality: 90 })
    .toFile(outputJpgPath);
  console.log(`✅ Saved JPG: ${outputJpgPath}`);

  // Copy to frontend public so it can be previewed/downloaded directly from web
  fs.copyFileSync(outputPngPath, frontendPngPath);
  fs.copyFileSync(outputJpgPath, frontendJpgPath);
  console.log(`✅ Copied to frontend public folder: ${frontendPngPath}`);
}

generateRichMenuImage().catch(console.error);

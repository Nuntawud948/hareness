import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

class SimpleDecryptor {
  constructor(secretKey) {
    if (!secretKey) {
      this.key = crypto.createHash('sha256').update('fallback-secret').digest();
    } else if (secretKey.length === 64 && /^[0-9a-fA-F]+$/.test(secretKey)) {
      this.key = Buffer.from(secretKey, 'hex');
    } else {
      this.key = crypto.createHash('sha256').update(secretKey).digest();
    }
  }

  decrypt(ciphertext) {
    if (!ciphertext) return '';
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      // If plaintext (not yet encrypted)
      return ciphertext;
    }
    const [ivHex, tagHex, dataHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encryptedData = Buffer.from(dataHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }
}

async function deployRichMenu() {
  console.log('🚀 Starting LINE Rich Menu Deployment...');

  const prisma = new PrismaClient();
  let accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  try {
    const channel = await prisma.botChannel.findUnique({
      where: { platform: 'line' },
    });

    if (channel && channel.lineAccessToken) {
      const secret = process.env.ENCRYPTION_SECRET || process.env.JWT_SECRET || 'dev_secret_key_123456789012345678901234';
      const decryptor = new SimpleDecryptor(secret);
      accessToken = decryptor.decrypt(channel.lineAccessToken);
      console.log('🔑 Loaded LINE Channel Access Token from database.');
    }
  } catch (err) {
    console.warn('⚠️ Could not load token from DB, falling back to env:', err.message);
  }

  if (!accessToken) {
    throw new Error('❌ Missing LINE Channel Access Token. Please configure it in DB or backend/.env');
  }

  // Fetch Drive folder URL from StorageConfig
  let driveFolderUrl = 'https://drive.google.com/drive/folders/1W_cu4ozE6wWUxdH3IOJ4SE4HXo5S2QHN';
  try {
    const storageConfig = await prisma.storageConfig.findUnique({
      where: { id: 'google_drive' },
    });
    if (storageConfig?.folderId) {
      driveFolderUrl = `https://drive.google.com/drive/folders/${storageConfig.folderId}`;
    }
  } catch (e) {
    console.warn('Using default drive folder URL');
  }

  // Check image file
  const imagePath = path.join(__dirname, '../assets/richmenu.jpg');
  if (!fs.existsSync(imagePath)) {
    throw new Error(`❌ Rich menu image not found at ${imagePath}. Run scripts/generate-richmenu-image.mjs first.`);
  }
  const imageBuffer = fs.readFileSync(imagePath);

  console.log(`📦 Rich menu image size: ${(imageBuffer.length / 1024).toFixed(1)} KB`);

  // 1. List existing rich menus
  const listRes = await fetch('https://api.line.me/v2/bot/richmenu/list', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (listRes.ok) {
    const existing = await listRes.json();
    console.log(`📋 Found ${existing.richmenus?.length || 0} existing rich menu(s).`);
  }

  // 2. Define Rich Menu Object (2500 x 1686, 6 grid)
  const richMenuBody = {
    size: {
      width: 2500,
      height: 1686,
    },
    selected: true,
    name: 'Executive_Fintech_Secretary_Menu',
    chatBarText: 'เมนูหลัก (Menu)',
    areas: [
      // ─── Row 1 ───
      // Area 1: สรุปค่าใช้จ่ายเดือนนี้
      {
        bounds: { x: 0, y: 0, width: 833, height: 843 },
        action: {
          type: 'message',
          label: 'สรุปค่าใช้จ่าย',
          text: 'สรุปค่าใช้จ่ายเดือนนี้',
        },
      },
      // Area 2: ถ่าย/ส่งสแกนบิล
      {
        bounds: { x: 833, y: 0, width: 834, height: 843 },
        action: {
          type: 'message',
          label: 'วิธีส่งบิลใบเสร็จ',
          text: 'วิธีส่งบิลใบเสร็จ',
        },
      },
      // Area 3: Google Drive (Open Folder)
      {
        bounds: { x: 1667, y: 0, width: 833, height: 843 },
        action: {
          type: 'uri',
          label: 'Google Drive',
          uri: driveFolderUrl,
        },
      },
      // ─── Row 2 ───
      // Area 4: สลับโมเดล AI
      {
        bounds: { x: 0, y: 843, width: 833, height: 843 },
        action: {
          type: 'message',
          label: 'สลับโมเดล AI',
          text: '/models',
        },
      },
      // Area 5: ล้างประวัติคุยใหม่
      {
        bounds: { x: 833, y: 843, width: 834, height: 843 },
        action: {
          type: 'message',
          label: 'ล้างประวัติคุยใหม่',
          text: '/clear',
        },
      },
      // Area 6: คู่มือ / วิธีใช้
      {
        bounds: { x: 1667, y: 843, width: 833, height: 843 },
        action: {
          type: 'message',
          label: 'คู่มือ / วิธีใช้',
          text: '/help',
        },
      },
    ],
  };

  // 3. Create Rich Menu
  console.log('🛠️ Creating Rich Menu on LINE Platform...');
  const createRes = await fetch('https://api.line.me/v2/bot/richmenu', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(richMenuBody),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create rich menu (${createRes.status}): ${errText}`);
  }

  const { richMenuId } = await createRes.json();
  console.log(`✅ Rich Menu created with ID: ${richMenuId}`);

  // 4. Upload Rich Menu Image
  console.log('📤 Uploading 2500x1686 JPEG image to LINE CDN...');
  const uploadRes = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: 'POST',
    headers: {
      'Content-Type': 'image/jpeg',
      Authorization: `Bearer ${accessToken}`,
    },
    body: imageBuffer,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Failed to upload rich menu image (${uploadRes.status}): ${errText}`);
  }
  console.log('✅ Rich Menu image uploaded successfully!');

  // 5. Set as Default Rich Menu for all users
  console.log('🌐 Setting as default Rich Menu for all users...');
  const defaultRes = await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!defaultRes.ok) {
    const errText = await defaultRes.text();
    throw new Error(`Failed to set default rich menu (${defaultRes.status}): ${errText}`);
  }

  console.log('🎉 SUCCESS! Rich Menu is now live and active for all LINE users!');
  console.log(`📍 Rich Menu ID: ${richMenuId}`);
  console.log(`📂 Google Drive Link: ${driveFolderUrl}`);

  await prisma.$disconnect();
}

deployRichMenu().catch((err) => {
  console.error('❌ Deployment error:', err.message);
  process.exit(1);
});

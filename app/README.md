# The Broken Seal Companion (แอปคู่หู) — รุ่นแรก

แอปแชตแยกสำหรับ The Broken Seal ติดตั้งคู่กับตัวเกม ดูแชตโลกสดและพิมพ์ตอบได้ด้วยบัญชีเดียวกับในเกม
(ผู้ใช้ตัดสิน 2026-11-02: "แชตเห็นได้นอกเกม", "แอปคู่หูแยกสำหรับเกมนี้", "ผูกบัญชีได้ตั้งแต่ Alpha")

รุ่นนี้เป็น **PWA** (HTML/CSS/JS ล้วน ไม่มีขั้น build) อยู่ใต้ `website/app/` ติดตั้งลงหน้าจอโฮมได้ทั้ง iOS และ Android
และออกแบบให้ห่อเป็นแอปสโตร์ด้วย Capacitor ภายหลังได้โดยไม่ต้องเขียนใหม่

## ไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | โครงหน้า (เข้าสู่ระบบ / แชต) + CSP |
| `app.css` | หน้าตา หินมืด + ทอง + แสงรอยแยกม่วง, mobile first, safe area |
| `app.js` | ตรรกะทั้งหมด: เซสชัน, เชื่อม Nakama, ห้องแชต, ส่งข้อความ, คำแนะนำติดตั้ง |
| `config.js` | ค่าตั้ง (ค่าเซิร์ฟเวอร์เป็นตัวยึด `YOUR_...` เท่านั้น) |
| `config.local.js` | (ไม่อยู่ใน git) ค่าจริงสำหรับทดสอบในเครื่อง |
| `sw.js` | service worker แคชเฉพาะโครงแอป ไม่แคชข้อมูลแชต |
| `manifest.webmanifest`, `icons/` | ข้อมูลติดตั้ง PWA, ไอคอนย่อจาก `Concept/branding/icon_1024.png` |

ไลบรารีเดียว: `@heroiclabs/nakama-js@2.8.0` จาก jsDelivr (ตรึงเวอร์ชัน + `integrity` sha384 ใน `index.html`)
ถ้าเปลี่ยนเวอร์ชันต้องแก้ 3 ที่พร้อมกัน: `index.html` (URL + hash), `app.js` (`NAKAMA_URL`), `sw.js` (`PINNED`)
คำนวณ hash ใหม่: `curl -s <url> | openssl dgst -sha384 -binary | openssl base64 -A`

## ค่าตั้ง

`config.js` มีแต่ตัวยึด ห้ามใส่ที่อยู่/คีย์จริงแล้ว commit

```js
nakama: { host: "YOUR_NAKAMA_HOST", port: "7350", useSSL: true, serverKey: "YOUR_CLIENT_SERVER_KEY" }
rooms:  { world: "world", mapPrefix: "map." }   // ต้องตรงกับห้องที่ตัวเกม join
maps:   [eldoria_keep, whisperwood, thornveil, mirefen, old_barrow]  // ชื่อตาม Resources/World/maps.json
allowSignUp: false   // บัญชีสร้างในเกม แอปนี้เข้าสู่ระบบอย่างเดียว
```

- `serverKey` คือ **client server key** (`socket.server_key`) ซึ่งอยู่ในตัวเกมทุกเครื่องอยู่แล้ว จึงไม่ใช่ความลับจริง
  แต่ยังไม่เก็บใน git ตามกติกา "ห้ามมีความลับในตัวเกม/repo" ห้ามใช้ http key หรือรหัส console เด็ดขาด
- ตอนเผยแพร่จริง ให้ขั้น deploy เขียนค่าจริงลง `config.js` ในสำเนาที่อัปขึ้นเว็บ (ไม่ commit กลับ)
- ถ้าเซิร์ฟเวอร์ยังเป็นตัวยึด แอปจะขึ้นกล่อง "ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์" และปิดปุ่มเข้าสู่ระบบ

## สิ่งที่แอปทำ

- **เข้าสู่ระบบ:** อีเมล + รหัสผ่าน (`authenticateEmail`, create=false), ปุ่ม Google / Apple เป็นตัวยึด "เร็ว ๆ นี้"
  มีคำอธิบายว่าบัญชี Guest/อุปกรณ์จากเกมใช้ที่นี่ไม่ได้จนกว่าจะผูกบัญชีในเกม
  เซสชัน (token + refresh token) เก็บใน `localStorage` คีย์ `bs.companion.session`, ต่ออายุเองก่อนหมด 60 วิ, refresh หมดอายุ → กลับหน้าเข้าสู่ระบบ
- **แชต:** แท็บ "แชตโลก" (ห้อง `world`) และ "แชตแมพ" (ห้อง `map.<mapId>` เลือกจาก dropdown, จำแมพที่เลือกไว้)
  join ห้องแบบถาวร (`joinChat(room, 1, persistence=true, hidden=false)`) โหลด 100 ข้อความล่าสุด (`listChannelMessages`) + ข้อความสด
  ใหม่สุดอยู่ล่าง, ชื่อผู้ส่ง + เวลาท้องถิ่น, คั่นวัน, ป้ายนับข้อความที่ยังไม่อ่านของอีกแท็บ, ปุ่ม "ข้อความใหม่ ↓" เมื่อเลื่อนขึ้นไปอ่านของเก่า
- **ข้อความระบบ:** content `{"system": true, "kind", "text", "map"}` แสดงกรอบแยก
  `kind` ขึ้นต้นด้วย `seal_rift` (เช่น `seal_rift_gate`) หรือ `rift_gate` = ประกาศประตู Seal Rift ไฮไลต์แสงรอยแยก + ปุ่มเปิดแชตแมพนั้น
  **ถือเป็นข้อความระบบเฉพาะเมื่อไม่มีผู้ส่งที่เป็นผู้เล่น** (sender ว่างหรือ `00000000-...`) ผู้เล่นส่ง `system: true` มาเองจะแสดงเป็นแชตธรรมดา
- **ส่งข้อความ:** content `{"text": "..."}` ทำเป็นบรรทัดเดียว ตัวนับ 120 ตัวอักษร (นับแบบ grapheme ให้สระ/วรรณยุกต์ไทยไม่นับซ้ำ ใกล้เคียง `ChatRules.Clean` ฝั่งเซิร์ฟเวอร์)
  เช็กมารยาทก่อนส่งให้ตรงกฎ `ChatLimiter` (5 ข้อความ/10 วิ, ข้อความเดิมซ้ำใน 30 วิ) แล้วบอกอย่างสุภาพให้รอ
  ถ้าเซิร์ฟเวอร์ปฏิเสธ (เช่น rate limit) แสดงข้อความสุภาพ + ข้อความจากเซิร์ฟเวอร์ และคงข้อความไว้ในช่องพิมพ์
- **ความปลอดภัย:** ข้อความทุกชนิดใส่ด้วย `textContent` ไม่ใช้ `innerHTML`, CSP จำกัดสคริปต์เหลือตัวเอง + jsDelivr, ไม่ใส่ข้อมูลผู้ใช้ใน URL
- **เชื่อมต่อใหม่เอง:** หลุดแล้วลองใหม่แบบถอยเวลา 1-30 วิ, กลับมาออนไลน์/กลับมาเปิดแอปแล้วต่อทันที แล้ว join ห้องและโหลดประวัติใหม่ (กันข้อความซ้ำด้วย message id)
- **ติดตั้ง:** Android/Chrome ใช้ปุ่ม "ติดตั้งแอป" (beforeinstallprompt), iOS Safari แสดงวิธีกดแชร์ → "เพิ่มไปยังหน้าจอโฮม", ปิดคำแนะนำแล้วจำไว้

### ฝั่งเซิร์ฟเวอร์ที่แอปนี้คาดหวัง (ยังต้องทำใน Nakama)

1. ห้อง `world` และ `map.<mapId>` เป็นห้องที่ตัวเกม join ชื่อเดียวกัน และเปิด persistence
2. before-hook ของ `ChannelMessageSend` ใช้ `ChatRules.Check` / `ChatLimiter` ตัวเดียวกับเกม (ทำความสะอาด, ตัด 120, rate limit)
   ปฏิเสธด้วย error code 8 (RESOURCE_EXHAUSTED) เมื่อส่งเร็ว แอปจะแปลเป็นข้อความสุภาพ
3. ข้อความระบบส่งจากเซิร์ฟเวอร์เท่านั้น (`nk.channelMessageSend` โดยไม่มี sender) และ hook ต้องทิ้ง `system` ที่ผู้เล่นส่งมาเอง
4. ชื่อที่แสดง = Nakama `username` ถ้าต้องการชื่อตัวละครแยก ให้ตั้ง username = ชื่อตัวละคร หรือเพิ่มฟิลด์ใน content ฝั่งเซิร์ฟเวอร์
5. ล็อกอินด้วยอีเมลต้องมีบัญชีที่ผูกอีเมลแล้ว (ระบบผูกบัญชีในเกม ตั้งแต่ Alpha)

## ทดสอบในเครื่อง

```bash
cd website/app
python3 -m http.server 8080
# เปิด http://localhost:8080/            (หน้าจริง)
# เปิด http://localhost:8080/?demo=1     (หน้าตัวอย่าง ไม่ต่อเซิร์ฟเวอร์ ข้อความตัวอย่างล้วน)
```

ต่อ Nakama ในเครื่อง: คัดลอก `config.js` เป็น `config.local.js` แล้วแก้ค่า เช่น `host: "127.0.0.1", port: "7350", useSSL: false, serverKey: "<server key ของเครื่องทดสอบ>"`
(`config.local.js` ถูกโหลดเฉพาะเมื่อเปิดจาก localhost / IP วงแลน และถูก gitignore ไว้)

- ทดสอบจากมือถือในวงแลน: เปิด `http://<IP เครื่อง>:8080/` ได้ แต่ service worker / ติดตั้ง PWA ต้องเป็น https หรือ localhost
  (ใช้ tunnel ที่เป็น https หรือทดสอบติดตั้งหลังขึ้นเว็บจริง)
- หน้าเว็บ https ต่อ Nakama แบบ `ws://`/`http://` ไม่ได้ (mixed content) ตอนขึ้นเว็บจริงต้อง `useSSL: true`
- แก้ไฟล์โครงแอปแล้วให้เพิ่ม `VERSION` ใน `sw.js` ไม่งั้นเครื่องที่ติดตั้งแล้วอาจเห็นของเก่าตอนออฟไลน์

## ต้องมี Nakama endpoint สาธารณะ

แอปนี้วิ่งบนมือถือของผู้เล่นทุกที่ จึงต้องมีที่อยู่ Nakama ที่เข้าถึงได้จากอินเทอร์เน็ต:

- โดเมน + ใบรับรอง TLS (เช่น `chat.<โดเมนเกม>`) ผ่าน reverse proxy (Caddy/Nginx) ไปพอร์ต 7350 รองรับ WebSocket
- ตั้ง CORS ของ Nakama/proxy ให้รับ origin ของเว็บเกม (และ `capacitor://localhost`, `https://localhost` เมื่อห่อเป็นแอป)
- ใช้เซิร์ฟเวอร์เดียวกับเกม (Byteder ไทย ตามที่ผู้ใช้ยืนยัน 2026-11-01) เพื่อให้บัญชีและแชตเป็นชุดเดียวกัน
- อย่าเปิดพอร์ต console (7351) สู่สาธารณะ

## เผยแพร่ (ยังไม่ทำในรอบนี้)

ไฟล์ PNG ใน repo นี้เก็บด้วย Git LFS ส่วนเว็บจริงอยู่ที่ repo GitHub Pages แยก
ตอนคัดลอก `website/app/` ไปขึ้นเว็บ ต้องเป็นไฟล์ภาพจริง (`git lfs pull`) ไม่ใช่ไฟล์ pointer

## แผนห่อเป็นแอปสโตร์ด้วย Capacitor

โครงนี้ตั้งใจให้ห่อได้ตรง ๆ: ไม่มี build step, path ทั้งหมดเป็นแบบ relative, ไม่พึ่ง server-side

1. สร้างโปรเจกต์ห่อแยก (เช่น `companion-native/`) `npm i @capacitor/core @capacitor/cli` → `npx cap init "The Broken Seal Companion" <bundle id>`
2. ตั้ง `webDir` ชี้สำเนาของ `website/app/` (สคริปต์คัดลอก + เขียน config จริงตอน build)
3. `npx cap add ios` / `npx cap add android` แล้ว build ด้วย Xcode / Android Studio
4. ในแอปห่อ ไม่ต้องใช้ service worker และคำแนะนำติดตั้ง (โค้ดข้ามเองเมื่อเป็น standalone; จะเพิ่มเช็ก `window.Capacitor` ตอนห่อ)
5. ควรรวม nakama-js ไว้ในตัวแอป (ไม่โหลดจาก CDN) เพื่อผ่านกฎสโตร์และใช้ออฟไลน์ได้
6. ล็อกอิน Google / Apple ใช้ปลั๊กอิน native แล้ว `authenticateGoogle` / `authenticateApple` / `link*` ของ Nakama
   (App Store บังคับ Sign in with Apple ถ้ามีล็อกอินโซเชียลอื่น)
7. **แจ้งเตือน (ภายหลัง):** `@capacitor/push-notifications` (APNs / FCM) ให้เซิร์ฟเวอร์ส่งเมื่อมีประกาศประตู Seal Rift หรือมีคนเรียกชื่อ
   ต้องมีตารางเก็บ device token ต่อบัญชี และตั้งค่าเปิด/ปิดในแอป
8. ข้อกำหนดสโตร์ที่ต้องเตรียม: ปุ่มรายงาน/บล็อกผู้เล่นในแชต (Apple 1.2 เนื้อหาจากผู้ใช้), หน้านโยบายความเป็นส่วนตัว, ลบบัญชีได้จากในแอป

## ยังไม่ทำในรุ่นนี้

- ล็อกอิน Google / Apple จริง, ผูกบัญชี (รอระบบผูกบัญชีในเกม)
- แชตปาร์ตี้ / กระซิบ, รายงาน/บล็อกผู้เล่น, แจ้งเตือน push
- ทดสอบกับเซิร์ฟเวอร์ Nakama จริง (ยังไม่มี endpoint) — ทดสอบได้แค่หน้าตาในโหมดตัวอย่าง


## ความปลอดภัยก่อนเปิดใช้จริง (รีวิวเครือข่าย 2026-11-02)
- **โดเมนแยก:** แอปนี้เก็บ token ใน localStorage จึงต้องเปิดจาก origin ของตัวเอง (เช่น subdomain แยก) ห้ามอยู่ origin เดียวกับหน้าเว็บที่โหลดสคริปต์บุคคลที่สาม (analytics)
- **nakama-js:** ตอนนี้ CSP จำกัดให้โหลดได้เฉพาะ path ของ `@heroiclabs/nakama-js@2.8.0` บน jsDelivr; ก่อนเปิดจริงให้ copy ไฟล์มาไว้ `vendor/` แล้วตัด jsDelivr ออกจาก CSP
- **connect-src:** ตอนนี้เปิด https/wss ทุกที่ (ยังไม่รู้ host จริง) ก่อนเปิดจริงให้จำกัดเหลือ host ของ Nakama
- **ชื่อในแชต:** ใช้ display name ที่เซิร์ฟเวอร์ตั้งเป็นชื่อตัวละคร (`name_reserve`) เท่านั้น ห้ามใช้ username

/**
 * هيما فارم — استقبال نتائج لعبة "جبنة السماء" في جوجل شيت
 * ─────────────────────────────────────────────────────────────
 * كل موبايل = صف واحد: لو نفس الرقم لعب تاني، بنحدّث نفس الصف
 * بالنتيجة الجديدة بدل ما نضيف صف جديد.
 *
 * التركيب (مرة واحدة):
 *   ١) افتح الشيت ← Extensions ← Apps Script
 *   ٢) امسح أي كود موجود والصق الكود ده كله
 *   ٣) Deploy ← New deployment ← Web app
 *        Execute as: Me
 *        Who has access: Anyone
 *   ٤) انسخ رابط /exec وحطه في .env.local كـ LEADS_WEBHOOK_URL
 *
 * بعد أي تعديل في الكود: Deploy ← Manage deployments ← ✏️ Edit ←
 * Version: New version ← Deploy (من غير كده الرابط هيفضل شغال بالكود القديم).
 *
 * السكريبت بيعمل تاب Leads والعناوين لوحده أول مرة.
 * لو حبيت حماية إضافية: حط SHARED_SECRET هنا وقيمته نفسها في LEADS_WEBHOOK_SECRET.
 */

const SHEET_NAME = "Leads";
const SHARED_SECRET = ""; // سيبه فاضي لو مش عايز حماية إضافية

const HEADERS = [
  "التاريخ",
  "الاسم",
  "الموبايل",
  "النقاط",
  "الحكم",
  "العرض",
  "كود العرض",
];

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    if (SHARED_SECRET && body.secret !== SHARED_SECRET) {
      return json({ ok: false, error: "unauthorized" });
    }

    const name = clean(body.name, 60);
    const phone = String(body.phone || "")
      .replace(/[^0-9]/g, "")
      .slice(0, 20);
    const score = Number(body.score);

    if (name.length < 2) return json({ ok: false, error: "invalid_name" });
    if (!/^(010|011|012|015)[0-9]{8}$/.test(phone)) {
      return json({ ok: false, error: "invalid_phone" });
    }
    if (!Number.isFinite(score) || score < 0 || score > 10000) {
      return json({ ok: false, error: "invalid_score" });
    }

    const book = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = book.getSheetByName(SHEET_NAME);
    if (!sheet) sheet = book.insertSheet(SHEET_NAME);
    ensureHeaders(sheet);

    const values = [
      body.createdAt || new Date().toISOString(),
      name,
      phone,
      Math.round(score),
      clean(body.verdict, 80),
      clean(body.offer, 80),
      clean(body.offerCode, 40),
    ];

    /* نفس الموبايل؟ حدّث صفه. جديد؟ ضيفه في آخر الشيت */
    const rowIndex = findRowByPhone(sheet, phone);
    if (rowIndex > 0) {
      writeRow(sheet, rowIndex, values);
      return json({ ok: true, action: "updated", row: rowIndex });
    }

    const nextRow = Math.max(sheet.getLastRow() + 1, 2);
    writeRow(sheet, nextRow, values);
    return json({ ok: true, action: "inserted", row: nextRow });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/** فحص سريع إن النشر شغال (افتح رابط /exec في المتصفح) */
function doGet() {
  return json({ ok: true, service: "hima-leads" });
}

/** بيعمل تاب Leads + العناوين لو التاب لسه فاضي */
function ensureHeaders(sheet) {
  if (sheet.getLastRow() > 0) return;
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
  sheet.setFrozenRows(1);
  /* عمود الموبايل نص — عشان الصفر في أول الرقم ميضيعش */
  sheet.getRange("C:C").setNumberFormat("@");
}

/** بيدور على رقم الموبايل في العمود C ويرجّع رقم الصف (0 = مش موجود) */
function findRowByPhone(sheet, phone) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const target = normalizePhone(phone);
  if (!target) return 0;
  const phones = sheet.getRange(2, 3, lastRow - 1, 1).getValues();
  for (let i = 0; i < phones.length; i += 1) {
    if (normalizePhone(phones[i][0]) === target) return i + 2;
  }
  return 0;
}

/**
 * بيكتب الصف. بنجهّز خلية الموبايل كنص قبل الكتابة عشان
 * Sheets ميحوّلش "010..." لرقم 101... (وبكده الصفر ميضيعش).
 */
function writeRow(sheet, rowIndex, values) {
  sheet.getRange(rowIndex, 3).setNumberFormat("@");
  sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([values]);
}

/** توحيد الأرقام للمقارنة: منغير مسافات/رموز ومنغير الأصفار الأولى */
function normalizePhone(value) {
  return String(value == null ? "" : value)
    .replace(/[^0-9]/g, "")
    .replace(/^0+/, "");
}

function json(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function clean(value, maxLength) {
  return String(value == null ? "" : value)
    .trim()
    .slice(0, maxLength);
}

/**
 * هيما فارم — استقبال نتائج لعبة "جبنة السماء" في جوجل شيت
 * ─────────────────────────────────────────────────────────────
 * التركيب (مرة واحدة):
 *   ١) افتح الشيت ← Extensions ← Apps Script
 *   ٢) امسح أي كود موجود والصق الكود ده كله
 *   ٣) Deploy ← New deployment ← Web app
 *        Execute as: Me
 *        Who has access: Anyone
 *   ٤) انسخ رابط /exec وحطه في .env.local كـ LEADS_WEBHOOK_URL
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

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
      sheet.setFrozenRows(1);
    }

    sheet.appendRow([
      body.createdAt || new Date().toISOString(),
      name,
      phone,
      Math.round(score),
      clean(body.verdict, 80),
      clean(body.offer, 80),
      clean(body.offerCode, 40),
    ]);

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/** فحص سريع إن النشر شغال (افتح رابط /exec في المتصفح) */
function doGet() {
  return json({ ok: true, service: "hima-leads" });
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

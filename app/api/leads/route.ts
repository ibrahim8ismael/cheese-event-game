/**
 * POST /api/leads — تسجيل نتيجة اللاعب في جوجل شيت
 * ─────────────────────────────────────────────────────────────
 * الصف اللي بيتضاف:
 *   التاريخ | الاسم | الموبايل | النقاط | الحكم | العرض | كود العرض
 *
 * الإعداد — أي طريقة من الاتنين:
 *   ١) Apps Script Web App (الأسهل): LEADS_WEBHOOK_URL (+ LEADS_WEBHOOK_SECRET اختياري)
 *   ٢) Service Account مباشرة على Sheets API:
 *      GOOGLE_SHEETS_ID, GOOGLE_SHEETS_TAB (افتراضي Leads)
 *      GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY
 *
 * لو مفيش أي إعداد: وضع الديمو — الصف بيتطبع في الكونسول
 * وبيرجع store:"console" عشان الواجهة توضح إن الشيت لسه مش متوصل.
 */
import { createSign } from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const EGYPT_PHONE = /^(010|011|012|015)\d{8}$/;

const WEBHOOK_URL = (process.env.LEADS_WEBHOOK_URL ?? "").trim();
const WEBHOOK_SECRET = (process.env.LEADS_WEBHOOK_SECRET ?? "").trim();

const SHEET_ID = (process.env.GOOGLE_SHEETS_ID ?? "").trim();
const SHEET_TAB = (process.env.GOOGLE_SHEETS_TAB ?? "").trim() || "Leads";
const CLIENT_EMAIL = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "").trim();
const PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY ?? "")
  .replace(/\\n/g, "\n")
  .trim();

const sheetsReady = Boolean(SHEET_ID && CLIENT_EMAIL && PRIVATE_KEY);

const base64url = (value: string | Buffer) =>
  Buffer.from(value).toString("base64url");

/** JWT قصير العمر + access token من حساب الخدمة — بدون مكتبات إضافية */
async function accessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: CLIENT_EMAIL,
      scope: SHEETS_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const assertion = `${unsigned}.${base64url(signer.sign(PRIVATE_KEY))}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`token ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("token response missing access_token");
  return data.access_token;
}

function text(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

/**
 * POST على Apps Script Web App — بيحصل 302 من Google،
 * فبنعيد إرسال نفس الـ body يدويًا عشان الـ fetch ميحوّلش الطلب لـ GET.
 */
async function postToWebhook(
  payload: Record<string, unknown>,
): Promise<Response> {
  const init: RequestInit = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    redirect: "manual",
    cache: "no-store",
  };
  let res = await fetch(WEBHOOK_URL, init);
  if ([301, 302, 303, 307, 308].includes(res.status)) {
    const location = res.headers.get("location");
    if (location) {
      res = await fetch(location, { ...init, redirect: "follow" });
    }
  }
  return res;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return Response.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const name = text(input.name, 60);
  const phone = text(input.phone, 20).replace(/[^\d]/g, "");
  const score = Number(input.score);
  const verdict = text(input.verdict, 80);
  const offer = text(input.offer, 80);
  const offerCode = text(input.offerCode, 40);

  if (name.length < 2) {
    return Response.json({ ok: false, error: "invalid_name" }, { status: 400 });
  }
  if (!EGYPT_PHONE.test(phone)) {
    return Response.json({ ok: false, error: "invalid_phone" }, { status: 400 });
  }
  if (!Number.isFinite(score) || score < 0 || score > 10000) {
    return Response.json({ ok: false, error: "invalid_score" }, { status: 400 });
  }

  const row = [
    new Date().toISOString(),
    name,
    phone,
    Math.round(score),
    verdict,
    offer,
    offerCode,
  ];

  /* الطريقة ١: Apps Script Web App */
  if (WEBHOOK_URL) {
    try {
      const res = await postToWebhook({
        secret: WEBHOOK_SECRET,
        createdAt: row[0],
        name,
        phone,
        score: Math.round(score),
        verdict,
        offer,
        offerCode,
      });
      if (!res.ok) {
        console.error(
          "[leads] webhook failed:",
          res.status,
          (await res.text()).slice(0, 200),
        );
        return Response.json(
          { ok: false, error: "webhook_error" },
          { status: 502 },
        );
      }
      const reply = (await res.json().catch(() => null)) as {
        ok?: boolean;
      } | null;
      if (reply && reply.ok === false) {
        console.error("[leads] webhook rejected:", reply);
        return Response.json(
          { ok: false, error: "webhook_rejected" },
          { status: 502 },
        );
      }
      return Response.json({ ok: true, store: "sheet" });
    } catch (error) {
      console.error("[leads] webhook error:", error);
      return Response.json(
        { ok: false, error: "webhook_error" },
        { status: 502 },
      );
    }
  }

  /* ديمو قبل ربط الشيت: الصف بيتطبع في الكونسول بدل ما يضيع */
  if (!sheetsReady) {
    console.warn("[leads] GOOGLE_* env ناقص — dry-run row:", row.join(" | "));
    return Response.json({ ok: true, store: "console" });
  }

  try {
    const token = await accessToken();
    const range = encodeURIComponent(`${SHEET_TAB}!A1`);
    const url = new URL(
      `${SHEETS_API}/${encodeURIComponent(SHEET_ID)}/values/${range}:append`,
    );
    url.searchParams.set("valueInputOption", "USER_ENTERED");
    url.searchParams.set("insertDataOption", "INSERT_ROWS");

    const res = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ values: [row] }),
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(
        "[leads] sheets append failed:",
        res.status,
        (await res.text()).slice(0, 300),
      );
      return Response.json(
        { ok: false, error: "sheet_error" },
        { status: 502 },
      );
    }

    return Response.json({ ok: true, store: "sheet" });
  } catch (error) {
    console.error("[leads] submission failed:", error);
    return Response.json({ ok: false, error: "sheet_error" }, { status: 502 });
  }
}

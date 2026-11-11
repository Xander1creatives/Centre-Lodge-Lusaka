// =====================================================================
//  centre LODGE - Lenco payment verification  (Supabase Edge Function)
//
//  The browser NEVER talks to Lenco's API and never sees the secret key.
//  Flow:
//    1. The website calls the database function start_payment(), which creates
//       the payment reference (CLP-xxxxxxxxxx) and the amount on the server.
//    2. The Lenco pop-up takes the payment.
//    3. The website (or Lenco's webhook, or an admin pressing "Verify") POSTs the
//       reference here. This function asks Lenco "what is the real status of this
//       reference?" using the SECRET key, then hands the answer to the database
//       function apply_lenco_result(), which checks the amount and currency,
//       records the payment ONCE, takes the rooms, and notifies the admin.
//
//  Anyone can call this function, and that is safe: it only ever reports what
//  Lenco itself says about a reference the database created, so a fake call
//  cannot create a payment.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const LENCO_BASE = (Deno.env.get("LENCO_API_BASE") ?? "https://api.lenco.co/access/v2").replace(/\/+$/, "");
const LENCO_SECRET = Deno.env.get("LENCO_SECRET_KEY") ?? "";
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const W3F_KEY = Deno.env.get("WEB3FORMS_ACCESS_KEY") ?? "";            // optional, see README
const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") ?? "*").split(",").map((s) => s.trim()).filter(Boolean);
const REF_RE = /^CLP-[A-Z0-9]{10}$/;

const sb = SB_URL && SB_SERVICE
  ? createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allow = ALLOWED.includes("*") ? "*" : (ALLOWED.includes(origin) ? origin : ALLOWED[0] ?? "");
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json", "Cache-Control": "no-store" } });

async function sendEmail(b: Record<string, unknown>, p: Record<string, unknown>): Promise<boolean> {
  // Best effort. Web3Forms' free plan only accepts browser calls, so this may be refused;
  // the website then sends the email itself (it is told emailed:false).
  if (!W3F_KEY) return false;
  try {
    const r = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        access_key: W3F_KEY,
        subject: `PAID: ${b.reference} - K${p.amount} received (${b.guest_name})`,
        from_name: "centre Lodge bookings",
        replyto: b.email,
        email: b.email,
        message: [
          `Payment received and verified with Lenco.`, ``,
          `Booking: ${b.reference}`, `Guest: ${b.guest_name}`, `Country: ${b.country}`, `Phone: ${b.phone}`, `Email: ${b.email}`,
          `Room: ${b.rooms} x ${b.room_type}`, `Stay: ${b.check_in} to ${b.check_out} (${b.nights} nights)`,
          `Amount paid now: K${p.amount}`, `Total paid: K${b.paid} of K${b.total} (balance K${b.balance})`,
          `Receipt: ${p.receipt_no}`, `Channel: ${p.channel ?? "online"}`, `Status: ${b.status}`,
        ].join("\n"),
        botcheck: "",
      }),
      signal: AbortSignal.timeout(10000),
    });
    const j = await r.json().catch(() => null);
    return r.ok && !!j && j.success === true;
  } catch { return false; }
}

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return json(req, { ok: false, error: "method_not_allowed" }, 405);
  if (!sb || !LENCO_SECRET) return json(req, { ok: false, error: "not_configured", message: "Payments are not set up yet." }, 500);

  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > 20000) return json(req, { ok: false, error: "too_large" }, 413);
  let body: any = null;
  try { body = await req.json(); } catch { return json(req, { ok: false, error: "bad_json" }, 400); }

  // accepts our own call {reference} and Lenco's webhook {event, data:{reference}}
  if (typeof body?.event === "string" && !body.event.startsWith("collection.")) return json(req, { ok: true, ignored: true });
  const reference = String(body?.reference ?? body?.data?.reference ?? "");
  if (!REF_RE.test(reference)) return json(req, { ok: false, error: "bad_reference", message: "Unknown payment reference." }, 400);

  const ip = (req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? (req.headers.get("x-forwarded-for") ?? "").split(",")[0] ?? "").trim() || "unknown";
  const [a, b] = await Promise.all([
    sb.rpc("edge_rate_limit", { p_key: "lenco:ip:" + ip, p_max: 90, p_secs: 600 }),
    sb.rpc("edge_rate_limit", { p_key: "lenco:ref:" + reference, p_max: 60, p_secs: 600 }),
  ]);
  if (a.data === false || b.data === false) return json(req, { ok: false, error: "rate_limited", message: "Please wait a moment and try again." }, 429);

  // ---- ask Lenco for the REAL status (secret key stays on the server) ----
  let lencoRes: Response;
  try {
    lencoRes = await fetch(`${LENCO_BASE}/collections/status/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${LENCO_SECRET}`, Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return json(req, { ok: false, error: "lenco_unreachable", message: "Could not reach the payment provider. Please try again shortly." }, 502);
  }
  const lj: any = await lencoRes.json().catch(() => null);

  let data: any;
  if (lencoRes.status === 404 || (lj && lj.status === false && /not.?found|no collection|does not exist/i.test(String(lj.message ?? "")))) {
    // Lenco has no record yet: the customer has not completed the pop-up. Treat as "still pending".
    data = { status: "pending", amount: null, currency: null, reference, lencoReference: null, type: null };
  } else if (!lencoRes.ok || !lj || lj.status !== true || !lj.data) {
    // NOTE: Lenco can answer HTTP 200 with {"status": false}. That is an error, not a success.
    return json(req, { ok: false, error: "lenco_error", message: "The payment provider could not confirm this payment yet. Please try again." }, 502);
  } else {
    data = lj.data;
    if (data.reference !== reference) return json(req, { ok: false, error: "reference_mismatch", message: "The payment reference did not match." }, 502);
  }

  const amount = data.amount == null ? null : Number(data.amount);
  const { data: res, error } = await sb.rpc("apply_lenco_result", {
    p_reference: reference,
    p_lenco_status: String(data.status ?? "pending"),
    p_amount: amount,
    p_currency: data.currency ?? null,
    p_lenco_reference: data.lencoReference ?? null,
    p_channel: data.type ?? null,
    p_failure: data.reasonForFailure ?? null,
  });
  if (error || !res) return json(req, { ok: false, error: "server_error", message: "Something went wrong recording the payment. Please contact the lodge." }, 500);
  if (res.ok === false) return json(req, { ok: false, error: res.error, message: res.message }, res.error === "unknown_reference" ? 404 : 400);

  let emailed = false;
  if (res.newly_paid) emailed = await sendEmail(res.booking, res.payment);

  const bk = res.booking ?? {};
  return json(req, {
    ok: true,
    state: res.state,                       // successful | pending | failed | needs_review
    newly_paid: !!res.newly_paid,
    emailed,
    message: res.message ?? null,
    payment: res.payment ?? null,
    // no email / phone / country is sent back to the browser
    booking: {
      reference: bk.reference, guest_name: bk.guest_name, room_type: bk.room_type, rooms: bk.rooms, guests: bk.guests,
      check_in: bk.check_in, check_out: bk.check_out, nights: bk.nights, status: bk.status,
      total: bk.total, paid: bk.paid, balance: bk.balance,
    },
  });
}

const port = Deno.env.get("LOCAL_PORT");           // only used when testing on a computer
if (port) Deno.serve({ port: Number(port) }, handler); else Deno.serve(handler);

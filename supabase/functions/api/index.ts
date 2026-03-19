// ============================================
// Supabase Edge Function: /api/*
// - Toss mTLS OAuth2 (5개 엔드포인트)
// - 사용자 데이터 CRUD (프로필/습관/기록)
//
// 필요한 Supabase Secrets (supabase secrets set):
//   TOSS_CERT          = cert_key/rich_habbit_public.crt 내용
//   TOSS_KEY           = cert_key/rich_habbit_private.key 내용
//   TOSS_OAUTH_BASE    = Toss OAuth2 베이스 URL (문서 확인)
//   TOSS_API_BASE      = Toss API 베이스 URL (문서 확인)
// ============================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// ==================== 환경변수 ====================
// Base64 인코딩된 인증서를 디코딩 (멀티라인 시크릿 문제 우회)
function b64decode(b64: string): string {
  return new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0)));
}
const TOSS_CERT_B64 = Deno.env.get("TOSS_CERT_B64") ?? "";
const TOSS_KEY_B64  = Deno.env.get("TOSS_KEY_B64") ?? "";
const TOSS_CERT     = TOSS_CERT_B64 ? b64decode(TOSS_CERT_B64) : (Deno.env.get("TOSS_CERT") ?? "");
const TOSS_KEY      = TOSS_KEY_B64  ? b64decode(TOSS_KEY_B64)  : (Deno.env.get("TOSS_KEY")  ?? "");
const TOSS_API_BASE = Deno.env.get("TOSS_API_BASE") ?? "https://apps-in-toss-api.toss.im";
const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY     = Deno.env.get("SB_SERVICE_ROLE_KEY")!;
const DEV_MODE        = Deno.env.get("DEV_MODE") === "true";

// ==================== mTLS: Deno.connectTls 직접 사용 ====================
interface TlsConn {
  read(p: Uint8Array): Promise<number | null>;
  write(p: Uint8Array): Promise<number>;
  close(): void;
}

async function tossFetch(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<{ status: number; data: unknown }> {
  if (!TOSS_CERT || !TOSS_KEY) {
    throw new Error(`mTLS 인증서 없음: CERT=${TOSS_CERT.length}, KEY=${TOSS_KEY.length}`);
  }

  const parsed    = new URL(url);
  const hostname  = parsed.hostname;
  const method    = options.method ?? "GET";
  const bodyStr   = options.body ?? "";
  const bodyBytes = bodyStr ? new TextEncoder().encode(bodyStr) : null;

  // Deno 1.x: certChain/privateKey, Deno 2.x: cert/key
  const conn = await (Deno as unknown as {
    connectTls: (o: { hostname: string; port: number; cert?: string; key?: string; certChain?: string; privateKey?: string }) => Promise<TlsConn>;
  }).connectTls({ hostname, port: 443, cert: TOSS_CERT, key: TOSS_KEY, certChain: TOSS_CERT, privateKey: TOSS_KEY });

  try {
    const extraHeaders = options.headers ?? {};
    const defaultHeaders: Record<string, string> = { "Content-Type": "application/json" };
    const mergedHeaders = { ...defaultHeaders, ...extraHeaders };
    const headerLines = [
      `${method} ${parsed.pathname}${parsed.search} HTTP/1.1`,
      `Host: ${hostname}`,
      `Connection: close`,
      ...Object.entries(mergedHeaders).map(([k, v]) => `${k}: ${v}`),
      ...(bodyBytes ? [`Content-Length: ${bodyBytes.byteLength}`] : []),
      "",
      "",
    ];
    const headerBytes = new TextEncoder().encode(headerLines.join("\r\n"));

    // 요청 전송
    if (bodyBytes) {
      const full = new Uint8Array(headerBytes.length + bodyBytes.length);
      full.set(headerBytes);
      full.set(bodyBytes, headerBytes.length);
      await conn.write(full);
    } else {
      await conn.write(headerBytes);
    }

    // 응답 읽기
    const chunks: Uint8Array[] = [];
    const buf = new Uint8Array(4096);
    while (true) {
      const n = await conn.read(buf);
      if (n === null) break;
      chunks.push(buf.slice(0, n));
    }

    const totalLen = chunks.reduce((s, c) => s + c.length, 0);
    const full = new Uint8Array(totalLen);
    let off = 0;
    for (const c of chunks) { full.set(c, off); off += c.length; }

    const text = new TextDecoder().decode(full);
    const sep  = text.indexOf("\r\n\r\n");
    const headerSection = sep >= 0 ? text.slice(0, sep) : text;
    const bodySection   = sep >= 0 ? text.slice(sep + 4) : "";

    const statusMatch = headerSection.match(/^HTTP\/\d\.\d (\d{3})/);
    const status = statusMatch ? parseInt(statusMatch[1]) : 500;

    let data: unknown = {};
    try { data = JSON.parse(bodySection); } catch { data = { raw: bodySection.slice(0, 200) }; }

    return { status, data };
  } finally {
    try { conn.close(); } catch { /* ignore */ }
  }
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: corsHeaders });
}

// ==================== Toss 토큰 검증 + userKey 반환 ====================
async function resolveTossUser(req: Request): Promise<string | null> {
  // DEV_MODE: X-Dev-UserKey 헤더로 우회 (테스트 전용)
  if (DEV_MODE) {
    const devKey = req.headers.get("x-dev-userkey");
    if (devKey) return devKey;
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  // ⚠️ 경로 확인 필요
  const { status, data } = await tossFetch(
    `${TOSS_API_BASE}/api-partner/v1/apps-in-toss/user/oauth2/login-me`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (status !== 200) return null;
  const success = (data as { success?: { userKey?: number } }).success;
  return success?.userKey != null ? String(success.userKey) : null;
}

// ==================== 라우터 ====================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url  = new URL(req.url);
  const path = url.pathname.replace(/^\/api/, "");

  // ── 진단 엔드포인트 (임시) ─────────────────────────────
  if (path === "/debug/cert") {
    let clientOk = false;
    let clientErr = "";
    try { makeTossClient(); clientOk = true; }
    catch (e) { clientErr = e instanceof Error ? e.message : String(e); }
    return json({
      cert_len: TOSS_CERT.length,
      key_len:  TOSS_KEY.length,
      cert_start: TOSS_CERT.slice(0, 30),
      cert_end:   TOSS_CERT.slice(-20),
      client_created: clientOk,
      client_error:   clientErr,
    });
  }

  try {
    // ── 1) generateOauth2Token ──────────────────────────────
    if (req.method === "POST" && path === "/auth/token") {
      const { authorizationCode, referrer } = await req.json();
      if (!authorizationCode) return json({ error: "authorizationCode required" }, 400);
      const { status, data } = await tossFetch(
        `${TOSS_API_BASE}/api-partner/v1/apps-in-toss/user/oauth2/generate-token`,
        { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ authorizationCode, referrer }) },
      );
      const result = (data as { success?: unknown; error?: unknown });
      return json(result.success ?? data, result.success ? 200 : status);
    }

    // ── 2) refreshOauth2Token ───────────────────────────────
    if (req.method === "POST" && path === "/auth/refresh") {
      const { refreshToken } = await req.json();
      if (!refreshToken) return json({ error: "refreshToken required" }, 400);
      const { status, data } = await tossFetch(
        `${TOSS_API_BASE}/api-partner/v1/apps-in-toss/user/oauth2/refresh-token`,
        { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }) },
      );
      const result2 = (data as { success?: unknown; error?: unknown });
      return json(result2.success ?? data, result2.success ? 200 : status);
    }

    // ── 3) loginMe ─────────────────────────────────────────
    if (req.method === "GET" && path === "/auth/me") {
      const authHeader = req.headers.get("authorization");
      if (!authHeader) return json({ error: "Unauthorized" }, 401);
      const { status, data } = await tossFetch(
        `${TOSS_API_BASE}/api-partner/v1/apps-in-toss/user/oauth2/login-me`,
        { headers: { Authorization: authHeader } },
      );
      const meResult = (data as { success?: unknown; error?: unknown });
      return json(meResult.success ?? data, meResult.success ? 200 : status);
    }

    // ── 4) removeByAccessToken ─────────────────────────────
    if (req.method === "POST" && path === "/auth/disconnect/token") {
      const { accessToken } = await req.json();
      if (!accessToken) return json({ error: "accessToken required" }, 400);
      const { status, data } = await tossFetch(
        `${TOSS_API_BASE}/api-partner/v1/apps-in-toss/user/oauth2/access/remove-by-access-token`,
        { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` } },
      );
      return json(data, status);
    }

    // ── 5) removeByUserKey ─────────────────────────────────
    if (req.method === "POST" && path === "/auth/disconnect/user") {
      const { userKey } = await req.json();
      if (!userKey) return json({ error: "userKey required" }, 400);
      const { status, data } = await tossFetch(
        `${TOSS_API_BASE}/api-partner/v1/apps-in-toss/user/oauth2/access/remove-by-user-key`,
        { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userKey }) },
      );
      return json(data, status);
    }

    // ── POST /payment/webhook — 인증 없이 처리 (Toss 서버 → 우리 서버) ──
    if (req.method === "POST" && path === "/payment/webhook") {
      const event = await req.json() as {
        orderId?: string;
        status?: string;
        productItemId?: string;
        userKey?: string;
      };
      console.log("[webhook] IAP event:", JSON.stringify(event));

      const { orderId, status, userKey: whUserKey } = event;
      if (!orderId || !whUserKey) return json({ ok: true });

      const sb = createClient(SUPABASE_URL, SERVICE_KEY);

      if (status === "PURCHASED") {
        await sb.from("orders")
          .upsert({ id: orderId, toss_user_key: whUserKey, status: "PURCHASED" });
        await sb.from("profiles")
          .update({ premium: true, updated_at: new Date().toISOString() })
          .eq("toss_user_key", whUserKey);
      } else if (status === "REFUNDED") {
        await sb.from("orders")
          .update({ status: "REFUNDED" }).eq("id", orderId);
        await sb.from("profiles")
          .update({ premium: false, premium_plan: null, premium_expires_at: null,
                    updated_at: new Date().toISOString() })
          .eq("toss_user_key", whUserKey);
      }

      return json({ ok: true });
    }

    // ── 이하 엔드포인트는 Toss 토큰 인증 필요 ──────────────
    const userKey = await resolveTossUser(req);
    if (!userKey) return json({ error: "Unauthorized" }, 401);

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // ── GET /user/data — 모든 사용자 데이터 로드 ──────────
    if (req.method === "GET" && path === "/user/data") {
      const [profileRes, habitsRes, recordsRes] = await Promise.all([
        sb.from("profiles").select("*").eq("toss_user_key", userKey).maybeSingle(),
        sb.from("habits").select("*").eq("toss_user_key", userKey).order("sort_order"),
        sb.from("records").select("*").eq("toss_user_key", userKey),
      ]);
      return json({
        profile: profileRes.data,
        habits:  habitsRes.data  ?? [],
        records: recordsRes.data ?? [],
      });
    }

    // ── POST /user/data — 전체 데이터 동기화 ──────────────
    if (req.method === "POST" && path === "/user/data") {
      const body = await req.json() as {
        profile?: Record<string, unknown>;
        habits?:  Record<string, unknown>[];
        records?: Record<string, unknown>[];
      };

      const errors: string[] = [];

      if (body.profile) {
        const { error } = await sb.from("profiles").upsert({
          toss_user_key: userKey,
          nickname:    body.profile.nickname    ?? null,
          goal:        body.profile.goal        ?? null,
          role_model:  body.profile.roleModel   ?? body.profile.role_model ?? null,
          wakeup:      body.profile.wakeup      ?? null,
          sleep:       body.profile.sleep       ?? null,
          xp:          body.profile.xp          ?? 0,
          premium:     body.profile.premium     ?? false,
          premium_plan: body.profile.premiumPlan ?? body.profile.premium_plan ?? null,
          premium_expires_at: body.profile.premiumExpiresAt ?? body.profile.premium_expires_at ?? null,
          updated_at: new Date().toISOString(),
        });
        if (error) errors.push(`profiles: ${error.message}`);
      }

      if (body.habits?.length) {
        const rows = body.habits.map(h => ({
          toss_user_key: userKey,
          id:         h.id,
          name:       h.name,
          category:   h.category   ?? null,
          icon:       h.icon       ?? null,
          enabled:    h.enabled    ?? true,
          sort_order: h.sort_order ?? h.sortOrder ?? 0,
        }));
        const { error } = await sb.from("habits")
          .upsert(rows, { onConflict: "toss_user_key,id" });
        if (error) errors.push(`habits: ${error.message}`);
      }

      if (body.records?.length) {
        const rows = body.records.map(r => ({
          toss_user_key: userKey,
          date:     r.date,
          habit_id: r.habit_id ?? r.habitId,
          done:     r.done     ?? false,
          done_at:  r.done_at  ?? r.doneAt ?? null,
        }));
        const { error } = await sb.from("records")
          .upsert(rows, { onConflict: "toss_user_key,date,habit_id" });
        if (error) errors.push(`records: ${error.message}`);
      }

      if (errors.length) {
        console.error("[POST /user/data] errors:", errors);
        return json({ ok: false, errors }, 500);
      }
      return json({ ok: true });
    }

    // ── POST /payment/verify — 결제 서버 검증 + 프리미엄 부여 ──
    // 클라이언트 onSuccess 콜백에서 호출
    if (req.method === "POST" && path === "/payment/verify") {
      const { orderId, productId, productName, price, period } = await req.json();
      if (!orderId || !productId) return json({ error: "orderId, productId required" }, 400);

      // Toss IAP 주문 상태 검증
      const { status: tossStatus, data: orderData } = await tossFetch(
        `${TOSS_API_BASE}/api-partner/v1/apps-in-toss/order/get-order-status`,
        {
          method: "POST",
          headers: { "x-toss-user-key": userKey },
          body: JSON.stringify({ orderId }),
        },
      );

      const orderSuccess = (orderData as { success?: { status?: string } }).success;
      const isValid = tossStatus === 200 && orderSuccess?.status === "PURCHASED";

      if (!isValid) {
        return json({ error: "Order not verified", tossStatus, orderData }, 402);
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + (period ?? 30) * 24 * 60 * 60 * 1000);

      const sb = createClient(SUPABASE_URL, SERVICE_KEY);

      // 중복 주문 방지
      const { data: existing } = await sb.from("orders").select("id").eq("id", orderId).maybeSingle();
      if (existing) return json({ ok: true, duplicate: true });

      // orders 저장
      await sb.from("orders").insert({
        id: orderId,
        toss_user_key: userKey,
        product_id: productId,
        product_name: productName,
        price,
        status: "PURCHASED",
        purchased_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });

      // profiles 프리미엄 활성화
      await sb.from("profiles").upsert({
        toss_user_key: userKey,
        premium: true,
        premium_plan: productId,
        premium_expires_at: expiresAt.toISOString(),
        updated_at: now.toISOString(),
      });

      return json({ ok: true, expiresAt: expiresAt.toISOString() });
    }

    return json({ error: "Not found" }, 404);

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api]", msg);
    return json({ error: msg }, 500);
  }
});

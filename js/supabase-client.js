/* ============================================
   Supabase 클라이언트 설정
   ⚠️ SUPABASE_URL, SUPABASE_ANON_KEY를 실제 값으로 교체
      Supabase 대시보드 → Settings → API 에서 확인
   ============================================ */

// Supabase JS CDN (index.html에서 로드됨)
// Settings → API → Project URL
const SUPABASE_URL = "https://bqlicfslwbvczscgpviq.supabase.co";

// Settings → API → anon (public) key
const SUPABASE_ANON_KEY = "sb_publishable_WGLpin7LyLCwVFcS64gizQ_cDTyUlNv";

// Edge Function 베이스 URL
const EDGE_BASE = `${SUPABASE_URL}/functions/v1/api`;


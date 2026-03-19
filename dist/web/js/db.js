/* ============================================
   DB - Supabase Edge Function 통신
   - Toss accessToken을 Authorization 헤더로 전달
   - localStorage ↔ Supabase 동기화
   ============================================ */
const DB = {

  _authHeader() {
    const token = TossAuth.getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },

  async _fetch(path, options = {}) {
    const res = await fetch(`${EDGE_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...this._authHeader(),
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  // ==================== 로그인 후 데이터 로드 ====================
  // Supabase에서 전체 데이터를 가져와 localStorage에 적용
  async loadFromCloud() {
    const data = await this._fetch('/user/data');

    if (data.profile) {
      // snake_case → camelCase 매핑 + tossLinked 복원
      const p = data.profile;
      const existing = Storage.getProfile() || {};
      Storage.saveProfile({
        ...existing,
        tossUserKey:        p.toss_user_key ?? existing.tossUserKey,
        tossLinked:         true,
        nickname:           p.nickname           ?? existing.nickname,
        goal:               p.goal               ?? existing.goal,
        roleModel:          p.role_model         ?? existing.roleModel,
        wakeup:             p.wakeup             ?? existing.wakeup,
        sleep:              p.sleep              ?? existing.sleep,
        xp:                 p.xp                 ?? existing.xp ?? 0,
        premium:            p.premium            ?? existing.premium ?? false,
        premiumPlan:        p.premium_plan        ?? existing.premiumPlan,
        premiumExpiresAt:   p.premium_expires_at  ?? existing.premiumExpiresAt,
      });
    }

    if (data.habits?.length) {
      // 클라우드 habits와 로컬 habits 병합 (streak/stats 등 로컬 전용 필드 보존)
      const localHabits = Storage.getHabits();
      const localMap = Object.fromEntries(localHabits.map(h => [h.id, h]));
      const cloudIds = new Set(data.habits.map(h => h.id));
      const merged = data.habits.map(h => {
        const local = localMap[h.id] || {};
        // 로컬에 없는 경우 RichDB에서 timeSlot 등 기본 템플릿 복원
        const template = !localMap[h.id] ? (RichDB.getHabitById(h.id) || {}) : {};
        return {
          ...template,
          ...local,
          id:       h.id,
          name:     h.name,
          category: h.category,
          icon:     h.icon,
          enabled:  h.enabled ?? true,
        };
      });
      // 클라우드에 아직 없는 로컬 전용 습관 보존 (아직 동기화 전 신규 추가 항목)
      const localOnly = localHabits.filter(h => !cloudIds.has(h.id));
      Storage.saveHabits([...merged, ...localOnly]);
    }

    if (data.records?.length) {
      // records 배열 → { date: { habitId: { done, completedAt } } } 형태로 변환
      const records = {};
      for (const r of data.records) {
        if (!records[r.date]) records[r.date] = {};
        records[r.date][r.habit_id] = { done: r.done, completedAt: r.done_at ?? null };
      }
      Storage.saveRecords(records);
    }

    return data;
  },

  // ==================== 데이터 저장 (전체 동기화) ====================
  async syncToCloud() {
    const profile = Storage.getProfile();
    if (!profile?.tossLinked) return;
    if (!TossAuth.isLoggedIn()) return; // 토큰 만료 시 스킵

    const habits  = Storage.getHabits();
    const rawRecords = Storage.getRecords();

    // records 객체 → 배열로 변환 (값은 { done, completedAt } 객체)
    const records = [];
    for (const [date, dayData] of Object.entries(rawRecords)) {
      for (const [habitId, r] of Object.entries(dayData)) {
        records.push({
          date,
          habit_id: habitId,
          done:     r?.done     ?? false,
          done_at:  r?.completedAt ?? null,
        });
      }
    }

    const { tossUserKey, tossLinked, ...profileData } = profile;
    await this._fetch('/user/data', {
      method: 'POST',
      body: JSON.stringify({ profile: profileData, habits, records }),
    });
  },

  // ==================== 변경 시마다 호출 (디바운스) ====================
  _syncTimer: null,
  scheduleSyncToCloud() {
    clearTimeout(this._syncTimer);
    this._syncTimer = setTimeout(() => this.syncToCloud(), 2000);
  },

  // ==================== DEV 전용: 콘솔 테스트 ====================
  // 사용법: DB.devTest('test-user-001')
  async devTest(devUserKey = 'dev-test-001') {
    const headers = {
      'Content-Type': 'application/json',
      'x-dev-userkey': devUserKey,
    };

    console.group('[DB.devTest]');

    // 1) 테스트 데이터 저장
    const testPayload = {
      profile: { nickname: '테스트유저', goal: '3억', xp: 100 },
      habits:  [{ id: 'h1', name: '독서 30분', category: 'learning', icon: '📚', sort_order: 0 }],
      records: [{ date: new Date().toISOString().slice(0, 10), habit_id: 'h1', done: true }],
    };

    console.log('▶ POST /user/data', testPayload);
    const saveRes = await fetch(`${EDGE_BASE}/user/data`, {
      method: 'POST', headers, body: JSON.stringify(testPayload),
    });
    console.log('저장 결과:', saveRes.status, await saveRes.json());

    // 2) 저장한 데이터 다시 로드
    console.log('▶ GET /user/data');
    const loadRes = await fetch(`${EDGE_BASE}/user/data`, { headers });
    const loaded = await loadRes.json();
    console.log('조회 결과:', loaded);

    console.groupEnd();
    return loaded;
  },
};

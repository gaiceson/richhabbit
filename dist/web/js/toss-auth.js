/* ============================================
   TossAuth - 토스 로그인 OAuth2 클라이언트
   - Supabase Edge Function(/api/auth/*) 경유로 mTLS 호출
   - 토큰은 sessionStorage에 저장 (탭 닫으면 자동 삭제)
   ============================================ */
const TossAuth = {
  SESSION_KEY: 'toss_session',

  // ==================== 토큰 저장/조회 ====================
  _save(data) {
    localStorage.setItem(this.SESSION_KEY, JSON.stringify({
      accessToken:  data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt:    Date.now() + (data.expiresIn || 3600) * 1000,
      userKey:      data.userKey || null,
    }));
  },

  _load() {
    try { return JSON.parse(localStorage.getItem(this.SESSION_KEY)); }
    catch { return null; }
  },

  _clear() { localStorage.removeItem(this.SESSION_KEY); },

  isLoggedIn() {
    const s = this._load();
    return !!(s?.accessToken && Date.now() < s.expiresAt);
  },

  getAccessToken() { return this._load()?.accessToken ?? null; },

  // ==================== 내부: 유효 토큰 (자동 갱신) ====================
  async _validToken() {
    const s = this._load();
    if (!s) throw new Error('Not logged in');
    if (Date.now() > s.expiresAt - 5 * 60 * 1000) {
      return (await this.refreshToken()).accessToken;
    }
    return s.accessToken;
  },

  _authHeader() {
    return { Authorization: `Bearer ${this.getAccessToken()}` };
  },

  async _post(path, body) {
    const res = await fetch(`${EDGE_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },

  async _get(path) {
    const token = await this._validToken();
    const res = await fetch(`${EDGE_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },

  // ==================== 1) generateOauth2Token ====================
  async generateToken(authorizationCode, referrer) {
    const data = await this._post('/auth/token', { authorizationCode, referrer });
    this._save(data);
    return data;
  },

  // ==================== 2) refreshOauth2Token ====================
  async refreshToken() {
    const s = this._load();
    if (!s?.refreshToken) throw new Error('No refresh token');
    const data = await this._post('/auth/refresh', { refreshToken: s.refreshToken });
    this._save(data);
    return data;
  },

  // ==================== 3) loginMe ====================
  async getMe() {
    return this._get('/auth/me');
  },

  // ==================== 4) removeByAccessToken ====================
  async disconnectByToken() {
    const accessToken = this.getAccessToken();
    if (!accessToken) throw new Error('No access token');
    const data = await this._post('/auth/disconnect/token', { accessToken });
    this._clear();
    return data;
  },

  // ==================== 5) removeByUserKey ====================
  async disconnectByUserKey(userKey) {
    userKey = userKey || this._load()?.userKey;
    if (!userKey) throw new Error('No userKey');
    const data = await this._post('/auth/disconnect/user', { userKey });
    this._clear();
    return data;
  },

  // ==================== 로그인 (appLogin 기반) ====================
  async login() {
    if (typeof window.appLogin !== 'function') {
      console.warn('[TossAuth] appLogin 없음 — Apps-in-Toss 환경에서 실행하세요.');
      return false;
    }

    try {
      // 1. appLogin() → authorizationCode
      const { authorizationCode, referrer } = await window.appLogin();

      // 2. 토큰 발급
      await this.generateToken(authorizationCode, referrer);

      // 3. 사용자 정보 조회
      const user = await this.getMe();

      // 4. userKey 세션 저장
      const s = this._load();
      this._save({ ...s, userKey: user.userKey });

      // 5. 프로필에 Toss 연동 정보 저장
      const profile = Storage.getProfile() || {};
      Storage.saveProfile({ ...profile, tossUserKey: user.userKey, tossLinked: true });

      // 6. 기존 로컬 데이터 → DB 업로드 (첫 로그인 시 데이터 보존)
      await DB.syncToCloud();

      // 7. DB 최신 데이터 로드
      await DB.loadFromCloud();

      return user;
    } catch (e) {
      console.error('[TossAuth] 로그인 실패:', e.message);
      return false;
    }
  },

  // ==================== 로그아웃 ====================
  async logout() {
    try { await this.disconnectByToken(); }
    catch { this._clear(); }

    const profile = Storage.getProfile() || {};
    Storage.saveProfile({ ...profile, tossUserKey: null, tossLinked: false });
  },
};

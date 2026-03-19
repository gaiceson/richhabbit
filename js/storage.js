/* ============================================
   Storage - localStorage 래퍼
   ============================================ */
const Storage = {
  PREFIX: 'rh_',

  save(key, data) {
    try {
      localStorage.setItem(this.PREFIX + key, JSON.stringify(data));
    } catch (e) {
      console.warn('Storage save failed:', e);
    }
  },

  load(key, defaultValue) {
    try {
      const raw = localStorage.getItem(this.PREFIX + key);
      return raw ? JSON.parse(raw) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  },

  remove(key) {
    localStorage.removeItem(this.PREFIX + key);
  },

  getProfile() {
    return this.load('profile', null);
  },

  saveProfile(profile) {
    this.save('profile', profile);
    if (typeof DB !== 'undefined') DB.scheduleSyncToCloud();
  },

  getHabits() {
    return this.load('habits', []);
  },

  saveHabits(habits) {
    this.save('habits', habits);
    if (typeof DB !== 'undefined') DB.scheduleSyncToCloud();
  },

  getRecords() {
    return this.load('records', {});
  },

  saveRecords(records) {
    this.save('records', records);
    if (typeof DB !== 'undefined') DB.scheduleSyncToCloud();
  },

  getToday() {
    const d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  },

  // 로컬 날짜 기준 YYYY-MM-DD 생성 헬퍼
  formatDate(date) {
    return date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  },

  isOnboarded() {
    return this.getProfile() !== null;
  }
};

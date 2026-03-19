/* ============================================
   Gamification - 레벨/뱃지/XP 시스템
   ============================================ */
const Gamification = {
  LEVELS: [
    { level: 1, name: '씨앗', nameEn: 'Seed', emoji: '\u{1F331}', minXP: 0 },
    { level: 2, name: '새싹', nameEn: 'Sprout', emoji: '\u{1F33F}', minXP: 200 },
    { level: 3, name: '나무', nameEn: 'Tree', emoji: '\u{1F333}', minXP: 500 },
    { level: 4, name: '숲', nameEn: 'Forest', emoji: '\u{1F332}', minXP: 1000 },
    { level: 5, name: '산', nameEn: 'Mountain', emoji: '\u{26F0}\u{FE0F}', minXP: 2000 },
    { level: 6, name: '대양', nameEn: 'Ocean', emoji: '\u{1F30A}', minXP: 5000 },
  ],

  BADGES: [
    { id: 'first_step', name: '첫 발자국', emoji: '\u{1F463}', desc: '모든 부자도 첫 걸음부터 시작했어요', condition: 'first_complete' },
    { id: 'week_warrior', name: '7일 전사', emoji: '\u{1F525}', desc: '일주일의 꾸준함, 부자의 기본기!', condition: 'streak_7' },
    { id: 'habit_former', name: '21일 습관 형성자', emoji: '\u{1F3AF}', desc: '과학적 습관 형성 기간 돌파!', condition: 'streak_21' },
    { id: 'master_66', name: '66일 마스터', emoji: '\u{1F451}', desc: '이제 이건 당신의 DNA예요', condition: 'streak_66' },
    { id: 'reader', name: '독서왕', emoji: '\u{1F4DA}', desc: '워렌 버핏이 인정할 독서량!', condition: 'reading_100h' },
    { id: 'all_clear', name: '올 클리어', emoji: '\u{2B50}', desc: '완벽한 하루를 만드는 힘', condition: 'all_clear_10' },
    { id: 'morning_rich', name: '아침형 부자', emoji: '\u{1F305}', desc: '팀 쿡처럼 아침을 지배하다', condition: 'early_30' },
    { id: 'saver_master', name: '저축 마스터', emoji: '\u{1F4B0}', desc: '복리의 마법을 시작한 당신', condition: 'saving_90' },
  ],

  addXP(amount) {
    const profile = Storage.getProfile();
    if (!profile) return;
    const oldLevel = this.getLevel(profile.xp);
    profile.xp = (profile.xp || 0) + amount;
    const newLevel = this.getLevel(profile.xp);
    profile.level = newLevel.level;
    Storage.saveProfile(profile);
    if (newLevel.level > oldLevel.level) {
      return { levelUp: true, oldLevel, newLevel };
    }
    return { levelUp: false };
  },

  getLevel(xp) {
    let current = this.LEVELS[0];
    for (const lvl of this.LEVELS) {
      if (xp >= lvl.minXP) current = lvl;
    }
    return current;
  },

  getNextLevel(xp) {
    for (const lvl of this.LEVELS) {
      if (xp < lvl.minXP) return lvl;
    }
    return null;
  },

  getXPProgress(xp) {
    const current = this.getLevel(xp);
    const next = this.getNextLevel(xp);
    if (!next) return { percent: 100, current: xp, needed: current.minXP };
    const range = next.minXP - current.minXP;
    const progress = xp - current.minXP;
    return { percent: Math.round((progress / range) * 100), current: progress, needed: range };
  },

  checkBadges() {
    const profile = Storage.getProfile();
    if (!profile) return [];
    const records = Storage.getRecords();
    const habits = Storage.getHabits();
    const earned = profile.badges || [];
    const newBadges = [];

    const totalCompleted = Object.values(records).reduce((sum, day) => {
      return sum + Object.values(day).filter(r => r.done).length;
    }, 0);
    const maxStreak = this._getMaxStreak(records, habits);
    const allClearCount = this._getAllClearCount(records, habits);

    if (totalCompleted >= 1 && !earned.includes('first_step')) {
      newBadges.push('first_step');
    }
    if (maxStreak >= 7 && !earned.includes('week_warrior')) {
      newBadges.push('week_warrior');
    }
    if (maxStreak >= 21 && !earned.includes('habit_former')) {
      newBadges.push('habit_former');
    }
    if (maxStreak >= 66 && !earned.includes('master_66')) {
      newBadges.push('master_66');
    }
    if (allClearCount >= 10 && !earned.includes('all_clear')) {
      newBadges.push('all_clear');
    }

    if (newBadges.length > 0) {
      profile.badges = [...earned, ...newBadges];
      Storage.saveProfile(profile);
    }

    return newBadges.map(id => this.BADGES.find(b => b.id === id));
  },

  _getMaxStreak(records, habits) {
    if (!habits.length) return 0;
    let currentStreak = 0;
    const today = new Date();
    let startOffset = 0;

    // 오늘 기록이 없으면 어제부터 카운트
    const todayKey = Storage.formatDate(today);
    const todayRecords = records[todayKey];
    if (!todayRecords || Object.values(todayRecords).filter(r => r.done).length === 0) {
      startOffset = 1;
    }

    for (let i = startOffset; i < 200; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = Storage.formatDate(d);
      const dayRecords = records[key];
      if (dayRecords) {
        const completed = Object.values(dayRecords).filter(r => r.done).length;
        if (completed > 0) {
          currentStreak++;
        } else {
          break;
        }
      } else {
        break;
      }
    }
    return currentStreak;
  },

  _getAllClearCount(records, habits) {
    if (!habits.length) return 0;
    let count = 0;
    for (const [date, dayRecords] of Object.entries(records)) {
      const completed = Object.values(dayRecords).filter(r => r.done).length;
      if (completed >= habits.length) count++;
    }
    return count;
  },

  getCurrentStreak() {
    const records = Storage.getRecords();
    const habits = Storage.getHabits();
    return this._getMaxStreak(records, habits);
  },

  getBadgeById(id) {
    return this.BADGES.find(b => b.id === id);
  }
};

/* ============================================
   Habit Manager - 습관 CRUD
   ============================================ */
const HabitManager = {
  initFromRoleModel(roleModelId) {
    const packageHabits = RichDB.getPackageHabits(roleModelId);
    const person = RichDB.PEOPLE.find(p => p.id === roleModelId);
    const habits = packageHabits.map(h => {
      const richPeople = h.richPeople ? [...h.richPeople] : [];
      if (person) {
        const idx = richPeople.indexOf(person.name);
        if (idx > 0) { richPeople.splice(idx, 1); richPeople.unshift(person.name); }
        else if (idx === -1) richPeople.unshift(person.name);
      }
      return {
        ...h,
        richPeople,
        createdAt: new Date().toISOString(),
        streak: 0,
        totalCompleted: 0,
        bestStreak: 0,
      };
    });
    Storage.saveHabits(habits);
    return habits;
  },

  getAll() {
    return Storage.getHabits();
  },

  // 습관 추가 (무료 사용자 3개 제한 체크, force=true 시 한도 무시)
  addHabit(habit, { force = false } = {}) {
    if (!force && !Payment.canAddHabit()) {
      return { success: false, reason: 'habit_limit' };
    }
    const habits = Storage.getHabits();
    habits.push({
      ...habit,
      createdAt: new Date().toISOString(),
      streak: 0,
      totalCompleted: 0,
      bestStreak: 0,
    });
    Storage.saveHabits(habits);
    return { success: true };
  },

  // 습관 삭제
  removeHabit(habitId) {
    const habits = Storage.getHabits().filter(h => h.id !== habitId);
    Storage.saveHabits(habits);
  },

  getByTimeSlot(slot) {
    return this.getAll().filter(h => h.timeSlot === slot);
  },

  isCompletedToday(habitId) {
    const today = Storage.getToday();
    const records = Storage.getRecords();
    return records[today]?.[habitId]?.done === true;
  },

  complete(habitId) {
    const records = Storage.getRecords();
    const today = Storage.getToday();
    if (!records[today]) records[today] = {};
    records[today][habitId] = {
      done: true,
      completedAt: new Date().toISOString()
    };
    Storage.saveRecords(records);

    // 스트릭 업데이트
    const streak = this._updateStreak(habitId);

    // XP 부여
    let xp = 10;
    if (streak >= 7) xp += 5;
    if (streak >= 21) xp += 10;
    if (streak >= 66) xp += 15;
    const levelResult = Gamification.addXP(xp);

    // 오늘 누적 XP 추적
    const todayKey = Storage.getToday();
    const todayXPStore = Storage.load('today_xp', {});
    todayXPStore[todayKey] = (todayXPStore[todayKey] || 0) + xp;
    Storage.save('today_xp', todayXPStore);

    // AI 코칭 메시지
    const coachMsg = AICoach.getCompletionMessage(habitId, streak);

    // 뱃지 체크
    const newBadges = Gamification.checkBadges();

    return { streak, coachMsg, levelResult, newBadges };
  },

  uncomplete(habitId) {
    const records = Storage.getRecords();
    const today = Storage.getToday();
    if (records[today]?.[habitId]) {
      delete records[today][habitId];
      Storage.saveRecords(records);
    }
  },

  getTodayProgress() {
    const habits = this.getAll();
    if (habits.length === 0) return { done: 0, total: 0, percent: 0 };
    const today = Storage.getToday();
    const records = Storage.getRecords();
    const dayRecords = records[today] || {};
    const done = habits.filter(h => dayRecords[h.id]?.done).length;
    return {
      done,
      total: habits.length,
      percent: Math.round((done / habits.length) * 100)
    };
  },

  getWeeklyData(baseDate) {
    const habits = this.getAll();
    const habitIds = new Set(habits.map(h => h.id));
    const records = Storage.getRecords();
    const data = [];
    const ref = baseDate ? new Date(baseDate) : new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(ref);
      d.setDate(d.getDate() - i);
      const key = Storage.formatDate(d);
      const dayRecords = records[key] || {};
      const done = Object.entries(dayRecords).filter(([id, r]) => habitIds.has(id) && r.done).length;
      const percent = habits.length > 0 ? Math.round((done / habits.length) * 100) : 0;
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      data.push({
        date: key,
        day: dayNames[d.getDay()],
        done,
        total: habits.length,
        percent
      });
    }
    return data;
  },

  getMonthlyData(year, month) {
    const records = Storage.getRecords();
    const habits = this.getAll();
    const habitIds = new Set(habits.map(h => h.id));
    const today = new Date();
    const yr = year != null ? year : today.getFullYear();
    const mo = month != null ? month : today.getMonth();
    const firstDay = new Date(yr, mo, 1);
    const lastDay = new Date(yr, mo + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const data = [];

    // 앞의 빈 칸
    for (let i = 0; i < startDayOfWeek; i++) {
      data.push({ empty: true });
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${yr}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayRecords = records[dateStr] || {};
      const done = Object.entries(dayRecords).filter(([id, r]) => habitIds.has(id) && r.done).length;
      const total = habits.length || 1;
      const ratio = done / total;
      let level = 0;
      if (ratio > 0) level = 1;
      if (ratio >= 0.5) level = 2;
      if (ratio >= 0.75) level = 3;
      if (ratio >= 1) level = 4;

      const isToday = dateStr === Storage.getToday();
      const todayStr = Storage.getToday();
      const isFuture = dateStr > todayStr;

      data.push({ date: dateStr, day: d, level, isToday, isFuture });
    }
    return data;
  },

  _updateStreak(habitId) {
    const records = Storage.getRecords();
    const today = new Date();
    let streak = 0;

    for (let i = 0; i < 500; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = Storage.formatDate(d);
      if (records[key]?.[habitId]?.done) {
        streak++;
      } else {
        break;
      }
    }

    // 습관 데이터 업데이트
    const habits = Storage.getHabits();
    const idx = habits.findIndex(h => h.id === habitId);
    if (idx >= 0) {
      habits[idx].streak = streak;
      habits[idx].totalCompleted = (habits[idx].totalCompleted || 0) + 1;
      if (streak > (habits[idx].bestStreak || 0)) {
        habits[idx].bestStreak = streak;
      }
      Storage.saveHabits(habits);
    }

    return streak;
  },

  getTodayXP() {
    const todayKey = Storage.getToday();
    const todayXPStore = Storage.load('today_xp', {});
    return todayXPStore[todayKey] || 0;
  },

  getAllClearStreak() {
    const habits = this.getAll();
    if (habits.length === 0) return 0;
    const records = Storage.getRecords();
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = Storage.formatDate(d);
      const dayRecords = records[key] || {};
      const doneAll = habits.every(h => dayRecords[h.id]?.done);
      if (doneAll) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  },

  getBestStreak() {
    const habits = this.getAll();
    return Math.max(0, ...habits.map(h => h.bestStreak || 0));
  },

  getTotalCompleted() {
    const habitIds = new Set(this.getAll().map(h => h.id));
    const records = Storage.getRecords();
    let total = 0;
    for (const day of Object.values(records)) {
      total += Object.entries(day).filter(([id, r]) => habitIds.has(id) && r.done).length;
    }
    return total;
  },

  getTotalDays() {
    const habitIds = new Set(this.getAll().map(h => h.id));
    const records = Storage.getRecords();
    return Object.keys(records).filter(date => {
      return Object.entries(records[date]).some(([id, r]) => habitIds.has(id) && r.done);
    }).length;
  }
};

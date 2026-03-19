/* ============================================
   AI Coach - AI 코칭 엔진
   토스 UX 라이팅: 해요체, 능동형, 긍정적
   ============================================ */
const AICoach = {
  getDailyMessage(profile) {
    const hour = new Date().getHours();
    const streak = Gamification.getCurrentStreak();
    const rate = this._getWeeklyRate();
    const quote = RichDB.getTimeBasedQuote(hour);
    const roleModel = RichDB.getPersonById(profile.roleModel);
    const name = profile.nickname || '오늘부터부자러';

    if (hour < 9) {
      return this._morningMsg(name, streak, quote, roleModel);
    } else if (hour < 18) {
      return this._afternoonMsg(name, rate, quote);
    } else {
      return this._eveningMsg(name, rate, streak, quote);
    }
  },

  _morningMsg(name, streak, quote, roleModel) {
    const msgs = [
      `${name}님, 좋은 아침이에요! ${roleModel ? roleModel.name + '도 아침을 이렇게 시작했어요.' : '오늘도 부자 습관을 실천해봐요.'}`,
      `${name}님, 오늘의 부자 인사이트: "${quote.text}" - ${quote.author}`,
      `${name}님, ${streak > 0 ? streak + '일 연속 달성 중이에요! 오늘도 이어가봐요.' : '오늘 첫 습관을 시작해봐요!'}`,
    ];
    return msgs[Math.floor(Math.random() * msgs.length)];
  },

  _afternoonMsg(name, rate, quote) {
    if (rate >= 70) {
      return `${name}님, 이번 주 달성률 ${rate}%! 멋진 페이스예요. "${quote.text}" - ${quote.author}`;
    }
    return `${name}님, 아직 오늘 할 수 있는 습관이 남았어요. 하나씩 해봐요!`;
  },

  _eveningMsg(name, rate, streak, quote) {
    const habits = Storage.getHabits();
    const habitIds = new Set(habits.map(h => h.id));
    const todayRecords = Storage.getRecords()[Storage.getToday()] || {};
    const todayDone = Object.entries(todayRecords).filter(([id, r]) => habitIds.has(id) && r.done).length;
    const total = habits.length;

    if (todayDone >= total && total > 0) {
      return `${name}님, 오늘 모든 습관을 완료했어요! 대단해요. 이 페이스면 부자의 길을 걷고 있어요.`;
    }
    if (todayDone > 0) {
      return `${name}님, 오늘 ${todayDone}개 습관을 완료했어요. 자기 전에 남은 습관도 도전해봐요!`;
    }
    return `${name}님, 아직 시간이 있어요. 잠들기 전 하나라도 실천해봐요. "${quote.text}" - ${quote.author}`;
  },

  getCompletionMessage(habitId, streak) {
    const habit = RichDB.getHabitById(habitId);
    if (!habit) return { message: '습관을 완료했어요!', richTip: '', xpGained: 10 };

    const richPerson = habit.richPeople[0] || '';
    let message = '';
    let richTip = '';
    let xpGained = 10 + Math.floor(streak / 7) * 5;

    if (streak === 1) {
      message = `"${habit.name}" 첫 실천이에요! 모든 부자도 이 첫 걸음에서 시작했어요.`;
      richTip = habit.richStat;
    } else if (streak === 7) {
      message = `7일 연속 달성! ${richPerson}도 인정할 꾸준함이에요.`;
      richTip = `${richPerson}의 비결: "${habit.quote}"`;
      xpGained += 20;
    } else if (streak === 21) {
      message = `21일 달성! 과학적으로 습관이 형성되는 기간을 돌파했어요!`;
      richTip = `${habit.science}`;
      xpGained += 50;
    } else if (streak === 66) {
      message = `66일 마스터! 이 습관은 이제 당신의 DNA예요. ${richPerson}처럼요!`;
      richTip = `${richPerson}의 철학이 당신 안에 살아 숨 쉬고 있어요.`;
      xpGained += 100;
    } else {
      const completionMsgs = [
        `"${habit.name}" 완료! ${habit.richStat}`,
        `멋져요! ${richPerson}도 이 습관을 매일 실천해요.`,
        `${streak}일 연속! 부자의 습관이 쌓이고 있어요.`,
        `오늘도 해냈어요! ${habit.science}`,
      ];
      message = completionMsgs[Math.floor(Math.random() * completionMsgs.length)];
      const story = RichDB.getRandomStory(habit.category);
      richTip = story ? `${story.person}: ${story.body.slice(0, 80)}...` : '';
    }

    return { message, richTip, xpGained };
  },

  generateWeeklyReport() {
    const records = Storage.getRecords();
    const habits = Storage.getHabits();
    const profile = Storage.getProfile();
    const rate = this._getWeeklyRate();
    const streak = Gamification.getCurrentStreak();
    const roleModel = RichDB.getPersonById(profile?.roleModel);

    let report = '';
    report += `<p>이번 주 달성률 <span class="ai-report-highlight">${rate}%</span>예요.</p>`;

    if (rate >= 90) {
      report += `<p>놀라운 성과예요! ${roleModel ? roleModel.name + '의 습관을 완벽하게 따라가고 있어요.' : '완벽에 가까운 실천이에요.'}</p>`;
    } else if (rate >= 60) {
      report += `<p>꾸준히 잘하고 있어요. 조금만 더 채워보면 부자 습관이 단단해질 거예요.</p>`;
    } else if (rate >= 30) {
      report += `<p>시작이 중요해요. 지금 페이스를 유지하면서 하나씩 더 추가해봐요.</p>`;
    } else {
      report += `<p>잠깐 쉬어가도 괜찮아요. 다시 시작하는 것도 부자의 습관이에요.</p>`;
    }

    if (streak > 0) {
      report += `<p>현재 <span class="ai-report-highlight">${streak}일</span> 연속 실천 중이에요!</p>`;
    }

    return report;
  },

  // ==================== 습관 점수 시스템 ====================
  calculateHabitScore() {
    const todayProgress = HabitManager.getTodayProgress();
    const weeklyRate = this._getWeeklyRate();
    const streak = Gamification.getCurrentStreak();
    const habits = HabitManager.getAll();
    const cats = new Set(habits.map(h => h.category || '기타'));
    const score = Math.round(
      weeklyRate * 0.5 +
      todayProgress.percent * 0.3 +
      Math.min(15, Math.floor(streak / 3)) +
      Math.min(5, cats.size)
    );
    return Math.min(100, score);
  },

  saveDailyScore() {
    const score = this.calculateHabitScore();
    const today = Storage.getToday();
    const history = Storage.load('score_history', {});
    history[today] = score;
    const keys = Object.keys(history).sort().slice(-90);
    const trimmed = {};
    keys.forEach(k => { trimmed[k] = history[k]; });
    Storage.save('score_history', trimmed);
    return score;
  },

  getScoreTrend() {
    const history = Storage.load('score_history', {});
    const dates = Object.keys(history).sort();
    if (dates.length === 0) return { current: this.calculateHabitScore(), diff: 0, days: 0 };
    const current = history[dates[dates.length - 1]];
    const prev = dates.length >= 2 ? history[dates[dates.length - 2]] : current;
    const first = history[dates[0]];
    return { current, diff: current - prev, totalDiff: current - first, days: dates.length, firstScore: first };
  },

  getWeeklyReportData() {
    const weeklyRate = this._getWeeklyRate();
    const prevRate = this._getPrevWeeklyRate();
    const score = this.calculateHabitScore();
    const prevScore = Math.round(prevRate * 0.8);
    const scoreDiff = score - prevScore;
    const slotRates = this._getSlotRates();
    const weekData = HabitManager.getWeeklyData(new Date());
    const bestDay = weekData.reduce((a, b) => a.percent >= b.percent ? a : b, { percent: 0, day: '-' });
    const streak = Gamification.getCurrentStreak();
    return {
      weeklyRate, prevRate, score, scoreDiff,
      bestDay, streak, slotRates,
      recommendation: this._getWeeklyRecommendation(weeklyRate, slotRates),
    };
  },

  _getPrevWeeklyRate() {
    const records = Storage.getRecords();
    const habits = Storage.getHabits();
    if (!habits.length) return 0;
    const habitIds = new Set(habits.map(h => h.id));
    let total = 0, done = 0;
    const today = new Date();
    for (let i = 7; i < 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      total += habits.length;
      const dayRecords = records[Storage.formatDate(d)] || {};
      done += Object.entries(dayRecords).filter(([id, r]) => habitIds.has(id) && r.done).length;
    }
    return total > 0 ? Math.round(done / total * 100) : 0;
  },

  _getWeeklyRecommendation(weeklyRate, slotRates) {
    if (weeklyRate >= 80) return '이번 주 훌륭했어요! 다음 주엔 새로운 습관 하나를 추가해보세요.';
    if (slotRates.evening < 40) return '저녁 루틴이 취약해요. 저녁 습관 1개를 줄이고 완주율을 높여보세요.';
    if (weeklyRate < 50) return '가장 쉬운 습관 1개에 집중해보세요. 작은 성공이 연쇄를 만들어요.';
    return '꾸준히 유지 중이에요. 아침 루틴 집중이 전체 달성률을 높입니다.';
  },

  // ==================== AI 분석 엔진 ====================
  getAISummary() {
    const progress = HabitManager.getTodayProgress();
    const weeklyRate = this._getWeeklyRate();
    const grade = this._getGrade(progress.percent);
    const wealthType = this._getWealthType();
    const slotRates = this._getSlotRates();
    const rates = [slotRates.morning, slotRates.afternoon, slotRates.evening];
    const slotNames = ['아침', '낮', '저녁'];
    const weakIdx = rates.indexOf(Math.min(...rates));
    const weakSlot = slotNames[weakIdx];
    return { todayRate: progress.percent, grade, wealthType, weakSlot, weeklyRate, slotRates };
  },

  getDetailedAnalysis() {
    const summary = this.getAISummary();
    const weeklyRate = summary.weeklyRate;
    const streak = Gamification.getCurrentStreak();
    return {
      block1: this._getTodayAnalysis(summary),
      block2: this._getPatternAnalysis(summary),
      block3: summary.wealthType,
      block4: this._getFutureGrowth(weeklyRate, streak),
      block5: this._getAIRecommendation(summary),
      productivityScore: Math.round(weeklyRate * 0.7 + summary.todayRate * 0.3),
      summary,
    };
  },

  _getGrade(percent) {
    if (percent === 100) return { label: 'S', color: '#F59E0B' };
    if (percent >= 90)  return { label: 'A+', color: '#10B981' };
    if (percent >= 80)  return { label: 'A',  color: '#10B981' };
    if (percent >= 70)  return { label: 'B+', color: '#3182F6' };
    if (percent >= 60)  return { label: 'B',  color: '#3182F6' };
    if (percent >= 40)  return { label: 'C',  color: '#8B95A1' };
    if (percent > 0)    return { label: 'D',  color: '#8B95A1' };
    return { label: '-', color: '#8B95A1' };
  },

  _getWealthType() {
    const habits = HabitManager.getAll();
    const catCount = {};
    habits.forEach(h => { const c = h.category || '기타'; catCount[c] = (catCount[c] || 0) + 1; });
    const topCat = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    const MAP = {
      '독서/학습':  { name: '버핏형 장기 성장',    person: '워렌 버핏',   emoji: '📚', desc: '꾸준한 독서와 기록 습관이 강합니다.\n워렌 버핏과 비슷한 장기 축적형 성장 패턴입니다.' },
      '건강 관리':  { name: '머스크형 극한 생산성', person: '일론 머스크', emoji: '⚡', desc: '건강과 체력 관리가 탁월합니다.\n일론 머스크처럼 높은 에너지로 최대 성과를 내는 유형입니다.' },
      '재테크 습관':{ name: '게이츠형 전략적 성장', person: '빌 게이츠',  emoji: '💰', desc: '재테크와 자산 관리에 집중합니다.\n빌 게이츠처럼 전략적이고 체계적인 성장 패턴입니다.' },
      '마인드셋':   { name: '오프라형 내면 성장',   person: '오프라 윈프리', emoji: '🌟', desc: '마인드셋과 내면 성장이 핵심입니다.\n오프라 윈프리처럼 내면의 성장이 외면의 성공으로 이어지는 유형입니다.' },
      '시간 관리':  { name: '쿡형 새벽 지배자',     person: '팀 쿡',      emoji: '⏰', desc: '시간 관리와 효율성을 극대화합니다.\n팀 쿡처럼 철저한 루틴으로 아침을 지배하는 유형입니다.' },
    };
    return MAP[topCat] || { name: '균형형 성장', person: '', emoji: '⚖️', desc: '다양한 영역을 균형 있게 성장시키는 유형입니다.\n부자들의 다양한 습관을 고르게 실천하고 있어요.' };
  },

  _getSlotRates() {
    const habits = HabitManager.getAll();
    const records = Storage.getRecords();
    const slots = {
      morning:   { done: 0, total: 0 },
      afternoon: { done: 0, total: 0 },
      evening:   { done: 0, total: 0 },
    };
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = Storage.formatDate(d);
      const dayRecords = records[key] || {};
      habits.forEach(h => {
        const s = h.timeSlot || 'morning';
        if (slots[s]) {
          slots[s].total++;
          if (dayRecords[h.id]?.done) slots[s].done++;
        }
      });
    }
    return {
      morning:   slots.morning.total   > 0 ? Math.round(slots.morning.done   / slots.morning.total   * 100) : 0,
      afternoon: slots.afternoon.total > 0 ? Math.round(slots.afternoon.done / slots.afternoon.total * 100) : 0,
      evening:   slots.evening.total   > 0 ? Math.round(slots.evening.done   / slots.evening.total   * 100) : 0,
    };
  },

  _getTodayAnalysis(summary) {
    const { todayRate, slotRates } = summary;
    const topSlot = slotRates.morning >= slotRates.evening ? '아침' : '저녁';
    let text = `오늘 당신의 습관 달성률은 **${todayRate}%**입니다. `;
    if (todayRate >= 80) {
      text += `특히 ${topSlot} 루틴 성공률이 높아 생산성이 좋은 패턴입니다. 이 흐름을 유지하면 자기계발 습관이 안정적으로 자리 잡을 가능성이 높습니다.`;
    } else if (todayRate >= 50) {
      text += `오늘의 흐름을 이어가면 이번 주 달성률을 높일 수 있어요. 꾸준함이 복리처럼 쌓여갑니다.`;
    } else {
      text += `하나의 습관이 다음 습관을 만들어냅니다. 지금 시작해도 충분히 의미 있어요.`;
    }
    return text;
  },

  _getPatternAnalysis(summary) {
    const { slotRates } = summary;
    const patterns = [
      { slot: '아침', emoji: '🌅', rate: slotRates.morning },
      { slot: '낮',   emoji: '☀️', rate: slotRates.afternoon },
      { slot: '저녁', emoji: '🌙', rate: slotRates.evening },
    ];
    const comment = slotRates.morning >= slotRates.evening
      ? '당신은 아침형 습관 구조에 더 잘 맞습니다. 저녁 습관을 아침으로 이동하면 성공률이 올라갈 수 있습니다.'
      : '저녁 시간대에 집중력이 높은 유형입니다. 중요한 습관을 저녁에 배치하면 효과적입니다.';
    return { patterns, comment };
  },

  _getFutureGrowth(weeklyRate, streak) {
    return {
      sixMonthProb:  Math.min(95, Math.round(weeklyRate * 0.8 + streak * 0.5 + 10)),
      oneYearAsset:  Math.min(30, Math.round(weeklyRate / 100 * 20 + (streak > 21 ? 5 : 0))),
    };
  },

  _getAIRecommendation(summary) {
    const { slotRates, todayRate, weeklyRate } = summary;
    if (slotRates.evening < 50 && slotRates.morning > 70)
      return '저녁 루틴 성공률이 낮아요. 저녁 습관 하나를 아침으로 이동하거나 개수를 줄여보세요. 적게 설정하고 완주하는 것이 더 효과적이에요.';
    if (weeklyRate < 50)
      return '이번 주 달성률을 높이려면 가장 쉬운 습관 하나를 먼저 고정하세요. 작은 성공이 연쇄 달성을 만들어냅니다.';
    if (todayRate === 100)
      return '완벽한 하루예요! 이 페이스를 유지하면서 새로운 습관을 하나 추가해볼 시점이에요.';
    return '달성하지 못한 습관의 트리거를 점검해보세요. 특정 시간이나 장소와 연결하면 달성률이 올라갑니다.';
  },

  _getWeeklyRate() {
    const records = Storage.getRecords();
    const habits = Storage.getHabits();
    if (!habits.length) return 0;

    const habitIds = new Set(habits.map(h => h.id));
    let totalPossible = 0;
    let totalDone = 0;
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = Storage.formatDate(d);
      totalPossible += habits.length;
      const dayRecords = records[key] || {};
      totalDone += Object.entries(dayRecords).filter(([id, r]) => habitIds.has(id) && r.done).length;
    }

    return totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0;
  }
};

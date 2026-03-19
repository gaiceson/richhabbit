/* ============================================
   App - 앱 초기화, 라우팅, 이벤트
   ============================================ */
const App = {
  currentScreen: null,
  selectedGoal: null,
  selectedRole: null,
  selectedPlan: 'gold_monthly',

  init() {
    // IAP 초기화 (미지급 주문 복원 포함)
    Payment.init();


    if (Storage.isOnboarded()) {
      this.goToScreen('screen-home');
      document.getElementById('tab-bar').style.display = 'flex';
      this.renderHome();
      this._checkTomorrowBoostBanner();
      AdManager.init();

      // 로그인 상태면 DB에서 최신 데이터 로드 (백그라운드)
      this._syncFromCloud();
    } else {
      this.goToScreen('screen-onboarding-welcome');
    }
  },

  _syncFromCloud() {
    const profile = Storage.getProfile();
    if (!profile?.tossLinked) return;

    if (!TossAuth.isLoggedIn()) {
      // 이전에 연동했지만 토큰 만료 → 자동 재인증 (appLogin은 이전 동의 기반으로 즉시 반환)
      TossAuth.login()
        .then(user => {
          if (user) this._loadCloud();
        })
        .catch(e => console.warn('[autoLogin]', e.message));
      return;
    }

    this._loadCloud();
  },

  _loadCloud() {
    DB.loadFromCloud()
      .then(() => {
        this.renderHome();
        AdManager.init();
      })
      .catch(e => console.warn('[syncFromCloud]', e.message));
  },

  // ==================== 화면 전환 ====================
  goToScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add('active');
      target.scrollTop = 0;
      this.currentScreen = screenId;
    }

    // 탭바 가시성
    const mainScreens = ['screen-home', 'screen-stats', 'screen-simulator', 'screen-library', 'screen-profile'];
    const tabBar = document.getElementById('tab-bar');
    if (tabBar) {
      tabBar.style.display = mainScreens.includes(screenId) ? 'flex' : 'none';
    }

    // 홈 배너 광고: 홈 화면에서만 노출
    const adBanner = document.getElementById('ad-banner');
    if (adBanner) {
      if (screenId === 'screen-home' && !Payment.isPremium()) {
        adBanner.style.display = adBanner.innerHTML.trim() ? 'block' : 'none';
      } else {
        adBanner.style.display = 'none';
      }
    }

    // 화면별 렌더링
    if (screenId === 'screen-onboarding-role') this.renderRoleList();
    if (screenId === 'screen-home') this.renderHome();
    if (screenId === 'screen-stats') {
      Stats.refreshAll();
    }
    if (screenId === 'screen-simulator') this.renderSimulator();
    if (screenId === 'screen-library') this.renderLibrary();
    if (screenId === 'screen-profile') this.renderProfile();
  },

  switchTab(el) {
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    this.goToScreen(el.dataset.screen);
  },

  goHomeTab() {
    const tab = document.querySelector('[data-screen="screen-home"]');
    if (tab) this.switchTab(tab);
  },

  applyPersonGrowthHabit() {
    const personId = this._comparePersonId;
    if (!personId) return;

    // 가장 약한 메트릭 찾기
    const metrics = (this._PERSON_METRICS[personId] || []).map(m => ({
      ...m, rate: this._getMetricRate(m), pct: this._rateToTopPct(this._getMetricRate(m)),
    }));
    const worst = metrics.filter(m => m.pct !== null).reduce((a, b) => (!a || b.pct > a.pct ? b : a), null)
      || metrics[metrics.length - 1]; // 모두 null이면 마지막 메트릭

    // 해당 메트릭 카테고리에 속하는 습관만 필터
    const packageHabits = RichDB.getPackageHabits(personId);
    const candidates = worst
      ? packageHabits.filter(h =>
          worst.type === 'slot'
            ? (h.timeSlot || 'morning') === worst.category
            : h.category === worst.category
        )
      : [];
    const habitsToAdd = candidates.length > 0 ? candidates : packageHabits.slice(0, 1);

    const existingIds = new Set(HabitManager.getAll().map(h => h.id));
    const person = RichDB.PEOPLE.find(p => p.id === personId);
    let added = 0;

    for (const template of habitsToAdd) {
      if (existingIds.has(template.id)) continue;
      if (!Payment.canAddHabit()) break;
      const richPeople = template.richPeople ? [...template.richPeople] : [];
      if (person) {
        const idx = richPeople.indexOf(person.name);
        if (idx > 0) { richPeople.splice(idx, 1); richPeople.unshift(person.name); }
        else if (idx === -1) richPeople.unshift(person.name);
      }
      HabitManager.addHabit({ ...template, richPeople });
      existingIds.add(template.id);
      added++;
    }

    this.goHomeTab();
    this._showToast(added > 0 ? `성장 루틴 ${added}개 추가됐어요 🔥` : '해당 루틴이 이미 등록되어 있어요');
  },

  // ==================== 내일 점수 부스트 ====================
  openTomorrowBoost() {
    // 기존 모달 먼저 닫기
    this.closeModal('modal-compare-result');
    this.closeModal('modal-compare-teaser');

    const personId = this._comparePersonId;
    const analysis = this._PERSON_ANALYSIS[personId] || {};
    const score = AICoach.saveDailyScore();

    const recommendations = this._getTomorrowBoostRecommendations(personId, analysis);

    const weaknessBadge = document.getElementById('tboost-weakness-badge');
    if (weaknessBadge) weaknessBadge.textContent = `현재 부족한 부분: ${analysis.weakness || '루틴 보완 필요'}`;

    const expectedScore = document.getElementById('tboost-expected-score');
    if (expectedScore) expectedScore.textContent = Math.min(100, score + 10);

    const optionsEl = document.getElementById('tboost-options');
    if (optionsEl) {
      optionsEl.innerHTML = recommendations.map((r, i) => `
        <button class="tboost-option${i === 0 ? ' tboost-option-primary' : ''}"
          data-habit-id="${r.id}" data-habit-name="${r.name}" data-points="${r.points}">
          <span class="tboost-option-name">${i === 0 ? '🔥 ' : '💡 '}${r.name}</span>
          <span class="tboost-option-pts">+${r.points}점</span>
        </button>
      `).join('');

      // 이벤트 위임으로 클릭 처리
      optionsEl.onclick = (e) => {
        const btn = e.target.closest('[data-habit-id]');
        if (!btn) return;
        this.selectTomorrowRoutine(btn.dataset.habitId, btn.dataset.habitName, Number(btn.dataset.points));
      };
    }

    document.getElementById('tboost-step1').style.display = '';
    document.getElementById('tboost-step3').style.display = 'none';
    document.getElementById('modal-tomorrow-boost').style.display = 'flex';
  },

  _getTomorrowBoostRecommendations(personId, analysis) {
    const packageHabits = RichDB.getPackageHabits(personId);
    const existing = new Set(HabitManager.getAll().map(h => h.id));
    const available = packageHabits.filter(h => !existing.has(h.id));

    // 1순위: growthAction에 해당하는 루틴
    const primary = available[0] || packageHabits[0] || { id: 'early_rise', name: '아침 루틴 1개 추가', points: 7 };
    // 2순위: 다른 시간대 루틴
    const secondary = available.find(h => h.timeSlot !== (primary.timeSlot || 'morning'))
      || available[1]
      || { id: 'deep_work', name: '집중 루틴 1개 추가', points: 3 };

    return [
      { id: primary.id, name: primary.name, points: 7 },
      { id: secondary.id || 'deep_work', name: secondary.name || '집중 루틴 1개 추가', points: 3 },
    ];
  },

  selectTomorrowRoutine(habitId, habitName, points) {
    const score = AICoach.saveDailyScore();
    const targetScore = Math.min(100, score + points);
    const today = new Date().toISOString().slice(0, 10);

    // 즉시 습관 추가 (부스트 플로우는 한도 체크 없이 추가)
    const existing = HabitManager.getAll().find(h => h.id === habitId);
    if (!existing) {
      const template = RichDB.HABITS.find(h => h.id === habitId);
      if (template) {
        HabitManager.addHabit(template, { force: true });
      }
    }

    // 예약 저장
    Storage.save('tomorrow_boost', {
      date: today,
      habitId,
      habitName,
      points,
      targetScore,
      done: false,
    });

    // Step3 표시
    document.getElementById('tboost-step1').style.display = 'none';
    document.getElementById('tboost-step3').style.display = '';
    document.getElementById('tboost-done-desc').textContent =
      `👉 내일 '${habitName}'을 달성하면 +${points}점 반영됩니다`;
    document.getElementById('tboost-done-target').textContent =
      `🔥 내일 목표 점수: ${targetScore}점`;
  },

  _closeTomorrowBoostOnOverlay(e) {
    if (e.target === document.getElementById('modal-tomorrow-boost')) {
      this.closeModal('modal-tomorrow-boost');
    }
  },

  _checkTomorrowBoostBanner() {
    const boost = Storage.load('tomorrow_boost', null);
    if (!boost || boost.done) return;
    const today = new Date().toISOString().slice(0, 10);
    // 어제 예약한 것만 표시
    if (boost.date >= today) return;

    const banner = document.getElementById('tomorrow-boost-banner');
    if (!banner) return;
    document.getElementById('tboost-banner-name').textContent = boost.habitName;
    document.getElementById('tboost-banner-reward').textContent = `완료 시 +${boost.points}점 확정`;
    banner.style.display = 'block';
  },

  executeTomorrowBoost() {
    const boost = Storage.load('tomorrow_boost', null);
    if (!boost) return;

    // 루틴 추가 (없는 경우에만)
    const existing = HabitManager.getAll().find(h => h.id === boost.habitId);
    if (!existing) {
      const template = (RichDB.HABITS || []).find(h => h.id === boost.habitId);
      if (template && Payment.canAddHabit()) {
        HabitManager.addHabit(template);
      }
    }

    // 예약 완료 처리
    boost.done = true;
    Storage.save('tomorrow_boost', boost);
    document.getElementById('tomorrow-boost-banner').style.display = 'none';

    this._showToast(`+${boost.points}점 반영 중 🔥`);
    this.goHomeTab();
  },

  // ==================== 온보딩 ====================
  selectGoal(el) {
    document.querySelectorAll('.goal-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    this.selectedGoal = el.dataset.goal;
    document.getElementById('btn-goal-next').disabled = false;
  },

  renderRoleList() {
    const container = document.getElementById('role-list');
    container.innerHTML = RichDB.PEOPLE.map(p => `
      <button class="role-card ${this.selectedRole === p.id ? 'selected' : ''}" data-role="${p.id}" onclick="App.selectRole(this)">
        <div class="role-avatar">${p.emoji}</div>
        <div class="role-info">
          <div class="role-name">${p.name}</div>
          <div class="role-desc">${p.title} | ${p.netWorth}</div>
          <div class="role-habits-preview">${p.packageName}: ${RichDB.getPackageHabits(p.id).slice(0, 3).map(h => h.name).join(', ')}...</div>
        </div>
      </button>
    `).join('');
  },

  selectRole(el) {
    document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    this.selectedRole = el.dataset.role;
    document.getElementById('btn-role-next').disabled = false;
  },

  completeOnboarding() {
    const nickname = document.getElementById('input-nickname').value.trim() || '오늘부터부자러';
    const wakeup = document.getElementById('input-wakeup').value;
    const sleep = document.getElementById('input-sleep').value;
    const job = document.getElementById('input-job').value;

    const profile = {
      nickname,
      targetWealth: this.selectedGoal || '3억',
      roleModel: this.selectedRole || 'warren_buffett',
      wakeup,
      sleep,
      job,
      xp: 0,
      level: 1,
      badges: [],
      currentIncome: 4000,
      currentSavings: 500,
      createdAt: new Date().toISOString(),
    };

    Storage.saveProfile(profile);
    HabitManager.initFromRoleModel(profile.roleModel);

    document.getElementById('tab-bar').style.display = 'flex';
    this.goToScreen('screen-home');

    // 광고 초기화
    AdManager.init();
  },

  // ==================== 홈 ====================
  renderHome() {
    const profile = Storage.getProfile();
    if (!profile) return;

    // 프리미엄 뱃지
    const premiumBadge = document.getElementById('home-premium-badge');
    if (premiumBadge) {
      premiumBadge.style.display = Payment.isPremium() ? 'inline-block' : 'none';
    }

    // 레벨 뱃지
    const level = Gamification.getLevel(profile.xp || 0);
    document.getElementById('home-level-badge').textContent = `${level.emoji} ${level.name}`;

    // AI 코칭
    document.getElementById('coach-message').textContent = AICoach.getDailyMessage(profile);

    // 오늘의 명언
    const quote = RichDB.getTimeBasedQuote(new Date().getHours());
    document.getElementById('quote-text').textContent = quote.text;
    document.getElementById('quote-author').textContent = `- ${quote.author}`;

    // 달성률
    const progress = HabitManager.getTodayProgress();
    document.getElementById('today-percent').textContent = progress.percent + '%';
    document.getElementById('today-progress').style.width = progress.percent + '%';

    // 자산 게이지
    try {
      const habits = HabitManager.getAll();
      const richHabits = habits.map(h => RichDB.getHabitById(h.id)).filter(Boolean);
      const projection = WealthSimulator.getQuickProjection(richHabits, progress.percent || 50);
      if (projection.length > 0) {
        const tenYear = projection[projection.length - 1];
        const initialSavings = (profile.currentSavings || 500) * 10000;
        const growth = initialSavings > 0 ? Math.round(((tenYear.savings - initialSavings) / initialSavings) * 100) : 0;
        document.getElementById('wealth-gauge-value').textContent = `+${growth}%`;
      }
    } catch (e) {
      console.warn('[renderHome] 자산 게이지 오류:', e.message);
    }

    // 습관 리스트
    this._renderHabitList('morning');
    this._renderHabitList('afternoon');
    this._renderHabitList('evening');
  },

  _renderHabitList(timeSlot) {
    const container = document.getElementById(`habit-list-${timeSlot}`);
    if (!container) return;

    const habits = HabitManager.getByTimeSlot(timeSlot);
    const timeGroup = document.getElementById(`${timeSlot}-habits`);

    if (habits.length === 0) {
      timeGroup.style.display = 'none';
      return;
    }
    timeGroup.style.display = 'block';

    container.innerHTML = habits.map(h => {
      const completed = HabitManager.isCompletedToday(h.id);
      const streak = h.streak || 0;
      return `
        <div class="habit-card ${completed ? 'completed' : ''}" data-id="${h.id}" onclick="App.toggleHabit('${h.id}')">
          <div class="habit-check">
            <svg class="habit-check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="habit-info">
            <div class="habit-name">${h.name}</div>
            <div class="habit-rich-tag">${h.richPeople?.[0] || ''} | ${h.richStat?.slice(0, 25) || ''}...</div>
          </div>
          ${streak > 0 ? `<div class="habit-streak">\u{1F525} ${streak}</div>` : ''}
          <button class="habit-delete-btn" onclick="App.showDeleteHabit('${h.id}', event)" title="삭제">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
      `;
    }).join('');
  },

  toggleHabit(habitId) {
    if (HabitManager.isCompletedToday(habitId)) {
      HabitManager.uncomplete(habitId);
      this.renderHome();
      return;
    }

    const result = HabitManager.complete(habitId);

    // 완료 모달
    const habit = RichDB.getHabitById(habitId);
    document.getElementById('modal-complete-icon').textContent = '\u2705';
    document.getElementById('modal-complete-title').textContent = habit?.name || '습관 완료!';
    document.getElementById('modal-complete-message').textContent = result.coachMsg.message;
    document.getElementById('modal-complete-tip').textContent = result.coachMsg.richTip || '';
    document.getElementById('modal-complete-xp').textContent = `+${result.coachMsg.xpGained} XP`;
    document.getElementById('modal-complete').style.display = 'flex';

    // 카드에 애니메이션
    const card = document.querySelector(`.habit-card[data-id="${habitId}"]`);
    if (card) {
      card.classList.add('just-completed');
      setTimeout(() => card.classList.remove('just-completed'), 500);
    }

    this.renderHome();

    // 레벨업 체크
    if (result.levelResult?.levelUp) {
      setTimeout(() => {
        this.closeModal('modal-complete');
        const nl = result.levelResult.newLevel;
        document.getElementById('modal-levelup-icon').textContent = nl.emoji;
        document.getElementById('modal-levelup-text').textContent =
          `${result.levelResult.oldLevel.emoji} ${result.levelResult.oldLevel.name}에서 ${nl.emoji} ${nl.name}(으)로 성장했어요!`;
        document.getElementById('modal-levelup').style.display = 'flex';
      }, 1500);
    }

    // 뱃지 체크
    if (result.newBadges?.length > 0) {
      const delay = result.levelResult?.levelUp ? 3000 : 1500;
      result.newBadges.forEach((badge, i) => {
        if (!badge) return;
        setTimeout(() => {
          this.closeModal('modal-complete');
          this.closeModal('modal-levelup');
          document.getElementById('modal-badge-icon').textContent = badge.emoji;
          document.getElementById('modal-badge-name').textContent = badge.name;
          document.getElementById('modal-badge-desc').textContent = badge.desc;
          document.getElementById('modal-badge').style.display = 'flex';
        }, delay + i * 1500);
      });
    }

    // 100% 완료 시 2배 보상 광고 모달
    const progress = HabitManager.getTodayProgress();
    if (progress.percent === 100) {
      const today = Storage.getToday();
      const claimed = Storage.load('routine_reward_claimed', null);
      if (claimed !== today) {
        const hasLevelUp = result.levelResult?.levelUp;
        const badgeCount = result.newBadges?.length || 0;
        const delay = hasLevelUp ? 3200 : badgeCount > 0 ? 3200 : 2000;
        setTimeout(() => {
          try {
            this.closeModal('modal-complete');
            this.closeModal('modal-levelup');
            this.closeModal('modal-badge');
            this.showRoutineCompleteModal();
          } catch (e) {
            console.error('[routineComplete] 모달 오류:', e.message, e.stack);
            // 폴백: 에러 발생 시 최소한 모달 표시
            const m = document.getElementById('modal-routine-complete');
            if (m) m.style.display = 'flex';
          }
        }, delay);
      }
    }
  },

  showRoutineCompleteModal() {
    const today = Storage.getToday();
    const todayXP = HabitManager.getTodayXP();
    const streak = HabitManager.getAllClearStreak();

    // 습관 점수 저장 (티저에 블러로 표시)
    const score = AICoach.saveDailyScore();
    const topPercent = score >= 70 ? 5 : score >= 50 ? 15 : score >= 35 ? 25 : score >= 20 ? 40 : 65;
    const numEl = document.querySelector('.routine-score-teaser-num');
    const rankEl = document.querySelector('.routine-score-teaser-rank-num');
    if (numEl) numEl.textContent = score;
    if (rankEl) rankEl.textContent = topPercent;

    document.getElementById('routine-today-xp').textContent = `+${todayXP}`;
    document.getElementById('routine-streak').textContent = `${streak}일`;
    document.getElementById('routine-2x-label').textContent = `XP +${todayXP} → +${todayXP * 2}`;

    const isPremium = Payment.isPremium();
    const adBtn = document.getElementById('btn-routine-ad');
    const banner = document.querySelector('#modal-routine-complete .routine-2x-banner');

    if (isPremium) {
      adBtn.textContent = '지금 리포트 확인하기 🔓';
      if (banner) banner.style.display = 'none';
    } else {
      adBtn.textContent = '지금 리포트 확인하기 🔓 (광고 시청)';
      if (banner) banner.style.display = 'flex';
    }

    adBtn.onclick = () => {
      this.closeModal('modal-routine-complete');
      if (isPremium) {
        // 프리미엄: 광고 없이 바로
        Gamification.addXP(todayXP);
        Storage.save('routine_reward_claimed', today);
        Storage.save('ai_analysis_unlocked', today);
        this.renderHome();
        this.showAIAnalysisModal();
      } else {
        AdManager.showRewardAd(
          () => {
            Gamification.addXP(todayXP);
            Storage.save('routine_reward_claimed', today);
            Storage.save('ai_analysis_unlocked', today);
            this.renderHome();
            this.showAIAnalysisModal();
          },
          () => {} // 광고 실패/취소 시 claimed 저장 안 함 → 재시도 가능
        );
      }
    };

    document.getElementById('btn-routine-skip').onclick = () => {
      this.closeModal('modal-routine-complete');
      Storage.save('routine_reward_claimed', today);
    };

    document.getElementById('modal-routine-complete').style.display = 'flex';
  },

  showAIAnalysisModal() {
    const trend = AICoach.getScoreTrend();
    const summary = AICoach.getAISummary();
    const data = AICoach.getDetailedAnalysis();

    // 점수 + 추세
    document.getElementById('ai-modal-score-num').textContent = trend.current;

    const trendEl = document.getElementById('ai-modal-trend');
    if (trend.days >= 2) {
      const sign = trend.diff >= 0 ? '▲' : '▼';
      const color = trend.diff >= 0 ? '#10B981' : '#EF4444';
      trendEl.innerHTML = `<span style="color:${color}">${sign} ${Math.abs(trend.diff)}점 (전일 대비)</span>`;
    } else {
      trendEl.textContent = '오늘 첫 기록 시작!';
    }

    const daysEl = document.getElementById('ai-modal-days');
    if (trend.days >= 2) {
      const sign = trend.totalDiff >= 0 ? '+' : '';
      daysEl.textContent = `Day 1 대비 ${sign}${trend.totalDiff}점 · ${trend.days}일째 기록`;
    } else {
      daysEl.textContent = `${trend.days}일째 기록 중`;
    }

    document.getElementById('ai-modal-grade').textContent =
      `오늘 평가: ${summary.grade.label}  ·  ${data.block3.emoji} ${data.block3.name}`;

    // 분석 내용 (블록 1 + 추천)
    const block1Html = data.block1.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    document.getElementById('ai-modal-content').innerHTML = `
      <div class="ai-block" style="margin-top:12px">
        <div class="ai-block-title">오늘의 분석</div>
        <p class="ai-block-text">${block1Html}</p>
      </div>
      <div class="ai-block">
        <div class="ai-block-title">🤖 AI 추천</div>
        <p class="ai-block-text">${data.block5}</p>
      </div>
      <div class="ai-block">
        <div class="ai-block-title">📈 미래 예측</div>
        <div class="ai-future-grid">
          <div class="ai-future-card">
            <div class="ai-future-period">6개월 후</div>
            <div class="ai-future-value">${data.block4.sixMonthProb}%</div>
            <div class="ai-future-desc">루틴 안정화 확률</div>
          </div>
          <div class="ai-future-card">
            <div class="ai-future-period">1년 후</div>
            <div class="ai-future-value">+${data.block4.oneYearAsset}%</div>
            <div class="ai-future-desc">예상 자산 성장</div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-ai-analysis').style.display = 'flex';
  },

  // ==================== 개발자 도구 ====================
  devResetTodayHabits() {
    const records = Storage.getRecords();
    const today = Storage.getToday();
    delete records[today];
    Storage.saveRecords(records);
    // 오늘 누적 XP도 초기화
    const todayXP = Storage.load('today_xp', {});
    delete todayXP[today];
    Storage.save('today_xp', todayXP);
    this.renderHome();
    alert('오늘 습관 체크가 초기화됐어요.');
  },

  devResetRoutineReward() {
    Storage.remove('routine_reward_claimed');
    Storage.remove('ai_analysis_unlocked');
    Storage.remove('weekly_report_unlocked');
    alert('루틴 완료 보상 및 AI 분석 잠금이 초기화됐어요.');
  },

  devResetPremium() {
    Storage.remove('subscription');
    if (typeof AdManager !== 'undefined') AdManager.init();
    this.renderProfile();
    alert('프리미엄 구독이 초기화됐어요.');
  },

  devResetAll() {
    if (!confirm('전체 데이터를 초기화할까요? 되돌릴 수 없어요.')) return;
    Object.keys(localStorage)
      .filter(k => k.startsWith('rh_'))
      .forEach(k => localStorage.removeItem(k));
    location.reload();
  },

  closeModal(id) {
    document.getElementById(id).style.display = 'none';
  },

  // ==================== 프리미엄 / 결제 ====================
  showPremiumModal(feature) {
    const msg = Payment.getPremiumPrompt(feature);
    document.getElementById('premium-prompt-msg').textContent = msg;

    const btn = document.getElementById('btn-premium-buy');
    if (Payment.isPremium()) {
      const days = Payment.getRemainingDays();
      btn.textContent = `Gold Pass 이용 중 (${days}일 남음)`;
      btn.disabled = true;
    } else {
      btn.textContent = 'Gold Pass 시작하기';
      btn.disabled = false;
    }

    document.getElementById('modal-premium').style.display = 'flex';
  },

  selectPlan(el) {
    document.querySelectorAll('.premium-plan-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    this.selectedPlan = el.dataset.plan;
  },

  async purchasePremium() {
    const btn = document.getElementById('btn-premium-buy');
    btn.disabled = true;
    btn.textContent = '처리 중...';

    const result = await Payment.requestPayment(this.selectedPlan);

    if (result.success) {
      this.closeModal('modal-premium');
      AdManager.removeAllAds();
      // 모든 화면 즉시 반영
      this.renderHome();
      this._renderSubscription();
      // 홈 GOLD 뱃지
      const badge = document.getElementById('home-premium-badge');
      if (badge) badge.style.display = 'inline';
      // 버튼 상태 갱신
      btn.textContent = `Gold Pass 이용 중 (${Payment.getRemainingDays()}일 남음)`;
      btn.disabled = true;
      // 성공 모달
      document.getElementById('modal-complete-icon').textContent = '\u{1F451}';
      document.getElementById('modal-complete-title').textContent = 'Gold Pass 활성화!';
      document.getElementById('modal-complete-message').textContent = '프리미엄 기능이 활성화됐어요. 광고 없이 부자 습관을 관리해 보세요!';
      document.getElementById('modal-complete-tip').textContent = '';
      document.getElementById('modal-complete-xp').textContent = '';
      document.getElementById('modal-complete').style.display = 'flex';
    } else {
      alert(result.error || '결제에 실패했어요. 다시 시도해 주세요.');
      btn.disabled = false;
      btn.textContent = 'Gold Pass 시작하기';
    }
  },

  // ==================== 자산 시뮬레이터 ====================
  renderSimulator() {
    const profile = Storage.getProfile();
    if (profile) {
      document.getElementById('sim-income').value = profile.currentIncome || 4000;
      document.getElementById('sim-savings').value = profile.currentSavings || 500;
    }

    // 심화 옵션 표시/숨김
    const advancedOptions = document.getElementById('sim-advanced-options');
    const advancedLock = document.getElementById('sim-advanced-lock');
    if (Payment.isPremium()) {
      if (advancedOptions) advancedOptions.style.display = 'block';
      if (advancedLock) advancedLock.style.display = 'none';
    } else {
      if (advancedOptions) advancedOptions.style.display = 'none';
      if (advancedLock) advancedLock.style.display = 'block';
    }
  },

  runSimulation() {
    const income = parseInt(document.getElementById('sim-income').value) || 4000;
    const savings = parseInt(document.getElementById('sim-savings').value) || 500;

    // 프로필 업데이트
    const profile = Storage.getProfile();
    if (profile) {
      profile.currentIncome = income;
      profile.currentSavings = savings;
      Storage.saveProfile(profile);
    }

    const habits = HabitManager.getAll();
    const richHabits = habits.map(h => RichDB.getHabitById(h.id)).filter(Boolean);
    const completionRate = HabitManager.getTodayProgress().percent || 50;

    const isPremium = Payment.isPremium();
    let results;

    if (isPremium) {
      // Gold Pass: 심화 시뮬레이션
      const inflation = parseFloat(document.getElementById('sim-inflation').value) || 3;
      const tax = parseFloat(document.getElementById('sim-tax').value) || 15.4;
      const savingRatio = parseFloat(document.getElementById('sim-saving-ratio').value) || 30;
      results = WealthSimulator.projectAdvanced(
        richHabits, completionRate, 30, income * 10000, savings * 10000,
        { inflation, tax, savingRatio }
      );
    } else {
      results = WealthSimulator.project(richHabits, completionRate, 30, income * 10000, savings * 10000);
    }

    document.getElementById('sim-result-card').style.display = 'block';

    const renderFn = () => {
      if (isPremium) {
        WealthSimulator.renderAdvancedChart('wealth-chart', results);
      } else {
        WealthSimulator.renderChart('wealth-chart', results);
      }
    };
    if (window._loadChartJs) {
      window._loadChartJs().then(renderFn);
    } else {
      renderFn();
    }

    // 요약
    const y10 = results[9];
    const y20 = results[19];
    const y30 = results[29];
    let summaryHTML = `
      <div class="sim-row">
        <span class="sim-row-label">10년 후 예상 자산</span>
        <span class="sim-row-value">${WealthSimulator.formatMoney(y10.savings)}</span>
      </div>
      <div class="sim-row">
        <span class="sim-row-label">20년 후 예상 자산</span>
        <span class="sim-row-value">${WealthSimulator.formatMoney(y20.savings)}</span>
      </div>
      <div class="sim-row">
        <span class="sim-row-label">30년 후 예상 자산</span>
        <span class="sim-row-value">${WealthSimulator.formatMoney(y30.savings)}</span>
      </div>
      <div class="sim-row">
        <span class="sim-row-label">현재 달성률 기준</span>
        <span class="sim-row-value">${completionRate}%</span>
      </div>
    `;

    // 심화 정보 (Gold Pass)
    if (isPremium && y30.realSavings) {
      summaryHTML += `
        <div class="sim-advanced-detail">
          <div class="sim-row">
            <span class="sim-row-label">30년 후 실질 자산 (오늘 가치)</span>
            <span class="sim-row-value">${WealthSimulator.formatMoney(y30.realSavings)}</span>
          </div>
          <div class="sim-row">
            <span class="sim-row-label">인플레이션 손실분</span>
            <span class="sim-row-value negative">-${WealthSimulator.formatMoney(y30.inflationLoss)}</span>
          </div>
          <div class="sim-row">
            <span class="sim-row-label">30년간 총 세금</span>
            <span class="sim-row-value negative">-${WealthSimulator.formatMoney(results.reduce((s, r) => s + r.taxPaid, 0))}</span>
          </div>
        </div>
      `;
    }

    document.getElementById('sim-summary').innerHTML = summaryHTML;
  },

  // ==================== 부자 도서관 ====================
  renderLibrary() {
    console.log('[Library] renderLibrary 호출됨, PEOPLE:', RichDB.PEOPLE?.length, 'STORIES:', RichDB.STORIES?.length, 'QUOTES:', RichDB.QUOTES?.length);

    this._renderLibPeople();
    this._renderLibStories();
    this._renderLibQuotes();

    // 활성 탭 콘텐츠 표시 보장
    const activeTab = document.querySelector('.lib-tab.active');
    const tab = activeTab ? activeTab.dataset.tab : 'people';
    document.querySelectorAll('.lib-content').forEach(c => c.style.display = 'none');
    const activeContent = document.getElementById(`lib-content-${tab}`);
    if (activeContent) {
      activeContent.style.display = 'flex';
      console.log('[Library] 활성 탭:', tab, '자식 수:', activeContent.children.length);
    }
  },

  _renderLibPeople() {
    const container = document.getElementById('lib-content-people');
    if (!container) { console.warn('[Library] lib-content-people 없음'); return; }
    try {
      const COMPARE = {
        warren_buffett:   { metric: '독서 시간',  personVal: '5시간',  category: '독서/학습', baseMin: 300 },
        elon_musk:        { metric: '집중 업무',  personVal: '14시간', category: '시간 관리', baseMin: 840 },
        bill_gates:       { metric: '학습+운동',  personVal: '1시간',  category: '건강 관리', baseMin: 60 },
        oprah_winfrey:    { metric: '명상 시간',  personVal: '20분',   category: '마인드셋',  baseMin: 20 },
        jeff_bezos:       { metric: '수면 관리',  personVal: '8시간',  category: '건강 관리', baseMin: 480 },
        ray_dalio:        { metric: '명상·원칙',  personVal: '20분',   category: '마인드셋',  baseMin: 20 },
        tim_cook:         { metric: '아침 운동',  personVal: '1시간',  category: '건강 관리', baseMin: 60 },
        richard_branson:  { metric: '운동 시간',  personVal: '1시간',  category: '건강 관리', baseMin: 60 },
        steve_jobs:       { metric: '집중 업무',  personVal: '10시간', category: '시간 관리', baseMin: 600 },
        mark_zuckerberg:  { metric: '딥워크',     personVal: '8시간',  category: '시간 관리', baseMin: 480 },
        naval_ravikant:   { metric: '독서 시간',  personVal: '1시간',  category: '독서/학습', baseMin: 60 },
        kim_seung_ho:     { metric: '재테크 루틴', personVal: '매일',   category: '재테크 습관', baseMin: 30 },
      };

      const _myVal = (baseMin, rate) => {
        const min = Math.round(baseMin * rate / 100);
        if (min === 0) return '0분';
        if (min >= 60) return `${Math.floor(min / 60)}시간${min % 60 > 0 ? ` ${min % 60}분` : ''}`;
        return `${min}분`;
      };

      const isPremium = typeof Payment !== 'undefined' && Payment.isPremium();
      let html = '';
      RichDB.PEOPLE.forEach((p, i) => {
        const cmp = COMPARE[p.id];
        const primaryMetric = (this._PERSON_METRICS[p.id] || [])[0];
        const myRate = primaryMetric ? this._getMetricRate(primaryMetric) : 0;
        const myValStr = cmp ? _myVal(cmp.baseMin, myRate) : '-';
        const myTopPct = this._rateToTopPct(myRate);
        const nextPct = myTopPct ? Math.max(10, myTopPct - 10) : 30;

        const compareHTML = cmp ? `
          <div class="person-compare-section">
            <div class="person-compare-title">당신과 비교</div>
            <div class="person-compare-row">
              <div class="person-compare-metric">${cmp.metric}</div>
              <div class="person-compare-values">
                <span class="person-compare-them">${p.name.split(' ')[0]} ${cmp.personVal}</span>
                <span class="person-compare-slash">/</span>
                <span class="person-compare-me">나 ${myValStr}</span>
              </div>
            </div>
            <div class="person-compare-rank">→ 당신은 상위 <strong>${myTopPct ?? '??'}%</strong></div>
            <div class="person-compare-hook">👉 이 루틴만 더 하면 상위 ${nextPct}% 가능</div>
          </div>
        ` : '';

        html += `
          <div class="rich-person-card">
            <div class="rich-person-header">
              <div class="rich-person-avatar">${p.emoji}</div>
              <div>
                <div class="rich-person-name">${p.name}</div>
                <div class="rich-person-title">${p.title}</div>
                <div class="rich-person-worth">${p.netWorth}</div>
              </div>
            </div>
            <div class="rich-person-routine">${p.morningRoutine}</div>
            <div class="rich-person-philosophy">"${p.philosophy}"</div>
            ${compareHTML}
            <div class="person-card-actions">
              <button class="btn-person-apply" onclick="App.applyPersonRoutine('${p.id}')">이 루틴 적용하기</button>
              <button class="btn-person-compare" onclick="App.openPersonCompareAd('${p.id}')">${p.name} 기준 내 점수 보기 🔓${isPremium || p.id === 'warren_buffett' ? '<span class="btn-free-label">무료</span>' : '<span class="btn-ad-label">광고 시청</span>'}</button>
            </div>
          </div>
        `;
        if (i === 1) html += AdManager.getNativeAdHTML();
      });
      container.innerHTML = html;
    } catch (e) {
      console.error('[Library] _renderLibPeople 오류:', e);
      container.innerHTML = '<div style="padding:20px;color:#8B95A1;text-align:center">콘텐츠를 불러오지 못했어요.</div>';
    }
  },

  applyPersonRoutine(personId) {
    const person = RichDB.PEOPLE.find(p => p.id === personId);
    if (!person) return;

    const existingIds = new Set(HabitManager.getAll().map(h => h.id));
    let added = 0, skipped = 0, limited = 0;

    person.keyHabits.forEach(habitId => {
      if (existingIds.has(habitId)) { skipped++; return; }
      const template = RichDB.HABITS.find(h => h.id === habitId);
      if (!template) return;
      // 루틴 출처 인물이 richPeople 첫 번째로 오도록 정렬, 없으면 앞에 추가
      const richPeople = template.richPeople ? [...template.richPeople] : [];
      const idx = richPeople.indexOf(person.name);
      if (idx > 0) { richPeople.splice(idx, 1); richPeople.unshift(person.name); }
      else if (idx === -1) richPeople.unshift(person.name);
      const result = HabitManager.addHabit({ ...template, richPeople });
      if (result.success) {
        added++;
        existingIds.add(habitId); // 루프 내 중복 방지
      } else {
        limited++;
      }
    });

    // 홈으로 이동 후 결과 표시
    this.switchTab(document.querySelector('[data-screen="screen-home"]'));

    if (added === 0 && skipped > 0 && limited === 0) {
      this._showToast(`${person.name}의 습관이 이미 모두 등록되어 있어요`);
    } else if (added === 0 && limited > 0) {
      this._showToast('무료 한도(3개) 초과 → Gold Pass로 무제한 추가 가능해요');
    } else if (added > 0) {
      const msg = `${person.name} 루틴 ${added}개 추가됐어요!`
        + (skipped > 0 ? ` (중복 ${skipped}개 제외)` : '')
        + (limited > 0 ? ` ⚠️ ${limited}개는 한도 초과` : '');
      this._showToast(msg);
    }
  },

  _showToast(msg) {
    let t = document.getElementById('app-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'app-toast';
      t.className = 'app-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('visible'), 3000);
  },

  // ==================== 부자 점수 비교 ====================
  _comparePersonId: null,

  _PERSON_METRICS: {
    warren_buffett: [
      { label: '독서 습관',   category: '독서/학습',   type: 'category' },
      { label: '재테크 루틴', category: '재테크 습관', type: 'category' },
      { label: '아침 루틴',   category: 'morning',     type: 'slot' },
    ],
    elon_musk: [
      { label: '집중력 루틴', category: '시간 관리',   type: 'category' },
      { label: '운동 습관',   category: '건강 관리',   type: 'category' },
      { label: '아침 루틴',   category: 'morning',     type: 'slot' },
    ],
    bill_gates: [
      { label: '독서+학습',   category: '독서/학습',   type: 'category' },
      { label: '건강 관리',   category: '건강 관리',   type: 'category' },
      { label: '아침 루틴',   category: 'morning',     type: 'slot' },
    ],
    oprah_winfrey: [
      { label: '마인드셋',    category: '마인드셋',    type: 'category' },
      { label: '운동 습관',   category: '건강 관리',   type: 'category' },
      { label: '아침 루틴',   category: 'morning',     type: 'slot' },
    ],
    jeff_bezos: [
      { label: '건강 관리',   category: '건강 관리',   type: 'category' },
      { label: '재테크 루틴', category: '재테크 습관', type: 'category' },
      { label: '저녁 루틴',   category: 'evening',     type: 'slot' },
    ],
    ray_dalio: [
      { label: '마인드셋',    category: '마인드셋',    type: 'category' },
      { label: '재테크 루틴', category: '재테크 습관', type: 'category' },
      { label: '아침 루틴',   category: 'morning',     type: 'slot' },
    ],
    tim_cook: [
      { label: '아침 루틴',   category: 'morning',     type: 'slot' },
      { label: '건강 관리',   category: '건강 관리',   type: 'category' },
      { label: '시간 관리',   category: '시간 관리',   type: 'category' },
    ],
    richard_branson: [
      { label: '운동 습관',   category: '건강 관리',   type: 'category' },
      { label: '네트워킹',    category: '네트워킹',    type: 'category' },
      { label: '아침 루틴',   category: 'morning',     type: 'slot' },
    ],
    steve_jobs: [
      { label: '집중 업무',   category: '시간 관리',   type: 'category' },
      { label: '마인드셋',    category: '마인드셋',    type: 'category' },
      { label: '아침 루틴',   category: 'morning',     type: 'slot' },
    ],
    mark_zuckerberg: [
      { label: '딥워크',      category: '시간 관리',   type: 'category' },
      { label: '학습 습관',   category: '독서/학습',   type: 'category' },
      { label: '운동 습관',   category: '건강 관리',   type: 'category' },
    ],
    naval_ravikant: [
      { label: '독서 습관',   category: '독서/학습',   type: 'category' },
      { label: '마인드셋',    category: '마인드셋',    type: 'category' },
      { label: '재테크 루틴', category: '재테크 습관', type: 'category' },
    ],
    kim_seung_ho: [
      { label: '재테크 루틴', category: '재테크 습관', type: 'category' },
      { label: '저축 습관',   category: '재테크 습관', type: 'category' },
      { label: '저녁 루틴',   category: 'evening',     type: 'slot' },
    ],
  },

  _PERSON_ANALYSIS: {
    warren_buffett:  { diagnosis: '"꾸준형 자산가" 단계',  strength: '독서/학습 루틴 유지력',   weakness: '장기 집중 시간 부족',    growthAction: '하루 1시간 독서 추가',   quote: '지금은 느리지만 가장 안정적으로 성장 중입니다', free: true },
    elon_musk:       { diagnosis: '"실행형 성장" 단계',    strength: '집중 업무 몰입도',         weakness: '루틴 지속력 부족',         growthAction: '반복 루틴 1개 추가',     quote: '지금 패턴 유지하면 크게 터질 가능성 있음' },
    bill_gates:      { diagnosis: '"지식 자산 축적" 단계', strength: '학습 습관',                weakness: '실전 적용 부족',           growthAction: '배운 내용 실행 루틴',    quote: '지금은 쌓는 단계, 곧 터집니다' },
    oprah_winfrey:   { diagnosis: '"내면 성장형 리더" 단계', strength: '마인드셋 루틴',          weakness: '체력 루틴 부족',           growthAction: '아침 운동 루틴 추가',    quote: '내면이 강해지면 외면도 따라옵니다' },
    jeff_bezos:      { diagnosis: '"시스템 구축" 초기 단계', strength: '일정·수면 관리',         weakness: '루틴 자동화 부족',         growthAction: '반복 루틴 고정화',       quote: '지금은 구조를 만드는 시기입니다' },
    ray_dalio:       { diagnosis: '"패턴 분석가" 단계',    strength: '루틴 데이터 축적',         weakness: '피드백 반영 부족',         growthAction: '실패 루틴 제거',         quote: '지금은 분석이 아닌 실행이 필요한 시점입니다' },
    tim_cook:        { diagnosis: '"규율형 리더" 성장 단계', strength: '아침 루틴 규律',         weakness: '에너지 관리 부족',         growthAction: '저녁 루틴 추가',         quote: '규율이 자유를 만듭니다' },
    richard_branson: { diagnosis: '"도전형 기업가" 성장 단계', strength: '에너지 활용',          weakness: '집중력 부족',              growthAction: '딥워크 루틴 추가',       quote: '에너지가 있는 곳에 성공이 있습니다' },
    steve_jobs:      { diagnosis: '"집중력 강화" 단계',    strength: '몰입 시간',                weakness: '불필요한 루틴 분산',       growthAction: '핵심 루틴 2개만 유지',   quote: '덜어낼수록 더 빠르게 성장합니다' },
    mark_zuckerberg: { diagnosis: '"속도형 성장" 단계',    strength: '빠른 실행력',              weakness: '깊이 부족',                growthAction: '집중 루틴 추가',         quote: '속도는 이미 충분, 이제 깊이를 더하세요' },
    naval_ravikant:  { diagnosis: '"레버리지 초기" 단계',  strength: '자기 통제력',              weakness: '시스템화 부족',            growthAction: '자동화 루틴 추가',       quote: '시간을 돈으로 바꾸는 구조를 만들어야 합니다' },
    kim_seung_ho:    { diagnosis: '"현실형 자산 구축" 단계', strength: '실천력',                 weakness: '소비 관리 부족',           growthAction: '소비 기록 루틴',         quote: '돈은 습관에서 결정됩니다' },
  },

  _getMetricRate(m) {
    const habits = HabitManager.getAll().filter(h =>
      m.type === 'slot' ? (h.timeSlot || 'morning') === m.category : h.category === m.category
    );
    if (!habits.length) return 0;
    const records = Storage.getRecords();
    let total = 0, done = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = Storage.formatDate(d);
      const dayRec = records[key] || {};
      habits.forEach(h => { total++; if (dayRec[h.id]?.done) done++; });
    }
    return total > 0 ? Math.round(done / total * 100) : 0;
  },

  _rateToTopPct(rate) {
    if (rate >= 80) return 15;
    if (rate >= 65) return 25;
    if (rate >= 50) return 35;
    if (rate >= 35) return 50;
    if (rate >= 20) return 65;
    return null; // 평균 이하
  },

  openPersonCompareAd(personId) {
    this._comparePersonId = personId;
    const person = RichDB.PEOPLE.find(p => p.id === personId);
    if (!person) return;

    const analysis = this._PERSON_ANALYSIS[personId];
    const isFree = !!(analysis && analysis.free);
    const isPremium = typeof Payment !== 'undefined' && Payment.isPremium();

    // 워렌 버핏(무료) 또는 프리미엄: 바로 결과
    if (isFree || isPremium) {
      this._showCompareResult(personId);
      return;
    }

    // 테저 모달 내용 세팅
    const score = AICoach.calculateHabitScore();
    const topPct = score >= 70 ? 5 : score >= 50 ? 15 : score >= 35 ? 25 : score >= 20 ? 40 : 65;
    document.getElementById('compare-person-context').textContent = `${person.emoji} ${person.name} 기준 분석`;
    document.getElementById('compare-metrics-list').innerHTML = `
      <div class="compare-teaser-diagnosis">${analysis ? analysis.diagnosis : '성장 단계'}</div>
      <div class="compare-teaser-score">내 점수 <strong>${score}점</strong> · 상위 ${topPct}%</div>
    `;
    document.getElementById('compare-hook').innerHTML =
      `👉 ${analysis ? analysis.weakness : '약점'} 개선 시 한 단계 도약 가능`;

    document.getElementById('modal-compare-teaser').style.display = 'flex';
  },

  watchAdForCompare() {
    const personId = this._comparePersonId;
    this.closeModal('modal-compare-teaser');
    if (Payment.isPremium()) {
      this._showCompareResult(personId);
      return;
    }
    AdManager.showRewardAd(
      () => this._showCompareResult(personId),
      () => {}
    );
  },

  _showCompareResult(personId) {
    const person = RichDB.PEOPLE.find(p => p.id === personId);
    const analysis = this._PERSON_ANALYSIS[personId] || {};
    const score = AICoach.saveDailyScore();
    const trend = AICoach.getScoreTrend();
    const topPct = score >= 70 ? 5 : score >= 50 ? 15 : score >= 35 ? 25 : score >= 20 ? 40 : 65;

    // 다음 단계까지
    const nextThresholds = [
      { score: 20, pct: 40 }, { score: 35, pct: 25 },
      { score: 50, pct: 15 }, { score: 70, pct: 5 },
    ];
    const nextT = nextThresholds.find(t => score < t.score);
    const nextPct = nextT ? nextT.pct : 5;
    const nextDiff = nextT ? nextT.score - score : 0;

    // 성장 추이
    const growth = trend.diff;
    const growthColor = growth > 0 ? '#10B981' : growth < 0 ? '#EF4444' : '#F59E0B';
    const growthLine = growth > 0 ? `▲ +${growth}점 어제 대비 상승` : growth < 0 ? `▼ ${Math.abs(growth)}점 어제 대비 하락` : '어제와 동일';
    const growthSub = growth === 0 ? '⚡ 지금 정체 구간 — 여기서 갈립니다' : growth > 0 ? '이 흐름 유지하면 이번 주 신기록 가능' : '';
    const streakHTML = trend.days >= 2 ? `<div class="compare-streak-badge">🔥 ${trend.days}일째 기록 중</div>` : '';

    // 다른 부자 버튼 (현재 인물 제외, 최대 6개)
    const others = RichDB.PEOPLE.filter(p => p.id !== personId).slice(0, 6);
    const isPremium = typeof Payment !== 'undefined' && Payment.isPremium();
    const othersHTML = others.map(p => {
      const otherAnalysis = this._PERSON_ANALYSIS[p.id] || {};
      const lockIcon = (otherAnalysis.free || isPremium) ? '' : ' 🔓';
      return `<button class="compare-other-btn" onclick="App.closeModal('modal-compare-result');App.openPersonCompareAd('${p.id}')">${p.emoji} ${p.name}${lockIcon}</button>`;
    }).join('');

    const predictScore = Math.min(100, score + 7);

    document.getElementById('modal-compare-result-title').textContent = `${person ? person.name : ''} 기준 내 점수`;

    document.getElementById('compare-result-content').innerHTML = `
      <div class="compare-result-score-row">
        <div>
          <div class="compare-result-score-label">내 부자 점수</div>
          <div class="compare-result-score">${score}<span class="compare-result-score-unit">점</span></div>
        </div>
        <div class="compare-result-rank-col">
          <div class="compare-result-rank">상위 ${topPct}%</div>
          <div class="compare-result-growth-mini" style="color:${growthColor}">${growthLine}</div>
        </div>
      </div>
      ${nextT ? `<div class="compare-next-step">👉 상위 ${nextPct}%까지 단 <strong>${nextDiff}점</strong> 남음 🔥</div>` : `<div class="compare-next-step compare-next-top">👑 이미 상위 5%! 최고 수준이에요</div>`}
      ${streakHTML}
      ${growthSub ? `<div class="compare-growth-sub" style="color:${growth === 0 ? '#F59E0B' : '#10B981'}">${growthSub}</div>` : ''}

      <div class="compare-person-analysis-box">
        <div class="compare-person-analysis-title">${person ? person.emoji : ''} ${person ? person.name : ''} 기준 분석</div>
        <div class="compare-analysis-diagnosis">👉 당신은 ${analysis.diagnosis || '성장 단계'}입니다</div>
        <div class="compare-analysis-row">
          <div class="compare-analysis-item compare-analysis-strength">
            <div class="compare-analysis-item-title">🔥 강점</div>
            <div class="compare-analysis-item-body">${analysis.strength || '-'}</div>
          </div>
          <div class="compare-analysis-item compare-analysis-weakness">
            <div class="compare-analysis-item-title">⚠️ 약점</div>
            <div class="compare-analysis-item-body">${analysis.weakness || '-'}</div>
          </div>
        </div>
        <div class="compare-analysis-growth">
          <div class="compare-analysis-item-title">📈 성장 방향</div>
          <div class="compare-analysis-growth-body">→ ${analysis.growthAction || ''} 시 상위 ${nextPct}% 진입</div>
        </div>
        <div class="compare-analysis-quote">"${analysis.quote || ''}"</div>
      </div>

      <div class="compare-result-urgency">
        ⚠️ 오늘 분석은 오늘만 확인 가능합니다<br>
        <span>자정 이후 데이터가 초기화됩니다</span>
      </div>

      <div class="compare-others-section">
        <div class="compare-others-title">다른 부자 기준으로 분석 보기</div>
        <div class="compare-others-grid">${othersHTML}</div>
      </div>

      <button class="btn-primary btn-full compare-action-btn" onclick="App.openTomorrowBoost()">내일 점수 +10점 만들기 🔥</button>
      <button class="btn-ghost btn-full compare-action-btn-sub" onclick="App.closeModal('modal-compare-result');App.applyPersonGrowthHabit()" style="margin-top:8px">지금 바로 루틴 추가하기</button>
    `;
    document.getElementById('modal-compare-result').style.display = 'flex';
  },

  _renderLibStories() {
    const container = document.getElementById('lib-content-stories');
    if (!container) return;
    try {
      let html = '';
      RichDB.STORIES.forEach((s, i) => {
        html += `
          <div class="story-card">
            <span class="story-category">${s.category}</span>
            <div class="story-title">${s.title}</div>
            <div class="story-body">${s.body}</div>
          </div>
        `;
        if (i === 2) {
          html += AdManager.getNativeAdHTML();
        }
      });
      container.innerHTML = html;
    } catch (e) {
      console.error('[Library] _renderLibStories 오류:', e);
      container.innerHTML = '<div style="padding:20px;color:#8B95A1;text-align:center">콘텐츠를 불러오지 못했어요.</div>';
    }
  },

  _renderLibQuotes() {
    const container = document.getElementById('lib-content-quotes');
    if (!container) return;
    try {
      container.innerHTML = RichDB.QUOTES.map(q => `
        <div class="quote-list-card">
          <div class="quote-list-text">"${q.text}"</div>
          <div class="quote-list-author">- ${q.author}</div>
          <div class="quote-list-category">${q.category}</div>
        </div>
      `).join('');
    } catch (e) {
      console.error('[Library] _renderLibQuotes 오류:', e);
      container.innerHTML = '<div style="padding:20px;color:#8B95A1;text-align:center">콘텐츠를 불러오지 못했어요.</div>';
    }
  },

  switchLibTab(el) {
    document.querySelectorAll('.lib-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    const tab = el.dataset.tab;
    document.querySelectorAll('.lib-content').forEach(c => c.style.display = 'none');
    document.getElementById(`lib-content-${tab}`).style.display = 'flex';
  },

  // ==================== 프로필 ====================
  renderProfile() {
    const profile = Storage.getProfile();
    if (!profile) return;

    const level = Gamification.getLevel(profile.xp || 0);
    const xpProgress = Gamification.getXPProgress(profile.xp || 0);

    document.getElementById('profile-level-icon').textContent = level.emoji;
    document.getElementById('profile-name').textContent = profile.nickname || '오늘부터부자러';
    document.getElementById('profile-title').textContent = `${level.emoji} ${level.name} (Lv.${level.level})`;
    document.getElementById('profile-xp-fill').style.width = xpProgress.percent + '%';
    document.getElementById('profile-xp-text').textContent = `XP ${profile.xp || 0} / ${Gamification.getNextLevel(profile.xp || 0)?.minXP || 'MAX'}`;

    document.getElementById('prof-total-days').textContent = HabitManager.getTotalDays();
    document.getElementById('prof-best-streak').textContent = HabitManager.getBestStreak();
    document.getElementById('prof-total-habits').textContent = HabitManager.getTotalCompleted();

    // 토스 로그인 상태
    this._renderTossLoginSection(profile);

    // 개인정보 표시
    this._renderProfileInfo(profile);

    // 구독 상태
    this._renderSubscription();

    // 뱃지
    const badgeGrid = document.getElementById('badge-grid');
    const earnedBadges = profile.badges || [];
    badgeGrid.innerHTML = Gamification.BADGES.map(b => {
      const earned = earnedBadges.includes(b.id);
      return `
        <div class="badge-item ${earned ? 'earned' : ''}">
          <div class="badge-icon">${b.emoji}</div>
          <div class="badge-label">${b.name}</div>
        </div>
      `;
    }).join('');
  },

  // ==================== 토스 로그인 섹션 ====================
  _renderTossLoginSection(profile) {
    const el = document.getElementById('toss-login-section');
    if (!el) return;

    if (profile?.tossLinked && TossAuth.isLoggedIn()) {
      el.innerHTML = `
        <div class="toss-linked">
          <span class="toss-linked-icon">✓</span>
          <span class="toss-linked-text">토스 계정 연동됨</span>
          <button class="btn-toss-logout" onclick="App.tossLogout()">연동 해제</button>
        </div>`;
    } else {
      el.innerHTML = `
        <button class="btn-toss-login" onclick="App.tossLogin()">
          토스로 로그인
        </button>
        <p class="toss-login-desc">로그인하면 데이터가 클라우드에 자동 저장돼요</p>`;
    }
  },

  async tossLogin() {
    const btn = document.querySelector('.btn-toss-login');
    if (btn) { btn.disabled = true; btn.textContent = '로그인 중...'; }
    try {
      const user = await TossAuth.login();
      if (user) {
        this.renderProfile();
      } else {
        alert('로그인에 실패했어요. 다시 시도해 주세요.');
      }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '토스로 로그인'; }
    }
  },

  async tossLogout() {
    if (!confirm('토스 로그인 연동을 해제할까요?')) return;
    try {
      await TossAuth.logout();
      this.renderProfile();
    } catch (e) {
      console.error('[tossLogout]', e.message);
    }
  },

  // ==================== 프로필 정보/수정 ====================
  _renderProfileInfo(profile) {
    const list = document.getElementById('profile-info-list');
    if (!list) return;

    const roleModel = RichDB.PEOPLE.find(p => p.id === profile.roleModel);
    const items = [
      { label: '닉네임', value: profile.nickname || '오늘부터부자러' },
      { label: '직업', value: profile.job || '-' },
      { label: '기상 시간', value: profile.wakeup || '-' },
      { label: '취침 시간', value: profile.sleep || '-' },
      { label: '목표 자산', value: profile.targetWealth || '-' },
      { label: '롤모델', value: roleModel ? `${roleModel.emoji} ${roleModel.name}` : '-' },
      { label: '월 수입', value: profile.currentIncome ? `${profile.currentIncome.toLocaleString()}만원` : '-' },
      { label: '현재 저축', value: profile.currentSavings ? `${profile.currentSavings.toLocaleString()}만원` : '-' },
    ];

    list.innerHTML = items.map(item => `
      <div class="profile-info-row">
        <span class="profile-info-label">${item.label}</span>
        <span class="profile-info-value">${item.value}</span>
      </div>
    `).join('');
  },

  showEditProfileModal() {
    const profile = Storage.getProfile();
    if (!profile) return;

    document.getElementById('edit-nickname').value = profile.nickname || '';
    document.getElementById('edit-job').value = profile.job || '';
    document.getElementById('edit-wakeup').value = profile.wakeup || '';
    document.getElementById('edit-sleep').value = profile.sleep || '';
    document.getElementById('edit-target-wealth').value = profile.targetWealth || '3억';
    document.getElementById('edit-income').value = profile.currentIncome || '';
    document.getElementById('edit-savings').value = profile.currentSavings || '';

    document.getElementById('modal-edit-profile').style.display = 'flex';
  },

  saveProfile() {
    const profile = Storage.getProfile();
    if (!profile) return;

    profile.nickname = document.getElementById('edit-nickname').value.trim() || '오늘부터부자러';
    profile.job = document.getElementById('edit-job').value.trim();
    profile.wakeup = document.getElementById('edit-wakeup').value;
    profile.sleep = document.getElementById('edit-sleep').value;
    profile.targetWealth = document.getElementById('edit-target-wealth').value;
    profile.currentIncome = parseInt(document.getElementById('edit-income').value) || 0;
    profile.currentSavings = parseInt(document.getElementById('edit-savings').value) || 0;

    Storage.saveProfile(profile);
    this.closeModal('modal-edit-profile');
    this.renderProfile();
  },

  // ==================== 습관 추가 ====================
  _deleteTargetId: null,

  showAddHabitModal() {
    // 무료 제한 체크
    if (!Payment.canAddHabit()) {
      document.getElementById('modal-habit-limit').style.display = 'flex';
      return;
    }
    this._renderRecommendHabits();
    document.getElementById('modal-add-habit').style.display = 'flex';
  },

  switchAddHabitTab(el) {
    document.querySelectorAll('.add-habit-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    const tab = el.dataset.tab;
    document.getElementById('add-habit-recommend').style.display = tab === 'recommend' ? 'block' : 'none';
    document.getElementById('add-habit-custom').style.display = tab === 'custom' ? 'block' : 'none';
  },

  _renderRecommendHabits(filterCat) {
    const myHabits = HabitManager.getAll().map(h => h.id);
    const available = RichDB.HABITS.filter(h => !myHabits.includes(h.id));

    // 카테고리 필터
    const cats = [...new Set(available.map(h => h.category))];
    const filterEl = document.getElementById('add-habit-filter');
    filterEl.innerHTML = `<button class="add-habit-filter-btn ${!filterCat ? 'active' : ''}" onclick="App._renderRecommendHabits()">전체</button>` +
      cats.map(c => `<button class="add-habit-filter-btn ${filterCat === c ? 'active' : ''}" onclick="App._renderRecommendHabits('${c}')">${c}</button>`).join('');

    const filtered = filterCat ? available.filter(h => h.category === filterCat) : available;
    const listEl = document.getElementById('add-habit-list');

    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="add-habit-empty">추가할 수 있는 습관이 없어요.</div>';
      return;
    }

    listEl.innerHTML = filtered.map(h => {
      const timeIcon = h.timeSlot === 'morning' ? '\u{1F305}' : h.timeSlot === 'afternoon' ? '\u2600\uFE0F' : '\u{1F319}';
      return `
        <div class="add-habit-item" onclick="App.addRecommendHabit('${h.id}')">
          <div class="add-habit-item-info">
            <div class="add-habit-item-name">${h.name}</div>
            <div class="add-habit-item-meta">${timeIcon} ${h.category} · ${h.richPeople?.[0] || ''}</div>
          </div>
          <div class="add-habit-item-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
          </div>
        </div>
      `;
    }).join('');
  },

  addRecommendHabit(habitId) {
    const habit = RichDB.getHabitById(habitId);
    if (!habit) return;
    const result = HabitManager.addHabit(habit);
    if (!result.success && result.reason === 'habit_limit') {
      this.closeModal('modal-add-habit');
      document.getElementById('modal-habit-limit').style.display = 'flex';
      return;
    }
    // 추가된 항목 제거 애니메이션 대신 목록 갱신
    this._renderRecommendHabits();
    this.renderHome();
  },

  addCustomHabit() {
    const name = document.getElementById('custom-habit-name').value.trim();
    if (!name) {
      document.getElementById('custom-habit-name').focus();
      return;
    }
    const timeSlot = document.querySelector('input[name="custom-time"]:checked').value;
    const category = document.getElementById('custom-habit-category').value;
    const habit = {
      id: 'custom_' + Date.now(),
      name,
      category,
      timeSlot,
      richPeople: [],
      richStat: '나만의 습관',
      wealthImpact: { type: 'mindset', annualEffect: 0.01 },
    };
    const result = HabitManager.addHabit(habit);
    if (!result.success && result.reason === 'habit_limit') {
      this.closeModal('modal-add-habit');
      document.getElementById('modal-habit-limit').style.display = 'flex';
      return;
    }
    document.getElementById('custom-habit-name').value = '';
    this.closeModal('modal-add-habit');
    this.renderHome();
  },

  // ==================== 습관 삭제 ====================
  showDeleteHabit(habitId, e) {
    e.stopPropagation();
    const habit = HabitManager.getAll().find(h => h.id === habitId);
    if (!habit) return;
    this._deleteTargetId = habitId;
    document.getElementById('delete-habit-msg').textContent =
      `"${habit.name}" 습관을 삭제할까요?\n연속 기록과 통계가 초기화돼요.`;
    document.getElementById('modal-delete-habit').style.display = 'flex';
  },

  confirmDeleteHabit() {
    if (this._deleteTargetId) {
      HabitManager.removeHabit(this._deleteTargetId);
      this._deleteTargetId = null;
    }
    this.closeModal('modal-delete-habit');
    this.renderHome();
  },

  addNewHabit(habit) {
    const result = HabitManager.addHabit(habit);
    if (!result.success && result.reason === 'habit_limit') {
      document.getElementById('modal-habit-limit').style.display = 'flex';
      return false;
    }
    this.renderHome();
    return true;
  },

  _renderSubscription() {
    const section = document.getElementById('subscription-section');
    if (!section) return;

    if (Payment.isPremium()) {
      const remaining = Payment.getRemainingDays();
      const sub = Payment.getSubscription();
      section.innerHTML = `
        <div class="subscription-card">
          <div class="sub-status">
            <span class="sub-status-badge active">\u{1F451} Gold Pass</span>
            <span class="sub-remaining">${remaining}일 남음</span>
          </div>
          <p style="font-size:13px;color:var(--text-secondary)">광고 없이 모든 프리미엄 기능을 이용 중이에요.</p>
          ${sub?.orderId ? `<p style="font-size:11px;color:var(--text-tertiary);margin-top:8px">주문번호: ${sub.orderId.slice(0, 16)}...</p>` : ''}
        </div>
      `;
    } else {
      // 결제 완료 but 미지급 상태 체크
      const history = Payment.getPaymentHistory();
      const pending = history.find(h => h.status === 'PAYMENT_COMPLETED');

      let pendingNotice = '';
      if (pending) {
        pendingNotice = `
          <div style="font-size:12px;color:var(--warning);background:var(--warning-bg);padding:8px 12px;border-radius:var(--radius-md);margin-bottom:12px">
            결제 완료된 주문이 있어요. 앱을 다시 시작하면 자동 복원돼요.
          </div>
        `;
      }

      section.innerHTML = `
        <div class="subscription-card">
          <div class="sub-status">
            <span class="sub-status-badge free">Free</span>
          </div>
          ${pendingNotice}
          <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">Gold Pass로 광고 없이 무제한 습관을 관리해 보세요.</p>
          <button class="btn-primary btn-full sub-upgrade-btn" onclick="App.showPremiumModal('ad_free')">Gold Pass 시작하기</button>
        </div>
      `;
    }
  },
};

// ==================== 디버그 유틸 ====================
window.Debug = {
  clearGoldPass() {
    Storage.remove('subscription');
    alert('골드패스 해제 완료. 새로고침합니다.');
    location.reload();
  },
  setGoldPass() {
    Storage.save('subscription', {
      active: true,
      plan: 'gold_monthly',
      expiresAt: new Date().getTime() + 30 * 24 * 60 * 60 * 1000
    });
    alert('골드패스 적용 완료. 새로고침합니다.');
    location.reload();
  }
};

// ==================== 앱 시작 ====================
document.addEventListener('DOMContentLoaded', () => App.init());

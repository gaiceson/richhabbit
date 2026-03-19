/* ============================================
   Stats - 통계/차트 렌더링 (주간/월간 네비게이션)
   ============================================ */
const Stats = {
  _chartReady: false,
  _weekOffset: 0,   // 0 = 이번 주, -1 = 지난 주, ...
  _monthYear: null,  // 현재 보고 있는 연도
  _monthMonth: null, // 현재 보고 있는 월 (0-based)

  _waitForChart(cb) {
    if (typeof Chart !== 'undefined') {
      this._chartReady = true;
      cb();
    } else if (window._loadChartJs) {
      window._loadChartJs().then(() => {
        this._chartReady = true;
        cb();
      });
    } else {
      console.warn('Chart.js 로드 실패');
    }
  },

  _initDates() {
    const now = new Date();
    if (this._monthYear == null) this._monthYear = now.getFullYear();
    if (this._monthMonth == null) this._monthMonth = now.getMonth();
  },

  // ==================== 주간 네비게이션 ====================
  _getWeekBaseDate() {
    const d = new Date();
    d.setDate(d.getDate() + this._weekOffset * 7);
    return d;
  },

  _getWeekLabel() {
    const base = this._getWeekBaseDate();
    const start = new Date(base);
    start.setDate(start.getDate() - 6);
    const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
    if (this._weekOffset === 0) return `이번 주 (${fmt(start)}~${fmt(base)})`;
    return `${fmt(start)} ~ ${fmt(base)}`;
  },

  prevWeek() {
    this._weekOffset--;
    this.renderWeeklyChart();
  },

  nextWeek() {
    if (this._weekOffset >= 0) return;
    this._weekOffset++;
    this.renderWeeklyChart();
  },

  // ==================== 월간 네비게이션 ====================
  _getMonthLabel() {
    return `${this._monthYear}년 ${this._monthMonth + 1}월`;
  },

  _isCurrentMonth() {
    const now = new Date();
    return this._monthYear === now.getFullYear() && this._monthMonth === now.getMonth();
  },

  prevMonth() {
    this._monthMonth--;
    if (this._monthMonth < 0) {
      this._monthMonth = 11;
      this._monthYear--;
    }
    this.renderHeatmap();
  },

  nextMonth() {
    if (this._isCurrentMonth()) return;
    this._monthMonth++;
    if (this._monthMonth > 11) {
      this._monthMonth = 0;
      this._monthYear++;
    }
    this.renderHeatmap();
  },

  // ==================== 주간 차트 ====================
  renderWeeklyChart() {
    if (typeof Chart === 'undefined') {
      this._waitForChart(() => this.renderWeeklyChart());
      return;
    }

    // 캔버스를 매번 새로 생성해 Chart.js 잔존 문제 방지
    const container = document.getElementById('weekly-chart-container');
    if (!container) return;
    const oldCanvas = document.getElementById('weekly-chart');
    if (oldCanvas) {
      if (oldCanvas._chart) oldCanvas._chart.destroy();
      oldCanvas.remove();
    }
    const canvas = document.createElement('canvas');
    canvas.id = 'weekly-chart';
    container.appendChild(canvas);

    const baseDate = this._getWeekBaseDate();
    const weekData = HabitManager.getWeeklyData(baseDate);
    const ctx = canvas.getContext('2d');
    const todayStr = Storage.getToday();

    // 제목 업데이트
    const titleEl = document.getElementById('week-title');
    if (titleEl) titleEl.textContent = this._getWeekLabel();

    // 다음 주 버튼 비활성
    const nextBtn = document.getElementById('btn-week-next');
    if (nextBtn) nextBtn.disabled = this._weekOffset >= 0;

    canvas._chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: weekData.map(d => d.day),
        datasets: [{
          label: '달성률 %',
          data: weekData.map(d => d.percent),
          backgroundColor: weekData.map(d =>
            d.date === todayStr ? '#D4A574' : 'rgba(212,165,116,0.3)'
          ),
          borderRadius: 6,
          borderSkipped: false,
          barThickness: 28,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => {
                const idx = items[0].dataIndex;
                return weekData[idx].date + ' (' + weekData[idx].day + ')';
              },
              label: (item) => '달성률: ' + item.raw + '%'
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: (v) => v + '%',
              font: { size: 11 },
              color: '#8B95A1',
              stepSize: 25,
            },
            grid: { color: 'rgba(0,0,0,0.05)' }
          },
          x: {
            ticks: { font: { size: 12, weight: '600' }, color: '#4E5968' },
            grid: { display: false }
          }
        }
      }
    });
  },

  // ==================== 월간 히트맵 ====================
  _selectedDate: null,

  renderHeatmap() {
    this._initDates();
    const container = document.getElementById('monthly-heatmap');
    if (!container) return;

    const monthData = HabitManager.getMonthlyData(this._monthYear, this._monthMonth);
    const dayHeaders = ['일', '월', '화', '수', '목', '금', '토'];

    // 제목 업데이트
    const titleEl = document.getElementById('month-title');
    if (titleEl) titleEl.textContent = this._getMonthLabel();

    // 다음 월 버튼 비활성
    const nextBtn = document.getElementById('btn-month-next');
    if (nextBtn) nextBtn.disabled = this._isCurrentMonth();

    let html = dayHeaders.map(d => `<div class="heatmap-header">${d}</div>`).join('');

    monthData.forEach(d => {
      if (d.empty) {
        html += '<div class="heatmap-day empty"></div>';
      } else {
        const classes = ['heatmap-day'];
        if (d.level > 0) classes.push('level-' + d.level);
        if (d.isToday) classes.push('today');
        if (d.isFuture) classes.push('future');
        if (d.date === this._selectedDate) classes.push('selected');
        const clickable = !d.isFuture;
        html += `<div class="${classes.join(' ')}"${clickable ? ` onclick="Stats.showDayDetail('${d.date}')"` : ''} title="${d.date}"><span class="heatmap-num">${d.day}</span></div>`;
      }
    });

    container.innerHTML = html;

    // 선택된 날짜가 이 달에 있으면 상세 유지
    if (this._selectedDate) {
      const inThisMonth = monthData.some(d => d.date === this._selectedDate);
      if (inThisMonth) {
        this._renderDayDetail(this._selectedDate);
      } else {
        this._hideDayDetail();
      }
    }
  },

  showDayDetail(dateStr) {
    // 같은 날짜 다시 탭하면 닫기
    if (this._selectedDate === dateStr) {
      this._selectedDate = null;
      this._hideDayDetail();
      this._updateSelectedDay();
      return;
    }
    this._selectedDate = dateStr;
    this._updateSelectedDay();
    this._renderDayDetail(dateStr);
  },

  _updateSelectedDay() {
    document.querySelectorAll('.heatmap-day').forEach(el => el.classList.remove('selected'));
    if (this._selectedDate) {
      document.querySelectorAll('.heatmap-day').forEach(el => {
        if (el.getAttribute('onclick')?.includes(this._selectedDate)) {
          el.classList.add('selected');
        }
      });
    }
  },

  _hideDayDetail() {
    const detail = document.getElementById('day-detail');
    if (detail) detail.style.display = 'none';
  },

  _renderDayDetail(dateStr) {
    const detail = document.getElementById('day-detail');
    if (!detail) return;

    const records = Storage.getRecords();
    const dayRecords = records[dateStr] || {};
    const habits = HabitManager.getAll();
    const doneCount = habits.filter(h => dayRecords[h.id]?.done).length;
    const percent = habits.length > 0 ? Math.round((doneCount / habits.length) * 100) : 0;

    // 날짜 포맷
    const parts = dateStr.split('-');
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const dayName = dayNames[dateObj.getDay()];
    const label = `${parseInt(parts[1])}월 ${parseInt(parts[2])}일 (${dayName})`;

    let html = `
      <div class="day-detail-header">
        <span class="day-detail-date">${label}</span>
        <span class="day-detail-rate ${percent >= 100 ? 'perfect' : percent > 0 ? 'partial' : ''}">${doneCount}/${habits.length} (${percent}%)</span>
      </div>
    `;

    if (habits.length === 0) {
      html += '<div class="day-detail-empty">등록된 습관이 없어요.</div>';
    } else {
      html += '<div class="day-detail-list">';
      habits.forEach(h => {
        const done = dayRecords[h.id]?.done;
        const time = done && dayRecords[h.id].completedAt
          ? new Date(dayRecords[h.id].completedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
          : '';
        html += `
          <div class="day-detail-item ${done ? 'done' : ''}">
            <span class="day-detail-check">${done ? '\u2705' : '\u2B1C'}</span>
            <span class="day-detail-name">${h.name}</span>
            ${time ? `<span class="day-detail-time">${time}</span>` : ''}
          </div>
        `;
      });
      html += '</div>';
    }

    detail.innerHTML = html;
    detail.style.display = 'block';
  },

  renderAIReport() {
    const container = document.getElementById('ai-report');
    if (!container) return;

    const profile = Storage.getProfile();
    if (!profile) {
      container.innerHTML = '<p>온보딩을 먼저 완료해 주세요.</p>';
      return;
    }

    const summary = AICoach.getAISummary();
    const today = Storage.getToday();
    const unlocked = Storage.load('ai_analysis_unlocked', null) === today;
    const isPremium = typeof Payment !== 'undefined' && Payment.isPremium();
    const { grade, wealthType, todayRate, weeklyRate, weakSlot } = summary;

    let html = `
      <div class="ai-summary-card">
        <div class="ai-summary-grid">
          <div class="ai-summary-stat">
            <span class="ai-stat-value">${todayRate}%</span>
            <span class="ai-stat-label">습관 달성률</span>
          </div>
          <div class="ai-summary-stat">
            <span class="ai-grade-badge" style="color:${grade.color}">${grade.label}</span>
            <span class="ai-stat-label">오늘의 평가</span>
          </div>
        </div>
        <div class="ai-wealth-chip"><span>${wealthType.emoji}</span><span>${wealthType.name}</span></div>
        <div class="ai-weak-point">⚠ ${weakSlot} 루틴 성공률 낮음</div>
      </div>
    `;

    if (unlocked || isPremium) {
      html += this._renderDetailedAnalysis();
    } else {
      html += `
        <div class="ai-unlock-box">
          <div class="ai-unlock-icon">📺</div>
          <div class="ai-unlock-desc">광고를 보면 오늘의 부자 리포트를 확인해요</div>
          <div class="ai-unlock-detail">4가지 분석 · 부자 유형 · 미래 예측</div>
          <button class="btn-primary btn-full" onclick="Stats.unlockDetailedAnalysis()" style="margin-top:12px">광고 보고 상세 분석 보기</button>
        </div>
      `;
    }

    // 공유 버튼 (요약 카드 아래 항상 노출)
    html += `
      <button class="ai-share-btn" onclick="Share.shareAIReport()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        부자 리포트 공유하기
      </button>
    `;

    // 점수 히스토리 표시
    const trend = AICoach.getScoreTrend();
    if (trend.days >= 2) {
      const sign = trend.totalDiff >= 0 ? '+' : '';
      html = `
        <div class="ai-score-history-row">
          <div class="ai-score-history-stat">
            <span class="ai-score-history-value">${trend.firstScore}점</span>
            <span class="ai-score-history-label">Day 1</span>
          </div>
          <div class="ai-score-history-arrow">→</div>
          <div class="ai-score-history-stat">
            <span class="ai-score-history-value highlight">${trend.current}점</span>
            <span class="ai-score-history-label">오늘 (${trend.days}일째)</span>
          </div>
          <div class="ai-score-history-diff ${trend.totalDiff >= 0 ? 'up' : 'down'}">${sign}${trend.totalDiff}점</div>
        </div>
      ` + html;
    }

    container.innerHTML = html;
  },

  unlockDetailedAnalysis() {
    if (typeof Payment !== 'undefined' && Payment.isPremium()) {
      Storage.save('ai_analysis_unlocked', Storage.getToday());
      Stats.renderAIReport();
      return;
    }
    if (typeof AdManager === 'undefined') return;
    AdManager.showRewardAd(
      () => {
        Storage.save('ai_analysis_unlocked', Storage.getToday());
        Stats.renderAIReport();
      },
      () => {}
    );
  },

  _renderDetailedAnalysis() {
    const data = AICoach.getDetailedAnalysis();
    const { block1, block2, block3, block4, block5, productivityScore } = data;
    const habits = HabitManager.getAll();

    const patternBars = block2.patterns.map(p => {
      const cls = p.rate >= 70 ? 'good' : p.rate >= 40 ? 'mid' : 'low';
      return `
        <div class="ai-pattern-item">
          <span class="ai-pattern-slot">${p.emoji} ${p.slot}</span>
          <div class="ai-pattern-bar-wrap">
            <div class="ai-pattern-bar-fill ${cls}" style="width:${p.rate}%"></div>
          </div>
          <span class="ai-pattern-pct">${p.rate}%</span>
        </div>`;
    }).join('');

    const stabilityBars = habits.slice(0, 5).map(h => {
      const pct = Math.min(100, Math.round((h.streak || 0) / 66 * 100));
      return `
        <div class="ai-stability-item">
          <span class="ai-stability-name">${h.name}</span>
          <div class="ai-stability-bar-wrap">
            <div class="ai-stability-bar-fill" style="width:${pct}%"></div>
          </div>
          <span class="ai-stability-pct">${pct}%</span>
        </div>`;
    }).join('');

    const block1Html = block1.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    return `
      <div class="ai-block">
        <div class="ai-block-title">1️⃣ 오늘의 부자 분석</div>
        <p class="ai-block-text">${block1Html}</p>
      </div>
      <div class="ai-block">
        <div class="ai-block-title">2️⃣ 습관 패턴 분석</div>
        <div class="ai-pattern-title">AI 패턴 분석 (최근 7일)</div>
        <div class="ai-pattern-bars">${patternBars}</div>
        <div class="ai-block-comment">${block2.comment}</div>
      </div>
      <div class="ai-block">
        <div class="ai-block-title">3️⃣ 부자 유형 분석</div>
        <div class="ai-type-card">
          <div class="ai-type-emoji">${block3.emoji}</div>
          <div class="ai-type-label">당신의 습관 유형</div>
          <div class="ai-type-name">"${block3.name}"</div>
          ${block3.person ? `<div class="ai-type-person">${block3.person}과 유사한 패턴</div>` : ''}
          <div class="ai-type-desc">${block3.desc.replace(/\n/g, '<br>')}</div>
        </div>
      </div>
      <div class="ai-block">
        <div class="ai-block-title">4️⃣ 미래 성장 예측</div>
        <div class="ai-future-grid">
          <div class="ai-future-card">
            <div class="ai-future-period">6개월 후</div>
            <div class="ai-future-value">${block4.sixMonthProb}%</div>
            <div class="ai-future-desc">루틴 안정화 확률</div>
          </div>
          <div class="ai-future-card">
            <div class="ai-future-period">1년 후</div>
            <div class="ai-future-value">+${block4.oneYearAsset}%</div>
            <div class="ai-future-desc">예상 자산 성장</div>
          </div>
        </div>
        <div class="ai-productivity-row">
          <span class="ai-productivity-label">생산성 점수</span>
          <span class="ai-productivity-score">${productivityScore}점</span>
        </div>
      </div>
      <div class="ai-block">
        <div class="ai-block-title">🤖 AI 추천</div>
        <p class="ai-block-text">${block5}</p>
      </div>
      <div class="ai-block">
        <div class="ai-block-title">📊 습관 안정도</div>
        <div class="ai-habit-stability">${stabilityBars}</div>
      </div>
    `;
  },

  renderStreakInfo() {
    const container = document.getElementById('streak-info');
    if (!container) return;

    const currentStreak = Gamification.getCurrentStreak();
    const bestStreak = HabitManager.getBestStreak();
    const totalDays = HabitManager.getTotalDays();

    container.innerHTML = `
      <div class="streak-item">
        <div class="streak-value">${currentStreak}</div>
        <div class="streak-label">현재 연속</div>
      </div>
      <div class="streak-item">
        <div class="streak-value">${bestStreak}</div>
        <div class="streak-label">최고 기록</div>
      </div>
      <div class="streak-item">
        <div class="streak-value">${totalDays}</div>
        <div class="streak-label">총 실천일</div>
      </div>
    `;
  },

  renderWeeklyReport() {
    const container = document.getElementById('weekly-report');
    if (!container) return;

    const today = Storage.getToday();
    const weekKey = today.slice(0, 7); // YYYY-MM
    const unlocked = Storage.load('weekly_report_unlocked', null) === weekKey;
    const isPremium = typeof Payment !== 'undefined' && Payment.isPremium();
    const data = AICoach.getWeeklyReportData();

    const diffSign = data.scoreDiff >= 0 ? '+' : '';
    const diffColor = data.scoreDiff >= 0 ? '#10B981' : '#EF4444';
    const diffArrow = data.scoreDiff >= 0 ? '▲' : '▼';

    // 요약 (무료)
    let html = `
      <div class="weekly-summary-row">
        <div class="weekly-stat">
          <span class="weekly-stat-value">${data.weeklyRate}%</span>
          <span class="weekly-stat-label">이번 주 달성률</span>
        </div>
        <div class="weekly-stat">
          <span class="weekly-stat-value">${data.score}점</span>
          <span class="weekly-stat-label">습관 점수</span>
        </div>
        <div class="weekly-stat">
          <span class="weekly-stat-value" style="color:${diffColor}">${diffArrow} ${Math.abs(data.scoreDiff)}점</span>
          <span class="weekly-stat-label">전주 대비</span>
        </div>
      </div>
    `;

    if (unlocked || isPremium) {
      html += `
        <div class="weekly-detail">
          <div class="weekly-best-day">
            <span class="weekly-detail-label">🏆 최고 달성일</span>
            <span class="weekly-detail-value">${data.bestDay.day}요일 (${data.bestDay.percent}%)</span>
          </div>
          <div class="weekly-slot-bars">
            ${[
              { label: '🌅 아침', rate: data.slotRates.morning },
              { label: '☀️ 낮',   rate: data.slotRates.afternoon },
              { label: '🌙 저녁', rate: data.slotRates.evening },
            ].map(s => {
              const cls = s.rate >= 70 ? 'good' : s.rate >= 40 ? 'mid' : 'low';
              return `
                <div class="ai-pattern-item">
                  <span class="ai-pattern-slot">${s.label}</span>
                  <div class="ai-pattern-bar-wrap">
                    <div class="ai-pattern-bar-fill ${cls}" style="width:${s.rate}%"></div>
                  </div>
                  <span class="ai-pattern-pct">${s.rate}%</span>
                </div>`;
            }).join('')}
          </div>
          <div class="weekly-recommendation">💡 ${data.recommendation}</div>
        </div>
      `;
    } else {
      html += `
        <div class="weekly-locked">
          <div class="weekly-locked-text">📺 광고를 보면 시간대별 분석 · 최고 달성일 · AI 추천을 확인해요</div>
          <button class="btn-primary btn-full" onclick="Stats.unlockWeeklyReport()" style="margin-top:10px">광고 보고 주간 분석 보기</button>
        </div>
      `;
    }

    container.innerHTML = html;
  },

  unlockWeeklyReport() {
    const weekKey = Storage.getToday().slice(0, 7);
    if (typeof Payment !== 'undefined' && Payment.isPremium()) {
      Storage.save('weekly_report_unlocked', weekKey);
      Stats.renderWeeklyReport();
      return;
    }
    if (typeof AdManager === 'undefined') return;
    AdManager.showRewardAd(
      () => {
        Storage.save('weekly_report_unlocked', weekKey);
        Stats.renderWeeklyReport();
      },
      () => {}
    );
  },

  refreshAll() {
    // 날짜 초기화 (통계 탭 진입 시 현재 달로 리셋)
    this._weekOffset = 0;
    const now = new Date();
    this._monthYear = now.getFullYear();
    this._monthMonth = now.getMonth();

    // 오늘 날짜를 자동 선택하여 상세 표시
    this._selectedDate = Storage.getToday();

    // 히트맵·스트릭은 즉시 렌더 (DOM 기반, 딜레이 불필요)
    this.renderHeatmap();
    this.renderStreakInfo();
    this.renderWeeklyReport();
    this.renderAIReport();

    // 차트는 캔버스 크기 계산을 위해 다음 프레임에서 렌더
    requestAnimationFrame(() => {
      this.renderWeeklyChart();
    });
  }
};

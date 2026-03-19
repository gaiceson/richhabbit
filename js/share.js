/* ============================================
   Share - 공유 기능
   ============================================ */
const Share = {
  generateShareText() {
    const profile = Storage.getProfile();
    const progress = HabitManager.getTodayProgress();
    const streak = Gamification.getCurrentStreak();
    const level = Gamification.getLevel(profile?.xp || 0);

    let text = `[오늘부터 부자] ${profile?.nickname || ''}님의 오늘\n`;
    text += `달성률: ${progress.percent}% (${progress.done}/${progress.total})\n`;
    text += `연속: ${streak}일 | 등급: ${level.emoji} ${level.name}\n`;
    text += `\n세계 부자들의 습관을 내 것으로!`;
    return text;
  },

  async shareResult() {
    const text = this.generateShareText();
    // 토스 네이티브 공유 (카카오톡 등 SNS 공유 시트)
    if (typeof window.tossShare === 'function') {
      try {
        await window.tossShare({ message: text });
        return;
      } catch (e) {}
    }
    // 폴백: Web Share API
    if (navigator.share) {
      try {
        await navigator.share({ title: '오늘부터 부자', text });
        return;
      } catch (e) {}
    }
    this._fallbackCopy(text);
  },

  _fallbackCopy(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
  },

  // ==================== AI 분석 공유 ====================
  generateAIShareText() {
    const summary = AICoach.getAISummary();
    const data = AICoach.getDetailedAnalysis();
    const profile = Storage.getProfile();
    const streak = HabitManager.getAllClearStreak();
    const name = profile?.nickname || '오늘부터부자러';

    const todayAnalysis = data.block1.replace(/\*\*/g, '');
    return [
      `📊 ${name}님의 오늘의 부자 리포트`,
      ``,
      `📌 오늘의 분석`,
      todayAnalysis,
      ``,
      `📊 달성률: ${summary.todayRate}%  평가: ${summary.grade.label}`,
      `${data.block3.emoji} 성장 유형: ${data.block3.name}`,
      `🔥 연속 달성: ${streak}일`,
      ``,
      `📈 미래 예측`,
      `6개월 후 루틴 안정화: ${data.block4.sixMonthProb}%`,
      `1년 후 예상 자산 성장: +${data.block4.oneYearAsset}%`,
      ``,
      `💡 AI 추천`,
      data.block5,
      ``,
      `세계 부자들의 습관을 내 것으로!`,
      `#오늘부터부자 #오늘의부자리포트 #습관챌린지`,
    ].join('\n');
  },

  async shareAIReport() {
    const text = this.generateAIShareText();
    const imageBlob = await this._generateAICard();

    // 1) 이미지 + 텍스트 공유 (Web Share API Level 2)
    if (imageBlob) {
      const file = new File([imageBlob], 'ai-report.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ title: '오늘의 부자 리포트', text, files: [file] });
          return;
        } catch (e) {}
      }
    }

    // 2) 토스 네이티브 공유
    if (typeof window.tossShare === 'function') {
      try {
        await window.tossShare({ message: text });
        return;
      } catch (e) {}
    }

    // 3) Web Share API 텍스트만
    if (navigator.share) {
      try {
        await navigator.share({ title: '오늘의 부자 리포트', text });
        return;
      } catch (e) {}
    }

    // 4) 클립보드 복사 폴백
    this._fallbackCopy(text);
    this._showCopyToast();
  },

  _generateAICard() {
    return new Promise((resolve) => {
      try {
        const summary = AICoach.getAISummary();
        const data = AICoach.getDetailedAnalysis();
        const profile = Storage.getProfile();
        const streak = HabitManager.getAllClearStreak();
        const name = profile?.nickname || '오늘부터부자러';

        const W = 375, H = 580;
        const canvas = document.createElement('canvas');
        canvas.width = W * 2;
        canvas.height = H * 2;
        const ctx = canvas.getContext('2d');
        ctx.scale(2, 2);

        // 배경
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#1A1A2E');
        bg.addColorStop(1, '#16213E');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);

        // 골드 사이드 라인
        const lineGrad = ctx.createLinearGradient(0, 0, 0, H);
        lineGrad.addColorStop(0, '#D4A574');
        lineGrad.addColorStop(1, '#B8860B');
        ctx.fillStyle = lineGrad;
        ctx.fillRect(0, 0, 3, H);

        // 앱명 + 날짜
        ctx.fillStyle = '#D4A574';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('오늘부터 부자', 20, 32);
        ctx.fillStyle = '#6B7684';
        ctx.font = '11px sans-serif';
        const dateStr = Storage.getToday();
        ctx.fillText(dateStr, W - 20 - ctx.measureText(dateStr).width, 32);

        // 제목
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText('오늘의 부자 리포트', 20, 68);

        // 유형 뱃지
        const typeLabel = `${data.block3.emoji} ${data.block3.name}`;
        ctx.fillStyle = 'rgba(212,165,116,0.15)';
        ctx.fillRect(20, 80, ctx.measureText(typeLabel).width + 20, 24);
        ctx.fillStyle = '#D4A574';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(typeLabel, 30, 96);

        // 구분선
        const drawLine = (y) => {
          ctx.strokeStyle = 'rgba(255,255,255,0.08)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(20, y);
          ctx.lineTo(W - 20, y);
          ctx.stroke();
        };
        drawLine(116);

        // 오늘 스탯 3개
        ctx.textAlign = 'center';
        const colW = (W - 40) / 3;
        [
          { label: '달성률', value: `${summary.todayRate}%` },
          { label: '평가',   value: summary.grade.label },
          { label: '연속',   value: `${streak}일` },
        ].forEach((s, i) => {
          const x = 20 + colW * i + colW / 2;
          ctx.fillStyle = '#D4A574';
          ctx.font = 'bold 26px sans-serif';
          ctx.fillText(s.value, x, 158);
          ctx.fillStyle = '#6B7684';
          ctx.font = '11px sans-serif';
          ctx.fillText(s.label, x, 176);
        });
        ctx.textAlign = 'left';

        drawLine(196);

        // 미래 예측
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('📈 미래 성장 예측', 20, 220);

        [
          { period: '6개월 후', value: `${data.block4.sixMonthProb}%`, desc: '루틴 안정화 확률' },
          { period: '1년 후',   value: `+${data.block4.oneYearAsset}%`, desc: '예상 자산 성장' },
        ].forEach((p, i) => {
          const bx = 20 + i * ((W - 50) / 2 + 10);
          const bw = (W - 50) / 2;
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fillRect(bx, 232, bw, 58);
          ctx.fillStyle = '#6B7684';
          ctx.font = '10px sans-serif';
          ctx.fillText(p.period, bx + 10, 250);
          ctx.fillStyle = '#D4A574';
          ctx.font = 'bold 22px sans-serif';
          ctx.fillText(p.value, bx + 10, 274);
          ctx.fillStyle = '#6B7684';
          ctx.font = '10px sans-serif';
          ctx.fillText(p.desc, bx + 10, 286);
        });

        drawLine(304);

        // 오늘의 분석
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('📌 오늘의 분석', 20, 328);
        ctx.fillStyle = '#C0C8D0';
        ctx.font = '11px sans-serif';
        this._wrapText(ctx, data.block1.replace(/\*\*/g, ''), 20, 346, W - 40, 16);

        drawLine(396);

        // AI 추천
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('💡 AI 추천', 20, 416);
        ctx.fillStyle = '#C0C8D0';
        ctx.font = '10px sans-serif';
        this._wrapText(ctx, data.block5, 20, 432, W - 40, 16);

        // 해시태그
        ctx.fillStyle = 'rgba(212,165,116,0.6)';
        ctx.font = '11px sans-serif';
        ctx.fillText('#오늘부터부자  #AI분석  #습관챌린지', 20, H - 16);

        canvas.toBlob(resolve, 'image/png');
      } catch (e) {
        resolve(null);
      }
    });
  },

  _wrapText(ctx, text, x, y, maxW, lineH) {
    const words = text.split(' ');
    let line = '';
    let curY = y;
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, curY);
        line = word;
        curY += lineH;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, curY);
  },

  _showCopyToast() {
    let toast = document.getElementById('share-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'share-toast';
      toast.className = 'share-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = '📋 분석 결과가 복사됐어요!';
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 2500);
  },
};

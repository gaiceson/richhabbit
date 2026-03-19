/* ============================================
   Wealth Simulator - 자산 시뮬레이터 엔진
   기본 모드: 모든 사용자
   심화 모드: Gold Pass (인플레이션, 세금, 저축률 반영)
   ============================================ */
const WealthSimulator = {
  IMPACT_FACTORS: {
    saving:     { type: 'direct',      annual: 6000000 },
    reading:    { type: 'income_mult', annual: 0.03 },
    exercise:   { type: 'save',        annual: 1200000 },
    networking: { type: 'income_mult', annual: 0.02 },
    investing:  { type: 'return_mult', annual: 0.02 },
    early_rise: { type: 'income_mult', annual: 0.05 },
    mindset:    { type: 'income_mult', annual: 0.01 },
  },

  // 기본 시뮬레이션 (무료)
  project(habits, completionRate, years, income, savings) {
    years = years || 10;
    income = income || 40000000;
    savings = savings || 5000000;
    const results = [];

    for (let y = 1; y <= years; y++) {
      let yearSave = 0;
      let incomeGrowth = 1.02;
      let returnRate = 0.07;

      habits.forEach(h => {
        const impactType = h.wealthImpact?.type;
        const factor = this.IMPACT_FACTORS[impactType];
        if (!factor) return;
        const adj = (completionRate || 70) / 100;

        switch (factor.type) {
          case 'direct':
            yearSave += factor.annual * adj;
            break;
          case 'income_mult':
            incomeGrowth += factor.annual * adj;
            break;
          case 'save':
            yearSave += factor.annual * adj;
            break;
          case 'return_mult':
            returnRate += factor.annual * adj;
            break;
        }
      });

      income = Math.round(income * incomeGrowth);
      savings = Math.round((savings + yearSave) * (1 + returnRate));
      results.push({ year: y, income, savings });
    }
    return results;
  },

  // 심화 시뮬레이션 (Gold Pass 전용)
  // 인플레이션, 세금, 저축률을 반영한 정밀 예측
  projectAdvanced(habits, completionRate, years, income, savings, options) {
    years = years || 30;
    income = income || 40000000;
    savings = savings || 5000000;
    const inflationRate = (options?.inflation ?? 3) / 100;   // 기본 3%
    const taxRate = (options?.tax ?? 15.4) / 100;             // 기본 15.4% (이자/배당 소득세)
    const savingRatio = (options?.savingRatio ?? 30) / 100;   // 소득 대비 저축 비율

    const results = [];
    let realSavings = savings; // 실질 자산 (인플레이션 반영)

    for (let y = 1; y <= years; y++) {
      let yearSave = 0;
      let incomeGrowth = 1.02;
      let returnRate = 0.07;

      habits.forEach(h => {
        const impactType = h.wealthImpact?.type;
        const factor = this.IMPACT_FACTORS[impactType];
        if (!factor) return;
        const adj = (completionRate || 70) / 100;

        switch (factor.type) {
          case 'direct':
            yearSave += factor.annual * adj;
            break;
          case 'income_mult':
            incomeGrowth += factor.annual * adj;
            break;
          case 'save':
            yearSave += factor.annual * adj;
            break;
          case 'return_mult':
            returnRate += factor.annual * adj;
            break;
        }
      });

      income = Math.round(income * incomeGrowth);

      // 소득 기반 저축 추가
      const incomeSaving = Math.round(income * savingRatio);
      yearSave += incomeSaving;

      // 투자 수익 (세전)
      const grossReturn = savings * returnRate;
      // 세금 차감
      const netReturn = grossReturn * (1 - taxRate);

      // 명목 자산
      savings = Math.round(savings + yearSave + netReturn);

      // 실질 자산 (인플레이션 반영)
      realSavings = Math.round(savings / Math.pow(1 + inflationRate, y));

      results.push({
        year: y,
        income,
        savings,          // 명목 자산
        realSavings,      // 실질 자산 (오늘 가치)
        inflationLoss: savings - realSavings,
        taxPaid: Math.round(grossReturn * taxRate),
      });
    }
    return results;
  },

  getQuickProjection(habits, completionRate) {
    const profile = Storage.getProfile();
    const income = (profile?.currentIncome || 4000) * 10000;
    const savings = (profile?.currentSavings || 500) * 10000;
    return this.project(habits, completionRate, 10, income, savings);
  },

  formatMoney(amount) {
    if (amount >= 100000000) {
      return Math.round(amount / 100000000 * 10) / 10 + '억원';
    }
    if (amount >= 10000) {
      return Math.round(amount / 10000).toLocaleString() + '만원';
    }
    return amount.toLocaleString() + '원';
  },

  // 기본 차트 (단일 라인)
  renderChart(canvasId, results) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (canvas._chart) {
      canvas._chart.destroy();
    }

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: results.map(r => r.year + '년'),
        datasets: [{
          label: '예상 자산',
          data: results.map(r => r.savings),
          borderColor: '#D4A574',
          backgroundColor: 'rgba(212,165,116,0.1)',
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointBackgroundColor: '#D4A574',
          pointRadius: 3,
        }]
      },
      options: this._getChartOptions(),
    });
    canvas._chart = chart;
  },

  // 심화 차트 (명목 vs 실질)
  renderAdvancedChart(canvasId, results) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (canvas._chart) {
      canvas._chart.destroy();
    }

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: results.map(r => r.year + '년'),
        datasets: [
          {
            label: '명목 자산',
            data: results.map(r => r.savings),
            borderColor: '#D4A574',
            backgroundColor: 'rgba(212,165,116,0.08)',
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 2,
          },
          {
            label: '실질 자산 (인플레이션 반영)',
            data: results.map(r => r.realSavings),
            borderColor: '#10B981',
            backgroundColor: 'rgba(16,185,129,0.08)',
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 2,
          },
        ]
      },
      options: {
        ...this._getChartOptions(),
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              font: { size: 11 },
              color: '#8B95A1',
              usePointStyle: true,
              padding: 12,
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${WealthSimulator.formatMoney(ctx.raw)}`
            }
          }
        },
      },
    });
    canvas._chart = chart;
  },

  _getChartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => WealthSimulator.formatMoney(ctx.raw)
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (val) => WealthSimulator.formatMoney(val),
            font: { size: 11 },
            color: '#8B95A1',
            maxTicksLimit: 5,
          },
          grid: { color: 'rgba(0,0,0,0.05)' }
        },
        x: {
          ticks: {
            font: { size: 11 },
            color: '#8B95A1',
            maxTicksLimit: 6,
          },
          grid: { display: false }
        }
      }
    };
  },
};

/* ============================================
   AdManager - 토스 인앱 광고 SDK 연동

   토스 인앱광고 2.0 ver2 기준
   - 배너 광고: TossAds.initialize() → TossAds.attachBanner()
   - 전면형/보상형: loadFullScreenAd() → showFullScreenAd()
   - 테스트 ID 사용 (운영 ID 사용 시 제재 가능)

   QA 가이드 준수:
   - 사전 로드 수행
   - 핵심 플로우(결제/가입) 중 광고 노출 차단
   - 보상은 userEarnedReward 이벤트에서만 지급
   - 광고 재생 중 앱 사운드 중단
   - 쿨다운 적용
   ============================================ */
const AdManager = {
  _initialized: false,
  _sdkAvailable: false,
  _bannerAttached: null,
  _rewardAdLoaded: false,
  _interstitialLoaded: false,
  _cooldown: false,

  // ==================== 광고 그룹 ID ====================
  // 개발/테스트 환경: 공식 테스트 ID
  // 운영 환경: 콘솔에서 발급받은 실제 ID로 교체
  AD_GROUP_IDS: {
    interstitial: 'ait.dev.43daa14da3ae487b',
    rewarded: 'ait.v2.live.7b90676a43a94211',
    bannerList: 'ait.v2.live.66fbbf0d80bf457d',
    bannerFeed: 'ait.v2.live.66fbbf0d80bf457d',
  },

  // 보상형 광고 보상 설정 (콘솔 설정과 일치해야 함)
  REWARD_CONFIG: {
    title: '부자 찬스!',
    desc: '영상을 시청하면 오늘의 연속 달성 기록을 유지할 수 있어요.',
    btnWatch: '영상 보고 찬스 받기',
    btnSkip: '다음에 할게요',
    xpReward: 50,
  },

  // 쿨다운 설정 (ms)
  COOLDOWN: {
    interstitial: 60000,   // 전면 광고 간 최소 60초
    banner_reshow: 30000,  // 배너 닫기 후 30초 뒤 재표시
  },

  // 개발 환경 폴백용 더미 배너 컨텐츠
  _DEV_BANNERS: [
    { id: 'dev_1', title: '토스증권', desc: '주식 시작하기, 수수료 0원', color: '#3182F6' },
    { id: 'dev_2', title: '토스뱅크 적금', desc: '연 4.5% 파킹통장', color: '#10B981' },
    { id: 'dev_3', title: '클래스101', desc: '부자 마인드셋 온라인 강의', color: '#7C3AED' },
    { id: 'dev_4', title: '오늘의 부자 루틴', desc: '습관 체크로 자산을 키워보세요', color: '#F59E0B' },
  ],

  // ==================== 초기화 ====================
  init() {
    if (this._initialized) return;

    // 앱 로딩 완료 후 2초 뒤 광고 모듈 초기화 (성능 영향 최소화)
    setTimeout(() => {
      try {
        this._initialized = true;
        if (Payment.isPremium()) return;

        this._sdkAvailable = this._checkSDKAvailable();
        console.log('[AdManager] SDK 지원:', this._sdkAvailable);

        if (this._sdkAvailable) {
          this._initTossAds();
        } else {
          this._showDevBanner();
        }
        this._preloadRewardAd();
      } catch (e) {
        console.warn('[AdManager] init 실패:', e.message);
        this._showDevBanner();
      }
    }, 2000);
  },

  // SDK 지원 여부 확인
  _checkSDKAvailable() {
    try {
      if (typeof window.loadFullScreenAd === 'function') {
        // isSupported가 있으면 우선 사용, 없으면 함수 존재 자체로 판단
        if (typeof window.loadFullScreenAd.isSupported === 'function') {
          return window.loadFullScreenAd.isSupported();
        }
        return true;
      }
    } catch (e) {
      console.warn('[AdManager] SDK 지원 체크 실패:', e.message);
    }
    try {
      if (typeof window.TossAds !== 'undefined') return true;
    } catch (e) {}
    return false;
  },

  // ==================== 배너 광고 (TossAds.attachBanner) ====================
  // 토스 SDK 배너: DOM 요소에 부착하는 형태
  _initTossAds() {
    if (!this._sdkAvailable) return;
    if (!window.TossAds || typeof window.TossAds.initialize !== 'function') {
      console.warn('[AdManager] TossAds 미로드 — 배너 스킵');
      this._showDevBanner();
      return;
    }

    window.TossAds.initialize({
      callbacks: {
        onInitialized: () => {
          this._attachBanner();
        },
        onInitializationFailed: (error) => {
          console.warn('[AdManager] TossAds 초기화 실패:', error);
          // 폴백: 개발 환경 배너
          this._showDevBanner();
        },
      },
    });
  },

  // 리스트형 배너 부착
  _attachBanner() {
    if (Payment.isPremium()) return;
    const container = document.getElementById('ad-banner');
    if (!container) return;

    // 기존 배너 제거
    if (this._bannerAttached) {
      this._bannerAttached.destroy();
      this._bannerAttached = null;
    }

    // 홈 화면에서만 노출
    const isHome = typeof App !== 'undefined' && App.currentScreen === 'screen-home';
    container.style.display = isHome ? 'block' : 'none';
    if (isHome) this._setTabSpacerForBanner(true);

    this._bannerAttached = window.TossAds.attachBanner(
      this.AD_GROUP_IDS.bannerList,
      container,
      {
        theme: 'light',
        tone: 'blackAndWhite',
        variant: 'expanded',
        callbacks: {
          onAdRendered: (payload) => {
            this._trackEvent('banner', 'rendered', payload.adGroupId);
          },
          onAdImpression: (payload) => {
            this._trackEvent('banner', 'impression', payload.adGroupId);
          },
          onAdClicked: (payload) => {
            this._trackEvent('banner', 'click', payload.adGroupId);
          },
          onAdFailedToRender: (payload) => {
            console.warn('[AdManager] 배너 렌더링 실패:', payload);
            container.style.display = 'none';
          },
          onNoFill: () => {
            // 광고 없음 → 개발 환경 배너로 폴백
            container.style.display = 'none';
            this._showDevBanner();
          },
        },
      }
    );
  },

  // 피드형(네이티브 이미지) 배너 부착 (도서관 내)
  attachFeedBanner(targetElement) {
    if (Payment.isPremium()) return null;
    if (!this._sdkAvailable || !targetElement) return null;

    return window.TossAds.attachBanner(
      this.AD_GROUP_IDS.bannerFeed,
      targetElement,
      {
        theme: 'light',
        tone: 'grey',
        variant: 'card',
        callbacks: {
          onAdImpression: (payload) => {
            this._trackEvent('feed', 'impression', payload.adGroupId);
          },
          onAdClicked: (payload) => {
            this._trackEvent('feed', 'click', payload.adGroupId);
          },
          onNoFill: () => {
            targetElement.style.display = 'none';
          },
        },
      }
    );
  },

  // ==================== 전면형 광고 (loadFullScreenAd → showFullScreenAd) ====================
  // 화면 전환 시점처럼 흐름이 단절되는 구간에서 노출
  _preloadInterstitial() {
    if (!this._sdkAvailable || Payment.isPremium()) return;
    if (typeof window.loadFullScreenAd !== 'function') return;

    this._interstitialUnregister = window.loadFullScreenAd({
      options: { adGroupId: this.AD_GROUP_IDS.interstitial },
      onEvent: (data) => {
        if (data.type === 'loaded') {
          this._interstitialLoaded = true;
        }
      },
      onError: (err) => {
        console.warn('[AdManager] 전면 광고 로드 실패:', err);
        this._interstitialLoaded = false;
      },
    });
  },

  showInterstitial(onDismissed) {
    if (Payment.isPremium()) {
      if (onDismissed) onDismissed();
      return;
    }
    if (this._cooldown) {
      if (onDismissed) onDismissed();
      return;
    }

    // SDK 사용 가능 + 로드 완료
    if (this._sdkAvailable && this._interstitialLoaded && typeof window.showFullScreenAd === 'function') {
      this._cooldown = true;
      setTimeout(() => { this._cooldown = false; }, this.COOLDOWN.interstitial);

      this._interstitialShowUnregister = window.showFullScreenAd({
        options: { adGroupId: this.AD_GROUP_IDS.interstitial },
        onEvent: (data) => {
          switch (data.type) {
            case 'show':
              this._trackEvent('interstitial', 'show', this.AD_GROUP_IDS.interstitial);
              break;
            case 'impression':
              this._trackEvent('interstitial', 'impression', this.AD_GROUP_IDS.interstitial);
              break;
            case 'clicked':
              this._trackEvent('interstitial', 'click', this.AD_GROUP_IDS.interstitial);
              break;
            case 'dismissed':
              this._interstitialLoaded = false;
              if (onDismissed) onDismissed();
              // 닫힌 후 다음 광고 사전 로드
              this._preloadInterstitial();
              break;
            case 'failedToShow':
              if (onDismissed) onDismissed();
              this._preloadInterstitial();
              break;
          }
        },
        onError: (err) => {
          console.warn('[AdManager] 전면 광고 표시 실패:', err);
          if (onDismissed) onDismissed();
        },
      });
    } else {
      // SDK 미지원 환경: 바로 콜백
      if (onDismissed) onDismissed();
    }
  },

  // ==================== 보상형 광고 (부자 찬스) ====================
  // QA 핵심: userEarnedReward 이벤트에서만 보상 지급
  _preloadRewardAd() {
    if (!this._sdkAvailable || Payment.isPremium()) return;
    if (typeof window.loadFullScreenAd !== 'function') return;

    this._rewardUnregister = window.loadFullScreenAd({
      options: { adGroupId: this.AD_GROUP_IDS.rewarded },
      onEvent: (data) => {
        if (data.type === 'loaded') {
          this._rewardAdLoaded = true;
        }
      },
      onError: (err) => {
        console.warn('[AdManager] 보상형 광고 로드 실패 adGroupId:', this.AD_GROUP_IDS.rewarded, 'error:', JSON.stringify(err));
        this._rewardAdLoaded = false;
      },
    });
  },

  showRewardAd(onComplete, onSkip) {
    if (Payment.isPremium()) {
      if (onComplete) onComplete();
      return;
    }

    // 호출 시점에 SDK 재확인 (2초 init 딜레이 대응)
    if (!this._sdkAvailable) {
      this._sdkAvailable = this._checkSDKAvailable();
    }

    // SDK 광고 로드 완료 → 바로 재생
    if (this._sdkAvailable && this._rewardAdLoaded && typeof window.showFullScreenAd === 'function') {
      this._showSDKRewardAd(onComplete, onSkip);
      return;
    }

    const modal = document.getElementById('modal-reward-ad');
    modal.style.display = 'flex';

    // SDK는 지원되지만 광고 미로드 → 즉시 새로 로드 (최대 5초 대기)
    if (this._sdkAvailable && typeof window.loadFullScreenAd === 'function') {
      document.getElementById('reward-ad-title').style.display = 'none';
      document.getElementById('reward-ad-desc').style.display = 'none';
      document.getElementById('reward-ad-watch').style.display = 'none';
      document.getElementById('reward-ad-skip').style.display = 'none';
      document.getElementById('reward-ad-progress').style.display = 'block';
      document.getElementById('reward-ad-progress-bar').style.width = '30%';

      let done = false;
      const fallback = setTimeout(() => {
        if (!done) { done = true; this._showRewardProgress(modal, onComplete); }
      }, 5000);

      // 기존 프리로드 취소 후 즉시 새로 로드
      if (this._rewardUnregister) { this._rewardUnregister(); this._rewardUnregister = null; }
      this._rewardAdLoaded = false;

      try {
        this._rewardUnregister = window.loadFullScreenAd({
          options: { adGroupId: this.AD_GROUP_IDS.rewarded },
          onEvent: (data) => {
            if (data.type === 'loaded' && !done) {
              done = true;
              clearTimeout(fallback);
              this._rewardAdLoaded = true;
              document.getElementById('reward-ad-title').style.display = '';
              document.getElementById('reward-ad-desc').style.display = '';
              document.getElementById('reward-ad-watch').style.display = '';
              document.getElementById('reward-ad-progress').style.display = 'none';
              modal.style.display = 'none';
              this._showSDKRewardAd(onComplete, onSkip);
            }
          },
          onError: (err) => {
            console.warn('[AdManager] 보상형 광고 로드 실패:', err);
            this._rewardAdLoaded = false;
            if (!done) { done = true; clearTimeout(fallback); this._showRewardProgress(modal, onComplete); }
          },
        });
      } catch (e) {
        if (!done) { done = true; clearTimeout(fallback); this._showRewardProgress(modal, onComplete); }
      }
      return;
    }

    // SDK 미지원 (Toss 앱 외부) → 개발/테스트 환경 시뮬레이션
    this._showRewardProgress(modal, onComplete);
  },

  // SDK 보상형 광고 재생
  _showSDKRewardAd(onComplete, onSkip) {
    let rewarded = false;

    this._rewardShowUnregister = window.showFullScreenAd({
      options: { adGroupId: this.AD_GROUP_IDS.rewarded },
      onEvent: (data) => {
        switch (data.type) {
          case 'show':
            this._trackEvent('reward', 'show', this.AD_GROUP_IDS.rewarded);
            break;
          case 'impression':
            this._trackEvent('reward', 'impression', this.AD_GROUP_IDS.rewarded);
            break;
          case 'clicked':
            this._trackEvent('reward', 'click', this.AD_GROUP_IDS.rewarded);
            break;
          case 'userEarnedReward':
            // 핵심: 이 이벤트에서만 보상 지급
            rewarded = true;
            Gamification.addXP(this.REWARD_CONFIG.xpReward);
            this._trackEvent('reward', 'earned', this.AD_GROUP_IDS.rewarded);
            break;
          case 'dismissed':
            this._rewardAdLoaded = false;
            if (rewarded) {
              if (onComplete) onComplete();
            } else {
              // 시청 완료 없이 닫음 → 스킵 처리
              if (onSkip) onSkip();
            }
            // 다음 보상형 광고 사전 로드
            this._preloadRewardAd();
            break;
          case 'failedToShow':
            this._preloadRewardAd();
            { const m = document.getElementById('modal-reward-ad'); m.style.display = 'flex'; this._showRewardProgress(m, onComplete); }
            break;
        }
      },
      onError: (err) => {
        console.warn('[AdManager] 보상형 광고 표시 실패:', err);
        const m = document.getElementById('modal-reward-ad'); m.style.display = 'flex'; this._showRewardProgress(m, onComplete);
      },
    });
  },

  // 광고 로드 실패 안내 (실제 광고 시청 없이 보상 없음)
  _showAdLoadFailed(modal, onSkip) {
    document.getElementById('reward-ad-progress').style.display = 'none';
    document.getElementById('reward-ad-title').style.display = '';
    document.getElementById('reward-ad-desc').style.display = '';
    document.getElementById('reward-ad-watch').style.display = 'none';
    document.getElementById('reward-ad-skip').style.display = '';

    const desc = document.getElementById('reward-ad-desc');
    if (desc) desc.textContent = '광고를 불러오지 못했어요. 잠시 후 다시 시도해주세요.';
    const title = document.getElementById('reward-ad-title');
    if (title) title.textContent = '광고 로드 실패';

    // 닫기 버튼(skip) 클릭 시 onSkip 처리
    const skipBtn = document.getElementById('reward-ad-skip');
    if (skipBtn) {
      const handler = () => {
        skipBtn.removeEventListener('click', handler);
        modal.style.display = 'none';
        // 다음 사용을 위해 텍스트 복원
        if (title) title.textContent = this.REWARD_CONFIG.title;
        if (desc) desc.textContent = this.REWARD_CONFIG.desc;
        document.getElementById('reward-ad-watch').style.display = '';
        if (onSkip) onSkip();
      };
      skipBtn.addEventListener('click', handler);
    }
  },

  // 개발 환경 보상 시뮬레이션 (3초 프로그레스) - 명시적 dev 테스트 전용
  _showRewardProgress(modal, onDone) {
    const progress = document.getElementById('reward-ad-progress');
    const bar = document.getElementById('reward-ad-progress-bar');

    // 버튼/타이틀 숨기고 프로그레스만 표시
    document.getElementById('reward-ad-title').style.display = 'none';
    document.getElementById('reward-ad-desc').style.display = 'none';
    document.getElementById('reward-ad-watch').style.display = 'none';
    document.getElementById('reward-ad-skip').style.display = 'none';
    progress.style.display = 'block';
    bar.style.width = '0%';

    let width = 0;
    const interval = setInterval(() => {
      width += 2;
      bar.style.width = width + '%';
      if (width >= 100) {
        clearInterval(interval);
        // 시뮬레이션에서도 보상 지급
        Gamification.addXP(this.REWARD_CONFIG.xpReward);
        this._trackEvent('reward', 'earned_dev', 'simulation');
        setTimeout(() => {
          modal.style.display = 'none';
          // 다음 사용을 위해 요소 복원
          document.getElementById('reward-ad-title').style.display = '';
          document.getElementById('reward-ad-desc').style.display = '';
          document.getElementById('reward-ad-watch').style.display = '';
          if (onDone) onDone();
        }, 300);
      }
    }, 60); // 약 3초
  },

  // ==================== 개발 환경 폴백 배너 ====================
  _showDevBanner() {
    if (Payment.isPremium()) return;
    const container = document.getElementById('ad-banner');
    if (!container) return;

    const ad = this._DEV_BANNERS[Math.floor(Math.random() * this._DEV_BANNERS.length)];
    container.innerHTML = `
      <div class="ad-banner-content" style="border-left: 3px solid ${ad.color}" onclick="AdManager._onDevBannerClick('${ad.id}')">
        <div class="ad-banner-info">
          <span class="ad-label">AD</span>
          <span class="ad-banner-title">${ad.title}</span>
          <span class="ad-banner-desc">${ad.desc}</span>
        </div>
        <button class="ad-banner-close" onclick="event.stopPropagation(); AdManager.hideBanner()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="#8B95A1" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
    `;
    // 홈 화면에서만 노출
    const isHome = typeof App !== 'undefined' && App.currentScreen === 'screen-home';
    container.style.display = isHome ? 'block' : 'none';
    if (isHome) this._setTabSpacerForBanner(true);
    this._trackEvent('banner_dev', 'impression', ad.id);
  },

  _setTabSpacerForBanner(hasAd) {
    // 광고 배너(56px) + 여유 8px
    const h = hasAd ? '164px' : '';
    document.querySelectorAll('.tab-spacer').forEach(el => { el.style.height = h; });
  },

  _onDevBannerClick(adId) {
    this._trackEvent('banner_dev', 'click', adId);
  },

  hideBanner() {
    const container = document.getElementById('ad-banner');
    if (container) {
      container.style.display = 'none';
    }
    this._setTabSpacerForBanner(false);

    // 배너 제거 시 SDK 배너도 정리
    if (this._bannerAttached) {
      this._bannerAttached.destroy();
      this._bannerAttached = null;
    }

    // 쿨다운 후 다시 표시
    setTimeout(() => {
      if (!Payment.isPremium()) {
        if (this._sdkAvailable) {
          this._attachBanner();
        } else {
          this._showDevBanner();
        }
      }
    }, this.COOLDOWN.banner_reshow);
  },

  // ==================== 피드형 네이티브 배너 (도서관 내) ====================
  // SDK 사용 가능: TossAds.attachBanner(feedId, target)
  // SDK 미지원: 로컬 폴백 HTML 반환
  getNativeAdHTML() {
    try {
      if (Payment.isPremium()) return '';

      // SDK 환경에서는 빈 컨테이너를 반환하고 attachBanner로 채움
      if (this._sdkAvailable) {
        const slotId = 'feed-ad-slot-' + Math.random().toString(36).slice(2, 8);
        // DOM 렌더 후 attach 예약
        setTimeout(() => {
          const el = document.getElementById(slotId);
          if (el) this.attachFeedBanner(el);
        }, 100);
        return `<div id="${slotId}" class="native-ad-slot" style="width:100%;min-height:96px"></div>`;
      }

      // 개발 환경 폴백: 로컬 네이티브 광고 카드
      return this._getDevNativeAdHTML();
    } catch (e) {
      console.warn('[AdManager] getNativeAdHTML 오류:', e);
      return '';
    }
  },

  _DEV_NATIVE_ADS: [
    { id: 'native_1', type: 'book', title: '습관의 힘', author: '찰스 두히그', desc: '워렌 버핏이 추천한 습관 과학 도서' },
    { id: 'native_2', type: 'book', title: '부자 아빠 가난한 아빠', author: '로버트 기요사키', desc: '재테크 필독서' },
    { id: 'native_3', type: 'course', title: '부자 마인드셋 클래스', author: '', desc: '30일 완성 부자 습관 온라인 강의' },
  ],

  _getDevNativeAdHTML() {
    const pool = this._DEV_NATIVE_ADS;
    const ad = pool[Math.floor(Math.random() * pool.length)];
    this._trackEvent('native_dev', 'impression', ad.id);

    const icon = ad.type === 'book' ? '\u{1F4D5}' : '\u{1F393}';
    return `
      <div class="native-ad-card" onclick="AdManager._trackEvent('native_dev','click','${ad.id}')">
        <div class="native-ad-badge">AD</div>
        <div class="native-ad-icon">${icon}</div>
        <div class="native-ad-info">
          <div class="native-ad-title">${ad.title}</div>
          ${ad.author ? '<div class="native-ad-author">' + ad.author + '</div>' : ''}
          <div class="native-ad-desc">${ad.desc}</div>
        </div>
      </div>
    `;
  },

  // ==================== 모든 광고 제거 (프리미엄) ====================
  removeAllAds() {
    // SDK 배너 제거
    if (this._bannerAttached) {
      this._bannerAttached.destroy();
      this._bannerAttached = null;
    }
    // TossAds 전체 배너 제거
    if (this._sdkAvailable && window.TossAds?.destroyAll) {
      window.TossAds.destroyAll();
    }
    // SDK 리스너 해제
    if (this._rewardUnregister) { this._rewardUnregister(); this._rewardUnregister = null; }
    if (this._interstitialUnregister) { this._interstitialUnregister(); this._interstitialUnregister = null; }

    // DOM 정리
    const banner = document.getElementById('ad-banner');
    if (banner) banner.style.display = 'none';
    document.querySelectorAll('.native-ad-card, .native-ad-slot').forEach(el => el.remove());

    this._rewardAdLoaded = false;
    this._interstitialLoaded = false;
  },

  // ==================== 이벤트 추적 (KPI / 로그) ====================
  // QA 가이드: 노출/완료/보상 지급 이벤트 로그 수집
  _trackEvent(adType, event, adGroupId) {
    const stats = Storage.load('ad_stats', {
      impressions: 0,
      clicks: 0,
      rewards: 0,
      events: [],
    });

    if (event === 'impression') stats.impressions++;
    if (event === 'click') stats.clicks++;
    if (event === 'earned' || event === 'earned_dev') stats.rewards++;

    if (!Array.isArray(stats.events)) stats.events = [];
    stats.events.push({
      adType,
      event,
      adGroupId,
      time: Date.now(),
    });

    // 이벤트 로그 최대 200개 유지
    if (stats.events.length > 200) {
      stats.events = stats.events.slice(-200);
    }

    Storage.save('ad_stats', stats);
  },

  getAdStats() {
    const stats = Storage.load('ad_stats', {
      impressions: 0,
      clicks: 0,
      rewards: 0,
      events: [],
    });
    return {
      ...stats,
      ctr: stats.impressions > 0
        ? ((stats.clicks / stats.impressions) * 100).toFixed(2) + '%'
        : '0%',
    };
  },
};

/* ============================================
   Payment - 토스 인앱결제(IAP) SDK 연동 & 프리미엄 관리

   토스 인앱결제 SDK 1.1.3+ 기준
   - 상품 유형: 비소모품 (Non-consumable) - 한 번 구매로 지속 사용
   - 결제 플로우: createOneTimePurchaseOrder() → 상품 지급 → completeProductGrant()
   - 복원 플로우: getPendingOrders() → 상품 지급 → completeProductGrant()
   - 수수료: 앱마켓 15% + 토스 5%

   QA 가이드 준수:
   - 주문 금액과 스토어 결제창 금액 일치 확인
   - 결제 후 미니앱 화면/서버 동일 결과 처리
   - 비소모품 복원(restore) 기능 구현
   - 중복 구매/지급 방지
   - 네트워크 장애 시 재시도/대체 흐름
   - orderId는 단건-단결제 원칙
   ============================================ */
const Payment = {
  _sdkAvailable: false,
  _products: null, // SDK에서 조회한 상품 목록 캐시

  // ==================== 상품 정보 ====================
  // 콘솔에 등록한 상품과 일치해야 함
  // 공급가 기준 (부가세 자동 계산되어 판매가로 표시)
  PRODUCTS: {
    gold_monthly: {
      id: 'gold_monthly',
      sku: 'ait.0000022065.2efbb607.7820a440ee.3817415252',
      name: 'Gold Pass 월간',
      price: 4900,        // 판매가 (VAT 포함)
      supplyPrice: 4455,   // 공급가 (VAT 제외)
      period: 30,
      type: 'NON_CONSUMABLE',  // 비소모품
      desc: '광고 제거 + 무제한 습관 + 심화 시뮬레이션',
    },
    gold_yearly: {
      id: 'gold_yearly',
      sku: 'ait.0000022065.3161defc.e2070c81db.3817546813',
      name: 'Gold Pass 연간',
      price: 39900,
      supplyPrice: 36273,
      period: 365,
      type: 'NON_CONSUMABLE',
      desc: '월간 대비 32% 할인 + 동일 혜택',
    },
  },

  FREE_HABIT_LIMIT: 3,

  // ==================== 주문 상태 (IAP Status Enum) ====================
  ORDER_STATUS: {
    PURCHASED: 'PURCHASED',                   // 지급 완료
    PAYMENT_COMPLETED: 'PAYMENT_COMPLETED',   // 결제 완료 (지급 미완료)
    FAILED: 'FAILED',                         // 결제 실패
    REFUNDED: 'REFUNDED',                     // 환불됨
    ORDER_IN_PROGRESS: 'ORDER_IN_PROGRESS',   // 진행 중
    NOT_FOUND: 'NOT_FOUND',                   // 주문 없음
  },

  // ==================== 초기화 ====================
  init() {
    this._sdkAvailable = this._checkSDKAvailable();

    if (this._sdkAvailable) {
      // 미지급 주문 복원 체크
      this._restorePendingOrders();
    }
  },

  _checkSDKAvailable() {
    // @apps-in-toss/web-framework IAP 함수 존재 여부
    return (
      typeof window.createOneTimePurchaseOrder === 'function' ||
      typeof window.iap?.createOneTimePurchaseOrder === 'function'
    );
  },

  // IAP 함수 접근 헬퍼
  _getIAP() {
    if (typeof window.iap !== 'undefined') return window.iap;
    // 글로벌 함수로 노출된 경우
    return {
      createOneTimePurchaseOrder: window.createOneTimePurchaseOrder,
      getProductItemList: window.getProductItemList,
      getPendingOrders: window.getPendingOrders,
      completeProductGrant: window.completeProductGrant,
      getCompletedOrRefundedOrders: window.getCompletedOrRefundedOrders,
    };
  },

  // ==================== 프리미엄 상태 확인 ====================
  isPremium() {
    // 1) DB 프리미엄 상태 우선 (로그인 시)
    const profile = Storage.getProfile();
    if (profile?.tossLinked) {
      if (profile.premium === true) {
        // DB 만료일 체크
        if (profile.premium_expires_at) {
          return new Date(profile.premium_expires_at).getTime() > Date.now();
        }
        return true;
      }
      // 클라우드 싱크 전/후 타이밍 이슈 대비: 로컬 subscription도 확인
      const sub = Storage.load('subscription', null);
      return !!(sub?.active && sub.expiresAt > Date.now());
    }
    // 2) 비로그인: localStorage subscription 체크
    const sub = Storage.load('subscription', null);
    if (!sub) return false;
    return sub.active && sub.expiresAt > Date.now();
  },

  getSubscription() {
    return Storage.load('subscription', null);
  },

  getRemainingDays() {
    const sub = this.getSubscription();
    if (!sub || !sub.active) return 0;
    const remaining = sub.expiresAt - new Date().getTime();
    return Math.max(0, Math.ceil(remaining / (1000 * 60 * 60 * 24)));
  },

  // ==================== 상품 목록 조회 (SDK) ====================
  async fetchProducts() {
    if (!this._sdkAvailable) return Object.values(this.PRODUCTS);

    try {
      const iap = this._getIAP();
      if (typeof iap.getProductItemList === 'function') {
        const result = await iap.getProductItemList();
        this._products = result;
        return result;
      }
    } catch (e) {
      console.warn('[Payment] 상품 목록 조회 실패:', e);
    }
    return Object.values(this.PRODUCTS);
  },

  // ==================== 인앱결제 요청 ====================
  // SDK 플로우: createOneTimePurchaseOrder() → 결제창 표시 → 상품 지급 → 콜백
  async requestPayment(productId) {
    const product = this.PRODUCTS[productId];
    if (!product) return { success: false, error: '상품 정보를 찾을 수 없어요.' };

    // 이미 프리미엄인 경우
    if (this.isPremium()) {
      return { success: false, error: '이미 Gold Pass를 이용 중이에요.' };
    }

    try {
      if (this._sdkAvailable) {
        return await this._requestSDKPayment(productId, product);
      } else {
        // 개발/테스트 환경 - 즉시 성공 처리
        return this._processPayment(productId, null);
      }
    } catch (e) {
      console.error('[Payment] 결제 오류:', e);

      // 에러 코드별 사용자 메시지
      const errorMsg = this._getErrorMessage(e);
      return { success: false, error: errorMsg };
    }
  },

  // 토스 IAP SDK 결제 요청
  async _requestSDKPayment(productId, product) {
    const iap = this._getIAP();

    return new Promise((resolve) => {
      iap.createOneTimePurchaseOrder({
        productItemId: product.sku || product.id,
        // SDK 1.1.3+: onSuccess에서 상품 지급 후 completeProductGrant 호출
        onSuccess: async (event) => {
          // SDK 1.1.3+: event.data.orderId
          const orderId = event.data?.orderId ?? event.orderId;

          try {
            // 1. 서버 검증 + DB 프리미엄 부여
            await this._verifyOnServer(orderId, productId, product);

            // 2. 로컬 상태 활성화 (즉각 UI 반영)
            const subscription = this._activateSubscription(productId, orderId);

            // 3. 지급 완료 알림 → SDK에 completeProductGrant
            if (typeof iap.completeProductGrant === 'function') {
              await iap.completeProductGrant({ orderId });
            }

            // 4. 결제 내역 저장
            this._savePaymentHistory(productId, orderId, 'PURCHASED');

            // 5. 광고 즉시 제거
            AdManager.removeAllAds();

            resolve({ success: true, subscription });
          } catch (grantError) {
            console.error('[Payment] 상품 지급 실패:', grantError);
            this._savePaymentHistory(productId, orderId, 'PAYMENT_COMPLETED');
            resolve({
              success: false,
              error: '결제는 완료됐지만 활성화에 실패했어요. 앱을 다시 시작하면 자동으로 복원돼요.',
              pendingOrderId: orderId,
            });
          }
        },
        onFail: (error) => {
          console.warn('[Payment] 결제 실패:', error);
          const errorMsg = this._getErrorMessage(error);
          resolve({ success: false, error: errorMsg });
        },
      });
    });
  },

  // ==================== 미지급 주문 복원 (SDK 1.2.2+) ====================
  // QA: 결제 완료되었으나 상품 미지급 주문 자동 복원
  async _restorePendingOrders() {
    if (!this._sdkAvailable) return;

    try {
      const iap = this._getIAP();
      if (typeof iap.getPendingOrders !== 'function') return;

      const pendingOrders = await iap.getPendingOrders();
      if (!pendingOrders || pendingOrders.length === 0) return;

      for (const order of pendingOrders) {
        // SDK 1.1.3+: order.data?.orderId 또는 order.orderId
        const orderId = order.data?.orderId ?? order.orderId;
        const productItemId = order.data?.productItemId ?? order.productItemId;

        const productId = this._findProductIdByItemId(productItemId);
        if (productId) {
          // 서버 검증 후 지급 (로그인 시)
          const product = this.PRODUCTS[productId];
          await this._verifyOnServer(orderId, productId, product).catch(() => {});

          this._activateSubscription(productId, orderId);

          if (typeof iap.completeProductGrant === 'function') {
            await iap.completeProductGrant({ orderId });
          }

          this._savePaymentHistory(productId, orderId, 'PURCHASED');
          AdManager.removeAllAds();
        }
      }
    } catch (e) {
      console.warn('[Payment] 미지급 주문 복원 실패:', e);
    }
  },

  // 상품 아이템 ID → 내부 상품 ID 매핑
  _findProductIdByItemId(productItemId) {
    for (const [key, product] of Object.entries(this.PRODUCTS)) {
      if (product.id === productItemId) return key;
    }
    return null;
  },

  // ==================== 서버 검증 ====================
  async _verifyOnServer(orderId, productId, product) {
    if (!TossAuth.isLoggedIn()) return; // 비로그인 시 스킵 (로컬만)

    const token = TossAuth.getAccessToken();
    const res = await fetch(`${EDGE_BASE}/payment/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        orderId,
        productId,
        productName: product.name,
        price: product.price,
        period: product.period,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `서버 검증 실패 (${res.status})`);
    }
    return res.json();
  },

  // ==================== 구독 활성화 (로컬) ====================
  _activateSubscription(productId, orderId) {
    const product = this.PRODUCTS[productId];
    const now = new Date().getTime();
    const expiresAt = now + (product.period * 24 * 60 * 60 * 1000);

    const subscription = {
      active: true,
      productId,
      productName: product.name,
      price: product.price,
      orderId: orderId || `dev_${Date.now()}`,
      purchasedAt: now,
      expiresAt,
    };

    Storage.save('subscription', subscription);

    // 로그인 사용자: profile.premium도 즉시 업데이트 (isPremium이 profile 기준으로 판단하므로)
    const profile = Storage.getProfile();
    if (profile) {
      Storage.saveProfile({
        ...profile,
        premium: true,
        premiumPlan: productId,
        premiumExpiresAt: new Date(expiresAt).toISOString(),
      });
    }

    return subscription;
  },

  // 개발 환경 결제 처리
  _processPayment(productId, orderId) {
    const subscription = this._activateSubscription(productId, orderId);
    this._savePaymentHistory(productId, orderId, 'PURCHASED');
    AdManager.removeAllAds();
    return { success: true, subscription };
  },

  // ==================== 결제 내역 관리 ====================
  _savePaymentHistory(productId, orderId, status) {
    const product = this.PRODUCTS[productId];
    const history = Storage.load('payment_history', []);

    // 중복 방지: 동일 orderId 체크
    if (orderId && history.some(h => h.orderId === orderId)) return;

    history.push({
      id: `pay_${Date.now()}`,
      productId,
      productName: product.name,
      price: product.price,
      orderId: orderId || `dev_${Date.now()}`,
      status,
      date: new Date().toISOString(),
    });
    Storage.save('payment_history', history);
  },

  getPaymentHistory() {
    return Storage.load('payment_history', []);
  },

  // ==================== 구독 해지 ====================
  cancelSubscription() {
    const sub = this.getSubscription();
    if (sub) {
      sub.active = false;
      sub.cancelledAt = new Date().getTime();
      Storage.save('subscription', sub);
    }
  },

  // ==================== 완료/환불 주문 조회 ====================
  async getOrderHistory() {
    if (!this._sdkAvailable) return this.getPaymentHistory();

    try {
      const iap = this._getIAP();
      if (typeof iap.getCompletedOrRefundedOrders === 'function') {
        return await iap.getCompletedOrRefundedOrders();
      }
    } catch (e) {
      console.warn('[Payment] 주문 조회 실패:', e);
    }
    return this.getPaymentHistory();
  },

  // ==================== 무료 사용자 제한 ====================
  canAddHabit() {
    if (this.isPremium()) return true;
    return HabitManager.getAll().length < this.FREE_HABIT_LIMIT;
  },

  canAccessFeature(feature) {
    if (this.isPremium()) return true;
    const freeFeatures = ['basic_sim', 'daily_quote', 'basic_coach'];
    return freeFeatures.includes(feature);
  },

  getPremiumPrompt(feature) {
    const prompts = {
      habit_limit: '무료 버전에서는 습관 3개까지 등록할 수 있어요.\nGold Pass로 무제한 습관을 관리해 보세요!',
      advanced_sim: '인플레이션, 세금을 반영한 정밀 시뮬레이션은\nGold Pass 전용 기능이에요.',
      ai_coach: 'AI 프라이빗 코칭은 Gold Pass 전용 기능이에요.\n맞춤형 부자 컨설팅을 받아보세요!',
      ad_free: '광고 없이 깔끔하게 습관을 관리해 보세요.\nGold Pass로 광고를 제거할 수 있어요.',
    };
    return prompts[feature] || 'Gold Pass로 더 많은 기능을 이용해 보세요!';
  },

  // ==================== 에러 메시지 ====================
  _getErrorMessage(error) {
    const code = error?.code || error?.errorCode || '';
    const messages = {
      'USER_CANCELLED': '결제를 취소했어요.',
      'PRODUCT_NOT_FOUND': '상품 정보를 찾을 수 없어요.',
      'PRODUCT_NOT_GRANTED_BY_PARTNER': '상품 활성화에 실패했어요. 다시 시도해 주세요.',
      'NETWORK_ERROR': '네트워크 오류가 발생했어요. 인터넷 연결을 확인해 주세요.',
      'ALREADY_PURCHASED': '이미 구매한 상품이에요.',
      'INTERNAL_ERROR': '일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.',
    };
    return messages[code] || error?.message || '결제 중 오류가 발생했어요.';
  },

  // ==================== 개발/테스트용 ====================
  _devActivatePremium(days) {
    const subscription = this._activateSubscription('gold_monthly', `dev_test_${Date.now()}`);
    subscription.productName = 'Gold Pass (DEV)';
    subscription.price = 0;
    if (days) {
      subscription.expiresAt = new Date().getTime() + days * 24 * 60 * 60 * 1000;
    }
    Storage.save('subscription', subscription);
    AdManager.removeAllAds();
  },

  // 개발용: 구독 초기화
  _devResetSubscription() {
    Storage.remove('subscription');
    Storage.remove('payment_history');
  },
};

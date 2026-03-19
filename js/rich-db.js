/* ============================================
   RichDB - 부자 습관/명언/사례 데이터베이스
   ============================================ */
const RichDB = {
  PEOPLE: [
    {
      id: 'warren_buffett',
      name: '워렌 버핏',
      nameEn: 'Warren Buffett',
      title: '버크셔 해서웨이 회장',
      netWorth: '약 1,300억 달러',
      emoji: '\u{1F4DA}',
      morningRoutine: '6:45 기상 \u2192 신문 5종 읽기 \u2192 맥도날드 아침 \u2192 독서 5~6시간',
      keyHabits: ['reading_30', 'saving_habit', 'simple_life', 'gratitude_journal'],
      philosophy: '복리의 힘을 믿고, 장기적 관점으로 투자하라',
      famousQuotes: [
        '하루에 500페이지를 읽어라. 지식은 그렇게 쌓이는 것이다. 복리처럼.',
        '다른 사람이 탐욕스러울 때 두려워하라',
        '가장 좋은 투자는 자기 자신에 대한 투자다'
      ],
      targetGoal: '1억',
      packageName: '버핏 클래스'
    },
    {
      id: 'elon_musk',
      name: '일론 머스크',
      nameEn: 'Elon Musk',
      title: '테슬라/스페이스X CEO',
      netWorth: '약 2,500억 달러',
      emoji: '\u{1F680}',
      morningRoutine: '7시 기상 \u2192 샤워 중 사고 \u2192 이메일 30분 \u2192 바로 업무',
      keyHabits: ['early_rise', 'deep_work', 'exercise_30', 'learning_new', 'decision_minimize', 'meditation_10'],
      philosophy: '인류를 다행성 종으로 만들기 위해 매일 최선을 다한다',
      famousQuotes: [
        '실패는 여기서 하나의 옵션이다. 실패하지 않으면, 충분히 혁신하지 않는 것이다.',
        '가장 위험한 것은 위험을 감수하지 않는 것이다',
        '끊임없이 생각하라. 개선할 수 있는 방법을.'
      ],
      targetGoal: '무제한',
      packageName: '머스크 프로토콜'
    },
    {
      id: 'bill_gates',
      name: '빌 게이츠',
      nameEn: 'Bill Gates',
      title: '마이크로소프트 공동 창업자',
      netWorth: '약 1,300억 달러',
      emoji: '\u{1F4D6}',
      morningRoutine: '7시 기상 \u2192 1시간 트레드밀+영상 학습 \u2192 독서',
      keyHabits: ['reading_30', 'exercise_60', 'family_time', 'learning_new', 'sleep_manage'],
      philosophy: '지식을 넓히고, 균형 잡힌 삶을 살아라',
      famousQuotes: [
        '나는 한 달에 4권의 책을 읽는다. 세상을 이해하는 가장 좋은 방법이다.',
        '성공은 형편없는 선생이다. 똑똑한 사람들이 절대 실패하지 않을 거라 착각하게 만든다.',
        '인생은 공정하지 않다. 그것에 익숙해져라.'
      ],
      targetGoal: '10억',
      packageName: '게이츠 패턴'
    },
    {
      id: 'oprah_winfrey',
      name: '오프라 윈프리',
      nameEn: 'Oprah Winfrey',
      title: '미디어 기업가',
      netWorth: '약 25억 달러',
      emoji: '\u{1F31F}',
      morningRoutine: '6시 기상 \u2192 20분 명상 \u2192 15분 운동 \u2192 건강식 아침',
      keyHabits: ['meditation_10', 'gratitude_journal', 'exercise_30', 'reading_30', 'positive_affirm'],
      philosophy: '내면의 성장이 외면의 성공을 만든다',
      famousQuotes: [
        '감사할수록 더 많은 것이 주어진다.',
        '당신이 되어야 할 사람이 되기 위해 용기를 가져라.',
        '모든 실패는 다른 방향으로 나아가라는 신호이다.'
      ],
      targetGoal: '3억',
      packageName: '윈프리 메서드'
    },
    {
      id: 'jeff_bezos',
      name: '제프 베조스',
      nameEn: 'Jeff Bezos',
      title: '아마존 창업자',
      netWorth: '약 1,800억 달러',
      emoji: '\u{1F4E6}',
      morningRoutine: '8시 기상 \u2192 가족과 아침식사 \u2192 신문 읽기 \u2192 오전 10시 이후 첫 회의',
      keyHabits: ['sleep_manage', 'family_time', 'learning_new', 'decision_minimize', 'goal_review'],
      philosophy: '오늘 할 수 있는 실험을 내일로 미루지 마라',
      famousQuotes: [
        '실패해도 괜찮다. 시도하지 않는 것이 진짜 실패다.',
        '고객에게 집착하라. 경쟁자가 아니라.',
        '좋은 의도는 결과를 만들지 못한다. 올바른 메커니즘만이 결과를 만든다.'
      ],
      targetGoal: '5억',
      packageName: '베조스 시스템'
    },
    {
      id: 'ray_dalio',
      name: '레이 달리오',
      nameEn: 'Ray Dalio',
      title: '브릿지워터 창업자',
      netWorth: '약 190억 달러',
      emoji: '\u{1F9D8}',
      morningRoutine: '새벽 기상 \u2192 20분 초월명상 \u2192 원칙 점검 \u2192 투자 분석',
      keyHabits: ['meditation_10', 'goal_review', 'invest_study', 'reading_30', 'news_check'],
      philosophy: '극도의 투명성과 원칙에 기반한 삶이 최고의 결과를 만든다',
      famousQuotes: [
        '고통 + 반성 = 발전',
        '원칙에 기반한 삶을 살아라. 매일 명상으로 원칙을 점검한다.',
        '가장 중요한 것은 생각하는 방법을 배우는 것이다.'
      ],
      targetGoal: '10억',
      packageName: '달리오 원칙'
    },
    {
      id: 'tim_cook',
      name: '팀 쿡',
      nameEn: 'Tim Cook',
      title: '애플 CEO',
      netWorth: '약 16억 달러',
      emoji: '\u{1F34E}',
      morningRoutine: '3:45 기상 \u2192 이메일 파악 \u2192 1시간 운동 \u2192 출근',
      keyHabits: ['early_rise', 'exercise_60', 'news_check', 'goal_review', 'deep_work'],
      philosophy: '아침의 고요한 시간을 지배하는 자가 하루를 지배한다',
      famousQuotes: [
        '아침의 고요한 시간이 하루 중 가장 생산적인 시간이다.',
        '리더십은 직급이 아니라 영향력이다.',
        '열정을 따르는 것이 아니라, 열정을 가져오는 것이다.'
      ],
      targetGoal: '1억',
      packageName: '쿡 모닝 프로토콜'
    },
    {
      id: 'richard_branson',
      name: '리처드 브랜슨',
      nameEn: 'Richard Branson',
      title: '버진 그룹 창업자',
      netWorth: '약 30억 달러',
      emoji: '\u{1F30A}',
      morningRoutine: '5시 기상 \u2192 서핑·테니스 운동 \u2192 가족 시간 \u2192 아이디어 노트',
      keyHabits: ['early_rise', 'exercise_30', 'networking', 'goal_review', 'positive_affirm'],
      philosophy: '즐기지 못하는 일은 하지 마라. 삶은 너무 짧다',
      famousQuotes: [
        '에너지를 관리하면 시간이 늘어난다. 운동이 가장 좋은 투자다.',
        '기회는 준비된 자에게 온다.',
        '먼저 꿈을 꾸고, 그 다음 실행하라.'
      ],
      targetGoal: '3억',
      packageName: '브랜슨 에너지 루틴'
    },
    {
      id: 'steve_jobs',
      name: '스티브 잡스',
      nameEn: 'Steve Jobs',
      title: '애플 공동 창업자',
      netWorth: '약 100억 달러',
      emoji: '\u{1F4F1}',
      morningRoutine: '기상 \u2192 거울 앞 자문 \u2192 중요한 것만 선택 \u2192 완벽한 집중',
      keyHabits: ['decision_minimize', 'deep_work', 'meditation_10', 'simple_life', 'goal_review'],
      philosophy: '가장 중요한 결정은 무엇을 하지 않을지를 고르는 것이다',
      famousQuotes: [
        '매일 아침 거울을 보며 묻는다. 오늘이 마지막 날이라면 이 일을 할 것인가?',
        '단순함이 궁극의 정교함이다.',
        '혁신은 천 가지에 노라고 말하는 것이다.'
      ],
      targetGoal: '5억',
      packageName: '잡스 집중 루틴'
    },
    {
      id: 'mark_zuckerberg',
      name: '마크 저커버그',
      nameEn: 'Mark Zuckerberg',
      title: '메타 CEO',
      netWorth: '약 1,700억 달러',
      emoji: '\u{1F4BB}',
      morningRoutine: '기상 \u2192 같은 옷 선택 \u2192 바로 업무 집중 \u2192 저녁 운동',
      keyHabits: ['decision_minimize', 'deep_work', 'exercise_30', 'learning_new', 'goal_review'],
      philosophy: '빠르게 움직이고, 한 가지에 집중하라',
      famousQuotes: [
        '가장 큰 위험은 위험을 감수하지 않는 것이다.',
        '완벽할 때까지 기다리지 마라. 지금 시작하라.',
        '사람들을 연결하면 세상이 바뀐다.'
      ],
      targetGoal: '10억',
      packageName: '저커버그 효율 루틴'
    },
    {
      id: 'naval_ravikant',
      name: '나발 라비칸트',
      nameEn: 'Naval Ravikant',
      title: '앤젤리스트 창업자',
      netWorth: '약 10억 달러',
      emoji: '\u{1F3AF}',
      morningRoutine: '기상 \u2192 명상 \u2192 독서 1시간 \u2192 레버리지 작업',
      keyHabits: ['reading_30', 'meditation_10', 'invest_study', 'sleep_manage', 'goal_review'],
      philosophy: '레버리지를 만들어라. 시간을 팔지 말고 자산을 쌓아라',
      famousQuotes: [
        '부자가 되고 싶다면 시간을 팔지 마라.',
        '코드나 미디어로 잠자는 동안에도 일하게 하라.',
        '독서는 가장 저렴한 레버리지다.'
      ],
      targetGoal: '3억',
      packageName: '나발 레버리지 루틴'
    },
    {
      id: 'kim_seung_ho',
      name: '김승호',
      nameEn: 'Seung-ho Kim',
      title: '스노우폭스 회장',
      netWorth: '약 1조원+',
      emoji: '\u{1F4B0}',
      morningRoutine: '새벽 기상 \u2192 독서 \u2192 가계부 점검 \u2192 하루 계획',
      keyHabits: ['saving_habit', 'invest_study', 'news_check', 'simple_life', 'goal_review', 'gratitude_journal'],
      philosophy: '돈은 인격이다. 돈을 대하는 태도가 부자를 만든다',
      famousQuotes: [
        '돈은 습관에서 결정됩니다.',
        '가난은 창피한 게 아니지만, 가난한 습관은 창피하다.',
        '부자는 하루아침에 되지 않는다. 매일의 작은 선택이 쌓인다.'
      ],
      targetGoal: '1억',
      packageName: '김승호 돈 습관'
    }
  ],

  HABITS: [
    { id: 'reading_30', name: '매일 독서 30분', category: '독서/학습', difficulty: 1, timeSlot: 'morning',
      richPeople: ['워렌 버핏', '빌 게이츠'], richStat: '부자의 88%가 매일 30분 이상 독서해요',
      quote: '"하루에 500페이지를 읽어라" - 워렌 버핏',
      wealthImpact: { type: 'reading', annualEffect: 0.03 },
      science: '독서는 뇌 신경가소성을 높여 창의적 사고를 향상시켜요' },
    { id: 'early_rise', name: '6시 이전 기상', category: '모닝 루틴', difficulty: 3, timeSlot: 'morning',
      richPeople: ['팀 쿡', '밥 아이거'], richStat: '부자의 50%가 5시 이전에 기상해요',
      quote: '"아침의 1시간은 낮의 3시간 가치" - 팀 쿡',
      wealthImpact: { type: 'early_rise', annualEffect: 0.05 },
      science: '아침 코르티솔 활용으로 의지력이 최대인 시간대예요' },
    { id: 'exercise_30', name: '30분 운동', category: '건강 관리', difficulty: 2, timeSlot: 'morning',
      richPeople: ['리처드 브랜슨', '마크 저커버그'], richStat: '부자의 76%가 매일 운동해요',
      quote: '"에너지를 관리하면 시간이 늘어난다" - 리처드 브랜슨',
      wealthImpact: { type: 'exercise', annualEffect: 1200000 },
      science: '운동은 BDNF를 증가시켜 인지 능력을 향상시켜요' },
    { id: 'exercise_60', name: '1시간 운동', category: '건강 관리', difficulty: 3, timeSlot: 'morning',
      richPeople: ['빌 게이츠', '팀 쿡'], richStat: '빌 게이츠는 매일 1시간 트레드밀 위에서 학습해요',
      quote: '"건강이 없으면 부도 의미가 없다" - 빌 게이츠',
      wealthImpact: { type: 'exercise', annualEffect: 1800000 },
      science: '장시간 유산소 운동은 심폐기능과 뇌 건강을 동시에 개선해요' },
    { id: 'meditation_10', name: '10분 명상', category: '마인드셋', difficulty: 1, timeSlot: 'morning',
      richPeople: ['레이 달리오', '오프라 윈프리'], richStat: '부자의 73%가 명상이나 묵상을 해요',
      quote: '"원칙에 기반한 삶을 살아라" - 레이 달리오',
      wealthImpact: { type: 'mindset', annualEffect: 0.01 },
      science: '명상은 전두엽 피질을 강화해 의사결정 능력을 높여요' },
    { id: 'saving_habit', name: '가계부 기록', category: '재테크 습관', difficulty: 1, timeSlot: 'evening',
      richPeople: ['워렌 버핏', 'IKEA 창업자'], richStat: '부자의 94%가 절약/저축 습관이 있어요',
      quote: '"불필요한 지출을 줄이는 것이 수입을 늘리는 것보다 쉽다" - 워렌 버핏',
      wealthImpact: { type: 'saving', annualEffect: 6000000 },
      science: '지출 추적만으로 평균 15% 지출 감소 효과가 있어요' },
    { id: 'invest_study', name: '투자 공부 30분', category: '재테크 습관', difficulty: 2, timeSlot: 'evening',
      richPeople: ['워렌 버핏', '레이 달리오'], richStat: '워렌 버핏은 하루 80%를 독서와 투자 공부에 써요',
      quote: '"위험은 자기가 뭘 하는지 모르는 데서 온다" - 워렌 버핏',
      wealthImpact: { type: 'investing', annualEffect: 0.02 },
      science: '금융 리터러시가 높을수록 자산 축적 속도가 빨라요' },
    { id: 'gratitude_journal', name: '감사일기 쓰기', category: '마인드셋', difficulty: 1, timeSlot: 'evening',
      richPeople: ['오프라 윈프리', '토니 로빈스'], richStat: '부자의 71%가 감사일기를 써요',
      quote: '"감사할수록 더 많은 것이 주어진다" - 오프라 윈프리',
      wealthImpact: { type: 'mindset', annualEffect: 0.01 },
      science: '감사 연습은 행복 호르몬을 증가시키고 스트레스를 줄여요' },
    { id: 'goal_review', name: '목표 리스트 점검', category: '시간 관리', difficulty: 1, timeSlot: 'morning',
      richPeople: ['짐 캐리', '리처드 브랜슨'], richStat: '부자의 81%가 매일 목표를 점검해요',
      quote: '"목표를 적으면 이룰 확률이 42% 높아진다" - 도미니칸 대학 연구',
      wealthImpact: { type: 'mindset', annualEffect: 0.02 },
      science: 'RAS(망상활성화계)가 목표 관련 정보를 선택적으로 인식해요' },
    { id: 'networking', name: '감사 메시지 보내기', category: '네트워킹', difficulty: 1, timeSlot: 'afternoon',
      richPeople: ['키스 페라지', '리처드 브랜슨'], richStat: '부자의 79%가 적극적으로 네트워킹해요',
      quote: '"혼자서는 누구도 부자가 될 수 없다" - 키스 페라지',
      wealthImpact: { type: 'networking', annualEffect: 0.02 },
      science: '사회적 자본은 경제적 자본만큼 중요한 자산이에요' },
    { id: 'deep_work', name: '딥워크 2시간', category: '시간 관리', difficulty: 3, timeSlot: 'afternoon',
      richPeople: ['일론 머스크', '마크 저커버그'], richStat: '집중 업무 시간이 생산성의 80%를 결정해요',
      quote: '"멀티태스킹은 환상이다. 하나에 집중하라" - 일론 머스크',
      wealthImpact: { type: 'early_rise', annualEffect: 0.05 },
      science: '딥워크 상태에서 생산성이 최대 5배까지 높아져요' },
    { id: 'learning_new', name: '새로운 것 배우기', category: '독서/학습', difficulty: 2, timeSlot: 'afternoon',
      richPeople: ['일론 머스크', '제프 베조스'], richStat: '부자의 86%가 매일 새로운 것을 배워요',
      quote: '"5년 안에 전문가가 될 수 있다. 매일 조금씩 배우면" - 일론 머스크',
      wealthImpact: { type: 'reading', annualEffect: 0.03 },
      science: '크로스 도메인 학습은 혁신적 아이디어를 창출해요' },
    { id: 'sleep_manage', name: '수면 8시간 확보', category: '건강 관리', difficulty: 2, timeSlot: 'evening',
      richPeople: ['제프 베조스', '아리아나 허핑턴'], richStat: '부자의 89%가 수면 루틴을 관리해요',
      quote: '"수면은 리더십의 비밀 무기다" - 아리아나 허핑턴',
      wealthImpact: { type: 'exercise', annualEffect: 800000 },
      science: '충분한 수면은 의사결정 능력을 35% 향상시켜요' },
    { id: 'news_check', name: '경제 뉴스 체크', category: '재테크 습관', difficulty: 1, timeSlot: 'morning',
      richPeople: ['워렌 버핏', '레이 달리오'], richStat: '워렌 버핏은 매일 아침 신문 5종을 읽어요',
      quote: '"정보가 곧 힘이다" - 워렌 버핏',
      wealthImpact: { type: 'investing', annualEffect: 0.01 },
      science: '경제 트렌드 파악은 투자 의사결정의 기본이에요' },
    { id: 'positive_affirm', name: '긍정 확언 5분', category: '마인드셋', difficulty: 1, timeSlot: 'morning',
      richPeople: ['오프라 윈프리', '짐 캐리'], richStat: '짐 캐리는 자신에게 1,000만 달러 수표를 써줬어요',
      quote: '"당신이 되어야 할 사람이 되기 위해 용기를 가져라" - 오프라 윈프리',
      wealthImpact: { type: 'mindset', annualEffect: 0.01 },
      science: '긍정 확언은 자기효능감을 높여 목표 달성률을 높여요' },
    { id: 'simple_life', name: '불필요한 지출 점검', category: '재테크 습관', difficulty: 1, timeSlot: 'evening',
      richPeople: ['워렌 버핏', 'IKEA 창업자'], richStat: '워렌 버핏은 1958년에 산 집에 아직 살아요',
      quote: '"필요하지 않은 것을 사면, 필요한 것을 팔아야 할 날이 온다" - 워렌 버핏',
      wealthImpact: { type: 'saving', annualEffect: 3000000 },
      science: '검소한 생활은 자산 축적의 가장 확실한 방법이에요' },
    { id: 'family_time', name: '가족/소중한 사람과 대화', category: '네트워킹', difficulty: 1, timeSlot: 'evening',
      richPeople: ['빌 게이츠', '제프 베조스'], richStat: '제프 베조스는 매일 가족과 아침을 먹어요',
      quote: '"인생에서 가장 중요한 투자는 관계에 대한 투자다" - 빌 게이츠',
      wealthImpact: { type: 'mindset', annualEffect: 0.01 },
      science: '강한 사회적 유대는 정신건강과 수명 연장에 도움이 돼요' },
    { id: 'decision_minimize', name: '의사결정 최소화', category: '시간 관리', difficulty: 2, timeSlot: 'morning',
      richPeople: ['일론 머스크', '마크 저커버그'], richStat: '저커버그는 매일 같은 옷을 입어 결정 피로를 줄여요',
      quote: '"중요하지 않은 결정에 에너지를 낭비하지 마라"',
      wealthImpact: { type: 'early_rise', annualEffect: 0.02 },
      science: '의사결정 피로를 줄이면 중요한 결정의 질이 높아져요' },
  ],

  QUOTES: [
    { text: '하루에 500페이지를 읽어라. 지식은 그렇게 쌓이는 것이다. 복리처럼.', author: '워렌 버핏', category: '독서/학습' },
    { text: '나는 매일 아침 거울을 보며 묻는다. 오늘이 인생 마지막 날이라면, 지금 하려는 일을 할 것인가?', author: '스티브 잡스', category: '마인드셋' },
    { text: '성공의 비밀은 일상을 지배하는 습관에 있다.', author: '토마스 콜리', category: '습관' },
    { text: '원칙에 기반한 삶을 살아라. 매일 명상으로 원칙을 점검한다.', author: '레이 달리오', category: '마인드셋' },
    { text: '나는 한 달에 4권의 책을 읽는다. 세상을 이해하는 가장 좋은 방법이다.', author: '빌 게이츠', category: '독서/학습' },
    { text: '에너지를 관리하면 시간이 늘어난다. 운동이 가장 좋은 투자다.', author: '리처드 브랜슨', category: '건강 관리' },
    { text: '습관은 너무 가벼워서 느끼지 못하다가, 너무 무거워서 벗어나지 못한다.', author: '워렌 버핏', category: '습관' },
    { text: '실패해도 괜찮다. 시도하지 않는 것이 진짜 실패다.', author: '제프 베조스', category: '마인드셋' },
    { text: '감사할수록 더 많은 것이 주어진다.', author: '오프라 윈프리', category: '마인드셋' },
    { text: '가장 좋은 투자는 자기 자신에 대한 투자다.', author: '워렌 버핏', category: '재테크 습관' },
    { text: '부자가 되려면 부자처럼 행동하라.', author: '토마스 콜리', category: '마인드셋' },
    { text: '매일 1%씩 나아지면, 1년 후 37배가 된다.', author: '제임스 클리어', category: '습관' },
    { text: '성공한 사람과 그렇지 않은 사람의 차이는 매일의 루틴에 있다.', author: '존 맥스웰', category: '습관' },
    { text: '위험은 자기가 뭘 하는지 모르는 데서 온다.', author: '워렌 버핏', category: '재테크 습관' },
    { text: '끊임없이 생각하라. 개선할 수 있는 방법을.', author: '일론 머스크', category: '시간 관리' },
    { text: '불필요한 것을 사면, 필요한 것을 팔아야 할 날이 온다.', author: '워렌 버핏', category: '재테크 습관' },
    { text: '수면은 리더십의 비밀 무기다.', author: '아리아나 허핑턴', category: '건강 관리' },
    { text: '혼자서는 누구도 부자가 될 수 없다.', author: '키스 페라지', category: '네트워킹' },
    { text: '인생에서 가장 중요한 투자는 관계에 대한 투자다.', author: '빌 게이츠', category: '네트워킹' },
    { text: '복리는 세계 8번째 불가사의다. 이해하는 자는 벌고, 그렇지 못한 자는 지불한다.', author: '알버트 아인슈타인', category: '재테크 습관' },
    { text: '당신의 습관이 곧 당신의 미래다.', author: '잭 캔필드', category: '습관' },
    { text: '목표를 적으면 이룰 확률이 42% 높아진다.', author: '도미니칸 대학 연구', category: '마인드셋' },
    { text: '아침을 지배하는 자가 인생을 지배한다.', author: '로빈 샤르마', category: '모닝 루틴' },
    { text: '작은 습관이 큰 변화를 만든다.', author: '제임스 클리어', category: '습관' },
    { text: '부자의 습관은 부자를 만들고, 가난의 습관은 가난을 만든다.', author: '토마스 콜리', category: '습관' },
  ],

  STORIES: [
    { title: '워렌 버핏의 독서 습관', category: '독서/학습', person: '워렌 버핏',
      body: '워렌 버핏은 하루 5~6시간을 독서에 투자해요. 투자 파트너 찰리 멍거는 "워렌은 읽는 기계"라고 말했어요. 버핏은 투자를 시작한 이후 지금까지 수만 건의 기업 보고서를 읽었어요.' },
    { title: '팀 쿡의 3:45 기상', category: '모닝 루틴', person: '팀 쿡',
      body: '애플 CEO 팀 쿡은 매일 새벽 3시 45분에 일어나요. "아침의 고요한 시간이 하루 중 가장 생산적인 시간"이라고 말했어요. 이메일 확인 후 1시간 운동으로 하루를 시작해요.' },
    { title: '레이 달리오의 명상 원칙', category: '마인드셋', person: '레이 달리오',
      body: '세계 최대 헤지펀드 브릿지워터의 창업자 레이 달리오는 40년 넘게 매일 명상을 해왔어요. "명상은 내 인생에서 가장 좋은 선물"이라고 말하며, 팀원들에게도 명상을 권해요.' },
    { title: '마크 저커버그의 회색 티셔츠', category: '시간 관리', person: '마크 저커버그',
      body: '마크 저커버그는 매일 같은 회색 티셔츠를 입어요. "사소한 결정을 줄여야 중요한 결정에 에너지를 쓸 수 있다"고 했어요. 의사결정 피로를 줄이는 대표적인 사례예요.' },
    { title: '오프라 윈프리의 감사 노트', category: '마인드셋', person: '오프라 윈프리',
      body: '오프라 윈프리는 20년 넘게 매일 감사한 것 5가지를 적어요. "감사 연습이 내 인생을 바꿨다"고 말하며, 가장 어려운 시기에도 감사할 것을 찾아요.' },
    { title: '제프 베조스의 8시간 수면', category: '건강 관리', person: '제프 베조스',
      body: '아마존 창업자 제프 베조스는 반드시 8시간 수면을 지켜요. "수면 부족 상태에서는 좋은 의사결정을 할 수 없다"며, 모든 중요한 회의를 오전 10시 이후에 잡아요.' },
    { title: '워렌 버핏의 검소한 생활', category: '재테크 습관', person: '워렌 버핏',
      body: '1,300억 달러 자산가인 버핏은 1958년에 3만 1,500달러에 산 집에 아직 살아요. 매일 맥도날드에서 아침을 먹고, 체리콕을 마셔요. "필요하지 않은 것에 돈을 쓰지 않는 것"이 부의 비결이라고 해요.' },
    { title: '리처드 브랜슨의 운동 철학', category: '건강 관리', person: '리처드 브랜슨',
      body: '버진그룹 회장 리처드 브랜슨은 매일 아침 5시에 일어나 운동해요. "운동은 생산성을 두 배로 높여준다"고 말하며, 서핑, 테니스, 사이클링 등 다양한 운동을 즐겨요.' },
  ],

  ROLE_MODEL_PACKAGES: {
    warren_buffett: ['reading_30', 'saving_habit', 'invest_study', 'news_check', 'gratitude_journal', 'simple_life', 'goal_review'],
    elon_musk: ['early_rise', 'deep_work', 'exercise_30', 'learning_new', 'decision_minimize', 'meditation_10', 'goal_review'],
    bill_gates: ['reading_30', 'exercise_60', 'family_time', 'learning_new', 'sleep_manage', 'gratitude_journal', 'goal_review'],
    oprah_winfrey: ['meditation_10', 'gratitude_journal', 'exercise_30', 'reading_30', 'positive_affirm', 'family_time', 'networking'],
    jeff_bezos: ['sleep_manage', 'family_time', 'learning_new', 'decision_minimize', 'goal_review', 'news_check', 'invest_study'],
    ray_dalio: ['meditation_10', 'goal_review', 'invest_study', 'reading_30', 'news_check', 'gratitude_journal', 'positive_affirm'],
    tim_cook: ['early_rise', 'exercise_60', 'news_check', 'goal_review', 'deep_work', 'decision_minimize', 'networking'],
    richard_branson: ['early_rise', 'exercise_30', 'networking', 'goal_review', 'positive_affirm', 'family_time', 'reading_30'],
    steve_jobs: ['decision_minimize', 'deep_work', 'meditation_10', 'simple_life', 'goal_review'],
    mark_zuckerberg: ['decision_minimize', 'deep_work', 'exercise_30', 'learning_new', 'goal_review'],
    naval_ravikant: ['reading_30', 'meditation_10', 'invest_study', 'sleep_manage', 'goal_review'],
    kim_seung_ho: ['saving_habit', 'invest_study', 'news_check', 'simple_life', 'goal_review', 'gratitude_journal'],
  },

  getHabitById(id) {
    return this.HABITS.find(h => h.id === id);
  },

  getHabitsByCategory(category) {
    return this.HABITS.filter(h => h.category === category);
  },

  getPersonById(id) {
    return this.PEOPLE.find(p => p.id === id);
  },

  getRandomQuote(category) {
    const pool = category ? this.QUOTES.filter(q => q.category === category) : this.QUOTES;
    return pool[Math.floor(Math.random() * pool.length)];
  },

  getTimeBasedQuote(hour) {
    if (hour < 9) return this.getRandomQuote('모닝 루틴') || this.getRandomQuote();
    if (hour < 18) return this.getRandomQuote();
    return this.getRandomQuote('마인드셋') || this.getRandomQuote();
  },

  getRandomStory(category) {
    const pool = category ? this.STORIES.filter(s => s.category === category) : this.STORIES;
    if (pool.length === 0) return this.STORIES[Math.floor(Math.random() * this.STORIES.length)];
    return pool[Math.floor(Math.random() * pool.length)];
  },

  getPackageHabits(roleModelId) {
    const habitIds = this.ROLE_MODEL_PACKAGES[roleModelId] || [];
    return habitIds.map(id => this.getHabitById(id)).filter(Boolean);
  }
};

// ============================================================================
// data.js — Trip dataset (九州・本州・四國 JR 自由行 2026/06/17–06/24)
// All facts compiled from official/authoritative sources (June 2026).
// Times & fares marked 參考 are representative — confirm live via the
// Google Maps / official-timetable links built into each route.
// ============================================================================

export const TRIP = {
  title: '九州 · 本州 · 四國',
  subtitle: 'JR 自由行 8 日',
  start: '2026-06-17',
  end: '2026-06-24',
  days: 8,
  base: '福岡（博多）進出',
  note: '梅雨季出行，請帶雨具；班次與票價為參考值，請以即時 Google Maps / JR 官方為準。',
};

// ---- Cities (map centers + weather points + POIs) ---------------------------
export const CITIES = [
  {
    key: 'fukuoka', name: '福岡 · 博多', jp: 'Fukuoka / Hakata', flag: '🏯',
    color: '#4f46e5', lat: 33.5902, lng: 130.4017, station: '博多駅',
    blurb: '九州門戶；屋台、明太子、太宰府。',
    pois: [
      { name: '博多站', jp: 'Hakata Station', lat: 33.5902, lng: 130.4017, emoji: '🚄', tag: 'hub', desc: '新幹線與 JR 九州樞紐，伴手禮一站購足（マイング / デイトス）。' },
      { name: '東長寺 · 福岡大佛', jp: 'Tōchō-ji', lat: 33.5925, lng: 130.4153, emoji: '🛕', tag: 'see', desc: '弘法大師創建，日本最大木造坐佛。', hours: '09:00–17:00', fee: '大佛殿 ¥50' },
      { name: '櫛田神社', jp: 'Kushida Shrine', lat: 33.5916, lng: 130.4106, emoji: '⛩️', tag: 'see', desc: '博多總鎮守，祇園山笠的舞台。', hours: '04:00–22:00', fee: '免費' },
      { name: 'Canal City 博多', jp: 'Canal City', lat: 33.5897, lng: 130.4113, emoji: '🛍️', tag: 'shop', desc: '運河造型購物城，每 30 分鐘噴泉秀。', hours: '商店 10:00–21:00' },
      { name: '中洲屋台', jp: 'Nakasu Yatai', lat: 33.5915, lng: 130.4030, emoji: '🍜', tag: 'eat', desc: '河畔路邊攤，豚骨拉麵・串燒・關東煮。', hours: '約 18:00–01:00' },
      { name: '太宰府天滿宮', jp: 'Dazaifu Tenmangū', lat: 33.5214, lng: 130.5350, emoji: '🌸', tag: 'see', desc: '學問之神菅原道真，參道梅ヶ枝餅必嚐。', hours: '約 06:30–19:30', fee: '境內免費' },
      { name: '大濠公園', jp: 'Ōhori Park', lat: 33.5876, lng: 130.3770, emoji: '🦢', tag: 'see', desc: '護城河湖景公園，旁有日本庭園與福岡城跡。', hours: '24h（日本庭園 ¥250，週一休）' },
      { name: '福岡塔', jp: 'Fukuoka Tower', lat: 33.5933, lng: 130.3514, emoji: '🗼', tag: 'see', desc: '234m 海濱塔，百道海濱夕陽絕景。', hours: '09:30–22:00', fee: '¥1,000' },
      { name: '福岡機場', jp: 'Fukuoka Airport', lat: 33.5859, lng: 130.4500, emoji: '✈️', tag: 'hub', desc: '地下鐵 5 分鐘直達博多，全日本最便利機場之一。' },
    ],
  },
  {
    key: 'kumamoto', name: '熊本', jp: 'Kumamoto', flag: '🐻',
    color: '#16a34a', lat: 32.8032, lng: 130.7079, station: '熊本駅',
    blurb: '熊本城、くまモン、馬刺し。',
    pois: [
      { name: '熊本城', jp: 'Kumamoto Castle', lat: 32.8060, lng: 130.7059, emoji: '🏯', tag: 'see', desc: '日本三大名城；天守閣已重開，可走「復原見學通路」俯瞰震災修復。', hours: '09:00–17:00（末入 16:00）', fee: '¥800' },
      { name: '櫻之馬場 城彩苑', jp: 'Sakuranobaba Jōsaien', lat: 32.8035, lng: 130.7035, emoji: '🍡', tag: 'eat', desc: '城下重現的江戶町，馬刺し・辛子蓮根・いきなり団子一次嚐。', hours: '商店 09:00–19:00' },
      { name: '水前寺成趣園', jp: 'Suizenji Jōjuen', lat: 32.7905, lng: 130.7335, emoji: '🌿', tag: 'see', desc: '桃山式回遊庭園，縮景東海道五十三次與迷你富士山。', hours: '08:30–17:00（末入 16:30）', fee: '¥500' },
      { name: 'くまモンスクエア', jp: 'Kumamon Square', lat: 32.7975, lng: 130.7080, emoji: '🐻', tag: 'see', desc: 'くまモン的辦公室與賣店；部長登場見面會（多在 15:00）。', hours: '10:00–17:00（不定休，請查官網）', fee: '免費' },
      { name: '熊本站', jp: 'Kumamoto Station', lat: 32.7894, lng: 130.6880, emoji: '🚄', tag: 'hub', desc: '九州新幹線站；距城區約 3km，搭市電前往。內有肥後よかモン市場。' },
    ],
  },
  {
    key: 'aso', name: '阿蘇', jp: 'Aso', flag: '🌋',
    color: '#ea580c', lat: 32.9522, lng: 131.1213, station: '阿蘇駅',
    blurb: '世界級火山口、草千里、あか牛。',
    pois: [
      { name: '阿蘇站', jp: 'Aso Station', lat: 32.9522, lng: 131.1213, emoji: '🚉', tag: 'hub', desc: '豐肥本線；前往火山口的巴士起點。' },
      { name: '阿蘇神社', jp: 'Aso Shrine', lat: 32.9510, lng: 131.1196, emoji: '⛩️', tag: 'see', desc: '日本三大樓門之一，2016 震後重建完成。', hours: '約 09:00–17:00', fee: '免費' },
      { name: '草千里之濱', jp: 'Kusasenri', lat: 32.8843, lng: 131.0856, emoji: '🐎', tag: 'see', desc: '火口原大草原與火口湖，放牧馬群與烏帽子岳全景。' },
      { name: '中岳火口', jp: 'Nakadake Crater', lat: 32.8845, lng: 131.0840, emoji: '🌋', tag: 'see', desc: '活火山口；可否進入視火山噴火警戒等級，出發前務必查詢。' },
    ],
  },
  {
    key: 'hiroshima', name: '廣島', jp: 'Hiroshima', flag: '🕊️',
    color: '#2563eb', lat: 34.3853, lng: 132.4553, station: '広島駅',
    blurb: '和平公園、原爆圓頂、廣島燒。',
    pois: [
      { name: '広島站', jp: 'Hiroshima Station', lat: 34.3978, lng: 132.4753, emoji: '🚄', tag: 'hub', desc: '山陽新幹線站；前往和平公園搭廣電 2/6 號線（ekie 伴手禮館）。' },
      { name: '平和記念公園', jp: 'Peace Memorial Park', lat: 34.3924, lng: 132.4525, emoji: '🕊️', tag: 'see', desc: '原爆圓頂、慰靈碑、和平之鐘聚集的核心。', hours: '24h', fee: '免費' },
      { name: '原爆圓頂（原爆ドーム）', jp: 'Atomic Bomb Dome', lat: 34.3955, lng: 132.4537, emoji: '🏛️', tag: 'see', desc: 'UNESCO 世界遺產，廣電「原爆ドーム前」站旁。', hours: '外觀 24h', fee: '免費' },
      { name: '平和記念資料館', jp: 'Peace Memorial Museum', lat: 34.3915, lng: 132.4525, emoji: '🕯️', tag: 'see', desc: '六月 7:30–19:00（末入 18:30）；建議線上預約、清晨或傍晚避開人潮。', hours: '07:30–19:00', fee: '¥200' },
      { name: '廣島城', jp: 'Hiroshima Castle', lat: 34.4026, lng: 132.4592, emoji: '🏯', tag: 'see', desc: '鯉城；天守閣 2026/3 起因結構整修閉館，可賞外觀與庭園。', hours: '09:00–17:30', fee: '¥370' },
      { name: '縮景園', jp: 'Shukkeien', lat: 34.4003, lng: 132.4675, emoji: '🌉', tag: 'see', desc: '池泉回遊式名園，距廣島城步行約 10 分。', hours: '09:00–18:00', fee: '¥260' },
      { name: '本通商店街', jp: 'Hondōri', lat: 34.3934, lng: 132.4585, emoji: '🛍️', tag: 'shop', desc: '580m 拱廊商店街，東端為お好み村（25 家廣島燒）。' },
    ],
  },
  {
    key: 'miyajima', name: '宮島', jp: 'Miyajima', flag: '⛩️',
    color: '#0d9488', lat: 34.2960, lng: 132.3199, station: '宮島口',
    blurb: '嚴島神社、海上大鳥居、神鹿。',
    pois: [
      { name: '宮島口', jp: 'Miyajimaguchi', lat: 34.3110, lng: 132.3036, emoji: '⛴️', tag: 'hub', desc: 'JR 山陽本線站；步行 5 分到渡輪口（JR 渡輪 Pass 可用）。' },
      { name: '嚴島神社', jp: 'Itsukushima Shrine', lat: 34.2960, lng: 132.3199, emoji: '⛩️', tag: 'see', desc: '世界遺產海上社殿；六月 6:30–18:00。', hours: '06:30–18:00', fee: '¥300（含寶物館 ¥500）' },
      { name: '海上大鳥居', jp: 'Great Torii', lat: 34.2958, lng: 132.3187, emoji: '🌊', tag: 'see', desc: '潮位 >250cm 看「海上浮鳥居」，<100cm 可走到鳥居腳下。出發前查潮汐表。' },
      { name: '表參道商店街', jp: 'Omotesandō', lat: 34.2978, lng: 132.3215, emoji: '🍡', tag: 'eat', desc: '穴子飯、烤牡蠣、現烤紅葉饅頭、楓葉霜淇淋。' },
    ],
  },
  {
    key: 'shimonoseki', name: '下關 · 馬關', jp: 'Shimonoseki', flag: '🐡',
    color: '#e11d48', lat: 33.9576, lng: 130.9410, station: '下関駅',
    blurb: '馬關條約簽署地、河豚、關門海峽。',
    pois: [
      { name: '下関站', jp: 'Shimonoseki Station', lat: 33.9499, lng: 130.9242, emoji: '🚉', tag: 'hub', desc: 'JR 山陽本線站；搭サンデン巴士約 9 分到唐戸／赤間神宮前（¥220）。' },
      { name: '日清講和記念館', jp: 'Treaty Memorial Hall', lat: 33.9578, lng: 130.9452, emoji: '📜', tag: 'see', desc: '★ 馬關條約（下関條約）核心；重現 1895 年談判房間、原桌椅文書。免費。', hours: '09:00–17:00（全年無休）', fee: '免費' },
      { name: '春帆樓', jp: 'Shunpanrō', lat: 33.9577, lng: 130.9450, emoji: '🏮', tag: 'see', desc: '1895 馬關條約簽署的料亭；日本第一家獲牌照河豚店。河豚會席須預約（¥12,000+）。', hours: '午餐 11:00–14:00' },
      { name: '赤間神宮', jp: 'Akama Shrine', lat: 33.9580, lng: 130.9460, emoji: '⛩️', tag: 'see', desc: '朱紅龍宮造水天門，祀安德天皇（壇之浦之戰）。', hours: '約 09:00–17:00', fee: '境內免費' },
      { name: '唐戸市場', jp: 'Karato Market', lat: 33.9535, lng: 130.9450, emoji: '🐡', tag: 'eat', desc: '河豚與壽司市場；週五六日「活きいき馬関街」屋台最熱鬧，平日攤位較少。', hours: '上午營業' },
      { name: 'みもすそ川公園 / 關門隧道人道', lat: 33.9620, lng: 130.9620, jp: 'Kanmon', emoji: '🌉', tag: 'see', desc: '壇之浦古戰場；可步行海底人道（約 780m）走到九州門司側。', hours: '人道 06:00–22:00' },
    ],
  },
];

export const cityByKey = Object.fromEntries(CITIES.map(c => [c.key, c]));

// ---- Inter-city JR journeys (路線 tab「所有班次」) ----------------------------
// dep/arr times are 參考 representative departures — use the live link to confirm.
export const ROUTES = [
  {
    id: 'r-hkt-kmj', from: '博多', to: '熊本', fromStn: '博多駅', toStn: '熊本駅',
    line: '九州新幹線', icon: 'i-train', color: '#16a34a',
    summary: 'さくら（自由席/指定席）約 40 分', fare: '¥5,640（指定）/ ¥5,310（自由）',
    pass: 'SSNK 周遊券可用（みずほ亦可）',
    legs: [
      { dep: '08:00', arr: '08:40', line: '九州新幹線 さくら', type: 'shinkansen', dur: '約 40 分', note: '參考班次，さくら每小時 2–3 班；みずほ約 35 分（不含 SSNK 以外多數普通 JR Pass）。' },
    ],
    tip: 'みずほ最快（約 35 分）但僅指定席；持 SSNK 周遊券可搭みずほ／さくら皆可。',
  },
  {
    id: 'r-kmj-aso', from: '熊本', to: '阿蘇', fromStn: '熊本駅', toStn: '阿蘇駅',
    line: '豐肥本線', icon: 'i-train', color: '#ea580c',
    summary: '特急（九州横断特急/あそ）約 70 分', fare: '約 ¥2,000–3,000（特急）/ ¥1,130（普通）',
    pass: 'JR Pass / SSNK 不含（SSNK 範圍不及阿蘇，普通票購買）',
    legs: [
      { dep: '08:38', arr: '09:50', line: '特急 九州横断特急', type: 'ltdexp', dur: '約 72 分', note: '直達不需轉乘；班次少（一天數班）。' },
      { dep: '—', arr: '—', line: '（替代）普通＋肥後大津轉乘', type: 'local', dur: '約 100 分', note: '普通車多在肥後大津轉乘，約每小時 1 班。' },
    ],
    tip: '週六日／假日有觀光列車「あそぼーい！」（需指定席預約，人氣高早訂）。豐肥本線 2020 全線復通，運行正常。',
  },
  {
    id: 'r-kmj-hir', from: '熊本', to: '廣島', fromStn: '熊本駅', toStn: '広島駅',
    line: '九州・山陽新幹線', icon: 'i-train', color: '#2563eb',
    summary: 'さくら/みずほ 直通 約 1 小時 50 分–2 小時', fare: '約 ¥14,000–15,000（指定）',
    pass: 'SSNK 周遊券可用（含のぞみ・みずほ）',
    legs: [
      { dep: '09:11', arr: '11:05', line: '山陽・九州新幹線 さくら／みずほ（直通）', type: 'shinkansen', dur: '約 1h50–2h', note: '部分さくら／みずほ熊本↔廣島直通免轉乘；否則於博多轉乘のぞみ（博多→廣島約 1 小時）。' },
    ],
    tip: '優先選直通的さくら／みずほ；若需轉乘，博多→廣島のぞみ最快約 1 小時。',
  },
  {
    id: 'r-hir-miy', from: '廣島', to: '宮島', fromStn: '広島駅', toStn: '宮島口駅',
    line: 'JR 山陽本線 + JR 宮島渡輪', icon: 'i-route', color: '#0d9488',
    summary: '山陽本線約 27 分 + 渡輪約 10 分', fare: 'JR ¥420 + 渡輪（Pass 可用）+ 宮島訪問稅 ¥100',
    pass: 'SSNK／JR Pass 含 JR 渡輪；持券者另購 ¥100 訪問稅',
    legs: [
      { dep: '08:35', arr: '09:02', line: 'JR 山陽本線（往岩国）', type: 'local', dur: '約 27 分', note: '每小時 3–4 班；至宮島口站。' },
      { dep: '09:10', arr: '09:20', line: 'JR 宮島渡輪', type: 'ferry', dur: '約 10 分', note: '步行 5 分到渡輪口；09:10–16:10 的 JR 船班會繞近大鳥居拍照。' },
    ],
    tip: '渡輪有 JR 與松大兩家，持 JR Pass 請搭 JR 船。',
  },
  {
    id: 'r-hir-smk', from: '廣島', to: '下關（馬關）', fromStn: '広島駅', toStn: '下関駅',
    line: '山陽新幹線 + JR 山陽本線', icon: 'i-route', color: '#e11d48',
    summary: '新幹線到小倉約 50 分 + 在來線到下關約 15 分', fare: '約 ¥9,000（指定，至小倉）+ ¥280–340',
    pass: 'SSNK 周遊券可用（含のぞみ／さくら）',
    legs: [
      { dep: '08:30', arr: '09:18', line: '山陽新幹線 のぞみ／さくら', type: 'shinkansen', dur: '約 48 分', note: '廣島→小倉；下關治在來線，新下関僅こだま停靠不便，建議走小倉轉在來。' },
      { dep: '09:30', arr: '09:45', line: 'JR 山陽本線（小倉→下関，多在門司轉乘）', type: 'local', dur: '約 13–15 分', note: '班次頻繁；下關站轉サンデン巴士到唐戸（約 9 分 ¥220）。' },
    ],
    tip: '馬關條約景點集中在唐戸；請到「下関駅」再轉巴士，勿到「新下関」。',
  },
  {
    id: 'r-smk-hkt', from: '下關', to: '博多', fromStn: '下関駅', toStn: '博多駅',
    line: 'JR 山陽本線 + 山陽新幹線', icon: 'i-route', color: '#4f46e5',
    summary: '在來線到小倉約 15 分 + 新幹線到博多約 16 分', fare: '約 ¥280–340 + ¥2,160（自由）',
    pass: 'SSNK 周遊券可用',
    legs: [
      { dep: '15:40', arr: '15:55', line: 'JR 山陽本線（下関→小倉，多在門司轉乘）', type: 'local', dur: '約 13–15 分', note: '回程；至小倉轉新幹線。' },
      { dep: '16:10', arr: '16:26', line: '山陽新幹線 のぞみ／さくら', type: 'shinkansen', dur: '約 16 分', note: '小倉→博多最快約 15 分。' },
    ],
    tip: '小倉↔博多新幹線每小時多班，回程彈性大。',
  },
];

// ---- JR Pass recommendation -------------------------------------------------
export const PASS = {
  best: 'JR West 山陽・山陰・北九州地區鐵路周遊券',
  bestEn: 'Sanyo–San\'in–Northern Kyushu Area Pass (SSNK)',
  price: '¥26,000',
  days: '連續 7 日',
  why: '唯一一張涵蓋「廣島⇄下關⇄博多⇄熊本」全程、且包含のぞみ・みずほ指定席的周遊券；本行程跑一趟廣島↔博多來回即回本。',
  highlights: [
    '✅ 含のぞみ・みずほ（多數 JR Pass 不含）',
    '✅ 涵蓋 山陽新幹線（廣島・下關・小倉）+ 九州新幹線（博多⇄熊本）',
    '✅ 含 JR 宮島渡輪',
    '⚠️ 不含 阿蘇（豐肥本線特急另購）與 四國',
    '🎫 連續 7 日 — 建議 6/19（熊本日）啟用，涵蓋所有新幹線移動',
  ],
  buy: '官方 JR West 線上預約（WESTER）或 Klook 等代理購買，持護照於博多／廣島等大站兌換實體券；綠色售票機可訂前 6 次座位，其餘到綠色窗口劃位（免費）。',
  compare: [
    { name: 'SSNK（推薦）', price: '¥26,000', days: '7', nozomi: '✅', hiroshima: '✅', shimonoseki: '✅', kumamoto: '✅', verdict: '★ 最佳' },
    { name: 'JR 九州北部', price: '¥15,000–17,000', days: '3/5', nozomi: '部分', hiroshima: '❌', shimonoseki: '❌', kumamoto: '✅', verdict: '範圍不足' },
    { name: '山陽・山陰', price: '約 ¥23,000', days: '7', nozomi: '✅', hiroshima: '✅', shimonoseki: '✅', kumamoto: '❌', verdict: '缺熊本' },
    { name: 'All Shikoku', price: '¥12,000–20,000', days: '3–7', nozomi: '—', hiroshima: '❌', shimonoseki: '❌', kumamoto: '❌', verdict: '另一網絡' },
    { name: '全國 JR Pass', price: '¥50,000', days: '7', nozomi: '⚠️加價', hiroshima: '✅', shimonoseki: '✅', kumamoto: '✅', verdict: '太貴' },
  ],
};

// ---- Souvenirs (伴手禮) by city ---------------------------------------------
export const SOUVENIRS = {
  fukuoka: [
    { name: '博多通りもん', emoji: '🥮', desc: '奶香白豆沙西式饅頭，Monde Selection 金賞，博多經典。', where: '博多站 マイング／デイトス', price: '6 入 ¥1,000' },
    { name: '辛子明太子', emoji: '🌶️', desc: '福岡代表；ふくや 創始。需冷藏，回程前再買。', where: 'デイトス 1F みやげもん市場（ふくや）', price: '禮盒 ¥1,500–3,000' },
    { name: '博多ひよ子', emoji: '🐤', desc: '小雞造型黃豆沙蛋糕，可愛伴手禮。', where: 'マイング／デイトス', price: '¥1,000–1,300' },
    { name: '二〇加煎餅', emoji: '🎭', desc: '博多仁和加面具造型雞蛋煎餅，附紙面具。', where: '東雲堂／站內賣店', price: '16 入 ¥540–760' },
    { name: '豚骨拉麵組合', emoji: '🍜', desc: '一蘭／一風堂／マルタイ 帶回家的博多拉麵。', where: 'マイング／超市', price: '¥400–1,000' },
  ],
  kumamoto: [
    { name: '誉の陣太鼓', emoji: '🥁', desc: '香梅出品；求肥包大納言紅豆，太鼓造型罐附切線。', where: '熊本站 肥後よかモン市場', price: '8 入 ¥1,728' },
    { name: '武者がえし', emoji: '🏯', desc: '薄餅皮包羊羹，熊本城石垣主題。', where: '香梅各店', price: '¥1,300–1,700' },
    { name: 'いきなり団子', emoji: '🍠', desc: '地瓜＋紅豆蒸點心；當地日常零食（賞味期短）。', where: '肥後よかモン市場', price: '¥130–180/個' },
    { name: '辛子蓮根', emoji: '🪷', desc: '蓮藕塞芥末味噌油炸；細川藩名物，有真空包裝版。', where: 'よかモン市場／百貨食品館', price: '¥1,000–1,500' },
    { name: 'くまモン周邊', emoji: '🐻', desc: '吉祥物零食、玩偶、文具，送禮討喜。', where: 'くまモンスクエア／站內', price: '¥300–2,000' },
  ],
  hiroshima: [
    { name: '生もみじ', emoji: '🍁', desc: 'にしき堂的濕潤求肥版紅葉饅頭，「廣島品牌」認證，首選。', where: '広島站 ekie おみやげ館', price: '10 入 ¥1,400' },
    { name: 'もみじ饅頭', emoji: '🍁', desc: '經典楓葉castella，にしき堂現場烘烤。', where: 'ekie / おみやげ街道', price: '10 入 ¥1,000–1,400' },
    { name: '檸檬蛋糕', emoji: '🍋', desc: '瀨戶田檸檬海綿蛋糕（島ごころ／Mozart）。', where: 'ekie おみやげ館', price: '5 入 ¥1,250' },
    { name: 'お好み焼きソース', emoji: '🥫', desc: 'Otafuku 濃厚醬，廣島燒的靈魂味道。', where: 'ekie／超市', price: '¥300–500' },
    { name: '牡蠣加工品', emoji: '🦪', desc: '燻牡蠣／油漬牡蠣／牡蠣醬油，常溫好攜帶。', where: 'ekie 瀨戶內海鮮區', price: '¥600–1,500' },
  ],
  shimonoseki: [
    { name: 'ふぐ刺し（河豚刺身）', emoji: '🐡', desc: '下關代表；冷藏／冷凍盤裝禮盒，需保冷。', where: '唐戸市場／站旁百貨 B1', price: '¥2,000–5,000' },
    { name: 'ふぐ煎餅', emoji: '🍘', desc: '河豚仙貝，輕巧常溫、適合帶回。', where: '唐戸市場／站內賣店', price: '¥500–1,000' },
    { name: 'ふぐ加工品', emoji: '🍶', desc: 'ふくのひれ酒（鰭酒）、河豚茶泡飯等。', where: '唐戸市場（ふくの里）', price: '¥500–2,000' },
    { name: '巌流焼', emoji: '🍮', desc: '以巖流島命名的卡士達烤點心。', where: '下關甜點店／站內（請現場確認）', price: '¥130–200/個' },
  ],
};

// ---- 8-day itinerary --------------------------------------------------------
// item.type: arrive|move|see|eat|shop|stay|depart   item.route -> ROUTES-like
const D = (date, dow, cityKey, weatherKey, title, summary, items) =>
  ({ date, dow, cityKey, weatherKey, title, summary, items });

export const DAYS = [
  D('2026-06-17', '二', 'fukuoka', 'fukuoka', '抵達福岡 · 博多巡禮', '機場直達博多，逛東長寺・櫛田神社・運河城，夜訪中洲屋台。', [
    { time: '14:00', type: 'arrive', title: '抵達福岡機場', jp: 'Fukuoka Airport', lat: 33.5859, lng: 130.4500, desc: '入境、領行李。' },
    { time: '14:25', type: 'move', title: '地下鐵空港線 → 博多', desc: '福岡機場 → 博多站，最便利的機場交通。', route: { fromStn: '福岡空港駅', toStn: '博多駅', legs: [{ dep: '14:25', arr: '14:30', line: '福岡市地下鐵 空港線', type: 'subway', dur: '約 5 分', note: '¥260；每 3–6 分一班。' }], fare: '¥260', pass: '（地下鐵不含 JR Pass）' } },
    { time: '15:00', type: 'stay', title: '飯店 Check-in / 寄放行李', desc: '建議住博多站周邊，交通與伴手禮最方便。', lat: 33.5902, lng: 130.4017 },
    { time: '15:40', type: 'see', title: '東長寺 · 福岡大佛', jp: 'Tōchō-ji', lat: 33.5925, lng: 130.4153, desc: '日本最大木造坐佛；地下鐵祇園站 1 分。', cost: '¥50', dur: '40 分' },
    { time: '16:30', type: 'see', title: '櫛田神社', jp: 'Kushida Shrine', lat: 33.5916, lng: 130.4106, desc: '博多總鎮守，祇園山笠飾山常設。', cost: '免費', dur: '30 分' },
    { time: '17:10', type: 'shop', title: 'Canal City 博多', lat: 33.5897, lng: 130.4113, desc: '運河購物城，每 30 分鐘噴泉聲光秀。', dur: '80 分' },
    { time: '18:40', type: 'eat', title: '中洲屋台 晚餐', lat: 33.5915, lng: 130.4030, desc: '河畔路邊攤體驗：豚骨拉麵・串燒・明太子玉子燒。', dur: '90 分' },
    { time: '21:00', type: 'stay', title: '返回博多飯店', lat: 33.5902, lng: 130.4017, desc: '休息，明日太宰府。' },
  ]),
  D('2026-06-18', '三', 'fukuoka', 'fukuoka', '太宰府 · 大濠 · 福岡塔', '上午西鐵到太宰府天滿宮，午後大濠公園與福岡塔夕景。', [
    { time: '09:00', type: 'move', title: '博多 → 天神 → 太宰府', desc: '地下鐵到天神，轉西鐵電車到太宰府。', route: { fromStn: '西鉄福岡（天神）駅', toStn: '太宰府駅', legs: [{ dep: '09:00', arr: '09:10', line: '地下鐵空港線 博多→天神', type: 'subway', dur: '約 5 分', note: '¥210' }, { dep: '09:20', arr: '09:55', line: '西鐵天神大牟田線＋太宰府線（二日市轉乘）', type: 'private', dur: '約 25–40 分', note: '¥480；部分觀光直達車免轉乘。' }], fare: '¥210 + ¥480', pass: '（西鐵／地下鐵不含 JR Pass）' } },
    { time: '10:15', type: 'see', title: '太宰府天滿宮', jp: 'Dazaifu Tenmangū', lat: 33.5214, lng: 130.5350, desc: '學問之神；本殿整修中於臨時殿參拜。參道嚐梅ヶ枝餅。', cost: '境內免費', dur: '2 小時' },
    { time: '12:30', type: 'eat', title: '參道／天神 午餐', lat: 33.5214, lng: 130.5350, desc: '梅ヶ枝餅、星巴克太宰府店，或回天神用餐。' },
    { time: '14:00', type: 'see', title: '大濠公園 + 日本庭園', jp: 'Ōhori Park', lat: 33.5876, lng: 130.3770, desc: '地下鐵大濠公園站；環湖散步、日本庭園 ¥250。', cost: '庭園 ¥250', dur: '90 分' },
    { time: '16:00', type: 'see', title: '福岡塔 夕景', jp: 'Fukuoka Tower', lat: 33.5933, lng: 130.3514, desc: '123m 展望台，百道海濱夕陽與夜景。', cost: '¥1,000', dur: '90 分' },
    { time: '18:30', type: 'eat', title: '天神 晚餐 / 購物', lat: 33.5908, lng: 130.3990, desc: '天神地下街、百貨；水炊き或もつ鍋。' },
    { time: '20:30', type: 'stay', title: '返回博多飯店', lat: 33.5902, lng: 130.4017, desc: '明日啟用 JR 周遊券，前往熊本。' },
  ]),
  D('2026-06-19', '四', 'kumamoto', 'kumamoto', '博多 → 熊本城', '新幹線南下熊本，登熊本城、城彩苑午餐、くまモン、水前寺。', [
    { time: '08:00', type: 'move', title: '博多 → 熊本（新幹線）', desc: '九州新幹線さくら；今天啟用 SSNK 周遊券最划算。', route: ROUTES[0] },
    { time: '09:00', type: 'move', title: '熊本站 → 熊本城（市電）', desc: '搭市電 B 系統到「熊本城・市役所前」，再步行 5–10 分。', route: { fromStn: '熊本駅前', toStn: '熊本城・市役所前', legs: [{ dep: '09:05', arr: '09:20', line: '熊本市電 B 系統', type: 'tram', dur: '約 15 分', note: '¥200 均一；每 6–10 分一班。' }], fare: '¥200', pass: '（市電不含 JR Pass；可買 1 日券 ¥500）' } },
    { time: '09:40', type: 'see', title: '熊本城 + 復原見學通路', jp: 'Kumamoto Castle', lat: 32.8060, lng: 130.7059, desc: '天守閣已重開；空中迴廊俯瞰震災修復（含於門票）。', cost: '¥800', dur: '2.5 小時' },
    { time: '12:15', type: 'eat', title: '櫻之馬場 城彩苑 午餐', lat: 32.8035, lng: 130.7035, desc: '馬刺し・辛子蓮根・いきなり団子・太平燕一次品嚐。', dur: '75 分' },
    { time: '14:30', type: 'see', title: 'くまモンスクエア', lat: 32.7975, lng: 130.7080, desc: '部長見面會多在 15:00；賣店掃くまモン伴手禮。', cost: '免費', dur: '60 分' },
    { time: '15:45', type: 'see', title: '水前寺成趣園', jp: 'Suizenji', lat: 32.7905, lng: 130.7335, desc: '市電約 30 分；末入 16:30，把握時間。', cost: '¥500', dur: '60 分' },
    { time: '17:30', type: 'eat', title: '熊本市區 晚餐', lat: 32.8000, lng: 130.7060, desc: '熊本ラーメン（焦香蒜油）或馬肉料理。' },
    { time: '19:30', type: 'stay', title: '熊本住宿', lat: 32.8000, lng: 130.7050, desc: '住熊本一晚，明日阿蘇。' },
  ]),
  D('2026-06-20', '五', 'aso', 'aso', '阿蘇火山一日', '豐肥本線進阿蘇，阿蘇神社、草千里、火口（視警戒），あか牛丼。', [
    { time: '08:38', type: 'move', title: '熊本 → 阿蘇', desc: '豐肥本線特急（週末可能有觀光列車あそぼーい！）。', route: ROUTES[1] },
    { time: '10:00', type: 'see', title: '阿蘇神社', jp: 'Aso Shrine', lat: 32.9510, lng: 131.1196, desc: '日本三大樓門之一，震後重建完成。', cost: '免費', dur: '45 分' },
    { time: '11:00', type: 'see', title: '草千里・中岳火口', lat: 32.8843, lng: 131.0856, desc: '阿蘇站搭產交巴士上山；火口能否進入視噴火警戒等級，務必當日查詢。', dur: '2 小時' },
    { time: '13:15', type: 'eat', title: '阿蘇 午餐：あか牛丼', lat: 32.9522, lng: 131.1213, desc: '阿蘇名物紅牛丼飯，車站周邊餐廳。', dur: '60 分' },
    { time: '15:30', type: 'move', title: '阿蘇 → 熊本', desc: '豐肥本線返回熊本。', route: { fromStn: '阿蘇駅', toStn: '熊本駅', legs: [{ dep: '15:40', arr: '16:55', line: '豐肥本線 特急／普通', type: 'ltdexp', dur: '約 75–100 分', note: '回程班次少，務必先查當日時刻。' }], fare: '約 ¥2,000', pass: '另購' } },
    { time: '17:30', type: 'eat', title: '熊本 晚餐 / 自由活動', lat: 32.8000, lng: 130.7060, desc: '下通／上通商店街。' },
    { time: '19:30', type: 'stay', title: '熊本住宿', lat: 32.8000, lng: 130.7050, desc: '明日跨海到廣島。' },
  ]),
  D('2026-06-21', '六', 'hiroshima', 'hiroshima', '熊本 → 廣島和平公園', '直通新幹線到廣島，午餐廣島燒，下午和平記念公園與資料館。', [
    { time: '09:11', type: 'move', title: '熊本 → 廣島（新幹線）', desc: 'さくら／みずほ直通最省事；否則博多轉のぞみ。', route: ROUTES[2] },
    { time: '11:20', type: 'eat', title: '廣島燒 午餐', lat: 34.3934, lng: 132.4585, desc: '本通／お好み村；廣島風お好み焼き（麵＋大量高麗菜）。', dur: '75 分' },
    { time: '13:00', type: 'move', title: '廣電路面電車 → 原爆ドーム前', desc: '廣島站搭 2／6 號線到原爆ドーム前。', route: { fromStn: '広島駅', toStn: '原爆ドーム前', legs: [{ dep: '13:00', arr: '13:17', line: '廣電市內電車 2／6 號線', type: 'tram', dur: '約 17 分', note: '¥240 均一；不含 JR Pass。' }], fare: '¥240', pass: '（廣電不含 JR Pass）' } },
    { time: '13:30', type: 'see', title: '原爆圓頂 + 和平記念公園', lat: 34.3955, lng: 132.4537, desc: '世界遺產原爆ドーム、慰靈碑、和平之鐘。', cost: '免費', dur: '60 分' },
    { time: '14:45', type: 'see', title: '平和記念資料館', lat: 34.3915, lng: 132.4525, desc: '建議線上預約；六月開到 19:00（末入 18:30）。', cost: '¥200', dur: '90 分' },
    { time: '16:45', type: 'shop', title: '本通商店街 / 散步', lat: 34.3934, lng: 132.4585, desc: '拱廊商店街購物，或おりづるタワー眺望。' },
    { time: '18:30', type: 'eat', title: '廣島 晚餐', lat: 34.3958, lng: 132.4620, desc: '牡蠣料理或つけ麺。' },
    { time: '20:00', type: 'stay', title: '廣島住宿', lat: 34.3970, lng: 132.4730, desc: '住廣島站周邊，明日宮島。' },
  ]),
  D('2026-06-22', '日', 'miyajima', 'miyajima', '宮島嚴島神社', '上午渡海宮島看大鳥居，午後廣島城外觀與縮景園。', [
    { time: '08:35', type: 'move', title: '廣島 → 宮島', desc: 'JR 山陽本線到宮島口，轉 JR 渡輪。', route: ROUTES[3] },
    { time: '09:30', type: 'see', title: '嚴島神社 + 大鳥居', jp: 'Itsukushima', lat: 34.2960, lng: 132.3199, desc: '世界遺產海上社殿；查潮汐：高潮看浮鳥居、低潮可走到鳥居腳。', cost: '¥300（+寶物館 ¥500）', dur: '2.5 小時' },
    { time: '12:30', type: 'eat', title: '表參道 午餐', lat: 34.2978, lng: 132.3215, desc: '穴子飯、烤牡蠣、現烤紅葉饅頭。', dur: '90 分' },
    { time: '14:30', type: 'move', title: '宮島 → 廣島', desc: '原路返回廣島。', route: { fromStn: '宮島口駅', toStn: '広島駅', legs: [{ dep: '14:30', arr: '14:40', line: 'JR 宮島渡輪', type: 'ferry', dur: '約 10 分' }, { dep: '14:50', arr: '15:17', line: 'JR 山陽本線', type: 'local', dur: '約 27 分' }], fare: 'Pass 可用', pass: 'SSNK／JR Pass 可用' } },
    { time: '15:40', type: 'see', title: '廣島城（外觀）+ 縮景園', lat: 34.4003, lng: 132.4675, desc: '天守閣 2026 整修閉館，賞外觀與庭園；縮景園開到 18:00。', cost: '縮景園 ¥260', dur: '120 分' },
    { time: '18:00', type: 'eat', title: '廣島 晚餐', lat: 34.3958, lng: 132.4620, desc: '最後一晚廣島，再吃一份廣島燒或牡蠣。' },
    { time: '20:00', type: 'stay', title: '廣島住宿', lat: 34.3970, lng: 132.4730, desc: '明日下關馬關條約。' },
  ]),
  D('2026-06-23', '一', 'shimonoseki', 'shimonoseki', '下關 · 馬關條約', '新幹線＋在來線到下關唐戸，馬關條約簽署地、河豚、關門海峽，夜回博多。', [
    { time: '08:30', type: 'move', title: '廣島 → 下關（小倉轉乘）', desc: '新幹線到小倉，轉在來線到下關，再轉巴士到唐戸。', route: ROUTES[4] },
    { time: '10:00', type: 'move', title: '下關站 → 赤間神宮前（巴士）', desc: 'サンデン巴士約 9 分，¥220。', route: { fromStn: '下関駅', toStn: '赤間神宮前', legs: [{ dep: '10:00', arr: '10:09', line: 'サンデン交通巴士（往長府方向）', type: 'bus', dur: '約 9 分', note: '¥220；可用 IC 卡。' }], fare: '¥220', pass: '（巴士不含 JR Pass）' } },
    { time: '10:30', type: 'see', title: '日清講和記念館（馬關條約）', jp: 'Treaty Hall', lat: 33.9578, lng: 130.9452, desc: '★ 重現 1895 馬關條約談判房間、原桌椅與文書。免費。', cost: '免費', dur: '45 分' },
    { time: '11:20', type: 'see', title: '春帆樓 + 赤間神宮', lat: 33.9577, lng: 130.9450, desc: '條約簽署料亭（外觀）與朱紅龍宮造赤間神宮。', cost: '神宮免費', dur: '50 分' },
    { time: '12:20', type: 'eat', title: '唐戸市場 河豚午餐', lat: 33.9535, lng: 130.9450, desc: '河豚握壽司／海鮮丼；平日攤位較少，亦可在春帆樓或市場餐廳。', dur: '70 分' },
    { time: '14:00', type: 'see', title: '關門海峽 / 關門隧道人道', lat: 33.9620, lng: 130.9620, desc: '壇之浦古戰場；可步行海底人道到九州門司（約 15 分）。', dur: '90 分' },
    { time: '15:40', type: 'move', title: '下關 → 博多', desc: '在來線到小倉，新幹線回博多。', route: ROUTES[5] },
    { time: '18:00', type: 'eat', title: '博多 最後晚餐', lat: 33.5902, lng: 130.4017, desc: '水炊き／一蘭總本店，或屋台再訪。' },
    { time: '20:00', type: 'stay', title: '博多住宿', lat: 33.5902, lng: 130.4017, desc: '明日返程。' },
  ]),
  D('2026-06-24', '二', 'fukuoka', 'fukuoka', '博多採購 · 返程', '上午博多站掃伴手禮，地下鐵到機場，賦歸。', [
    { time: '09:00', type: 'shop', title: '博多站 伴手禮採購', lat: 33.5902, lng: 130.4017, desc: 'マイング（92 店）＋デイトス みやげもん市場；明太子最後再買並要保冷劑。', dur: '120 分' },
    { time: '11:15', type: 'move', title: '博多 → 福岡機場', desc: '地下鐵空港線約 5 分。', route: { fromStn: '博多駅', toStn: '福岡空港駅', legs: [{ dep: '11:15', arr: '11:20', line: '福岡市地下鐵 空港線', type: 'subway', dur: '約 5 分', note: '¥260' }], fare: '¥260', pass: '（地下鐵不含 JR Pass）' } },
    { time: '12:00', type: 'depart', title: '福岡機場 出發', jp: 'Fukuoka Airport', lat: 33.5859, lng: 130.4500, desc: '辦理登機，賦歸。八日九州・本州之旅圓滿！' },
  ]),
];

// Quick lookups
export const dayByDate = Object.fromEntries(DAYS.map((d, i) => [d.date, { ...d, index: i }]));
export const allPois = CITIES.flatMap(c => c.pois.map(p => ({ ...p, cityKey: c.key, cityName: c.name, color: c.color })));

// Type metadata for badges/icons
export const TYPE_META = {
  arrive: { label: '抵達', cls: 'badge-see', icon: 'i-pin' },
  depart: { label: '出發', cls: 'badge-see', icon: 'i-pin' },
  move: { label: '交通', cls: 'badge-move', icon: 'i-train' },
  see: { label: '景點', cls: 'badge-see', icon: 'i-pin' },
  eat: { label: '美食', cls: 'badge-eat', icon: 'i-gift' },
  shop: { label: '購物', cls: 'badge-eat', icon: 'i-bag' },
  stay: { label: '住宿', cls: 'badge-see', icon: 'i-pin' },
};

// WMO weather code -> {label, emoji}
export const WMO = {
  0: ['晴朗', '☀️'], 1: ['大致晴朗', '🌤️'], 2: ['局部多雲', '⛅'], 3: ['陰天', '☁️'],
  45: ['霧', '🌫️'], 48: ['霧凇', '🌫️'], 51: ['毛毛雨', '🌦️'], 53: ['中毛雨', '🌦️'], 55: ['濃毛雨', '🌧️'],
  56: ['凍毛雨', '🌧️'], 57: ['濃凍毛雨', '🌧️'], 61: ['小雨', '🌧️'], 63: ['中雨', '🌧️'], 65: ['大雨', '🌧️'],
  66: ['凍雨', '🌧️'], 67: ['強凍雨', '🌧️'], 71: ['小雪', '🌨️'], 73: ['中雪', '🌨️'], 75: ['大雪', '❄️'],
  77: ['霰', '🌨️'], 80: ['陣雨', '🌦️'], 81: ['中陣雨', '🌧️'], 82: ['強陣雨', '⛈️'],
  85: ['陣雪', '🌨️'], 86: ['強陣雪', '❄️'], 95: ['雷雨', '⛈️'], 96: ['雷雨夾雹', '⛈️'], 99: ['強雷雨雹', '⛈️'],
};
export const wmo = code => WMO[code] || ['—', '🌡️'];

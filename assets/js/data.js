// ============================================================================
// data.js — Trip dataset (九州・瀨戶內・關西 JR 單程自由行 2026/06/17–06/24)
// 熊本機場(KMJ)進 → 關西機場(KIX)出。
// Facts compiled from official/authoritative sources (June 2026).
// 班次/票價標 參考 為代表值 — 以各段內建的 Google 即時/JR 官方連結為準。
// ============================================================================

export const TRIP = {
  title: '九州 · 瀨戶內 · 關西',
  subtitle: 'JR 單程自由行 8 日',
  start: '2026-06-17',
  end: '2026-06-24',
  days: 8,
  base: '熊本(KMJ)進 · 關西(KIX)出',
  note: '梅雨季出行，請帶雨具；班次與票價為參考值，請以即時 Google Maps / JR 官方為準。',
};

// ---- Cities (map centers + weather points + POIs) ---------------------------
export const CITIES = [
  {
    key: 'kumamoto', name: '熊本', jp: 'Kumamoto', flag: '🐻',
    color: '#16a34a', lat: 32.8032, lng: 130.7079, station: '熊本駅',
    blurb: '起點；熊本城、くまモン、馬刺し。',
    pois: [
      { name: '阿蘇熊本機場', jp: 'Kumamoto Airport (KMJ)', lat: 32.8372, lng: 130.8553, emoji: '✈️', tag: 'hub', desc: '進入點；リムジンバス約 50 分到桜町巴士總站（¥1,200），或免費空港ライナー到肥後大津轉 JR。' },
      { name: '熊本城', jp: 'Kumamoto Castle', lat: 32.8060, lng: 130.7059, emoji: '🏯', tag: 'see', desc: '日本三大名城；天守閣已重開，可走「復原見學通路」俯瞰震災修復。', hours: '09:00–17:00（末入 16:00）', fee: '¥800' },
      { name: '櫻之馬場 城彩苑', jp: 'Sakuranobaba Jōsaien', lat: 32.8035, lng: 130.7035, emoji: '🍡', tag: 'eat', desc: '城下江戶町；馬刺し・辛子蓮根・いきなり団子・太平燕一次嚐。', hours: '商店 09:00–19:00' },
      { name: '水前寺成趣園', jp: 'Suizenji Jōjuen', lat: 32.7905, lng: 130.7335, emoji: '🌿', tag: 'see', desc: '桃山式回遊庭園，縮景東海道與迷你富士山。', hours: '08:30–17:00（末入 16:30）', fee: '¥500' },
      { name: 'くまモンスクエア', jp: 'Kumamon Square', lat: 32.7975, lng: 130.7080, emoji: '🐻', tag: 'see', desc: 'くまモン的辦公室與賣店；部長見面會多在 15:00。', hours: '10:00–17:00（不定休）', fee: '免費' },
      { name: '熊本站', jp: 'Kumamoto Station', lat: 32.7896, lng: 130.6880, emoji: '🚄', tag: 'hub', desc: '九州新幹線站（距城區約 3km，搭市電）；內有肥後よかモン市場。' },
    ],
  },
  {
    key: 'fukuoka', name: '福岡 · 博多', jp: 'Fukuoka / Hakata', flag: '🏮',
    color: '#4f46e5', lat: 33.5902, lng: 130.4017, station: '博多駅',
    blurb: '屋台、明太子、太宰府；周遊券啟用點。',
    pois: [
      { name: '博多站', jp: 'Hakata Station', lat: 33.5899, lng: 130.4207, emoji: '🚄', tag: 'hub', desc: '新幹線樞紐；Setouchi 周遊券在此啟用。伴手禮：マイング／デイトス。' },
      { name: '太宰府天滿宮', jp: 'Dazaifu Tenmangū', lat: 33.5214, lng: 130.5350, emoji: '🌸', tag: 'see', desc: '學問之神；西鐵電車前往，參道梅ヶ枝餅必嚐。', hours: '約 06:30–19:30', fee: '境內免費' },
      { name: '櫛田神社', jp: 'Kushida Shrine', lat: 33.5916, lng: 130.4106, emoji: '⛩️', tag: 'see', desc: '博多總鎮守，祇園山笠的舞台。', hours: '04:00–22:00', fee: '免費' },
      { name: 'Canal City 博多', jp: 'Canal City', lat: 33.5897, lng: 130.4113, emoji: '🛍️', tag: 'shop', desc: '運河造型購物城，每 30 分鐘噴泉秀。', hours: '商店 10:00–21:00' },
      { name: '中洲屋台', jp: 'Nakasu Yatai', lat: 33.5915, lng: 130.4030, emoji: '🍜', tag: 'eat', desc: '河畔路邊攤，豚骨拉麵・串燒・明太子玉子燒。', hours: '約 18:00–01:00' },
      { name: '東長寺 · 福岡大佛', jp: 'Tōchō-ji', lat: 33.5925, lng: 130.4153, emoji: '🛕', tag: 'see', desc: '日本最大木造坐佛；地下鐵祇園站 1 分。', hours: '09:00–17:00', fee: '大佛殿 ¥50' },
    ],
  },
  {
    key: 'shimonoseki', name: '下關 · 馬關', jp: 'Shimonoseki', flag: '🐡',
    color: '#e11d48', lat: 33.9576, lng: 130.9410, station: '下関駅',
    blurb: '馬關條約簽署地、河豚、關門海峽。',
    pois: [
      { name: '下關站', jp: 'Shimonoseki Station', lat: 33.9498, lng: 130.9242, emoji: '🚉', tag: 'hub', desc: 'JR 山陽本線站（非新幹線站）；搭サンデン巴士約 9 分到唐戸／赤間神宮前 ¥220。' },
      { name: '日清講和記念館', jp: 'Treaty Memorial Hall', lat: 33.9578, lng: 130.9452, emoji: '📜', tag: 'see', desc: '★ 馬關條約（下関條約）核心；重現 1895 談判房間、原桌椅文書。免費。', hours: '09:00–17:00（全年無休）', fee: '免費' },
      { name: '春帆樓', jp: 'Shunpanrō', lat: 33.9577, lng: 130.9450, emoji: '🏮', tag: 'see', desc: '1895 馬關條約簽署的料亭；日本第一家河豚牌照店。河豚會席須預約（¥12,000+）。', hours: '午餐 11:00–14:00' },
      { name: '赤間神宮', jp: 'Akama Shrine', lat: 33.9580, lng: 130.9460, emoji: '⛩️', tag: 'see', desc: '朱紅龍宮造水天門，祀安德天皇（壇之浦之戰）。', hours: '約 09:00–17:00', fee: '境內免費' },
      { name: '唐戸市場', jp: 'Karato Market', lat: 33.9535, lng: 130.9450, emoji: '🐡', tag: 'eat', desc: '河豚與壽司市場；週五六日「活きいき馬関街」屋台最熱鬧，平日攤位較少。', hours: '上午營業' },
      { name: '關門海峽 · 火之山', jp: 'Kanmon', lat: 33.9620, lng: 130.9620, emoji: '🌉', tag: 'see', desc: '壇之浦古戰場；可步行海底人道（約 780m）到九州門司側。', hours: '人道 06:00–22:00' },
      { name: '小倉站', jp: 'Kokura Station', lat: 33.8866, lng: 130.8825, emoji: '🚄', tag: 'hub', desc: '山陽新幹線轉乘點；小倉↔下關在來線約 15 分 ¥340。' },
    ],
  },
  {
    key: 'hiroshima', name: '廣島', jp: 'Hiroshima', flag: '🕊️',
    color: '#2563eb', lat: 34.3853, lng: 132.4553, station: '広島駅',
    blurb: '和平公園、原爆圓頂、廣島燒。',
    pois: [
      { name: '広島站', jp: 'Hiroshima Station', lat: 34.3975, lng: 132.4757, emoji: '🚄', tag: 'hub', desc: '山陽新幹線站；和平公園搭廣電 2/6 號線。ekie 伴手禮館。' },
      { name: '平和記念公園', jp: 'Peace Memorial Park', lat: 34.3924, lng: 132.4525, emoji: '🕊️', tag: 'see', desc: '原爆圓頂、慰靈碑、和平之鐘聚集的核心。', hours: '24h', fee: '免費' },
      { name: '原爆圓頂（原爆ドーム）', jp: 'Atomic Bomb Dome', lat: 34.3955, lng: 132.4537, emoji: '🏛️', tag: 'see', desc: 'UNESCO 世界遺產，廣電「原爆ドーム前」站旁。', hours: '外觀 24h', fee: '免費' },
      { name: '平和記念資料館', jp: 'Peace Memorial Museum', lat: 34.3915, lng: 132.4525, emoji: '🕯️', tag: 'see', desc: '六月 7:30–19:00（末入 18:30）；建議線上預約、清晨或傍晚避開人潮。', hours: '07:30–19:00', fee: '¥200' },
      { name: '廣島城', jp: 'Hiroshima Castle', lat: 34.4026, lng: 132.4592, emoji: '🏯', tag: 'see', desc: '鯉城；天守閣 2026/3 起整修閉館，可賞外觀與庭園。', hours: '09:00–17:30', fee: '¥370' },
      { name: '縮景園', jp: 'Shukkeien', lat: 34.4003, lng: 132.4675, emoji: '🌉', tag: 'see', desc: '池泉回遊式名園，距廣島城步行約 10 分。', hours: '09:00–18:00', fee: '¥260' },
      { name: '本通商店街', jp: 'Hondōri', lat: 34.3934, lng: 132.4585, emoji: '🛍️', tag: 'shop', desc: '580m 拱廊商店街，東端為お好み村（25 家廣島燒）。' },
    ],
  },
  {
    key: 'miyajima', name: '宮島', jp: 'Miyajima', flag: '⛩️',
    color: '#0d9488', lat: 34.2960, lng: 132.3199, station: '宮島口',
    blurb: '嚴島神社、海上大鳥居、神鹿。',
    pois: [
      { name: '宮島口', jp: 'Miyajimaguchi', lat: 34.3110, lng: 132.3036, emoji: '⛴️', tag: 'hub', desc: 'JR 山陽本線站；步行 5 分到渡輪口（周遊券含 JR 渡輪）。' },
      { name: '嚴島神社', jp: 'Itsukushima Shrine', lat: 34.2960, lng: 132.3199, emoji: '⛩️', tag: 'see', desc: '世界遺產海上社殿；六月 6:30–18:00。', hours: '06:30–18:00', fee: '¥300（含寶物館 ¥500）' },
      { name: '海上大鳥居', jp: 'Great Torii', lat: 34.2958, lng: 132.3187, emoji: '🌊', tag: 'see', desc: '潮位 >250cm 看「海上浮鳥居」，<100cm 可走到鳥居腳下。出發前查潮汐。' },
      { name: '表參道商店街', jp: 'Omotesandō', lat: 34.2978, lng: 132.3215, emoji: '🍡', tag: 'eat', desc: '穴子飯、烤牡蠣、現烤紅葉饅頭、楓葉霜淇淋。' },
    ],
  },
  {
    key: 'takamatsu', name: '高松 · 四國', jp: 'Takamatsu', flag: '🍜',
    color: '#d97706', lat: 34.3506, lng: 134.0466, station: '高松駅',
    blurb: '瀨戶大橋過海、栗林公園、讚岐烏龍。',
    pois: [
      { name: '高松站', jp: 'Takamatsu Station', lat: 34.3506, lng: 134.0466, emoji: '🚉', tag: 'hub', desc: '岡山搭快速マリンライナー過瀨戶大橋約 55 分（周遊券可用）。' },
      { name: '栗林公園', jp: 'Ritsurin Garden', lat: 34.3296, lng: 134.0440, emoji: '🌿', tag: 'see', desc: '日本特別名勝；75 公頃回遊庭園，六大池與紫雲山借景。', hours: '六月 05:30–19:00', fee: '¥500' },
      { name: '玉藻公園 · 高松城', jp: 'Tamamo Park', lat: 34.3501, lng: 134.0504, emoji: '🏯', tag: 'see', desc: '罕見海水堀海城；緊鄰高松站步行 3 分。', hours: '六月 05:30–19:00', fee: '¥200' },
      { name: '屋島', jp: 'Yashima', lat: 34.3437, lng: 134.1013, emoji: '⛰️', tag: 'see', desc: '293m 台地；屋島寺（八十八所第84番）與 Yashimaru 展望台俯瞰瀨戶內海。', hours: '寺 09:00–17:00' },
    ],
  },
  {
    key: 'okayama', name: '岡山 · 倉敷', jp: 'Okayama / Kurashiki', flag: '🍑',
    color: '#7c3aed', lat: 34.6500, lng: 133.8400, station: '岡山駅',
    blurb: '倉敷美觀地區、後樂園、白桃。',
    pois: [
      { name: '岡山站', jp: 'Okayama Station', lat: 34.6664, lng: 133.9180, emoji: '🚄', tag: 'hub', desc: '山陽新幹線＋四國轉乘樞紐；岡山↔倉敷在來線約 17 分 ¥330。' },
      { name: '倉敷美觀地區', jp: 'Kurashiki Bikan', lat: 34.5950, lng: 133.7716, emoji: '🏘️', tag: 'see', desc: '江戶白壁倉庫＋運河柳樹；可搭川舟遊運河，傍晚瓦斯燈點燈。', hours: '街區 24h', fee: '免費' },
      { name: '大原美術館', jp: 'Ohara Museum', lat: 34.5953, lng: 133.7718, emoji: '🖼️', tag: 'see', desc: '日本首座西洋美術館（1930）；藏 El Greco、莫內、畢卡索。', hours: '09:00–17:00（週一休）', fee: '¥2,000' },
      { name: '岡山後樂園', jp: 'Kōrakuen', lat: 34.6675, lng: 133.9355, emoji: '🌳', tag: 'see', desc: '日本三名園之一；與岡山城隔河相望。', hours: '六月 07:30–18:00', fee: '¥500' },
      { name: '岡山城', jp: 'Okayama Castle', lat: 34.6652, lng: 133.9361, emoji: '🏯', tag: 'see', desc: '黑色「烏城」，2022 整修重開；可與後樂園套票 ¥800。', hours: '09:00–17:30', fee: '¥400' },
      { name: '倉敷站', jp: 'Kurashiki Station', lat: 34.6000, lng: 133.7625, emoji: '🚉', tag: 'hub', desc: '南口步行約 12 分到美觀地區。' },
    ],
  },
  {
    key: 'osaka', name: '大阪', jp: 'Osaka', flag: '🐙',
    color: '#db2777', lat: 34.7025, lng: 135.4959, station: '大阪駅',
    blurb: '大阪城、道頓堀、章魚燒。',
    pois: [
      { name: '大阪站 · 梅田', jp: 'Osaka Station', lat: 34.7025, lng: 135.4959, emoji: '🚉', tag: 'hub', desc: 'JR 環狀線樞紐；新大阪→大阪約 4 分。' },
      { name: '新大阪站', jp: 'Shin-Osaka', lat: 34.7335, lng: 135.5003, emoji: '🚄', tag: 'hub', desc: '山陽新幹線抵達站；轉在來線約 4 分到大阪站。' },
      { name: '大阪城', jp: 'Osaka Castle', lat: 34.6873, lng: 135.5259, emoji: '🏯', tag: 'see', desc: 'JR 大阪城公園站步行約 15 分；建議線上購票避排隊。', hours: '09:00–17:00（末入 16:30）', fee: '¥1,200' },
      { name: '道頓堀 · 難波', jp: 'Dotonbori', lat: 34.6687, lng: 135.5013, emoji: '🌃', tag: 'eat', desc: 'Glico 看板、心齋橋商店街；章魚燒・大阪燒・串炸。', hours: '24h（夜晚最熱鬧）' },
      { name: '梅田空中庭園', jp: 'Umeda Sky', lat: 34.7053, lng: 135.4903, emoji: '🌆', tag: 'see', desc: '173m 屋頂環形展望台，夜景絕佳。', hours: '09:30–22:30', fee: '¥2,000' },
      { name: '通天閣 · 新世界', jp: 'Tsutenkaku', lat: 34.6525, lng: 135.5063, emoji: '🗼', tag: 'see', desc: '昭和懷舊街；串炸發源地（醬汁不可二次沾）。', hours: '10:00–20:00', fee: '展望 ¥1,200' },
      { name: '環球影城 USJ', jp: 'Universal Studios', lat: 34.6654, lng: 135.4323, emoji: '🎢', tag: 'see', desc: 'JR 環狀線→西九条轉ゆめ咲線到ユニバーサルシティ；票價依日期 ¥8,600+。', hours: '依官方日曆' },
      { name: '關西國際機場', jp: 'Kansai Airport (KIX)', lat: 34.4339, lng: 135.2440, emoji: '✈️', tag: 'hub', desc: '離開點；関空快速約 50–70 分 / はるか特急（周遊券含指定席）。' },
    ],
  },
  {
    key: 'kyoto', name: '京都', jp: 'Kyoto', flag: '🍵',
    color: '#b91c1c', lat: 34.9858, lng: 135.7588, station: '京都駅',
    blurb: '伏見稻荷、嵐山、清水寺。',
    pois: [
      { name: '京都站', jp: 'Kyoto Station', lat: 34.9858, lng: 135.7588, emoji: '🚉', tag: 'hub', desc: '大阪→京都新快速約 28 分 ¥580（周遊券在來線可用）。' },
      { name: '伏見稻荷大社', jp: 'Fushimi Inari', lat: 34.9671, lng: 135.7727, emoji: '⛩️', tag: 'see', desc: '千本鳥居；JR 奈良線「稻荷駅」站前，免費 24h，建議清晨。', hours: '24h', fee: '免費' },
      { name: '嵐山 · 竹林', jp: 'Arashiyama', lat: 35.0170, lng: 135.6716, emoji: '🎋', tag: 'see', desc: 'JR 嵯峨嵐山駅；竹林、天龍寺、渡月橋。', hours: '竹林 24h', fee: '天龍寺 ¥500' },
      { name: '渡月橋', jp: 'Togetsukyo', lat: 35.0130, lng: 135.6776, emoji: '🌉', tag: 'see', desc: '桂川上的嵐山地標。', hours: '24h', fee: '免費' },
      { name: '清水寺', jp: 'Kiyomizu-dera', lat: 34.9949, lng: 135.7850, emoji: '🛕', tag: 'see', desc: '京都站搭市巴士 206/100 到五条坂步行；清水舞台。', hours: '06:00–18:00', fee: '¥500' },
      { name: '祇園 · 八坂神社', jp: 'Gion', lat: 35.0036, lng: 135.7785, emoji: '🏮', tag: 'see', desc: '花見小路藝伎街；可由清水寺經二三年坂步行下來。', hours: '24h', fee: '免費' },
      { name: '金閣寺', jp: 'Kinkaku-ji', lat: 35.0394, lng: 135.7292, emoji: '🏯', tag: 'see', desc: '金箔舍利殿；市巴士 205 約 40 分（西北郊，較難與東山同日）。', hours: '09:00–17:00', fee: '¥500' },
    ],
  },
  {
    key: 'nara', name: '奈良', jp: 'Nara', flag: '🦌',
    color: '#65a30d', lat: 34.6851, lng: 135.8430, station: 'JR奈良駅',
    blurb: '東大寺大佛、奈良公園神鹿。',
    pois: [
      { name: 'JR 奈良站', jp: 'JR Nara Station', lat: 34.6831, lng: 135.8190, emoji: '🚉', tag: 'hub', desc: '大阪→奈良大和路快速約 50 分；京都→奈良みやこ路快速約 45 分。' },
      { name: '東大寺', jp: 'Tōdai-ji', lat: 34.6889, lng: 135.8398, emoji: '🛕', tag: 'see', desc: '世界最大級木造大佛殿與奈良大佛。', hours: '07:30–17:30', fee: '¥800' },
      { name: '奈良公園 · 神鹿', jp: 'Nara Park', lat: 34.6851, lng: 135.8430, emoji: '🦌', tag: 'see', desc: '上千頭放養鹿；鹿仙貝 ¥200。', hours: '24h', fee: '免費' },
      { name: '春日大社', jp: 'Kasuga Taisha', lat: 34.6815, lng: 135.8483, emoji: '⛩️', tag: 'see', desc: '朱紅社殿與千盞石燈籠參道。', hours: '06:30–17:30', fee: '本殿特別參拜 ¥500' },
      { name: '興福寺', jp: 'Kōfuku-ji', lat: 34.6822, lng: 135.8316, emoji: '🗼', tag: 'see', desc: '五重塔地標（修復中至 2020 年代後期，請現場確認）。', hours: '09:00–17:00' },
    ],
  },
];

export const cityByKey = Object.fromEntries(CITIES.map(c => [c.key, c]));

// ---- Inter-city JR journeys (路線 tab「所有班次」) ----------------------------
export const ROUTES = [
  {
    id: 'r-kmj-hkt', from: '熊本', to: '博多', fromStn: '熊本駅', toStn: '博多駅',
    line: '九州新幹線', icon: 'i-train', color: '#16a34a',
    summary: 'さくら／みずほ 約 35–40 分', fare: '¥5,310（自由席）',
    pass: '⚠️ 周遊券「不含」此段，另購',
    legs: [
      { dep: '08:30', arr: '09:10', line: '九州新幹線 さくら', type: 'shinkansen', dur: '約 40 分', note: '此段為 JR 九州，Setouchi 周遊券不含，請於熊本站另購（自由席 ¥5,310）。みずほ約 35 分。' },
    ],
    tip: '抵達博多後再啟用 Setouchi 周遊券，之後一路向東到關西全部含於券內。',
  },
  {
    id: 'r-hkt-smk', from: '博多', to: '下關（馬關）', fromStn: '博多駅', toStn: '下関駅',
    line: '山陽新幹線 + 在來線', icon: 'i-route', color: '#e11d48',
    summary: '新幹線到小倉約 16 分 + 在來線到下關約 15 分', fare: '周遊券可用',
    pass: 'Setouchi 周遊券可用（含のぞみ・みずほ）',
    legs: [
      { dep: '09:00', arr: '09:16', line: '山陽新幹線 のぞみ／さくら', type: 'shinkansen', dur: '約 16 分', note: '博多→小倉；下關治在來線。' },
      { dep: '09:30', arr: '09:45', line: 'JR 山陽本線（小倉→下関，多在門司轉乘）', type: 'local', dur: '約 15 分', note: '¥340；班次頻繁。下關站轉サンデン巴士到唐戸約 9 分 ¥220。' },
    ],
    tip: '馬關條約景點集中在唐戸；到「下関駅」再轉巴士，勿到「新下関」。',
  },
  {
    id: 'r-smk-hir', from: '下關', to: '廣島', fromStn: '下関駅', toStn: '広島駅',
    line: '在來線 + 山陽新幹線', icon: 'i-route', color: '#2563eb',
    summary: '在來到小倉約 15 分 + 新幹線到廣島約 50 分', fare: '周遊券可用',
    pass: 'Setouchi 周遊券可用',
    legs: [
      { dep: '15:30', arr: '15:45', line: 'JR 山陽本線（下関→小倉）', type: 'local', dur: '約 15 分', note: '¥340。' },
      { dep: '16:00', arr: '16:50', line: '山陽新幹線 のぞみ／さくら', type: 'shinkansen', dur: '約 50 分', note: '小倉→廣島；のぞみ約 48 分。' },
    ],
    tip: '小倉↔廣島每小時多班，回程彈性大。',
  },
  {
    id: 'r-hir-miy', from: '廣島', to: '宮島', fromStn: '広島駅', toStn: '宮島口駅',
    line: 'JR 山陽本線 + JR 宮島渡輪', icon: 'i-route', color: '#0d9488',
    summary: '山陽本線約 27 分 + 渡輪約 10 分', fare: '周遊券可用 + 宮島訪問稅 ¥100',
    pass: 'Setouchi 周遊券含 JR 渡輪；另付 ¥100 訪問稅',
    legs: [
      { dep: '08:35', arr: '09:02', line: 'JR 山陽本線（往岩国）', type: 'local', dur: '約 27 分', note: '每小時 3–4 班，至宮島口站。' },
      { dep: '09:10', arr: '09:20', line: 'JR 宮島渡輪', type: 'ferry', dur: '約 10 分', note: '09:10–16:10 的 JR 船班會繞近大鳥居拍照。請搭 JR 船（非松大）。' },
    ],
    tip: '查潮汐：高潮看海上浮鳥居，低潮可走到鳥居腳。',
  },
  {
    id: 'r-hir-oka', from: '廣島', to: '岡山', fromStn: '広島駅', toStn: '岡山駅',
    line: '山陽新幹線', icon: 'i-train', color: '#7c3aed',
    summary: 'のぞみ／さくら 約 35–40 分', fare: '周遊券可用',
    pass: 'Setouchi 周遊券可用（含のぞみ・みずほ）',
    legs: [
      { dep: '08:30', arr: '09:08', line: '山陽新幹線 のぞみ／さくら', type: 'shinkansen', dur: '約 38 分', note: '班次密集，數班/小時。' },
    ],
    tip: '岡山是前往四國（高松）與關西的樞紐。',
  },
  {
    id: 'r-oka-tak', from: '岡山', to: '高松（四國）', fromStn: '岡山駅', toStn: '高松駅',
    line: '快速マリンライナー（瀨戶大橋）', icon: 'i-route', color: '#d97706',
    summary: '快速マリンライナー 約 55 分', fare: '¥1,660（周遊券可用）',
    pass: 'Setouchi 周遊券可用（含瀨戶大橋線）',
    legs: [
      { dep: '08:40', arr: '09:35', line: '快速マリンライナー', type: 'rapid', dur: '約 55 分', note: '每 30 分一班；1 號車為雙層，上層綠色車廂可預約看瀨戶大橋海景（周遊券可免費劃位）。' },
    ],
    tip: '搭 1 號車上層看跨海大橋是亮點；當日往返岡山，鐵路全程周遊券免費。',
  },
  {
    id: 'r-oka-osk', from: '岡山', to: '大阪', fromStn: '岡山駅', toStn: '新大阪駅',
    line: '山陽新幹線', icon: 'i-train', color: '#db2777',
    summary: 'のぞみ／さくら 約 45–50 分', fare: '周遊券可用',
    pass: 'Setouchi 周遊券可用（含のぞみ・みずほ）',
    legs: [
      { dep: '16:00', arr: '16:50', line: '山陽新幹線 のぞみ／さくら', type: 'shinkansen', dur: '約 45 分', note: '到新大阪，轉在來線約 4 分到大阪站。' },
    ],
    tip: '注意：新大阪↔京都的東海道新幹線「不含」於券；京都改搭在來線新快速。',
  },
  {
    id: 'r-osk-kyo', from: '大阪', to: '京都', fromStn: '大阪駅', toStn: '京都駅',
    line: 'JR 京都線 新快速', icon: 'i-route', color: '#b91c1c',
    summary: '新快速 約 28 分', fare: '¥580（周遊券在來線可用）',
    pass: 'Setouchi 周遊券可用（在來線新快速）',
    legs: [
      { dep: '08:00', arr: '08:28', line: 'JR 京都線 新快速', type: 'rapid', dur: '約 28 分', note: '每 15 分一班；只停新大阪・高槻。京都市內伏見稻荷搭 JR 奈良線稻荷駅、嵐山搭 JR 嵯峨野線嵯峨嵐山駅。' },
    ],
    tip: '清水寺・金閣寺・祇園無 JR 站，需轉市巴士 ¥230（可買京都巴士一日券 ¥600）。',
  },
  {
    id: 'r-kyo-nar', from: '京都 / 大阪', to: '奈良', fromStn: '京都駅', toStn: 'JR奈良駅',
    line: 'JR 奈良線 / 大和路線 快速', icon: 'i-route', color: '#65a30d',
    summary: 'みやこ路快速 約 45 分（京都）／大和路快速 約 50 分（大阪）', fare: '¥720 / ¥820（周遊券在來線可用）',
    pass: 'Setouchi 周遊券可用（請持 JR；近鐵不可）',
    legs: [
      { dep: '08:30', arr: '09:15', line: 'JR 奈良線 みやこ路快速（京都→奈良）', type: 'rapid', dur: '約 45 分', note: '每 30 分一班。' },
      { dep: '—', arr: '—', line: '（替代）JR 大和路快速（大阪→奈良）', type: 'rapid', dur: '約 50 分', note: '經環狀線，每 15 分一班 ¥820。' },
    ],
    tip: 'JR 奈良站步行至公園約 20 分，或搭奈良交通巴士 ¥250；近鐵奈良站較近但不含於周遊券。',
  },
  {
    id: 'r-osk-kix', from: '大阪 / 奈良', to: '關西機場（KIX）', fromStn: '天王寺駅', toStn: '関西空港駅',
    line: '関空快速 / はるか特急', icon: 'i-route', color: '#4f46e5',
    summary: '関空快速 天王寺約 50 分 / 大阪約 70 分；はるか更快', fare: '周遊券可用（含はるか指定席）',
    pass: 'Setouchi 周遊券可用（含 KIX 與はるか指定席）',
    legs: [
      { dep: '—', arr: '—', line: 'JR 大和路快速（奈良→天王寺）', type: 'rapid', dur: '約 35 分', note: '若由奈良出發，先到天王寺轉乘。' },
      { dep: '—', arr: '—', line: 'JR 関空快速（天王寺→関西空港）', type: 'rapid', dur: '約 50 分', note: '⚠️ 列車在「日根野」分割，請坐「前 4 節車廂」往關空（後段往和歌山）。' },
      { dep: '—', arr: '—', line: '（更快）特急はるか', type: 'ltdexp', dur: '天王寺約 30 分 / 京都約 75 分', note: '周遊券含指定席，雨季尖峰建議劃位。' },
    ],
    tip: '國際線建議起飛前 2.5–3 小時到機場；由奈良出發抓 ~4 小時、由大阪/京都 ~3.5 小時較保險。',
  },
];

// ---- JR Pass recommendation -------------------------------------------------
export const PASS = {
  best: 'JR West 瀨戶內地區鐵路周遊券',
  bestEn: 'Setouchi Area Pass',
  price: '¥22,000',
  days: '連續 7 日',
  why: '唯一一張橫跨「博多 ⇄ 廣島 ⇄ 岡山 ⇄ 四國高松 ⇄ 大阪 ⇄ 京都 ⇄ 奈良 ⇄ 關西機場」、且含のぞみ・みずほ指定席的周遊券；正好對應你由西往東的單程路線。',
  highlights: [
    '✅ 含のぞみ・みずほ（山陽新幹線 新大阪⇄博多）',
    '✅ 含 四國高松（岡山↔高松 快速マリンライナー）',
    '✅ 含 關西在來線（大阪⇄京都⇄奈良）＋ 關西機場（含はるか指定席）',
    '✅ 含 JR 宮島渡輪',
    '⚠️ 不含 熊本→博多 九州新幹線（約 ¥5,310 另購）與京都⇄新大阪的東海道新幹線',
    '🎫 連續 7 日 — 建議 6/19（博多→下關日）啟用，涵蓋到 6/24 關西出發',
  ],
  buy: '官方 JR West 線上預約（WESTER）或 Klook／JTB 等代理；持護照於關西機場／新大阪／岡山／廣島／博多等大站兌換實體券。座位於綠色售票機或綠色窗口免費劃位（含はるか指定席）。',
  compare: [
    { name: 'Setouchi（推薦）', price: '¥22,000', days: '7', nozomi: '✅', hiroshima: '✅', shimonoseki: '✅', kumamoto: '❌另購', verdict: '★ 最佳' },
    { name: '山陽山陰北九州', price: '¥26,000', days: '7', nozomi: '✅', hiroshima: '✅', shimonoseki: '✅', kumamoto: '✅', verdict: '缺關西/四國' },
    { name: '山陽・山陰', price: '約 ¥23,000', days: '7', nozomi: '✅', hiroshima: '✅', shimonoseki: '✅', kumamoto: '❌', verdict: '缺關西/四國' },
    { name: 'All Shikoku', price: '¥12,000–20,000', days: '3–7', nozomi: '—', hiroshima: '❌', shimonoseki: '❌', kumamoto: '❌', verdict: '只四國' },
    { name: '全國 JR Pass', price: '¥50,000', days: '7', nozomi: '⚠️加價', hiroshima: '✅', shimonoseki: '✅', kumamoto: '✅', verdict: '太貴' },
  ],
};

// ---- Souvenirs (伴手禮) by city ---------------------------------------------
export const SOUVENIRS = {
  kumamoto: [
    { name: '誉の陣太鼓', emoji: '🥁', desc: '香梅出品；求肥包大納言紅豆，太鼓造型罐附切線。', where: '熊本站 肥後よかモン市場', price: '8 入 ¥1,728' },
    { name: '武者がえし', emoji: '🏯', desc: '薄餅皮包羊羹，熊本城石垣主題。', where: '香梅各店', price: '¥1,300–1,700' },
    { name: 'いきなり団子', emoji: '🍠', desc: '地瓜＋紅豆蒸點心，當地日常零食（賞味期短）。', where: '肥後よかモン市場', price: '¥130–180/個' },
    { name: '辛子蓮根', emoji: '🪷', desc: '蓮藕塞芥末味噌油炸；有真空包裝版便於攜帶。', where: 'よかモン市場／百貨食品館', price: '¥1,000–1,500' },
    { name: 'くまモン周邊', emoji: '🐻', desc: '吉祥物零食、玩偶、文具，送禮討喜。', where: 'くまモンスクエア／站內', price: '¥300–2,000' },
  ],
  fukuoka: [
    { name: '博多通りもん', emoji: '🥮', desc: '奶香白豆沙西式饅頭，Monde Selection 金賞。', where: '博多站 マイング／デイトス', price: '6 入 ¥1,000' },
    { name: '辛子明太子', emoji: '🌶️', desc: '福岡代表；ふくや 創始。需冷藏，盡量晚買。', where: 'デイトス ふくや', price: '禮盒 ¥1,500–3,000' },
    { name: '博多ひよ子', emoji: '🐤', desc: '小雞造型黃豆沙蛋糕。', where: 'マイング／デイトス', price: '¥1,000–1,300' },
    { name: '二〇加煎餅', emoji: '🎭', desc: '博多仁和加面具造型雞蛋煎餅，附紙面具。', where: '東雲堂／站內', price: '16 入 ¥540–760' },
    { name: '豚骨拉麵組合', emoji: '🍜', desc: '一蘭／一風堂／マルタイ 帶回家的博多拉麵。', where: 'マイング／超市', price: '¥400–1,000' },
  ],
  hiroshima: [
    { name: '生もみじ', emoji: '🍁', desc: 'にしき堂濕潤求肥版紅葉饅頭，「廣島品牌」首選。', where: '広島站 ekie おみやげ館', price: '10 入 ¥1,400' },
    { name: 'もみじ饅頭', emoji: '🍁', desc: '經典楓葉castella，にしき堂現場烘烤。', where: 'ekie / おみやげ街道', price: '10 入 ¥1,000–1,400' },
    { name: '檸檬蛋糕', emoji: '🍋', desc: '瀨戶田檸檬海綿蛋糕（島ごころ／Mozart）。', where: 'ekie おみやげ館', price: '5 入 ¥1,250' },
    { name: 'お好み焼きソース', emoji: '🥫', desc: 'Otafuku 濃厚醬，廣島燒的靈魂味道。', where: 'ekie／超市', price: '¥300–500' },
    { name: '牡蠣加工品', emoji: '🦪', desc: '燻牡蠣／油漬牡蠣，常溫好攜帶。', where: 'ekie 瀨戶內海鮮區', price: '¥600–1,500' },
  ],
  shimonoseki: [
    { name: 'ふぐ刺し', emoji: '🐡', desc: '下關代表；冷藏／冷凍盤裝禮盒，需保冷。', where: '唐戸市場／站旁百貨 B1', price: '¥2,000–5,000' },
    { name: 'ふぐ煎餅', emoji: '🍘', desc: '河豚仙貝，輕巧常溫適合帶回。', where: '唐戸市場／站內', price: '¥500–1,000' },
    { name: 'ふぐ加工品', emoji: '🍶', desc: 'ふくのひれ酒（鰭酒）、河豚茶泡飯等。', where: '唐戸市場（ふくの里）', price: '¥500–2,000' },
  ],
  takamatsu: [
    { name: '讚岐烏龍（乾麵/半生）', emoji: '🍜', desc: '香川名物；乾麵或半生禮盒，帶回家自煮。', where: '高松站 ハレノヒヤ／四国ショップ88', price: '¥500–1,500' },
    { name: 'おいり', emoji: '🎀', desc: '彩色米菓婚禮喜糖，輕巧可愛。', where: '高松站 キヨスク 銘品館', price: '¥400–700' },
    { name: '灸まん', emoji: '🍡', desc: '金平糖蛋黃餡饅頭，金刀比羅名物。', where: '高松站賣店／四国ショップ88', price: '6 入 ¥648' },
  ],
  okayama: [
    { name: 'きびだんご（廣榮堂）', emoji: '🍡', desc: '桃太郎黍團子（1856 創業），軟Q求肥，岡山第一伴手。', where: '岡山站 さんすて／高島屋', price: '15 入 ¥700' },
    { name: '白桃 / 麝香葡萄菓子', emoji: '🍑', desc: '岡山名產水果做的果凍與糕點。', where: '岡山站 駅ナカ／倉敷美觀', price: '¥370–1,500' },
  ],
  osaka: [
    { name: '551蓬萊 豚まん（冷藏）', emoji: '🥟', desc: '大阪代表豬肉包；冷藏盒回家蒸熱，需保冷。', where: '新大阪站 エキマルシェ／梅田百貨', price: '10 個 ¥2,100' },
    { name: '點天 ひとくち餃子', emoji: '🥢', desc: '北新地一口生煎餃，回家自煎。', where: 'エキマルシェ新大阪／阪神 B1', price: '30 個 ¥1,180' },
    { name: 'りくろーおじさん 起司蛋糕', emoji: '🧀', desc: '會晃動的現烤輕乳酪蛋糕。', where: '新大阪站／難波本店', price: '整顆 ¥965' },
    { name: '面白い恋人', emoji: '😆', desc: '吉本搞笑版「白色戀人」，趣味伴手。', where: '新大阪站／大阪站', price: '6 枚 ¥594' },
    { name: '章魚燒風味零食', emoji: '🐙', desc: 'じゃがりこ等地區限定口味，分送好用。', where: '新大阪站 アントレマルシェ', price: '¥300–700' },
  ],
  kyoto: [
    { name: '生八ッ橋 / おたべ', emoji: '🎴', desc: '肉桂麻糬包紅豆，京都經典；抹茶／季節口味。', where: '京都站 京のみやげ店／ザ・キューブ', price: '10 入 ¥600' },
    { name: '阿闍梨餅（滿月）', emoji: '🌕', desc: '半月形丹波紅豆餡餅，Q彈；傍晚常售罄。', where: '京都站 新幹線コンコース／伊勢丹', price: '1 個 ¥141' },
    { name: '抹茶菓子（中村藤吉／伊藤久右衛門）', emoji: '🍵', desc: '宇治老舖；生茶凍、抹茶餅乾與蕨餅。', where: '京都站 伊勢丹 B1', price: '¥400–1,500' },
    { name: 'よーじや 吸油面紙', emoji: '💄', desc: '藝伎招牌吸油面紙，輕巧不怕壓。', where: '京都站八条口 よーじや', price: '抹茶版 3 冊 ¥1,500' },
  ],
  nara: [
    { name: '鹿サブレ', emoji: '🦌', desc: '鹿與大佛造型可可奶油酥餅，奈良招牌。', where: 'JR/近鐵奈良站賣店', price: '15 入 禮盒' },
    { name: '鹿造型和菓子', emoji: '🍡', desc: '鹿最中・味噌煎餅等經典分送點心。', where: '東向商店街／まほろば館', price: '¥150–1,200' },
    { name: '柿の葉壽司（現吃）', emoji: '🍣', desc: '柿葉包鯖／鮭壽司，車上享用的名物（約 3 日賞味）。', where: '平宗／たなか（奈良站）', price: '¥882–1,200' },
  ],
};

// ---- In-trip essentials (錦囊) ----------------------------------------------
export const PHRASES = [
  { cat: '基本禮貌', emoji: '🙏', items: [
    { zh: '你好', jp: 'こんにちは', ro: 'konnichiwa' },
    { zh: '謝謝', jp: 'ありがとうございます', ro: 'arigatō gozaimasu' },
    { zh: '不好意思／打擾了', jp: 'すみません', ro: 'sumimasen' },
    { zh: '對不起', jp: 'ごめんなさい', ro: 'gomen nasai' },
    { zh: '我聽不懂', jp: 'わかりません', ro: 'wakarimasen' },
    { zh: '請說慢一點', jp: 'ゆっくり話してください', ro: 'yukkuri hanashite kudasai' },
    { zh: '會說英文嗎？', jp: '英語は話せますか？', ro: 'eigo wa hanasemasu ka' },
    { zh: '麻煩你了', jp: 'お願いします', ro: 'onegai shimasu' },
  ] },
  { cat: '交通・車站', emoji: '🚆', items: [
    { zh: '請問XX在哪裡？', jp: 'XXはどこですか？', ro: 'XX wa doko desu ka' },
    { zh: '這班車有到廣島嗎？', jp: 'この電車は広島に行きますか？', ro: 'kono densha wa Hiroshima ni ikimasu ka' },
    { zh: '我要自由席', jp: '自由席をお願いします', ro: 'jiyūseki o onegai shimasu' },
    { zh: '我有周遊券，要劃位', jp: 'パスがあります、座席指定をお願いします', ro: 'pasu ga arimasu, zaseki shitei o onegai shimasu' },
    { zh: 'X號月台在哪？', jp: 'X番線はどこですか？', ro: 'X-bansen wa doko desu ka' },
    { zh: '在哪裡轉乘？', jp: '乗り換えはどこですか？', ro: 'norikae wa doko desu ka' },
    { zh: '下一班幾點？', jp: '次は何時ですか？', ro: 'tsugi wa nanji desu ka' },
  ] },
  { cat: '餐廳・點餐', emoji: '🍽️', items: [
    { zh: '兩位', jp: '二人です', ro: 'futari desu' },
    { zh: '請給我菜單', jp: 'メニューをください', ro: 'menyū o kudasai' },
    { zh: '推薦是什麼？', jp: 'おすすめは何ですか？', ro: 'osusume wa nan desu ka' },
    { zh: '請給我這個', jp: 'これをください', ro: 'kore o kudasai' },
    { zh: '不要芥末', jp: 'わさび抜きで', ro: 'wasabi nuki de' },
    { zh: '我要結帳', jp: 'お会計お願いします', ro: 'okaikei onegai shimasu' },
    { zh: '很好吃！', jp: 'おいしいです！', ro: 'oishii desu' },
  ] },
  { cat: '購物・退稅', emoji: '🛍️', items: [
    { zh: '多少錢？', jp: 'いくらですか？', ro: 'ikura desu ka' },
    { zh: '可以刷卡嗎？', jp: 'カードで払えますか？', ro: 'kādo de haraemasu ka' },
    { zh: '可以免稅嗎？', jp: '免税できますか？', ro: 'menzei dekimasu ka' },
    { zh: '請幫我包裝', jp: '包んでください', ro: 'tsutsunde kudasai' },
    { zh: '我只是看看', jp: '見ているだけです', ro: 'mite iru dake desu' },
  ] },
  { cat: '問路・飯店', emoji: '🏨', items: [
    { zh: '我想去XX', jp: 'XXに行きたいです', ro: 'XX ni ikitai desu' },
    { zh: '廁所在哪？', jp: 'トイレはどこですか？', ro: 'toire wa doko desu ka' },
    { zh: '可以寄放行李嗎？', jp: '荷物を預けられますか？', ro: 'nimotsu o azukeraremasu ka' },
    { zh: '我要 check in', jp: 'チェックインお願いします', ro: 'chekku-in onegai shimasu' },
    { zh: '有空房嗎？', jp: '空いている部屋はありますか？', ro: 'aite iru heya wa arimasu ka' },
  ] },
  { cat: '緊急・身體不適', emoji: '🆘', items: [
    { zh: '請幫幫我！', jp: '助けてください！', ro: 'tasukete kudasai' },
    { zh: '我身體不舒服', jp: '気分が悪いです', ro: 'kibun ga warui desu' },
    { zh: '我頭痛', jp: '頭が痛いです', ro: 'atama ga itai desu' },
    { zh: '我肚子痛', jp: 'お腹が痛いです', ro: 'onaka ga itai desu' },
    { zh: '最近的醫院在哪？', jp: '一番近い病院はどこですか？', ro: 'ichiban chikai byōin wa doko desu ka' },
    { zh: '請叫救護車', jp: '救急車を呼んでください', ro: 'kyūkyūsha o yonde kudasai' },
  ] },
];

export const EMERGENCY = {
  numbers: [
    { label: '警察（事件・事故・遺失）', num: '110', emoji: '🚓' },
    { label: '火災・救護車', num: '119', emoji: '🚑' },
    { label: '海上事故', num: '118', emoji: '🌊' },
    { label: 'JNTO 訪日旅客諮詢熱線（24h・中文）', num: '050-3816-2787', emoji: '📞' },
  ],
  taiwanLine: { label: '外交部旅外國人急難救助', intl: '+886-800-085-095', note: '台灣境內直撥 0800-085-095；海外免付費 800-0885-0885（在日本撥 001 再撥 010-800-0885-0885）。僅限車禍／搶劫／生命安危／護照遺失等急難。' },
  offices: [
    { name: '台北駐大阪經濟文化辦事處', area: '轄 廣島・宮島・高松・岡山・大阪・京都・奈良・KIX', tel: '06-6227-8623', emg: '090-8794-4568', addr: '大阪市北区中之島2-3-18 中之島フェスティバルタワー 17F', url: 'https://www.roc-taiwan.org/jposa/' },
    { name: '台北駐大阪經濟文化辦事處 福岡分處', area: '轄 熊本・福岡・下關（山口）等九州', tel: '092-734-2810', emg: '090-1922-9740', addr: '福岡市中央区桜坂3-12-42', url: 'https://www.roc-taiwan.org/jpfuk/' },
  ],
  steps: [
    '護照遺失：先到最近的警察局（交番）報案，取得「遺失證明」。',
    '再聯絡上方台灣駐處（依所在地選大阪或福岡分處），辦理入國證明書或臨時護照。',
    'JR Pass 遺失通常無法補發，請妥善保管；信用卡遺失立即打發卡行止付。',
    '地震時：護頭、遠離窗戶玻璃，依 NHK / Safety tips App 指示避難。',
  ],
};

export const PACKING = [
  '護照 + 影本/電子檔', '回程機票/登機證', 'JR Setouchi 周遊券兌換券', '日幣現金 + 信用卡',
  'ICOCA / Suica 卡', '手機 + 充電器 + 行動電源', 'eSIM / 口袋 WiFi', '萬用轉接頭（日本 A 型）',
  '摺疊傘 / 輕便雨衣（梅雨季）', '防水好走的鞋', '常備藥 + 個人藥品', '保溫瓶',
  '保冷袋（買明太子/河豚用）', '購物環保袋', '健保卡/旅平險資料', '盥洗用品',
];

export const CURRENCY = { rate: 0.213, note: '約略匯率（1 日圓 ≈ 0.21 台幣），請依當日銀行匯率為準；可在設定調整。' };

export const TIPS = {
  taxfree: [
    '消費稅 10%；同店同日「一般物品」或「消耗品」各滿 ¥5,000（未稅）可辦免稅。',
    '結帳時在 Tax-Free 櫃台出示護照辦理；消耗品會密封包裝，離境前請勿拆封。',
    '藥妝（唐吉訶德/松本清）、百貨、電器行多可直接店內免稅。',
    '消耗品上限 ¥50 萬；「離境機場退稅」新制 2026/11 才上路，本趟 6 月仍用現行店內免稅。',
  ],
  iccard: [
    'ICOCA / Suica 可搭 JR、地下鐵、私鐵、巴士、市電，也能在便利商店、置物櫃付款。',
    '周遊券沒涵蓋的段落（熊本→博多九州新幹線、市電、廣電、近鐵、巴士）改用 IC 卡或現金。',
    '用周遊券劃位：綠色售票機或綠色窗口（みどりの窓口）免費；マリンライナー上層、はるか指定席都可預約。',
    '新幹線「自由席」免劃位直接坐；尖峰建議先劃「指定席」。',
  ],
  connectivity: [
    '上網：抵達熊本機場/關西機場可取 eSIM 或租口袋 WiFi；eSIM 最方便（出發前先買）。',
    '領現金：7-11 Seven Bank、郵局 JP Post ATM 可用海外卡提領日幣。',
    '行李：車站投幣置物櫃（小 ¥400 起）；或用宅急便把行李送到下個飯店/機場（手ぶら観光）。',
  ],
  etiquette: [
    '不用給小費；電車內保持安靜、勿講電話，背包請前背。',
    '關西手扶梯「靠右站、左側通行」（與東京相反）。',
    '垃圾桶少，隨身帶垃圾袋；確實做好分類。',
    '神社參拜：鳥居前一鞠躬，手水舍洗手，二拜二拍手一拜。',
    '梅雨季悶熱多雨：穿防水鞋、隨身帶傘，多排室內景點備案。',
  ],
};

// ---- Miyajima tide table (大鳥居) — 2026/06, verify live before going --------
export const TIDE = {
  floatCm: 250, walkCm: 100,
  note: '潮位 >250cm 可看「海上浮鳥居」；<100cm 可走到鳥居腳下。出發前請以即時潮汐表再確認。',
  days: {
    '2026-06-17': { high: [['09:29', 327], ['22:25', 381]], low: [['03:44', 94], ['15:52', -15]] },
    '2026-06-18': { high: [['10:10', 322], ['23:13', 376]], low: [['04:28', 104], ['16:35', -17]] },
    '2026-06-19': { high: [['10:52', 314]], low: [['05:13', 116], ['17:20', -9]] },
    '2026-06-20': { high: [['11:37', 302], ['24:01', 365]], low: [['06:01', 129], ['18:07', 10]] },
    '2026-06-21': { high: [['12:27', 287]], low: [['06:54', 140], ['18:59', 35]] },
    '2026-06-22': { high: [['13:26', 270]], low: [['07:54', 147], ['19:57', 64]] },
    '2026-06-23': { high: [['14:39', 256]], low: [['09:02', 147], ['21:04', 92]] },
    '2026-06-24': { high: [['16:08', 253]], low: [['10:16', 138], ['22:19', 114]] },
  },
};

// ---- Budget defaults --------------------------------------------------------
export const BUDGET = {
  fixed: [
    { label: 'JR Setouchi 周遊券', amount: 22000 },
    { label: '熊本→博多 九州新幹線', amount: 5310 },
    { label: '機場巴士 + IC 卡儲值（估）', amount: 6000 },
  ],
  mealsPerDay: 4000,
  hotelPerNight: 9000,
  nights: 7,
  catLabels: { food: '🍽️ 餐食', transit: '🚆 交通', shop: '🛍️ 購物', sight: '🎫 門票', hotel: '🏨 住宿', other: '📦 其他' },
};
export function admissionTotal() {
  let sum = 0;
  for (const d of DAYS) for (const it of d.items) {
    if (!it.cost) continue;
    const m = String(it.cost).replace(/,/g, '').match(/¥\s?(\d+)/);
    if (m) sum += parseInt(m[1], 10);
  }
  return sum;
}

// ---- 8-day itinerary --------------------------------------------------------
const D = (date, dow, cityKey, weatherKey, title, summary, items) =>
  ({ date, dow, cityKey, weatherKey, title, summary, items });

export const DAYS = [
  D('2026-06-17', '三', 'kumamoto', 'kumamoto', '抵達熊本 · 熊本城', '桃園 06:00 早班機約 9 點抵熊本，巴士進城；熊本城、城彩苑午餐、くまモン、水前寺，一整天玩好玩滿。', [
    { time: '09:00', type: 'arrive', title: '抵達熊本機場（KMJ）', jp: 'Kumamoto Airport', lat: 32.8372, lng: 130.8553, desc: '桃園 06:00 早班機，約 09:00 抵阿蘇熊本空港；入境、領行李。' },
    { time: '09:45', type: 'move', title: '機場巴士 → 桜町巴士總站', desc: 'リムジンバス直達市區（近熊本城），雨季帶行李最方便。', route: { fromStn: '阿蘇くまもと空港', toStn: '桜町バスターミナル', legs: [{ dep: '09:45', arr: '10:35', line: '產交リムジンバス', type: 'bus', dur: '約 50 分', note: '¥1,200；班次密集。或搭免費空港ライナー到肥後大津轉 JR（不含周遊券）。' }], fare: '¥1,200', pass: '（機場交通不含周遊券）' } },
    { time: '10:40', type: 'stay', title: '飯店寄放行李', lat: 32.8009, lng: 130.7066, desc: '入住多為 15:00；先寄放行李輕裝出發。建議住桜町／下通一帶，鄰熊本城。' },
    { time: '11:00', type: 'see', title: '熊本城 + 復原見學通路', jp: 'Kumamoto Castle', lat: 32.8060, lng: 130.7059, desc: '天守閣已重開；空中迴廊俯瞰震災修復（含於門票）。', cost: '¥800', dur: '2.5 小時' },
    { time: '13:30', type: 'eat', title: '櫻之馬場 城彩苑 午餐', lat: 32.8035, lng: 130.7035, desc: '馬刺し・辛子蓮根・いきなり団子・太平燕一次嚐。', dur: '75 分' },
    { time: '14:45', type: 'see', title: 'くまモンスクエア', lat: 32.7975, lng: 130.7080, desc: '部長見面會多在 15:00；賣店掃くまモン伴手禮。', cost: '免費', dur: '60 分' },
    { time: '15:45', type: 'see', title: '水前寺成趣園', jp: 'Suizenji', lat: 32.7905, lng: 130.7335, desc: '桃山式回遊庭園與迷你富士山；末入 16:30，把握時間。', cost: '¥500', dur: '60 分' },
    { time: '17:30', type: 'eat', title: '下通 / 上通 晚餐', lat: 32.8000, lng: 130.7060, desc: '熊本ラーメン（焦香蒜油）或馬肉料理。', dur: '90 分' },
    { time: '19:30', type: 'stay', title: '熊本住宿', lat: 32.8009, lng: 130.7066, desc: '明日新幹線北上博多。' },
  ]),
  D('2026-06-18', '四', 'fukuoka', 'fukuoka', '熊本 → 博多 · 太宰府', '新幹線到博多（此段另購），太宰府天滿宮、櫛田／運河城，夜訪中洲屋台。', [
    { time: '09:00', type: 'move', title: '熊本 → 博多（九州新幹線）', desc: 'さくら約 40 分；此段周遊券不含，於熊本站另購。', route: ROUTES[0] },
    { time: '10:30', type: 'move', title: '博多 → 太宰府', desc: '地下鐵到天神轉西鐵電車到太宰府。', route: { fromStn: '西鉄福岡（天神）駅', toStn: '太宰府駅', legs: [{ dep: '10:30', arr: '11:10', line: '地下鐵＋西鐵（二日市轉乘）', type: 'private', dur: '約 35–40 分', note: '¥210＋¥480；西鐵非 JR，不含周遊券。' }], fare: '¥690', pass: '（西鐵不含 JR Pass）' } },
    { time: '11:15', type: 'see', title: '太宰府天滿宮', jp: 'Dazaifu Tenmangū', lat: 33.5214, lng: 130.5350, desc: '學問之神；參道梅ヶ枝餅必嚐。本殿整修中於臨時殿參拜。', cost: '境內免費', dur: '2 小時' },
    { time: '14:30', type: 'see', title: '櫛田神社 + Canal City', lat: 33.5916, lng: 130.4106, desc: '博多總鎮守，旁為運河購物城（每 30 分噴泉秀）。', dur: '2 小時' },
    { time: '18:30', type: 'eat', title: '中洲屋台 晚餐', lat: 33.5915, lng: 130.4030, desc: '河畔路邊攤：豚骨拉麵・串燒・明太子玉子燒。', dur: '90 分' },
    { time: '20:30', type: 'stay', title: '博多住宿', lat: 33.5899, lng: 130.4207, desc: '明日啟用 Setouchi 周遊券。' },
  ]),
  D('2026-06-19', '五', 'shimonoseki', 'shimonoseki', '下關 · 馬關條約 → 廣島', '啟用周遊券；到下關唐戸看馬關條約簽署地、河豚午餐、關門海峽，傍晚到廣島。', [
    { time: '09:00', type: 'move', title: '博多 → 下關（小倉轉乘）', desc: '★ 今日啟用 Setouchi 周遊券。新幹線到小倉轉在來線到下關。', route: ROUTES[1] },
    { time: '10:00', type: 'move', title: '下關站 → 赤間神宮前（巴士）', desc: 'サンデン巴士約 9 分 ¥220。', route: { fromStn: '下関駅', toStn: '赤間神宮前', legs: [{ dep: '10:00', arr: '10:09', line: 'サンデン交通巴士', type: 'bus', dur: '約 9 分', note: '¥220；可用 IC 卡。' }], fare: '¥220', pass: '（巴士不含周遊券）' } },
    { time: '10:30', type: 'see', title: '日清講和記念館（馬關條約）', jp: 'Treaty Hall', lat: 33.9578, lng: 130.9452, desc: '★ 重現 1895 馬關條約談判房間、原桌椅文書。免費。', cost: '免費', dur: '45 分' },
    { time: '11:20', type: 'see', title: '春帆樓 + 赤間神宮', lat: 33.9577, lng: 130.9450, desc: '條約簽署料亭（外觀）與朱紅龍宮造赤間神宮。', cost: '神宮免費', dur: '50 分' },
    { time: '12:20', type: 'eat', title: '唐戸市場 河豚午餐', lat: 33.9535, lng: 130.9450, desc: '河豚握壽司／海鮮丼；平日攤位較少，亦可在市場餐廳。', dur: '70 分' },
    { time: '14:00', type: 'see', title: '關門海峽 / 關門隧道人道', lat: 33.9620, lng: 130.9620, desc: '壇之浦古戰場；可步行海底人道到九州門司（約 15 分）。', dur: '70 分' },
    { time: '15:30', type: 'move', title: '下關 → 廣島（小倉轉乘）', desc: '在來線到小倉轉新幹線到廣島。', route: ROUTES[2] },
    { time: '17:30', type: 'eat', title: '廣島燒 晚餐', lat: 34.3934, lng: 132.4585, desc: '本通／お好み村；廣島風お好み焼き（麵＋大量高麗菜）。', dur: '90 分' },
    { time: '19:30', type: 'stay', title: '廣島住宿', lat: 34.3975, lng: 132.4757, desc: '住廣島站周邊，明日宮島＋和平公園。' },
  ]),
  D('2026-06-20', '六', 'hiroshima', 'miyajima', '宮島 + 廣島和平公園', '上午渡海宮島看大鳥居，午後和平記念公園與資料館。', [
    { time: '08:35', type: 'move', title: '廣島 → 宮島', desc: 'JR 山陽本線到宮島口轉 JR 渡輪（周遊券可用）。', route: ROUTES[3] },
    { time: '09:30', type: 'see', title: '嚴島神社 + 大鳥居', jp: 'Itsukushima', lat: 34.2960, lng: 132.3199, desc: '世界遺產海上社殿；查潮汐：高潮看浮鳥居、低潮可走到鳥居腳。', cost: '¥300（+寶物館 ¥500）', dur: '2.5 小時' },
    { time: '12:30', type: 'eat', title: '表參道 午餐', lat: 34.2978, lng: 132.3215, desc: '穴子飯、烤牡蠣、現烤紅葉饅頭。', dur: '80 分' },
    { time: '14:00', type: 'move', title: '宮島 → 廣島（廣電到原爆ドーム前）', desc: '渡輪回宮島口，JR 到廣島後轉廣電 2/6 號線到和平公園。', route: { fromStn: '宮島口駅', toStn: '原爆ドーム前', legs: [{ dep: '14:00', arr: '14:10', line: 'JR 宮島渡輪', type: 'ferry', dur: '約 10 分' }, { dep: '14:20', arr: '14:47', line: 'JR 山陽本線', type: 'local', dur: '約 27 分' }, { dep: '15:00', arr: '15:17', line: '廣電 2／6 號線', type: 'tram', dur: '約 17 分', note: '¥240，不含周遊券。' }], fare: 'JR 周遊券 + 廣電 ¥240', pass: 'JR 段周遊券可用' } },
    { time: '15:30', type: 'see', title: '原爆圓頂 + 和平記念公園 + 資料館', lat: 34.3955, lng: 132.4537, desc: '世界遺產原爆ドーム、慰靈碑；資料館六月開到 19:00（末入 18:30）。', cost: '資料館 ¥200', dur: '2.5 小時' },
    { time: '18:30', type: 'eat', title: '廣島 晚餐', lat: 34.3958, lng: 132.4620, desc: '牡蠣料理或つけ麺。' },
    { time: '20:00', type: 'stay', title: '廣島住宿', lat: 34.3975, lng: 132.4757, desc: '明日跨海到四國高松。' },
  ]),
  D('2026-06-21', '日', 'takamatsu', 'takamatsu', '四國 · 高松一日', '新幹線到岡山，快速マリンライナー過瀨戶大橋到高松：玉藻公園、栗林公園、讚岐烏龍、屋島。', [
    { time: '08:30', type: 'move', title: '廣島 → 岡山（新幹線）', desc: '山陽新幹線のぞみ／さくら約 38 分。', route: ROUTES[4] },
    { time: '09:20', type: 'move', title: '岡山 → 高松（瀨戶大橋）', desc: '快速マリンライナー過海約 55 分；坐 1 號車上層看跨海大橋。', route: ROUTES[5] },
    { time: '10:30', type: 'see', title: '玉藻公園 · 高松城', lat: 34.3501, lng: 134.0504, desc: '罕見海水堀海城；緊鄰高松站步行 3 分。', cost: '¥200', dur: '45 分' },
    { time: '11:30', type: 'see', title: '栗林公園', jp: 'Ritsurin Garden', lat: 34.3296, lng: 134.0440, desc: '日本特別名勝；六大池與紫雲山借景，回遊賞景。', cost: '¥500', dur: '90 分' },
    { time: '13:15', type: 'eat', title: '讚岐烏龍 午餐', lat: 34.3506, lng: 134.0466, desc: '香川「烏龍縣」名物；自助セルフ式：自取麵、加湯、加蔥薑天婦羅，最後結帳。', dur: '60 分' },
    { time: '14:30', type: 'see', title: '屋島 展望台', jp: 'Yashima', lat: 34.3437, lng: 134.1013, desc: 'JR 屋島站轉接駁巴士（¥200）上山；屋島寺與 Yashimaru 展望台俯瞰瀨戶內海。', dur: '2.5 小時' },
    { time: '17:30', type: 'move', title: '高松 → 岡山', desc: '快速マリンライナー回岡山（夕陽過大橋）。', route: { fromStn: '高松駅', toStn: '岡山駅', legs: [{ dep: '17:40', arr: '18:35', line: '快速マリンライナー', type: 'rapid', dur: '約 55 分', note: '周遊券可用。' }], fare: '周遊券可用', pass: 'Setouchi 周遊券可用' } },
    { time: '19:00', type: 'stay', title: '岡山住宿', lat: 34.6664, lng: 133.9180, desc: '住岡山站周邊，明日倉敷＋大阪。' },
  ]),
  D('2026-06-22', '一', 'osaka', 'okayama', '倉敷美觀 → 大阪', '上午倉敷美觀地區，午後新幹線到大阪：大阪城、道頓堀。', [
    { time: '09:00', type: 'move', title: '岡山 → 倉敷', desc: 'JR 山陽本線約 17 分 ¥330（周遊券可用）。', route: { fromStn: '岡山駅', toStn: '倉敷駅', legs: [{ dep: '09:00', arr: '09:17', line: 'JR 山陽本線 普通', type: 'local', dur: '約 17 分', note: '¥330；南口步行約 12 分到美觀地區。' }], fare: '周遊券可用', pass: 'Setouchi 周遊券可用' } },
    { time: '09:40', type: 'see', title: '倉敷美觀地區 + 大原美術館', lat: 34.5950, lng: 133.7716, desc: '江戶白壁倉庫與運河；可搭川舟、逛大原美術館（¥2,000）。', cost: '美術館 ¥2,000', dur: '2.5 小時' },
    { time: '12:30', type: 'eat', title: '倉敷 午餐', lat: 34.5950, lng: 133.7716, desc: 'ぶっかけうどん（ふるいち）或岡山ばら寿司。', dur: '60 分' },
    { time: '14:00', type: 'move', title: '岡山 → 大阪（新幹線）', desc: '回岡山轉山陽新幹線到新大阪約 45 分，再到大阪站。', route: ROUTES[6] },
    { time: '16:00', type: 'see', title: '大阪城', jp: 'Osaka Castle', lat: 34.6873, lng: 135.5259, desc: 'JR 大阪城公園站；天守閣與石垣博物館（建議線上購票）。', cost: '¥1,200', dur: '90 分' },
    { time: '18:30', type: 'eat', title: '道頓堀 晚餐', lat: 34.6687, lng: 135.5013, desc: 'Glico 看板、心齋橋；章魚燒・大阪燒・串炸。', dur: '120 分' },
    { time: '21:00', type: 'stay', title: '大阪住宿', lat: 34.7025, lng: 135.4959, desc: '連住大阪 2 晚，京都／奈良當日往返。' },
  ]),
  D('2026-06-23', '二', 'kyoto', 'kyoto', '京都一日', '新快速到京都：伏見稻荷千本鳥居、嵐山竹林、清水寺與祇園。', [
    { time: '08:00', type: 'move', title: '大阪 → 京都（新快速）', desc: 'JR 京都線新快速約 28 分（周遊券在來線可用）。', route: ROUTES[7] },
    { time: '08:45', type: 'see', title: '伏見稻荷大社', jp: 'Fushimi Inari', lat: 34.9671, lng: 135.7727, desc: 'JR 奈良線「稻荷駅」站前；千本鳥居建議清晨避人潮。', cost: '免費', dur: '90 分' },
    { time: '10:45', type: 'see', title: '嵐山 · 竹林 · 渡月橋', jp: 'Arashiyama', lat: 35.0170, lng: 135.6716, desc: 'JR 嵯峨嵐山駅；竹林、天龍寺（¥500）、渡月橋。', cost: '天龍寺 ¥500', dur: '2.5 小時' },
    { time: '13:30', type: 'eat', title: '嵐山 / 京都 午餐', lat: 35.0156, lng: 135.6739, desc: '湯豆腐、抹茶甜點。' },
    { time: '14:45', type: 'see', title: '清水寺 + 二三年坂 + 祇園', lat: 34.9949, lng: 135.7850, desc: '京都站搭巴士 206 到五条坂；清水舞台後沿坂道下行到祇園八坂神社。', cost: '清水寺 ¥500', dur: '3 小時' },
    { time: '18:30', type: 'eat', title: '祇園 / 京都 晚餐', lat: 35.0036, lng: 135.7785, desc: '錦市場小吃或京料理。' },
    { time: '20:30', type: 'move', title: '京都 → 大阪', desc: 'JR 新快速回大阪約 28 分。', route: { fromStn: '京都駅', toStn: '大阪駅', legs: [{ dep: '20:30', arr: '20:58', line: 'JR 京都線 新快速', type: 'rapid', dur: '約 28 分', note: '周遊券可用。' }], fare: '周遊券可用', pass: 'Setouchi 周遊券可用' } },
    { time: '21:30', type: 'stay', title: '大阪住宿', lat: 34.7025, lng: 135.4959, desc: '明日奈良半日後赴機場。' },
  ]),
  D('2026-06-24', '三', 'nara', 'nara', '奈良 → 關西機場 · 返程', '上午奈良東大寺與神鹿，午後最後採購，傍晚 19:05 班機自關西機場返台（21:10 抵桃園）。', [
    { time: '08:30', type: 'move', title: '大阪 → 奈良', desc: 'JR 大和路快速約 50 分（周遊券在來線可用）。', route: ROUTES[8] },
    { time: '09:30', type: 'see', title: '東大寺 + 奈良公園神鹿', jp: 'Tōdai-ji', lat: 34.6889, lng: 135.8398, desc: '世界最大級木造大佛殿；公園放養鹿、鹿仙貝 ¥200。', cost: '東大寺 ¥800', dur: '2.5 小時' },
    { time: '12:00', type: 'eat', title: '奈良 午餐', lat: 34.6822, lng: 135.8316, desc: '柿の葉壽司、釜飯；採購鹿サブレ伴手。', dur: '60 分' },
    { time: '13:30', type: 'shop', title: '最後採購（奈良 / 回大阪）', lat: 34.7025, lng: 135.4959, desc: '回大阪心齋橋或新大阪駅 エキマルシェ補貨；明太子等冷藏品最後再買並要保冷劑。', dur: '90 分' },
    { time: '15:30', type: 'move', title: '前往關西機場（KIX）', desc: '由奈良經天王寺轉関空快速，或由大阪/京都搭はるか；19:05 國際線抓 ~16:30 前抵達最穩。', route: ROUTES[9] },
    { time: '17:00', type: 'stay', title: '抵達 KIX · 辦理登機', lat: 34.4339, lng: 135.2440, desc: '退稅、最後伴手禮；國際線建議起飛前 2–2.5 小時完成報到。' },
    { time: '19:05', type: 'depart', title: '關西機場起飛 → 21:10 桃園', jp: 'Kansai Airport', lat: 34.4339, lng: 135.2440, desc: '班機 KIX 19:05 起飛、21:10 抵達桃園。八日九州・瀨戶內・關西之旅圓滿！' },
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

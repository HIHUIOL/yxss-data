/* ============================================================
 * pages/calc.js —— 伤害计算器
 *
 * 两种模式：
 *   [技能伤害] 四步公式（已被实机验证，见 数据翻译/职业技能数值_hsd1.md §8）
 *       ① 基础值 V = 其他加成 + 武器掷值（武器在 [下限,上限] 内随机）
 *       ② 技能值 值 = (A + B×Lv) × V / C + V
 *       ③ 减伤   伤害 = max(5, 值 − 敌防)      （战术熟练可削敌防）
 *       ④ 暴击   伤害 ×= 2 × (1 + 冷酷加成)
 *
 *   [基础估算] 旧的简化算法（max(5, 攻击−防御)），保留做对照
 *
 * 实测校验（地狱木乃伊领主 def=117，主手 683 副手 648，冷酷 3，连击 Lv3）：
 *   普通 550/1795 · 斩击 2019/6444 · 连击 1347/1356/4099  ← 全部吻合
 * ============================================================ */
(function (global) {
  'use strict';
  const { h, card, empty, stat } = UI;
  const Pages = global.Pages = global.Pages || {};

  const state = {
    mode: 'skill',
    monId: '',
    diff: '地狱',
    jobIdx: 1,
    skillIdx: 2,
    skillLv: 3,
    atkMain: 683,
    atkOff: 648,
    hand: 'main',
    coolLv: 3,
    tacticLv: 0,
    wpnLo: 83,
    wpnHi: 102,
    playerLv: 85,
    playerHit: 200,
    playerDodge: 100,
  };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function renderDamageCalc(ctx) {
    const mons = Data.get('monsters') || {};
    const skills = Data.get('skills') || {};
    const jobs = skills.jobs || [];
    const passives = skills.passive || [];

    if (!state.monId) {
      const ks = Object.keys(mons).sort((a, b) => mons[a].baseLv - mons[b].baseLv);
      // 默认选木乃伊领主（实机验证用的那只），找不到就取等级最高的怪
      const target = ks.find(k => mons[k].name === '木乃伊领主');
      state.monId = target || ks[ks.length - 1] || '';
    }

    const findPassive = name => (passives.find(p => p.name === name) || {}).v || null;
    const coldV = findPassive('冷酷');
    const tacticV = findPassive('战术熟练');

    const out = h('div');
    const resultBox = h('div');

    const monSel = h('select', {
      style: {
        width: '100%', height: '44px', padding: '0 12px', borderRadius: '11px',
        background: 'var(--bg2)', border: '1px solid var(--line2)',
        color: 'var(--fg)', fontSize: '14px',
      },
      onchange: e => { state.monId = e.target.value; refresh(); },
    }, Object.keys(mons).sort((a, b) => mons[a].baseLv - mons[b].baseLv).map(k =>
      h('option', { value: k, selected: k === state.monId },
        mons[k].name + '（Lv' + mons[k].baseLv + '）')));

    const diffSeg = UI.seg(
      ['普通', '专家', '地狱'].map(x => ({ id: x, name: x })),
      state.diff,
      v => { state.diff = v; refresh(); }
    );

    const mkNum = (label, key, min, max) => h('div.kv', [
      h('span', label),
      h('input', {
        type: 'number', value: state[key], min: min || 0, max: max || 999999,
        style: {
          width: '110px', height: '38px', padding: '0 10px', textAlign: 'right',
          background: 'var(--bg2)', border: '1px solid var(--line2)',
          borderRadius: '9px', color: 'var(--fg)', fontFamily: 'var(--mono)',
        },
        oninput: e => { state[key] = +e.target.value || 0; refresh(); },
      }),
    ]);

    /* ---------- 技能伤害 ---------- */
    function calcSkill() {
      const m = mons[state.monId];
      const d = m && m.diff && m.diff[state.diff];
      if (!d) return null;
      const job = jobs[state.jobIdx];
      const sk = job && job.skills && job.skills[state.skillIdx];
      if (!sk || !sk.v || !sk.v.abc) return null;

      const A = sk.v.abc[0], B = sk.v.abc[1], C = sk.v.abc[2] || 1;
      const lv = state.skillLv;

      let defv = d.def;
      if (tacticV && tacticV.abc && state.tacticLv > 0) {
        const ta = tacticV.abc[0], tb = tacticV.abc[1], tc = tacticV.abc[2] || 1;
        defv = Math.floor(defv * (ta + tb * state.tacticLv) / tc);
      }

      const pool = state.hand === 'off' ? state.atkOff : state.atkMain;
      // ★ 浮动来源（已用实测确认）：武器伤害在 [dmg下限, dmg上限] 间随机取值，
      //   而面板攻击 = 武器上限 + 其他加成总和。
      //   所以实际 V = 其他加成 + 武器掷值，范围很窄（不是总攻击的 1~100%）。
      //   例：爆发 04:30 dmg[83,102]，面板 683 → 其他 581，实际 V = 664~683。
      const wLo = state.wpnLo, wHi = state.wpnHi;
      const other = Math.max(0, pool - wHi);          // 其他加成
      const Vlow = other + wLo;
      const Vhigh = other + wHi;

      const k = (A + B * lv) / C;

      let coldAdd = 0;
      if (coldV && coldV.abc && state.coolLv > 0) {
        const ca = coldV.abc[0], cb = coldV.abc[1], cc = coldV.abc[2] || 1;
        coldAdd = (ca + cb * state.coolLv) / cc;
      }
      const critMul = 2 * (1 + coldAdd);

      const one = V => {
        const val = k * V + V;
        const dmg = Math.max(5, Math.round(val) - defv);
        return { val: Math.round(val), dmg, crit: Math.round(dmg * critMul) };
      };
      const lo = one(Vlow);
      const hi = one(Vhigh);

      return {
        mon: m, diffData: d, job, sk, A, B, C, k, lv,
        defv, defRaw: d.def, tacticCut: d.def - defv,
        pool, Vlow, Vhigh, lo, hi, coldAdd, critMul,
        other: Math.max(0, pool - state.wpnHi),
      };
    }

    /* ---------- 基础估算 ---------- */
    function calcBasic() {
      const m = mons[state.monId];
      const d = m && m.diff && m.diff[state.diff];
      if (!d) return null;
      const PA = state.atkMain;
      const dmg = Math.max(5, PA - d.def);
      const hits = Math.ceil(d.hp / dmg);
      const myHit = clamp(90 + state.playerHit - 2 * d.hit, 15, 100);
      const itsHit = clamp(90 + d.hit - 2 * state.playerDodge, 15, 100);
      const gap = clamp(20 + d.lv[0] - state.playerLv, 0, 30);
      const exp = (d.exp && d.exp.fixed) ? d.exp.fixed : Math.floor(18 * d.lv[0] * gap / 20);
      return { mon: m, d, dmg, hits, myHit, itsHit, exp };
    }

    function refresh() {
      if (state.mode === 'skill') {
        const r = calcSkill();
        if (!r) { UI.mount(resultBox, empty('当前职业/难度没有可用技能数据')); return; }
        const avg = Math.round((r.lo.dmg + r.hi.dmg) / 2);
        UI.mount(resultBox, [
          card('⚔️ ' + r.sk.name + '（Lv' + r.lv + '）伤害区间', h('div', [
            h('div.stats', [
              stat('最低（武器下限）', r.lo.dmg, 'blu'),
              stat('最高（武器上限）', r.hi.dmg, 'gold'),
              stat('暴击最低', r.lo.crit, 'grn'),
              stat('暴击最高', r.hi.crit, 'grn'),
            ]),
            h('div.mt12', h('div.dim', { style: { fontSize: '12px', lineHeight: '1.9' } }, [
              '① 基础值 V = ' + r.Vlow + ' ~ ' + r.Vhigh + '（其他加成 ' + r.other + ' + 武器掷值 ' + state.wpnLo + '~' + state.wpnHi + '，' + (state.hand === 'off' ? '副手' : '主手') + '）',
              h('br'),
              '② 技能倍率 k = (基础 ' + r.A + ' + 每级 ' + r.B + ' × 等级 ' + r.lv + ') ÷ ' + r.C + ' = ' + r.k.toFixed(2) + '，技能值 = V × (1 + k)',
              h('br'),
              '③ 减伤 = 值 − ' + r.defv + (r.tacticCut > 0 ? ('（原 ' + r.defRaw + '，战术熟练削 ' + r.tacticCut + '）') : '（敌防）'),
              h('br'),
              '④ 暴击 = ×' + r.critMul.toFixed(2) + '（冷酷 Lv' + state.coolLv + ' → +' + (r.coldAdd * 100).toFixed(0) + '%）',
            ])),
          ])),

          card('📐 逐档明细', h('div', [
            h('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' } }, [
              h('tr', { style: { color: 'var(--sub)' } }, [
                h('td', { style: { padding: '4px 2px' } }, '浮动'),
                h('td', { style: { padding: '4px 2px', textAlign: 'right' } }, 'V'),
                h('td', { style: { padding: '4px 2px', textAlign: 'right' } }, '值'),
                h('td', { style: { padding: '4px 2px', textAlign: 'right' } }, '非暴击'),
                h('td', { style: { padding: '4px 2px', textAlign: 'right' } }, '暴击'),
              ]),
              h('tr', {}, [
                h('td', { style: { padding: '4px 2px' } }, '50%'),
                h('td', { style: { padding: '4px 2px', textAlign: 'right', fontFamily: 'var(--mono)' } }, r.Vlow),
                h('td', { style: { padding: '4px 2px', textAlign: 'right', fontFamily: 'var(--mono)' } }, r.lo.val),
                h('td', { style: { padding: '4px 2px', textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--gold2)' } }, r.lo.dmg),
                h('td', { style: { padding: '4px 2px', textAlign: 'right', fontFamily: 'var(--mono)', color: '#6ee7a8' } }, r.lo.crit),
              ]),
              h('tr', {}, [
                h('td', { style: { padding: '4px 2px' } }, '100%'),
                h('td', { style: { padding: '4px 2px', textAlign: 'right', fontFamily: 'var(--mono)' } }, r.Vhigh),
                h('td', { style: { padding: '4px 2px', textAlign: 'right', fontFamily: 'var(--mono)' } }, r.hi.val),
                h('td', { style: { padding: '4px 2px', textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--gold2)' } }, r.hi.dmg),
                h('td', { style: { padding: '4px 2px', textAlign: 'right', fontFamily: 'var(--mono)', color: '#6ee7a8' } }, r.hi.crit),
              ]),
            ]),
            h('div.mt8.dim', { style: { fontSize: '11.5px', lineHeight: '1.7' } },
              '武器攻击每次出手独立掷 1~100% 的浮动率，所以实际伤害落在「最低~最高」之间。' +
              '精灵被动「最大化」可抬高浮动率。'),
          ])),

          card('🎯 击杀这只怪', h('div.stats', [
            stat('怪物 HP', r.diffData.hp, ''),
            stat('平均每下', avg + ' 伤', 'blu'),
            stat('约需刀数', Math.ceil(r.diffData.hp / Math.max(1, avg)) + ' 刀', 'gold'),
          ])),
        ]);
        return;
      }

      const r = calcBasic();
      if (!r) { UI.mount(resultBox, empty('该难度无数据')); return; }
      UI.mount(resultBox, [
        card('⚔️ 击杀估算（简化算法）', h('div', [
          h('div.stats', [
            stat('每刀伤害', r.dmg, 'blu'),
            stat('需要刀数', r.hits + ' 刀', 'gold'),
            stat('你的命中率', r.myHit.toFixed(0) + '%', r.myHit >= 80 ? 'grn' : ''),
            stat('它打你命中', r.itsHit.toFixed(0) + '%'),
          ]),
          h('div.mt12', h('div.dim', { style: { fontSize: '12px', lineHeight: '1.7' } },
            '伤害 = max(5, 攻击 − 防御) = max(5, ' + state.atkMain + ' − ' + r.d.def + ') = ' + r.dmg +
            '。这个算法没算技能系数、主副手、暴击，仅作粗略对照。')),
        ])),
        card('💰 收益', h('div.stats', [
          stat('金币', r.d.gold[0] + '~' + r.d.gold[1], 'gold'),
          stat('经验', r.exp, 'grn'),
        ])),
      ]);
    }

    const modeSeg = UI.seg([
      { id: 'skill', name: '技能伤害', sub: '精确' },
      { id: 'basic', name: '基础估算', sub: '简化' },
    ], state.mode, v => { state.mode = v; drawInputs(); refresh(); });

    const inputBox = h('div');

    function drawInputs() {
      if (state.mode === 'skill') {
        const jobSeg = UI.seg(
          jobs.map((j, i) => ({ id: String(i), name: j.name })),
          String(state.jobIdx),
          v => { state.jobIdx = +v; state.skillIdx = 0; drawInputs(); refresh(); }
        );
        const job = jobs[state.jobIdx];
        const skillSeg = UI.seg(
          ((job && job.skills) || []).map((s, i) => ({ id: String(i), name: s.name })),
          String(state.skillIdx),
          v => { state.skillIdx = +v; refresh(); }
        );
        const sk = job && job.skills && job.skills[state.skillIdx];
        const maxLv = (sk && sk.v && sk.v.max) || 3;
        if (state.skillLv > maxLv) { state.skillLv = maxLv; }

        const handSeg = UI.seg([
          { id: 'main', name: '主手' },
          { id: 'off', name: '副手' },
        ], state.hand, v => { state.hand = v; refresh(); });

        UI.mount(inputBox, [
          card('🎓 职业与技能', h('div', [jobSeg, h('div.mt12', skillSeg)])),
          card('📊 参数', h('div', [
            mkNum('技能等级 (0~' + maxLv + ')', 'skillLv', 0, maxLv),
            mkNum('主手攻击力', 'atkMain', 0, 99999),
            mkNum('副手攻击力', 'atkOff', 0, 99999),
            h('div.mt12', handSeg),
            mkNum('武器伤害下限', 'wpnLo', 0, 9999),
            mkNum('武器伤害上限', 'wpnHi', 0, 9999),
            h('div.dim', { style: { fontSize: '11.5px', padding: '4px 2px', lineHeight: '1.7' } },
              '武器伤害区间见「物品图鉴」里该武器的数值（例：爆发 04:30 = 83~102）。' +
              '面板攻击 = 武器上限 + 其他加成，实际伤害时武器在区间内随机取值。'),
            mkNum('冷酷等级 (0~3)', 'coolLv', 0, 3),
            mkNum('战术熟练等级 (0~3)', 'tacticLv', 0, 3),
          ])),
        ]);
      } else {
        UI.mount(inputBox, [
          card('🧍 你的属性', h('div', [
            mkNum('玩家等级', 'playerLv', 1, 999),
            mkNum('你的攻击', 'atkMain', 0, 99999),
            mkNum('你的命中', 'playerHit', 0, 99999),
            mkNum('你的闪避', 'playerDodge', 0, 99999),
          ])),
        ]);
      }
    }

    out.appendChild(card('👹 选择目标', h('div', [monSel, h('div.mt12', diffSeg)])));
    out.appendChild(modeSeg);
    out.appendChild(inputBox);
    out.appendChild(resultBox);

    drawInputs();
    refresh();
    return out;
  }

  Pages.renderDamageCalc = renderDamageCalc;
})(window);
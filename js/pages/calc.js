/* ============================================================
 * pages/calc.js —— 伤害计算器
 *
 * 源码依据（cq.java:842 / cq.java 命中判定）：
 *   伤害 = max(5, 攻击 − 防御)
 *   命中率 = clamp(90 + 攻方命中 − 2×防方闪避, 15, 100)%
 *   背击：攻/防各 × 4/5
 *   经验 = 18 × 怪等级 × clamp(20 + 怪等级 − 玩家等级, 0, 30) / 20
 * ============================================================ */
(function (global) {
  'use strict';
  const { h, card, empty, stat, chip, fmt } = UI;

  const state = {
    monId: '59',
    diff: '地狱',
    playerLv: 85,
    playerAtk: 200,
    playerHit: 200,
    playerDodge: 100,
  };

  function renderDamageCalc(ctx) {
    const mons = Data.get('monsters') || {};
    const keys = Object.keys(mons);

    const out = h('div');

    /* ---- 选择怪物 ---- */
    const monSel = h('select', {
      style: {
        width: '100%', height: '44px', padding: '0 12px', borderRadius: '11px',
        background: 'var(--bg2)', border: '1px solid var(--line2)', color: 'var(--fg)',
        fontSize: '14px',
      },
      onchange: e => { state.monId = e.target.value; refresh(); },
    }, keys.sort((a, b) => mons[a].baseLv - mons[b].baseLv).map(k =>
      h('option', { value: k, selected: k === state.monId },
        mons[k].name + '（Lv' + mons[k].baseLv + '）')
    ));

    /* ---- 玩家输入 ---- */
    const mkNum = (label, key, min, max) => {
      const input = h('input', {
        type: 'number', value: state[key], min: min, max: max,
        style: {
          width: '100%', height: '40px', padding: '0 10px', textAlign: 'right',
          background: 'var(--bg2)', border: '1px solid var(--line2)',
          borderRadius: '9px', color: 'var(--fg)', fontFamily: 'var(--mono)',
        },
        oninput: e => { state[key] = +e.target.value || 0; refresh(); },
      });
      return h('div.kv', [h('span', label), input]);
    };

    const diffSeg = UI.seg(
      ['普通', '困难', '地狱'].map(x => ({ id: x, name: x })),
      state.diff,
      v => { state.diff = v; refresh(); }
    );

    const resultBox = h('div');

    const refresh = () => {
      const m = mons[state.monId];
      if (!m) { UI.mount(resultBox, empty('请选择怪物')); return; }
      const d = m.diff[state.diff];
      if (!d) { UI.mount(resultBox, empty('该难度无数据')); return; }

      const PL = state.playerLv;
      const PA = state.playerAtk;
      const PH = state.playerHit;
      const PD = state.playerDodge;

      /* 伤害 */
      const dmg = Math.max(5, PA - d.def);
      const dmgBack = Math.max(5, Math.round(PA * 0.8) - Math.round(d.def * 0.8));
      const hits = Math.ceil(d.hp / dmg);
      const hitsBack = Math.ceil(d.hp / dmgBack);

      /* 命中率 */
      const myHit = clamp(90 + PH - 2 * d.hit, 15, 100);
      const itsHit = clamp(90 + d.hit - 2 * PD, 15, 100);

      /* 它打我一下多少 */
      const itsDmg = Math.max(5, d.atk - 0);

      /* 经验 */
      let exp;
      if (d.exp.fixed) {
        exp = d.exp.fixed;
      } else {
        const gap = clamp(20 + d.lv[0] - PL, 0, 30);
        exp = Math.floor(18 * d.lv[0] * gap / 20);
      }

      UI.mount(resultBox, [
        card('⚔️ 击杀估算', h('div', [
          h('div.stats', [
            stat('每刀伤害', dmg, 'blu'),
            stat('需要刀数', hits + ' 刀', 'gold'),
            stat('你的命中率', myHit.toFixed(0) + '%', myHit >= 80 ? 'grn' : ''),
            stat('它打你命中', itsHit.toFixed(0) + '%'),
          ]),
          h('div.mt12', h('div.dim', { style: { fontSize: '12px', lineHeight: '1.7' } },
            '伤害 = max(5, 攻击 − 防御) = max(5, ' + PA + ' − ' + d.def + ') = ' + dmg + '。' +
            (hitsBack !== hits ? (' 背击时攻防各打 8 折 → ' + dmgBack + ' 伤害，' + hitsBack + ' 刀。') : '')
          )),
        ])),

        card('🎯 命中判定', h('div', [
          h('div.kv', [h('span', '你打它'), h('b' + (myHit >= 80 ? '.grn' : ''), myHit.toFixed(1) + '%')]),
          h('div.kv', [h('span', '它打你'), h('b' + (itsHit >= 95 ? '.gold' : ''), itsHit.toFixed(1) + '%')]),
          h('div.mt8.dim', { style: { fontSize: '11.5px', lineHeight: '1.7' } }, [
            '命中率 = clamp(90 + 攻方命中 − 2×防方命中, 15, 100)%',
            h('br'),
            '这只怪命中 ' + d.hit + '，你要超过 ' + Math.ceil((90 + d.hit - 100) / 2) + ' 命中才能满命中。',
          ]),
        ])),

        card('💰 收益', h('div.stats', [
          stat('金币（80%）', d.gold[0] + '~' + d.gold[1], 'gold'),
          stat('经验', d.exp.fixed ? ('固定 ' + exp) : exp, 'grn'),
        ])),

        card('⚠️ 它打你', h('div', [
          h('div.kv', [h('span', '单次伤害'), h('b', itsDmg + '（未算你防御）')]),
          h('div.kv', [h('span', '命中率'), h('b', itsHit.toFixed(0) + '%')]),
          h('div.kv', [h('span', '期望伤害/回合'), h('b', (itsDmg * itsHit / 100).toFixed(0))]),
        ])),
      ]);
    };

    out.appendChild(card('👹 选择目标', h('div', [
      monSel, h('div.mt12', diffSeg),
    ])));
    out.appendChild(card('🧍 你的属性', h('div', [
      mkNum('玩家等级', 'playerLv', 1, 999),
      mkNum('你的攻击', 'playerAtk', 0, 99999),
      mkNum('你的命中', 'playerHit', 0, 99999),
      mkNum('你的闪避', 'playerDodge', 0, 99999),
    ])));
    out.appendChild(resultBox);

    refresh();
    return out;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  global.Pages = global.Pages || {};
  Pages.renderDamageCalc = renderDamageCalc;

  Pages.meta = Pages.meta || {};
  Pages.meta['calc'] = { needs: ['monsters'] };
})(window);
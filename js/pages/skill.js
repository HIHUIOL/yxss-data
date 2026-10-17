/* ============================================================
 * pages/skill.js —— 技能图鉴
 *
 * 数据来源：web/data/skills.json
 *   由 工具/构建技能数据.py 从 jar 内 /t/*.tdf 解码生成
 *
 *   职业技能 = /t/s0 ~ /t/s5（按 ed.b 当前职业加载）
 *   通用主动 = /t/sa（10 个）
 *   被动     = /t/ps（20 个，全职业共用一张表）
 * ============================================================ */
(function (global) {
  'use strict';
  const { h, card, row, seg, chip, empty } = UI;
  const Pages = global.Pages = global.Pages || {};

  const state = { tab: 'job', jobIdx: 0 };

  function skillRow(s, kind) {
    const v = s.v;
    // 有等级数据 → 拼「标签  0 / 1 / 2 / 3」一行小字
    let lvLine = null;
    if (v && v.lv && v.lv.length) {
      lvLine = h('div', {
        style: {
          marginTop: '5px',
          fontSize: '11.5px',
          color: 'var(--sub)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center',
        },
      }, [
        h('span', { style: { color: 'var(--gold2)' } }, v.label),
        h('span', { style: { opacity: '.65' } },
          'Lv0→' + (v.max !== undefined ? v.max : (v.lv.length - 1))),
        h('span', { style: { color: 'var(--fg)', letterSpacing: '.3px' } },
          v.lv.join(' → ')),
        v.parts ? h('span', {
          style: { fontSize: '10.5px', opacity: '.55' },
        }, '（基础 ' + v.parts.base + ' + 每级 ' + v.parts.per + '，÷' + v.parts.div + '）') : null,
        v.coef ? h('span', {
          style: { fontSize: '10.5px', opacity: '.6' },
        }, '魔力 ' + v.coef[0] + ' · 冷却 ' + v.coef[1]) : null,
        v.note ? h('span', {
          style: {
            fontSize: '10.5px', padding: '1px 6px', borderRadius: '8px',
            background: 'rgba(255,200,80,.14)', color: '#e8c46a',
            border: '1px solid rgba(255,200,80,.3)',
          },
        }, '⚠️ ' + v.note) : null,
      ]);
    } else if (v && v.cool !== undefined) {
      // 精灵主动：只有冷却除数
      lvLine = h('div', {
        style: { marginTop: '5px', fontSize: '11.5px', color: 'var(--sub)' },
      }, [
        h('span', { style: { color: 'var(--gold2)' } }, '冷却除数 '),
        h('span', { style: { color: 'var(--fg)' } }, String(v.cool)),
        h('span', { style: { opacity: '.6' } }, '（越大冷却越短）'),
      ]);
    }
    return h('div.row', {}, [
      h('div.ri', kind === 'passive' ? '🔹' : '⚡'),
      h('div.rm', [
        h('div.rn', s.name),
        s.desc ? h('div.rd', s.desc) : null,
        lvLine,
      ]),
    ]);
  }

  function renderSkillList(ctx) {
    const d = Data.get('skills') || {};
    const jobs = d.jobs || [];
    const spiritActive = d.spiritActive || [];
    const spiritPassive = d.spiritPassive || [];
    const passive = d.passive || [];
    const rules = d.rules || [];
    const meta = d.meta || {};

    const box = h('div');
    const body = h('div');

    /* ---- 规则说明（用户实测 + 源码） ---- */
    if (rules.length) {
      box.appendChild(card('📋 技能系统规则', h('div', {
        style: { padding: '8px 4px', fontSize: '12.5px', lineHeight: '1.9' },
      }, rules.map((r, i) => h('div', [
        h('span', { style: { color: 'var(--gold2)', marginRight: '5px' } }, (i + 1) + '.'),
        h('span', r),
      ]))), { flush: true }));
    }

    /* ---- 页签 ---- */
    const tabSeg = seg([
      { id: 'job', name: '职业技能', sub: jobs.length + ' 个' },
      { id: 'spirit', name: '精灵', sub: (spiritActive.length + spiritPassive.length) + ' 个' },
      { id: 'passive', name: '通用被动', sub: passive.length + ' 个' },
    ], state.tab, v => { state.tab = v; draw(); });

    function draw() {
      if (state.tab === 'passive') {
        UI.mount(body, [
          h('div', {
            style: { padding: '2px 4px 10px', fontSize: '11.5px', color: 'var(--sub)', lineHeight: '1.7' },
          }, '数值来自 /hero/hsd2（20 组 × 3 字节），已由字节码逐条验证。等级上限 3（职业技能/通用被动）或 5（精灵技能），上限来自 cb.j:B。'),
          card('🔹 通用被动（' + passive.length + ' 个）',
            passive.map(s => skillRow(s, 'passive')),
            { flush: true, aside: passive.length + ' 个' }),
        ]);
        return;
      }

      if (state.tab === 'spirit') {
        UI.mount(body, [
          h('div', {
            style: { padding: '2px 4px 10px', fontSize: '11.5px', color: 'var(--sub)', lineHeight: '1.7' },
          }, '精灵形态专用，与职业无关，所有职业变身后都能用。'),
          card('✨ 精灵主动（' + spiritActive.length + ' 个）',
            spiritActive.map(s => skillRow(s, 'active')),
            { flush: true, aside: spiritActive.length + ' 个' }),
          card('🔹 精灵被动（' + spiritPassive.length + ' 个）',
            spiritPassive.map(s => skillRow(s, 'passive')),
            { flush: true, aside: spiritPassive.length + ' 个' }),
        ]);
        return;
      }

      /* 职业技能：先选职业 */
      const jobSeg = seg(
        jobs.map((j, i) => ({ id: String(i), name: j.name, sub: j.skills.length + ' 个' })),
        String(state.jobIdx),
        v => { state.jobIdx = Number(v); draw(); }
      );
      const job = jobs[state.jobIdx];
      const jobPassive = (job && job.jobPassive) || [];
      UI.mount(body, [
        jobSeg,
        job ? card(
          '⚔️ ' + job.name + ' · ' + job.weapon,
          [
            h('div', {
              style: { padding: '8px 4px', fontSize: '12px', lineHeight: '1.75', color: 'var(--sub)' },
            }, job.style),
            h('div', {
              style: { padding: '0 4px 8px', fontSize: '11px', color: 'var(--sub)', opacity: '.75' },
            }, '数值来自 /hero/hsd1。「伤害倍率」= (基础 + 每级×技能等级) ÷ 除数，就是这一下技能的伤害/效果倍数。「魔力」= 该技能消耗的魔力，「冷却」= 冷却帧数。持久力/技术熟练被动可各减 30%。'),
            ...job.skills.map(s => skillRow(s, 'active')),
          ],
          { flush: true, aside: job.skills.length + ' 个主动' }
        ) : empty('没有数据'),
        jobPassive.length ? card(
          '🔹 ' + job.name + ' 职业专属被动',
          jobPassive.map(s => skillRow(s, 'passive')),
          { flush: true, aside: jobPassive.length + ' 个' }
        ) : null,
      ]);
    }

    box.appendChild(tabSeg);
    box.appendChild(body);
    draw();
    return box;
  }

  Pages.renderSkillList = renderSkillList;
  Pages.meta = Pages.meta || {};
  Pages.meta['skill'] = { needs: ['skills'] };
})(window);
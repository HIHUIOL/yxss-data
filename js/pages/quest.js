/* ============================================================
 * pages/quest.js —— 任务攻略
 *
 * 数据来源：web/data/quests.json
 *   由 工具/构建任务数据.py 从 数据翻译/全任务攻略.md 提取
 *
 * 两条主线：
 *   主线 0~34（qm.tdf，35 条）
 *   支线 0~27（qs.tdf，28 条）
 *   权重：主线 11~40 双倍（2 分），主线 0~10 单倍，支线单倍
 * ============================================================ */
(function (global) {
  'use strict';
  const { h, card, row, search, seg, chip, empty } = UI;
  const Pages = global.Pages = global.Pages || {};

  const state = { kind: 'main', q: '' };

  function wchip(w) {
    if (w === 2) return chip('双倍 ×2', 'gold');
    if (w === 1) return chip('1 分');
    return null;
  }

  function renderQuestList(ctx) {
    const data = Data.get('quests') || {};
    const main = data.main || [];
    const side = data.side || [];
    const meta = data.meta || {};

    const box = h('div');
    const listBox = h('div');

    /* ---- 进度说明 ---- */
    box.appendChild(card('📊 进度怎么算', h('div', {
      style: { padding: '8px 4px', fontSize: '12px', lineHeight: '1.8' },
    }, [
      h('div', '进度 = 主线[11~40]完成数 × 2 + 主线[0~10]完成数 + 支线完成数 + 要素4 + 要素5 + 周目'),
      h('div', { style: { color: 'var(--muted)', marginTop: '4px' } },
        '理论满分 102 → 封顶 100；但任务31（决战）永远点不亮，实测上限 90 分。'),
      h('div', { style: { display: 'flex', gap: '6px', marginTop: '7px', flexWrap: 'wrap' } }, [
        chip('主线 ' + (meta.mainCount || main.length) + ' 条'),
        chip('支线 ' + (meta.sideCount || side.length) + ' 条'),
        chip('实测上限 90 分', 'gold'),
      ]),
    ]), { flush: true }));

    /* ---- ★ 难度影响 ---- */
    const diff = data.difficulty;
    if (diff) {
      box.appendChild(card('🎚️ 难度会影响任务', h('div', {
        style: { padding: '8px 4px', fontSize: '12.5px', lineHeight: '1.85' },
      }, [
        h('div', [
          h('b', { style: { color: 'var(--gold2)' } }, '主线：'),
          diff.main,
        ]),
        h('div', [
          h('b', { style: { color: 'var(--gold2)' } }, '支线：'),
          diff.side,
        ]),
        h('div', {
          style: { marginTop: '7px', paddingTop: '7px', borderTop: '1px solid var(--line)', color: 'var(--sub)', fontSize: '11.5px' },
        }, [
          h('div', diff.evidence),
          h('div', { style: { marginTop: '3px', color: 'var(--muted)' } }, '⚠️ ' + diff.status),
        ]),
      ]), { flush: true }));
    }

    /* ---- ★★ 要素 4 / 5 ---- */
    const elements = data.elements || [];
    if (elements.length) {
      const note = data.elementNote || {};
      const body = [
        h('div', { style: { padding: '8px 4px', fontSize: '12.5px', lineHeight: '1.85' } }, [
          h('div', { style: { color: 'var(--gold2)', fontWeight: '600', marginBottom: '4px' } },
            '这两项各 +1 分，但不在任务列表里，最容易漏。'),
          note.what ? h('div', '· ' + note.what) : null,
          note.whyHidden ? h('div', { style: { color: 'var(--sub)' } }, '· ' + note.whyHidden) : null,
        ]),
      ];
      elements.forEach(el => {
        body.push(h('div', {
          style: {
            margin: '6px 4px', padding: '10px', borderRadius: '8px',
            background: 'var(--bg2)', border: '1px solid var(--line2)',
          },
        }, [
          h('div', { style: { fontSize: '13.5px', fontWeight: '600', color: 'var(--gold2)' } },
            el.name + ' → 解锁「' + el.unlockJob + '」'),
          h('div', { style: { fontSize: '12px', lineHeight: '1.85', marginTop: '5px' } }, [
            h('div', '触发任务：' + el.questType + '「' + el.questName + '」'),
            h('div', { style: { color: 'var(--sub)' } }, '  要求：' + el.questReq),
            h('div', '触发地点：' + el.triggerMap),
            h('div', { style: { color: 'var(--sub)' } }, '存档位置：' + el.saveSlot + ' · 变量 ' + el.field),
          ]),
          h('div', {
            style: {
              marginTop: '7px', padding: '7px 9px', borderRadius: '6px',
              background: 'rgba(0,0,0,.35)', fontFamily: 'var(--mono)',
              fontSize: '11px', lineHeight: '1.75', color: '#9fd7a0',
            },
          }, (el.triggerText || []).map(t => h('div', t))),
        ]));
      });
      if (note.uniqueWritePoint) {
        body.push(h('div', {
          style: { padding: '6px 4px', fontSize: '11px', color: 'var(--sub)', lineHeight: '1.7' },
        }, '源码依据：' + note.uniqueWritePoint + (note.jobNames ? ' · ' + note.jobNames : '')));
      }
      box.appendChild(card('★★ 要素 4 / 5（隐藏加分项）', body, { flush: true, aside: '各 +1 分' }));
    }

    const doRender = () => {
      const arr0 = state.kind === 'main' ? main : side;
      const q = state.q.toLowerCase();
      const arr = arr0.filter(x =>
        !q || x.name.toLowerCase().includes(q) || x.goal.toLowerCase().includes(q) ||
        String(x.id) === q);

      if (!arr.length) { UI.mount(listBox, empty('没有匹配的任务', '📜')); return; }

      const rows = arr.map(x => row({
        icon: String(x.id),
        title: h('span', [
          h('span', x.name),
          x.weight === 2 ? h('span', { style: { color: 'var(--gold2)', fontSize: '11px', marginLeft: '5px' } }, '×2') : null,
        ]),
        desc: x.goal,
        right: null,
      }));

      UI.mount(listBox, card(
        (state.kind === 'main' ? '📖 主线任务' : '📜 支线任务'),
        rows,
        { flush: true, aside: arr.length + ' 条' }
      ));
    };

    /* 切换 */
    const kindSeg = seg([
      { id: 'main', name: '主线', sub: (meta.mainCount || main.length) + ' 条' },
      { id: 'side', name: '支线', sub: (meta.sideCount || side.length) + ' 条' },
    ], state.kind, v => { state.kind = v; doRender(); });

    const s = search('搜任务名 / 目标 / 编号', v => { state.q = v; doRender(); });

    box.appendChild(s.el);
    box.appendChild(kindSeg);
    box.appendChild(listBox);
    doRender();
    return box;
  }

  Pages.renderQuestList = renderQuestList;
  Pages.meta = Pages.meta || {};
  Pages.meta['quest'] = { needs: ['quests'] };
})(window);
/* ============================================================
 * pages/monster.js —— 怪物图鉴
 *
 * 两个页面：
 *   monster        → renderMonsterList   列表（支持搜索 / 排序）
 *   monster-detail → renderMonsterDetail 详情（属性 + 掉落 + 出现地图）
 * ============================================================ */
(function (global) {
  'use strict';
  const { h, card, row, search, seg, chip, empty, stat, fmt } = UI;

  const DIFFS = ['普通', '困难', '地狱'];
  const state = { diff: '地狱', sort: 'lv', q: '' };

  /* ================= 列表 ================= */
  function renderMonsterList(ctx) {
    const mons = Data.get('monsters') || {};
    const list = Object.keys(mons).map(k => mons[k]);

    const box = h('div');
    const listBox = h('div');

    const doRender = () => {
      const q = state.q.toLowerCase();
      let arr = list.filter(m => {
        if (!q) return true;
        if (m.name.toLowerCase().includes(q)) return true;
        if (String(m.id) === q) return true;
        // 按掉落物品名反查
        return hasDropItem(m, q);
      });

      arr.sort((a, b) => {
        if (state.sort === 'lv') return a.baseLv - b.baseLv || a.id - b.id;
        if (state.sort === 'lvDesc') return b.baseLv - a.baseLv || a.id - b.id;
        return a.id - b.id;
      });

      if (!arr.length) {
        UI.mount(listBox, empty('没有匹配的怪物'));
        return;
      }

      // 按等级段分组（每 10 级一段），便于浏览
      const groups = {};
      arr.forEach(m => {
        const seg0 = Math.floor(m.baseLv / 10) * 10;
        (groups[seg0] = groups[seg0] || []).push(m);
      });

      const nodes = Object.keys(groups).map(Number).sort((a, b) => a - b).map(g => {
        const items = groups[g];
        return card(
          'Lv ' + g + ' ~ ' + (g + 9),
          items.map(m => monRow(m)),
          { flush: true, aside: items.length + ' 只' }
        );
      });
      UI.mount(listBox, nodes);
    };

    const s = search('搜怪物名 / 物品名 / 编号', v => { state.q = v; doRender(); });
    const sortSeg = seg([
      { id: 'lv', name: '等级↑' },
      { id: 'lvDesc', name: '等级↓' },
      { id: 'id', name: '编号' },
    ], state.sort, v => { state.sort = v; doRender(); });

    box.appendChild(s.el);
    box.appendChild(sortSeg);
    box.appendChild(listBox);
    doRender();
    return box;
  }

  function hasDropItem(m, q) {
    for (const d in m.diff) {
      for (const dr of m.diff[d].drops) {
        const nm = (Data.itemName(dr[4]) || '').toLowerCase();
        if (nm.includes(q)) return true;
      }
    }
    return false;
  }

  function monRow(m) {
    const d = m.diff[state.diff];
    const lvText = d ? ('Lv' + d.lv[0] + '~' + d.lv[1]) : ('Lv' + m.baseLv);
    return row({
      icon: UI.monSprite(m.id, m.boss ? '👑' : '👹', { size: 'sm' }),
      title: m.name,
      desc: lvText + ' · 攻' + (d ? d.atk : m.base.atk) + ' 防' + (d ? d.def : m.base.def) + ' · ' + m.maps.length + ' 张图',
      right: m.boss ? 'BOSS' : null,
      onclick: () => ctx_goDetail(m.id),
    });
  }

  function ctx_goDetail(id) {
    Router.navigate('wiki', 'monster-detail', [id]);
  }

  /* ================= 详情 ================= */
  function renderMonsterDetail(ctx) {
    const id = ctx.param(0);
    const m = Data.monsterOf(id);
    if (!m) return empty('找不到怪物 #' + id, '❔');

    if (!m.diff[state.diff]) state.diff = Object.keys(m.diff)[0];

    const box = h('div');
    const bodyBox = h('div');

    /* --- 头部 --- */
    const d0 = m.diff[state.diff] || m.diff[Object.keys(m.diff)[0]];
    const heroBox = h('div');
    const renderHero = () => {
      const d = m.diff[state.diff];
      UI.mount(heroBox, h('div.mhero' + (m.boss ? '.boss' : ''), [
        h('div.mtop', [
          h('div.mico', UI.monSprite(m.id, m.boss ? '👑' : '👹', { size: 'lg' })),
          h('div', { style: { flex: '1', minWidth: '0' } }, [
            h('div.mname', m.name),
            h('div.mlv', '编号 #' + m.id + ' · 基础 Lv' + m.baseLv + ' · 出现 ' + m.maps.length + ' 张图'),
          ]),
        ]),
        h('div.mchips', [
          m.boss ? chip('BOSS', 'gold') : null,
          d ? chip('攻 ' + d.atk, 'blu') : null,
          d ? chip('防 ' + d.def, 'blu') : null,
          d ? chip('HP ' + d.hp, 'blu') : null,
          d ? chip('命中 ' + d.hit) : null,
        ]),
      ]));
    };

    /* --- 难度切换 --- */
    const segBox = seg(
      DIFFS.filter(x => m.diff[x]).map(x => ({
        id: x, name: x,
        sub: 'Lv' + m.diff[x].lv[0] + '~' + m.diff[x].lv[1],
      })),
      state.diff,
      v => { state.diff = v; renderHero(); renderBody(); }
    );

    /* --- 正文 --- */
    const renderBody = () => {
      const d = m.diff[state.diff];
      if (!d) { UI.mount(bodyBox, empty('该难度无数据')); return; }

      const nodes = [];

      /* 属性 */
      nodes.push(card('📊 ' + state.diff + ' 实况', h('div.stats', [
        stat('等级区间', d.lv[0] + '~' + d.lv[1]),
        stat('金币（80%）', d.gold[0] + '~' + d.gold[1], 'gold'),
        stat('经验 · 同级', d.exp.fixed ? '固定 ' + d.exp.fixed : d.exp.mid, 'grn'),
        stat('经验 · 封顶', d.exp.fixed ? '—' : d.exp.hi, 'grn'),
      ])));

      /* 基础白值 */
      nodes.push(card('📐 基础属性（白值）', h('div.stats', [
        stat('攻击', m.base.atk),
        stat('防御', m.base.def),
        stat('HP', m.base.hp),
        stat('命中', m.base.hit),
      ])));

      /* 掉落 */
      nodes.push(renderDrops(m, d));

      /* 出现地图 */
      if (m.maps.length) {
        const maps = Data.get('maps') || {};
        nodes.push(card('🗺️ 出现地图', m.maps.map(mid => {
          const mp = maps[mid];
          const cnt = mp ? (mp.mons.find(x => x.id === m.id) || {}).cnt : '?';
          return row({
            icon: '🗺️',
            title: mp ? mp.name : mid,
            desc: mid + ' · 刷 ' + cnt + ' 只',
            onclick: () => Router.navigate('wiki', 'map-detail', [mid]),
          });
        }), { flush: true, aside: m.maps.length + ' 张' }));
      }

      UI.mount(bodyBox, nodes);
    };

    renderHero();
    renderBody();

    box.appendChild(heroBox);
    box.appendChild(segBox);
    box.appendChild(bodyBox);
    return box;
  }

  /* --- 掉落清单 --- */
  function renderDrops(m, d) {
    const groups = {};
    d.drops.forEach(it => {
      const g = it[0];
      (groups[g] = groups[g] || []).push(it);
    });

    const order = ['组0', '组1', '组2', '组3', '兜底'];
    const keys = Object.keys(groups).sort((a, b) => {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

    const total = d.drops.length;

    return card('🎁 掉落清单', h('div', keys.map(g => {
      const list = groups[g];
      const pct = list[0][2];
      const n = list[0][3];
      // 组内按单件概率降序
      list.sort((a, b) => b[6] - a[6]);

      return h('div.dgrp', [
        h('div.dh', [
          h('span.dt', g),
          h('span.dp', fmt.pct(pct)),
          n > 1 ? chip(n + ' 选 1') : null,
        ]),
        ...list.map(it => dropItem(it)),
      ]);
    })), { flush: true, aside: total + ' 件' });
  }

  function dropItem(it) {
    const itemId = it[4];
    const e = Data.itemOf(itemId);
    const name = e ? e.name : (itemId || '?');
    const fallback = e ? e.icon : '❔';
    const single = it[6];
    const w = Math.min(100, Math.max(3, single * 100));

    return h('div.ditem', {
      onclick: () => { if (itemId) Router.navigate('wiki', 'item-detail', [itemId]); },
    }, [
      h('div.di', UI.itemIcon(itemId, fallback, { size: 'sm' })),
      h('div.dn', [
        name,
        it[5] ? h('span.dl', 'Lv' + it[5]) : null,
      ]),
      h('div.dbar', h('i', { style: { width: w + '%' } })),
      h('div.dpc' + (single >= 1 ? '.hi' : single < 0.05 ? '.lo' : ''), fmt.pct(single)),
    ]);
  }

  global.Pages = global.Pages || {};
  Pages.renderMonsterList = renderMonsterList;
  Pages.renderMonsterDetail = renderMonsterDetail;

  // 数据集需求（框架会自动合并到 page.load）
  Pages.meta = Pages.meta || {};
  Pages.meta['monster'] = { needs: ['monsters', 'items', 'icons', 'sprites'] };
  Pages.meta['monster-detail'] = { needs: ['monsters', 'items', 'maps', 'icons', 'sprites'] };
  Pages.MON_DIFFS = DIFFS;
})(window);
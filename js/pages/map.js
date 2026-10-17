/* ============================================================
 * pages/map.js —— 地图一览
 *
 *   map        → renderMapList    地图列表（搜索 + 按文件分组）
 *   map-detail → renderMapDetail  某张图的刷怪详情
 * ============================================================ */
(function (global) {
  'use strict';
  const { h, card, row, search, empty, chip } = UI;

  const state = { q: '' };

  /* ================= 列表 ================= */
  function renderMapList(ctx) {
    const maps = Data.get('maps') || {};
    const list = Object.keys(maps).map(k => maps[k]);
    const box = h('div');
    const listBox = h('div');

    const doRender = () => {
      const q = state.q.toLowerCase();
      const arr = list.filter(mp => {
        if (!q) return true;
        if (mp.name.toLowerCase().includes(q)) return true;
        if (mp.id.toLowerCase().includes(q)) return true;
        // 按怪物名反查
        return mp.mons.some(x => {
          const m = Data.monsterOf(x.id);
          return m && m.name.toLowerCase().includes(q);
        });
      }).sort((a, b) => a.id.localeCompare(b.id));

      if (!arr.length) { UI.mount(listBox, empty('没有匹配的地图')); return; }

      // 按 m/ 和 m2/ 分两组
      const g1 = arr.filter(mp => mp.id.startsWith('m2/'));
      const g0 = arr.filter(mp => !mp.id.startsWith('m2/'));

      const nodes = [];
      if (g0.length) nodes.push(card('主世界 m/', g0.map(mapRow), { flush: true, aside: g0.length + ' 张' }));
      if (g1.length) nodes.push(card('迷宫 m2/', g1.map(mp => mapRow(mp, '🏛️')), { flush: true, aside: g1.length + ' 张' }));
      UI.mount(listBox, nodes);
    };

    box.appendChild(search('搜地图名 / 怪物名 / 文件名', v => { state.q = v; doRender(); }).el);
    box.appendChild(listBox);
    doRender();
    return box;
  }

  function mapRow(mp, icon) {
    const total = mp.mons.reduce((s, x) => s + (x.cnt || 0), 0);
    return row({
      icon: icon || '🗺️',
      title: mp.name,
      desc: mp.id + ' · ' + mp.size + ' · ' + mp.mons.length + ' 种怪',
      right: String(total),
      onclick: () => Router.navigate('wiki', 'map-detail', [mp.id]),
    });
  }

  /* ================= 详情 ================= */
  function renderMapDetail(ctx) {
    const raw = ctx.param(0);
    const maps = Data.get('maps') || {};

    // ★ 容错：路由可能把 `m2/b6.m` 拆开，或用户手输错后缀
    let mp = maps[raw];
    if (!mp && raw) {
      // 尝试补 .m 后缀
      mp = maps[raw + '.m'];
    }
    if (!mp && raw) {
      // 尝试用 resolveId：在 keys 里找唯一包含该串的
      const keys = Object.keys(maps).filter(k => k.includes(raw) || k.endsWith('/' + raw));
      if (keys.length === 1) mp = maps[keys[0]];
    }
    if (!mp) return empty('找不到地图「' + raw + '」', '❔');

    const total = mp.mons.reduce((s, x) => s + (x.cnt || 0), 0);

    const head = h('div.mhero', [
      h('div.mtop', [
        h('div.mico', mp.id.startsWith('m2/') ? '🏛️' : '🗺️'),
        h('div', { style: { flex: '1', minWidth: '0' } }, [
          h('div.mname', mp.name),
          h('div.mlv', mp.id + ' · ' + mp.size),
        ]),
      ]),
      h('div.mchips', [
        chip(mp.mons.length + ' 种怪'),
        chip('共 ' + total + ' 只', 'blu'),
      ]),
    ]);

    const monCard = card('👹 刷怪清单', mp.mons.map(x => {
      const m = Data.monsterOf(x.id);
      if (!m) return row({ icon: '❔', title: '未知怪物 #' + x.id, desc: '' });
      const d = m.diff['地狱'] || m.diff[Object.keys(m.diff)[0]];
      return row({
        icon: UI.monSprite(m.id, m.boss ? '👑' : '👹', { size: 'sm' }),
        title: m.name + ' ×' + x.cnt,
        desc: 'Lv' + (d ? d.lv[0] + '~' + d.lv[1] : m.baseLv) +
              ' · 攻' + (d ? d.atk : m.base.atk) +
              ' 防' + (d ? d.def : m.base.def),
        onclick: () => Router.navigate('wiki', 'monster-detail', [m.id]),
      });
    }), { flush: true, aside: mp.mons.length + ' 种' });

    return h('div', [
      h('div.mt8', [
        h('button.b.ghost.sm', {
          onclick: () => Router.back({ group: 'wiki', page: 'map' }),
        }, '← 返回地图列表'),
      ]),
      head,
      monCard,
    ]);
  }

  global.Pages = global.Pages || {};
  Pages.renderMapList = renderMapList;
  Pages.renderMapDetail = renderMapDetail;

  Pages.meta = Pages.meta || {};
  Pages.meta['map'] = { needs: ['maps', 'monsters', 'icons', 'sprites'] };
  Pages.meta['map-detail'] = { needs: ['maps', 'monsters', 'icons', 'sprites'] };
})(window);
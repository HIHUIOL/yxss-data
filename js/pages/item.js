/* ============================================================
 * pages/item.js —— 物品图鉴
 *
 * 列表：按类别分组，支持搜索（名字/编号/类别）与排序
 * 详情：完整属性、掉落来源（反查怪物）
 * ============================================================ */
(function (global) {
  'use strict';
  const { h, card, row, search, seg, chip, empty, stat } = UI;
  const Pages = global.Pages = global.Pages || {};

  const state = { cat: '全部', sort: 'cat', q: '' };

/* ============================================================
 * ★ 品质颜色 —— 取自游戏字节码
 *
 * 证据：class原始/g.class
 *   214: getstatic  q.c:[I        ← 颜色表
 *   221: getfield   bx.e:B        ← 装备品质字段
 *   224: iaload                   ← q.c[bx.e]
 *   225: invokevirtual dd.a(I)V   ← 设为绘制颜色
 *
 * 源码/q.java:11
 *   public static final int[] c = new int[]{0xFFFFFF, 0xFFFF00, 16722152, 65280};
 *
 * 0xFFFFFF = 白 / 0xFFFF00 = 黄 / 16722152 = 0xFF2A68 粉 / 65280 = 0x00FF00 绿
 * ============================================================ */
const QUALITY_COLORS = ['#FFFFFF', '#FFFF00', '#FF2A68', '#00FF00'];
const QUALITY_NAMES = ['普通', '优良', '稀有', '传说'];

function qColor(it) {
  const q = (it && typeof it.quality === 'number') ? it.quality : 0;
  return QUALITY_COLORS[q] || QUALITY_COLORS[0];
}
function qName(it) {
  const q = (it && typeof it.quality === 'number') ? it.quality : 0;
  return QUALITY_NAMES[q] || QUALITY_NAMES[0];
}
/** 带品质颜色的名字节点 */
function qNameNode(it, tag) {
  const el = h(tag || 'span', { style: { color: qColor(it) } }, it.name);
  return el;
}

  /* 装备类（有攻/防） */
  const EQUIP_CATS = new Set([
    '斧头', '双手剑', '刀剑', '短剑', '枪', '枪剑', '钝器',
    '盾牌', '头盔', '轻护甲', '重护甲', '轻鞋', '重鞋',
    '轻手套', '重手套', '饰品'
  ]);

  /* ---------- 列表 ---------- */
  function renderItemList(ctx) {
    const items = Data.get('items') || {};
    const all = Object.keys(items).map(k => items[k]);

    /* 类别列表（按数量排序） */
    const catCount = {};
    all.forEach(it => { catCount[it.catName] = (catCount[it.catName] || 0) + 1; });
    const cats = Object.keys(catCount).sort((a, b) => catCount[b] - catCount[a]);

    const box = h('div');
    const listBox = h('div');

    const doRender = () => {
      const q = state.q.toLowerCase();
      let arr = all.filter(it => {
        if (state.cat !== '全部' && it.catName !== state.cat) return false;
        if (!q) return true;
        if (it.name.toLowerCase().includes(q)) return true;
        if (it.id === q) return true;
        if (it.catName.toLowerCase().includes(q)) return true;
        return false;
      });

      arr.sort((a, b) => {
        if (state.sort === 'lv') return a.level - b.level || a.id.localeCompare(b.id);
        if (state.sort === 'lvDesc') return b.level - a.level || a.id.localeCompare(b.id);
        if (state.sort === 'atk') {
          const av = a.dmg ? a.dmg[1] : -1, bv = b.dmg ? b.dmg[1] : -1;
          return bv - av || a.id.localeCompare(b.id);
        }
        if (state.sort === 'def') {
          const av = a.defense || -1, bv = b.defense || -1;
          return bv - av || a.id.localeCompare(b.id);
        }
        // 默认：按类别
        return a.cat - b.cat || a.sub - b.sub;
      });

      if (!arr.length) {
        UI.mount(listBox, empty('没有匹配的物品', '📦'));
        return;
      }

      /* 按类别分组展示 */
      const groups = {};
      arr.forEach(it => (groups[it.catName] = groups[it.catName] || []).push(it));

      const nodes = Object.keys(groups).map(c => {
        const list = groups[c];
        return card(
          c,
          list.map(it => itemRow(it)),
          { flush: true, aside: list.length + ' 件' }
        );
      });
      UI.mount(listBox, nodes);
    };

    /* 搜索 */
    const s = search('搜物品名 / 编号 / 类别', v => { state.q = v; doRender(); });

    /* 类别筛选（横向滚动） */
    const catBox = h('div.seg-scroll');
    const mkCats = () => {
      const names = ['全部'].concat(cats);
      UI.mount(catBox, h('div.seg', names.map(c =>
        h('div.s' + (c === state.cat ? '.on' : ''), {
          onclick: (ev) => {
            state.cat = c;
            catBox.querySelectorAll('.s').forEach(x => x.classList.remove('on'));
            ev.currentTarget.classList.add('on');
            doRender();
          }
        }, [h('span', c), h('span.sl', c === '全部' ? all.length : catCount[c])])
      )));
    };
    mkCats();

    /* 排序 */
    const sortSeg = seg([
      { id: 'cat', name: '类别' },
      { id: 'lv', name: '等级↑' },
      { id: 'lvDesc', name: '等级↓' },
      { id: 'atk', name: '攻击↓' },
      { id: 'def', name: '防御↓' },
    ], state.sort, v => { state.sort = v; doRender(); });

    box.appendChild(s.el);
    box.appendChild(catBox);
    box.appendChild(sortSeg);
    box.appendChild(listBox);
    doRender();
    return box;
  }

  function itemRow(it) {
    const parts = [];
    if (it.level) parts.push('Lv' + it.level);
    if (it.dmg) parts.push('攻' + it.dmg[0] + '~' + it.dmg[1]);
    if (it.defense) parts.push('防' + it.defense);
    if (it.crit) parts.push('暴' + it.crit + '%');
    if (!parts.length) parts.push('数量类');
    return row({
      icon: UI.itemIcon(it.id, it.icon, { size: 'sm' }),
      // ★ 名字按品质着色（同游戏内表现）
      title: qNameNode(it),
      desc: '#' + it.id + ' · ' + parts.join(' · '),
      right: it.price ? it.price + 'G' : null,
      onclick: () => Router.navigate('wiki', 'item-detail', [it.id]),
    });
  }

  /* ---------- 详情 ---------- */
  function renderItemDetail(ctx) {
    const id = ctx.param(0);
    const items = Data.get('items') || {};
    const it = items[id];
    if (!it) return empty('找不到物品 #' + id, '❔');

    const box = h('div');

    /* 头部 */
    box.appendChild(h('div.mhero', [
      h('div.mtop', [
        h('div.mico', UI.itemIcon(it.id, it.icon, { size: 'lg' })),
        h('div', { style: { flex: '1', minWidth: '0' } }, [
          h('div.mname', { style: { color: qColor(it) } }, it.name),
          h('div.mlv', '编号 #' + it.id + ' · ' + it.catName + ' · ' + (it.equip ? '可装备' : '非装备')),
        ]),
      ]),
      h('div.mchips', [
        chip('Lv' + it.level, 'gold'),
        chip(qName(it), 'q' + (it.quality || 0)),
        it.dmg ? chip('攻 ' + it.dmg[0] + '~' + it.dmg[1], 'blu') : null,
        it.defense ? chip('防 ' + it.defense, 'blu') : null,
        it.crit ? chip('暴击 ' + it.crit + '%') : null,
      ]),
    ]));

    /* 基础属性 */
    const rows = [];
    rows.push(stat('等级需求', it.level));
    if (it.price) rows.push(stat('售价', it.price + ' G', 'gold'));
    if (it.dmg) rows.push(stat('攻击力', it.dmg[0] + '~' + it.dmg[1]));
    if (it.defense) rows.push(stat('防御力', it.defense));
    if (it.crit) rows.push(stat('暴击率', it.crit + '%'));
    if (it.tier) rows.push(stat('套装', '#' + it.tier));
    box.appendChild(card('📊 属性', h('div.stats', rows)));

    /* 说明文字 */
    if (it.desc) {
      box.appendChild(card('📝 说明', h('div', { style: { padding: '8px 4px', lineHeight: '1.7' } }, it.desc)));
    }

    /* 掉落来源（反查怪物） */
    const monBox = h('div');
    const srcList = [];
    const mons = Data.get('monsters') || {};
    Object.keys(mons).forEach(mk => {
      const m = mons[mk];
      for (const d in m.diff) {
        const drops = m.diff[d].drops || [];
        for (const dr of drops) {
          if (dr[4] === it.id) {
            srcList.push({ mon: m, diff: d, p: dr });
            break;
          }
        }
      }
    });
    if (srcList.length) {
      const grouped = {};
      srcList.forEach(s => (grouped[s.mon.id] = grouped[s.mon.id] || { mon: s.mon, diffs: [] }));
      srcList.forEach(s => grouped[s.mon.id].diffs.push(s.diff));
      UI.mount(monBox, Object.values(grouped).map(g => row({
        icon: UI.monSprite(g.mon.id, g.mon.boss ? '👑' : '👹', { size: 'sm' }),
        title: g.mon.name,
        desc: '难度：' + [...new Set(g.diffs)].join(' / '),
        onclick: () => Router.navigate('wiki', 'monster-detail', [g.mon.id]),
      })));
      box.appendChild(card('👹 掉落来源', monBox, { flush: true, aside: srcList.length + ' 处' }));
    } else {
      box.appendChild(card('👹 掉落来源', empty('非掉落获得（商店 / 任务 / 合成）', '🛒')));
    }

    return box;
  }

  Pages.renderItemList = renderItemList;
  Pages.renderItemDetail = renderItemDetail;
  // ★ 品质颜色工具，供其他页面（怪物掉落行等）复用
  Pages.qColor = qColor;
  Pages.qName = qName;
  Pages.QUALITY_COLORS = QUALITY_COLORS;
  Pages.QUALITY_NAMES = QUALITY_NAMES;
  Pages.meta = Pages.meta || {};
  Pages.meta['item'] = { needs: ['items', 'icons', 'monsters', 'sprites'] };
  Pages.meta['item-detail'] = { needs: ['items', 'icons', 'monsters', 'sprites'] };
})(window);
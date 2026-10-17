/* ============================================================
 * pages/set.js —— 套装图鉴
 *
 * 数据来源：
 *   items.json 里每件装备的 tier 字段 = bx.f 套装号
 *   效果说明来自 数据翻译/全套装效果.md（字节码逐条核对）
 *
 * 判定规则：同一套装号 ≥ 3 件即触发（ek.a(int)，只看 bx.f）
 * ============================================================ */
(function (global) {
  'use strict';
  const { h, card, row, chip, empty } = UI;
  const Pages = global.Pages = global.Pages || {};

  /* ★ 套装定义（来自字节码核对 + 玩家实测）
   *  flags 是 ek 里的 boolean[] b[] 标记位
   */
  const SETS = [
    {
      tier: 0, name: '女装套', short: '女装',
      flags: ['b[0]'],
      effect: '四项基础属性各 +4',
      extra: '旅馆休息价格降低（待源码确认）',
      note: '轻甲职业专用',
    },
    {
      tier: 1, name: '狂战士系列', short: '狂战士',
      flags: ['b[1]'],
      effect: 'HP 类资源获得量 +10%',
      extra: '吸血',
      note: '',
    },
    {
      tier: 2, name: '加速套', short: '加速',
      flags: ['b[2]'],
      effect: '移动速度 ×2',
      extra: '冰海（轻甲）/ 神殿骑士（重甲）共用套装号，混穿也计数',
      note: '两线设计',
    },
    {
      tier: 3, name: '红狮系列', short: '红狮',
      flags: ['b[1]', 'b[3]', 'b[4]'],
      effect: 'HP +10% + MP +5% + 命中 +5%',
      extra: '吸血吸魔',
      note: '',
    },
    {
      tier: 4, name: '暴风系列', short: '暴风',
      flags: ['b[1]', 'b[4]', 'b[5]'],
      effect: 'HP +10% + 命中 +5% + 免疫受击减速',
      extra: '吸血；被怪打中不会减速（实测确认）',
      note: '',
    },
    {
      tier: 5, name: '封印套', short: '封印',
      flags: ['b[4]', 'b[6]'],
      effect: '命中 +5% + 某属性 +50%',
      extra: '延长变身时间 + 加快灵力恢复',
      note: '精灵使专用',
    },
  ];

  /* 标记位说明（点击展开用） */
  const FLAG_DESC = {
    'b[0]': '四项基础属性各 +4',
    'b[1]': 'HP 类资源获得量 +10%（吸血/回血）',
    'b[2]': '移动速度 ×2',
    'b[3]': 'MP/灵力获得量 +5%（吸魔/回灵）',
    'b[4]': '命中率 +5%',
    'b[5]': '免疫「受击减速」',
    'b[6]': '某项属性 +50%',
  };

  /* 按套装号收集成员
   ★ items.json 里 tier 是两位字符串（'00'~'05'），不是数字 */
  function tierKey(t) {
    return (typeof t === 'number') ? ('0' + t).slice(-2) : String(t);
  }

  function membersOf(tier) {
    const items = Data.get('items') || {};
    const key = tierKey(tier);
    return Object.keys(items)
      .map(k => items[k])
      .filter(it => String(it.tier) === key)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  /* ---------- 列表 ---------- */
  function renderSetList(ctx) {
    const box = h('div');

    box.appendChild(h('div', {
      style: { padding: '2px 4px 12px', fontSize: '12px', lineHeight: '1.7', color: 'var(--muted)' },
    }, [
      h('div', '同一套装号穿满 ', h('b', { style: { color: 'var(--gold2)' } }, '3 件'),
        ' 即触发效果。只看套装号，不看名字、不看品质，'),
      h('div', '所以同一套装的两套不同装备（如冰海 / 神殿骑士）可以混穿。'),
    ]));

    SETS.forEach(s => {
      const members = membersOf(s.tier);
      box.appendChild(card(
        '👑 ' + s.name,
        [
          h('div', { style: { padding: '8px 4px' } }, [
            h('div', { style: { fontSize: '13px', lineHeight: '1.8' } },
              '效果：' + s.effect),
            s.extra ? h('div', { style: { fontSize: '11.5px', color: 'var(--sub)', marginTop: '3px' } },
              s.extra) : null,
            h('div', { style: { display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '7px' } },
              s.flags.map(f => chip(f, 'q3'))),
          ]),
          ...members.map(it => row({
            icon: UI.itemIcon(it.id, it.icon, { size: 'sm' }),
            title: h('span', { style: { color: Pages.qColor ? Pages.qColor(it) : null } }, it.name),
            desc: '#' + it.id + ' · ' + it.catName + ' · Lv' + it.level,
            right: it.dmg ? ('攻' + it.dmg[0] + '~' + it.dmg[1]) : (it.defense ? ('防' + it.defense) : null),
            onclick: () => Router.navigate('wiki', 'item-detail', [it.id]),
          })),
        ],
        { flush: true, aside: members.length + ' 件' }
      ));
    });

    return box;
  }

  Pages.renderSetList = renderSetList;
  Pages.SETS = SETS;
  Pages.FLAG_DESC = FLAG_DESC;
  Pages.setMembersOf = membersOf;
  Pages.meta = Pages.meta || {};
  Pages.meta['set'] = { needs: ['items', 'icons'] };
})(window);
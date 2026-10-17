/* ============================================================
 * config.js —— 站点配置 + 页面注册
 *
 * ★ 加一个页面只需要：
 *     Router.registerPage({ id, group, title, load, render, ... })
 *   导航、页签、路由、数据加载全部自动。
 * ============================================================ */
(function () {
  'use strict';

  const SITE = {
    name: '英雄史诗初章',
    en: 'HEROIC EPIC',
    tagline: '资料库 · 存档编辑 · 工具',
    footer: '数据由源码逆向解出 · 仅供学习交流',
    version: '2.0',
  };

  /* ---------- 一级分组 = 底部导航 ---------- */
  Router.registerGroup({ id: 'wiki', title: '资料', icon: '📖', order: 10,
    sub: '怪物 · 物品 · 地图 · 攻略' });
  // ⚠️ 存档分组暂不启用：目前还没有存档编辑页，注册了会让底栏出现空入口。
  //    等 web 存档编辑器做出来后，取消下面这行注释并注册页面即可。
  // Router.registerGroup({ id: 'save', title: '存档', icon: '🎒', order: 20,
  //   sub: '仓库 · 背包 · 角色 · 进度' });
  Router.registerGroup({ id: 'tool', title: '工具', icon: '🧰', order: 30,
    sub: '伤害计算 · 掉落模拟' });

  /* ---------- 资料页 ---------- */
  Router.registerPage({
    id: 'monster', group: 'wiki', title: '怪物', order: 10,
    load: ['monsters', 'items'],
    countData: 'monsters',
    homeEntry: { icon: '👹', name: '怪物图鉴', desc: '属性 · 掉落 · 经验' },
    render: ctx => Pages.renderMonsterList(ctx),
  });

  Router.registerPage({
    id: 'monster-detail', group: 'wiki', title: '怪物详情', order: 10,
    hidden: true, parent: 'monster',
    load: ['monsters', 'items'],
    render: ctx => Pages.renderMonsterDetail(ctx),
  });

  Router.registerPage({
    id: 'item', group: 'wiki', title: '物品', order: 15,
    load: ['items', 'icons', 'monsters'],
    countData: 'items',
    homeEntry: { icon: '📦', name: '物品图鉴', desc: '属性 · 售价 · 掉落来源' },
    render: ctx => Pages.renderItemList(ctx),
  });
  Router.registerPage({
    id: 'item-detail', group: 'wiki', title: '物品详情', order: 15,
    hidden: true, parent: 'item',
    load: ['items', 'icons', 'monsters'],
    render: ctx => Pages.renderItemDetail(ctx),
  });
  Router.registerPage({
    id: 'set', group: 'wiki', title: '套装', order: 17,
    load: ['items', 'icons'],
    countData: null,
    homeEntry: { icon: '👑', name: '套装图鉴', desc: '6 套 32 件 · 效果对照' },
    render: ctx => Pages.renderSetList(ctx),
  });
  Router.registerPage({
    id: 'quest', group: 'wiki', title: '任务', order: 18,
    load: ['quests'],
    countData: 'quests',
    homeEntry: { icon: '📜', name: '任务攻略', desc: '主线 35 · 支线 28 · 进度算法' },
    render: ctx => Pages.renderQuestList(ctx),
  });
  Router.registerPage({
    id: 'skill', group: 'wiki', title: '技能', order: 19,
    load: ['skills'],
    countData: 'skills',
    homeEntry: { icon: '⚔️', name: '技能图鉴', desc: '6 职业 · 通用主动 · 20 被动' },
    render: ctx => Pages.renderSkillList(ctx),
  });
  Router.registerPage({
    id: 'map', group: 'wiki', title: '地图', order: 20,
    load: ['maps', 'monsters', 'items'],
    countData: 'maps',
    homeEntry: { icon: '🗺️', name: '地图一览', desc: '尺寸 · 刷怪 · 区域' },
    render: ctx => Pages.renderMapList(ctx),
  });

  Router.registerPage({
    id: 'map-detail', group: 'wiki', title: '地图详情', order: 20,
    hidden: true, parent: 'map',
    load: ['maps', 'monsters', 'items'],
    render: ctx => Pages.renderMapDetail(ctx),
  });

  /* ---------- 工具页 ---------- */
  Router.registerPage({
    id: 'calc', group: 'tool', title: '伤害计算', order: 10,
    load: ['monsters', 'skills'],
    homeEntry: { icon: '⚔️', name: '伤害计算', desc: '几刀杀死 · 拿多少' },
    render: ctx => Pages.renderDamageCalc(ctx),
  });

  /* 暴露上下文 */
  window.SITE = SITE;
})();
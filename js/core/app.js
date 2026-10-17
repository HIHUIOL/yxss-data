/* ============================================================
 * core/app.js —— 应用主壳
 *
 * 职责：
 *   1. 根据注册表自动生成底部导航 + 顶部页签
 *   2. 监听路由 → 找到页面 → 按需加载数据 → 调 render
 *   3. 统一的 loading / error / 重试
 *   4. 页面滚动位置记忆
 * ============================================================ */
(function (global) {
  'use strict';

  const { h, mount, $, $$ } = UI;

  const state = {
    group: null,
    page: null,
    params: [],
    scrollMemo: new Map(),   // key -> scrollY
    current: null,           // 当前页面 def
    renderToken: 0,          // 防止异步渲染串台
  };

  let els = {};

  /* ---------- 初始化 ---------- */
  function init(opts) {
    opts = opts || {};
    els = {
      hdrEm: $('#hdrEm'),
      hdrTitle: $('#hdrTitle'),
      hdrSub: $('#hdrSub'),
      tabs: $('#tabs'),
      view: $('#view'),
      nav: $('#nav'),
    };

    buildNav();
    Router.onRoute(handleRoute);

    // 全局报错兜底
    window.addEventListener('unhandledrejection', e => {
      console.error('[app] 未处理的异步错误', e.reason);
    });

    // ★ 先拿 manifest（首页要显示各数据集条目数），失败不阻塞启动
    Data.loadManifest()
      .catch(err => console.warn('[app] manifest 加载失败：', err.message))
      .then(() => {
        Router.start();
      });
  }

  /* ---------- 底部导航（自动生成） ---------- */
  function buildNav() {
    const groups = Router.allGroups();
    mount(els.nav, groups.map(g =>
      h('a', {
        dataset: { group: g.id },
        onclick: () => {
          const tabs = Router.groupTabs(g.id);
          const first = tabs[0];
          if (first) Router.navigate(g.id, first.id);
          else Router.navigate(g.id);
        },
      }, [h('span.ni', g.icon || '•'), g.title])
    ));
  }

  /* ---------- 顶部页签（自动生成） ---------- */
  function buildTabs(groupId) {
    const tabs = Router.groupTabs(groupId);
    if (!tabs.length) { els.tabs.textContent = ''; return; }
    mount(els.tabs, tabs.map(t =>
      h('div.t' + (t.id === state.page ? '.on' : ''), {
        onclick: () => Router.navigate(groupId, t.id),
      }, t.title)
    ));
  }

  /* ---------- 路由处理 ---------- */
  async function handleRoute(route) {
    // 保存离开页面的滚动位置
    if (state.current !== null) {
      state.scrollMemo.set(location.hash, window.scrollY);
    }

    // 首页：没指定 group
    if (!route.group) {
      state.group = null; state.page = null; state.params = [];
      els.hdrEm.textContent = '⚔️';
      els.hdrTitle.textContent = '英雄史诗初章';
      els.hdrSub.textContent = '资料库 · 存档编辑 · 工具';
      els.tabs.textContent = '';
      setNavActive(null);
      return renderHome();
    }

    const group = Router.allGroups().find(g => g.id === route.group);
    if (!group) return renderNotFound('分组不存在：' + route.group);

    // 没指定 page，跳到该分组第一个页面
    if (!route.page) {
      const tabs = Router.groupTabs(group.id);
      if (tabs.length) {
        Router.navigate(group.id, tabs[0].id, null, true);
        return;
      }
      return renderNotFound('该分组下还没有页面');
    }

    const page = Router.getPage(route.page);
    if (!page) return renderNotFound('页面不存在：' + route.page);

    state.group = group.id;
    state.page = page.id;
    state.params = route.params;
    state.current = page;

    // 头部
    els.hdrEm.textContent = group.icon || '•';
    els.hdrTitle.textContent = group.title;
    els.hdrSub.textContent = group.sub || '';
    buildTabs(group.id);
    setNavActive(group.id);

    // 详情页（hidden）不切页签，保留列表页签高亮
    if (page.hidden) {
      const tabs = Router.groupTabs(group.id);
      $$('.t', els.tabs).forEach((el, i) => {
        el.classList.toggle('on', tabs[i] && tabs[i].id === page.parent);
      });
    }

    await renderPage(page, route.params);
  }

  /* ---------- 页面渲染 ---------- */
  async function renderPage(page, params) {
    const token = ++state.renderToken;
    mount(els.view, UI.loading('加载中…'));

    try {
      // ★ 数据集需求 = 配置里声明的 ∪ 页面模块自报的（防止漏配导致白屏）
      const need = new Set(page.load || []);
      const handler = resolveHandler(page);
      if (handler && handler.needs) {
        (Array.isArray(handler.needs) ? handler.needs : [handler.needs]).forEach(n => need.add(n));
      }
      if (need.size) await Data.need([...need]);
      if (token !== state.renderToken) return;  // 已被新路由取代

      const ctx = {
        params: params || [],
        param: i => (params || [])[i],
        query: parseQuery(),
        page,
        route: { group: state.group, page: page.id },
        /** 站内跳转 */
        go: (g, p, ps) => Router.navigate(g, p, ps),
        /** 用新内容整体替换视图 */
        set: (nodes) => mount(els.view, nodes),
        /** 在视图里追加 */
        add: (nodes) => UI.append(els.view, nodes),
      };

      const out = page.render(ctx);
      if (token !== state.renderToken) return;

      if (out !== undefined && out !== null) mount(els.view, out);

      if (page.mount) page.mount(els.view, ctx);

      // 恢复滚动位置
      const memo = state.scrollMemo.get(location.hash);
      window.scrollTo(0, memo || 0);
    } catch (err) {
      if (token !== state.renderToken) return;
      console.error('[app] 页面渲染失败', page.id, err);
      mount(els.view, UI.error(
        '加载失败：' + (err && err.message ? err.message : err),
        () => renderPage(page, params)
      ));
    }
  }
  function resolveHandler(page) {
    // render 是 (ctx)=>dom 的箭头函数，无法取到它引用的具体函数；
    // 这里用约定：页面模块把元信息挂在 Pages.meta[pageId] 上。
    const meta = (global.Pages && Pages.meta) || {};
    return meta[page.id] || null;
  }

  function parseQuery() {
    const q = {};
    const raw = location.hash.split('?')[1];
    if (!raw) return q;
    raw.split('&').forEach(kv => {
      const [k, v] = kv.split('=');
      if (k) q[decodeURIComponent(k)] = v === undefined ? '' : decodeURIComponent(v);
    });
    return q;
  }

  function setNavActive(groupId) {
    $$('a', els.nav).forEach(a => {
      a.classList.toggle('on', a.dataset.group === groupId);
    });
  }

  /* ---------- 首页 ---------- */
  function renderHome() {
    state.current = null;
    const groups = Router.allGroups();

    const entries = [];
    groups.forEach(g => {
      Router.groupTabs(g.id).forEach(p => {
        if (!p.homeEntry) return;
        entries.push(homeEntry(p));
      });
    });

    const node = h('div', [
      h('div.hero', [
        h('div.h1', '英雄史诗初章'),
        h('div.h2', 'HEROIC EPIC · 资料库'),
        h('div.h3', '2010 J2ME · 全数据解包'),
      ]),
      h('div.entries', entries),
      h('div.foot', { style: { marginTop: '18px', textAlign: 'center', fontSize: '11px', color: 'var(--sub)' } },
        '数据由源码逆向解出 · 仅供学习交流'),
    ]);
    mount(els.view, node);
    window.scrollTo(0, 0);
  }

  function homeEntry(page) {
    const cnt = page.countData ? Data.count(page.countData) : null;
    return h('div.entry', {
      onclick: () => Router.navigate(page.group, page.id),
    }, [
      cnt !== null && cnt !== undefined ? h('div.ecnt', String(cnt)) : null,
      h('div.ei', page.homeEntry.icon || '•'),
      h('div.en', page.homeEntry.name || page.title),
      page.homeEntry.desc ? h('div.ed', page.homeEntry.desc) : null,
    ]);
  }

  /* ---------- 404 ---------- */
  function renderNotFound(msg) {
    state.current = null;
    els.tabs.textContent = '';
    setNavActive(null);
    mount(els.view, UI.error(msg || '页面不存在', () => Router.navigate(null)));
  }

  global.App = {
    init,
    get state() { return state; },
    navigate: (g, p, ps) => Router.navigate(g, p, ps),
  };
})(window);
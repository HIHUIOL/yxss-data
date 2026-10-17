/* ============================================================
 * core/router.js —— hash 路由 + 页面注册表
 *
 * 设计目标：加一个页面 = 调用一次 registerPage()，其余全自动。
 *   导航栏、二级页签、路由、数据加载、页面显隐 都由框架接管。
 *
 * 路由格式：#/<group>/<page>/<param...>
 *   #/wiki/monster          怪物列表
 *   #/wiki/monster/59       怪物详情（id=59）
 *   #/save/file             存档-文件
 *   #/                    首页
 * ============================================================ */
(function (global) {
  'use strict';

  /* ---------- 页面注册表 ---------- */
  const PAGES = new Map();      // pageId -> pageDef
  const GROUPS = new Map();     // groupId -> {id,title,icon,sub,pages:[]}

  /**
   * 注册一个一级分组（底部导航项）
   * @param {{id,title,icon,sub,order}} def
   */
  function registerGroup(def) {
    if (!GROUPS.has(def.id)) {
      GROUPS.set(def.id, Object.assign({ order: 99, pages: [] }, def));
    }
    return GROUPS.get(def.id);
  }

  /**
   * 注册一个页面
   * @param {{
   *   id: string,            页面唯一 id
   *   group: string,         所属分组
   *   title: string,         页签显示名
   *   order: number,         排序
   *   hidden: boolean,       不在页签里显示（详情页用）
   *   load: string[],        需要的数据集，自动按需加载
   *   render: function(ctx), 渲染函数
   *   mount: function(el,ctx), 可选，挂载后回调
   * }} def
   */
  function registerPage(def) {
    if (!def || !def.id) throw new Error('registerPage: id 必填');
    if (!def.group) throw new Error('registerPage(' + def.id + '): group 必填');
    if (typeof def.render !== 'function') throw new Error('registerPage(' + def.id + '): render 必填');
    PAGES.set(def.id, Object.assign({ order: 50, hidden: false, load: [] }, def));
    const g = GROUPS.get(def.group);
    if (g) g.pages.push(def.id);
    return def;
  }

  /** 取分组下所有可见页面（按 order 排序） */
  function groupTabs(groupId) {
    const g = GROUPS.get(groupId);
    if (!g) return [];
    return g.pages
      .map(id => PAGES.get(id))
      .filter(p => p && !p.hidden)
      .sort((a, b) => a.order - b.order);
  }

  function getPage(id) { return PAGES.get(id) || null; }
  function allGroups() {
    return [...GROUPS.values()].sort((a, b) => a.order - b.order);
  }

  /* ---------- 路由解析 ---------- */
  /**
   * 解析 hash -> { group, page, params, raw }
   * 未匹配到页面时 page=null
   *
   * ★ 参数含斜杠的处理（地图 id 形如 `m2/b6.m`）：
   *   `#/wiki/map-detail/m2/b6.m`
   *   → params = ['m2/b6.m', 'm2', 'b6.m']
   *   即 params[0] 恒为「剩余整段拼接值」，方便取含斜杠的 id；
   *   params 其余项为逐段拆分的值。
   */
  function parseHash(hash) {
    let h = (hash || location.hash || '').replace(/^#\/?/, '');
    h = h.split('?')[0];
    if (!h) return { group: null, page: null, params: [], raw: '' };

    const seg = h.split('/').filter(Boolean).map(s => {
      try { return decodeURIComponent(s); } catch (e) { return s; }
    });

    const group = seg[0] || null;
    const page = seg[1] || null;
    const rest = seg.slice(2);

    if (rest.length > 1) {
      // params[0]=拼接值，后面跟各段
      return { group, page, params: [rest.join('/')].concat(rest), raw: h };
    }
    return { group, page, params: rest, raw: h };
  }

  function buildHash(group, page, params) {
    const seg = [group, page].concat(params || []).filter(x => x !== undefined && x !== null && x !== '');
    return '#/' + seg.join('/');
  }

  /* ---------- 路由事件 ---------- */
  const listeners = new Set();

  /** 订阅路由变化，返回取消订阅函数 */
  function onRoute(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  let internalNavigation = false;

  /** 命令式跳转 */
  function navigate(group, page, params, replace) {
    const h = buildHash(group, page, params);
    if (h === location.hash) { emit(); return; }
    internalNavigation = true;
    if (replace) {
      history.replaceState(null, '', h);
      internalNavigation = false;
      emit();
    } else {
      location.hash = h;
    }
  }

  /** 返回上一页（有历史则后退，否则回首页） */
  function back(fallback) {
    if (history.length > 1) {
      history.back();
    } else {
      const f = fallback || { group: null, page: null };
      navigate(f.group, f.page, f.params, true);
    }
  }

  function emit() {
    const r = parseHash();
    listeners.forEach(fn => {
      try { fn(r); } catch (e) { console.error('[router] 监听器出错', e); }
    });
  }

  function start() {
    window.addEventListener('hashchange', () => {
      internalNavigation = false;
      emit();
    });
    emit();
  }

  /* ---------- 导出 ---------- */
  global.Router = {
    registerGroup, registerPage, getPage, groupTabs, allGroups,
    parseHash, buildHash, navigate, back, onRoute, start,
    get isNavigating() { return internalNavigation; },
  };
})(window);
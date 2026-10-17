/* ============================================================
 * core/loader.js —— 数据集按需加载 + 缓存 + 索引
 *
 * 用法：
 *   await Data.need('monsters')            // 加载单个
 *   await Data.need(['monsters','items'])  // 加载多个
 *   Data.get('monsters')                   // 同步取（未加载返回 null）
 *   Data.idx('items', '00:01')             // 按 id 取实体
 *
 * 目录清单在 data/index.json，格式：
 *   { "datasets": { "monsters": {file:"monsters.json", count:132, size:726000} } }
 * ============================================================ */
(function (global) {
  'use strict';

  const BASE = 'data/';
  const cache = new Map();        // name -> data
  const pending = new Map();      // name -> Promise（并发去重）
  const indexes = new Map();      // name -> Map(id -> entity)
  let manifest = null;
  let manifestPromise = null;

  const listeners = new Set();

  /** 订阅数据集加载完成事件 */
  function onLoad(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function notify(name, data) {
    listeners.forEach(fn => {
      try { fn(name, data); } catch (e) { console.error('[loader] 监听器出错', e); }
    });
  }

  async function fetchJSON(url) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error('加载失败 HTTP ' + res.status + '：' + url);
    return res.json();
  }

  /** 加载目录（只加载一次） */
  function loadManifest() {
    if (manifest) return Promise.resolve(manifest);
    if (manifestPromise) return manifestPromise;
    manifestPromise = fetchJSON(BASE + 'index.json')
      .then(m => { manifest = m; return m; })
      .catch(err => {
        manifestPromise = null;
        throw new Error('读取 data/index.json 失败：' + err.message + '\n（请用 http 服务打开，不要直接双击 html）');
      });
    return manifestPromise;
  }

  /** 加载一个数据集（带缓存 + 并发去重） */
  function load(name) {
    if (cache.has(name)) return Promise.resolve(cache.get(name));
    if (pending.has(name)) return pending.get(name);

    const p = loadManifest()
      .then(m => {
        const meta = (m.datasets || {})[name];
        if (!meta) throw new Error('数据集不存在：' + name + '（检查 data/index.json）');
        return fetchJSON(BASE + meta.file);
      })
      .then(data => {
        cache.set(name, data);
        pending.delete(name);
        notify(name, data);
        return data;
      })
      .catch(err => {
        pending.delete(name);
        throw err;
      });

    pending.set(name, p);
    return p;
  }

  /** 加载多个数据集，全部并行 */
  function need(names) {
    const list = Array.isArray(names) ? names : [names];
    return Promise.all(list.map(load));
  }

  /** 同步取已加载的数据 */
  function get(name) {
    return cache.has(name) ? cache.get(name) : null;
  }

  /**
   * 建立/获取 id 索引
   *
   * 支持两种顶层形态：
   *   A. { "59": {id, name...}, ... }   —— 以 key 为 id 的实体表
   *   B. [{id, name...}, ...]           —— 实体数组
   */
  function idx(name, id) {
    const data = get(name);
    if (!data) return null;
    let map = indexes.get(name);
    if (!map) {
      map = new Map();
      buildIndex(map, data);
      indexes.set(name, map);
    }
    if (id === undefined) return map;
    return map.get(String(id)) || null;
  }

  function buildIndex(map, data) {
    if (Array.isArray(data)) {
      data.forEach(e => { if (e && e.id !== undefined) map.set(String(e.id), e); });
      return;
    }
    if (!data || typeof data !== 'object') return;
    for (const k in data) {
      const v = data[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        map.set(k, v);
      } else if (typeof v === 'string' || typeof v === 'number') {
        map.set(k, v);
      }
    }
  }

  /** 取目录里记录的条目数（未加载也能显示） */
  function count(name) {
    if (!manifest) return null;
    const meta = (manifest.datasets || {})[name];
    return meta ? (meta.count === undefined ? null : meta.count) : null;
  }

  /** 数据版本号（用于缓存破坏） */
  function version() {
    return manifest ? (manifest.version || '') : '';
  }

  /* ---------- 便捷查询：物品名 ---------- */
  /**
   * 取物品显示名。物品 id 格式统一为 "cat:sub"，如 "00:01"
   * 未加载 items 时返回 id 本身，保证 UI 不出错
   */
  function itemName(itemId) {
    const e = idx('items', itemId);
    return e && e.name ? e.name : itemId;
  }

  function itemOf(itemId) {
    return idx('items', itemId);
  }

  function monsterName(monId) {
    const e = idx('monsters', monId);
    return e && e.name ? e.name : ('怪物#' + monId);
  }

  function monsterOf(monId) {
    return idx('monsters', monId);
  }

  /* ---------- 图标 ---------- */
  /**
   * 取物品图标 data URL。
   * 未加载 icons 数据集时返回 null，调用方应回退到 emoji。
   */
  function iconUrl(itemId) {
    const icons = get('icons');
    if (!icons) return null;
    const n = icons.map ? icons.map[itemId] : undefined;
    if (n === undefined || n === null) return null;
    return icons.img[n] || null;
  }

  /** 按类别取图标（物品 id 已知类别时更快） */
  function iconByCat(catId) {
    const icons = get('icons');
    if (!icons || !icons.cat) return null;
    const n = icons.cat[String(catId)];
    if (n === undefined || n === null) return null;
    return icons.img[n] || null;
  }

  /** 是否已加载图标数据 */
  function hasIcons() {
    return cache.has('icons');
  }

  /* ---------- 怪物精灵 ---------- */
  /**
   * 取怪物精灵图 data URL。
   *
   * 数据结构（sprites.json）：
   *   mon["59"] = { k: 1, ids: [15,35,38,43,0,0] }
   *   img["1:15"] = [dataURL, ...]        key = "{k}:{id}"
   *
   * k === 0 → 值是「方向」，img["0:NN"] 里每个元素对应一个方向
   * k !== 0 → 值是「帧」，取第一帧
   */
  function spriteUrl(monId) {
    const sp = get('sprites');
    if (!sp || !sp.mon) return null;
    const rec = sp.mon[String(monId)];
    if (!rec || !rec.ids) return null;
    const { k, ids } = rec;
    for (let i = 0; i < ids.length; i++) {
      const sid = ids[i];
      if (!sid) continue;
      const arr = sp.img[spriteKey(k, sid)];
      if (arr && arr.length) return arr[0];
    }
    return null;
  }
  /** 拼 img 的 key："{k}:{id:02d}" */
  function spriteKey(k, sid) {
    return k + ':' + (sid < 10 ? '0' + sid : String(sid));
  }

  /** 首帧之外是否还有更多帧（用于判断能否动画） */
  function spriteFrames(monId) {
    const sp = get('sprites');
    if (!sp || !sp.mon) return [];
    const rec = sp.mon[String(monId)];
    if (!rec) return [];
    const { k, ids } = rec;
    if (!ids || !ids.length || !ids[0]) return [];
    const key = k + ':' + (ids[0] < 10 ? '0' + ids[0] : ids[0]);
    return sp.img[key] || [];
  }

  function hasSprites() {
    return cache.has('sprites');
  }

  global.Data = {
    load, need, get, idx, count, version, onLoad, loadManifest,
    itemName, itemOf, monsterName, monsterOf,
    iconUrl, iconByCat, hasIcons,
    spriteUrl, spriteFrames, hasSprites,
    get manifest() { return manifest; },
    /** 调试用：已加载的数据集名 */
    get loaded() { return [...cache.keys()]; },
  };
})(window);
/* ============================================================
 * core/ui.js —— 轻量组件库
 *
 * 统一用 h() 构建设计 DOM，不拼字符串。
 *   好处：自动转义（防 XSS）、可组合、可复用、易调试。
 *
 *   h('div.card', {onclick}, [ ...children ])
 *   h('span', '纯文本')
 * ============================================================ */
(function (global) {
  'use strict';

  /* ---------- 元素构建 ---------- */
  /**
   * @param {string} spec   'tag.class.class#id' 或 'tag'
   * @param {object|string|Array|function} props 属性 / 文本 / 子节点
   * @param {Array} children 子节点
   */
  function h(spec, props, children) {
    // 支持 'div.a.b#id'、'div'，也支持省略标签名的 '.a.b'（默认 div）
    const m = String(spec).match(/^([a-zA-Z0-9-]*)((?:[.#][\w-]+)*)$/);
    const tag = (m && m[1]) || 'div';
    const el = document.createElement(tag || 'div');

    if (m && m[2]) {
      m[2].replace(/([.#])([\w-]+)/g, (_, kind, name) => {
        if (kind === '.') el.classList.add(name);
        else el.id = name;
      });
    }

    // 参数重载：h(spec, children)
    if (props !== undefined && props !== null &&
        (typeof props === 'string' || typeof props === 'number' ||
         Array.isArray(props) || props instanceof Node)) {
      children = props;
      props = null;
    }

    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class' || k === 'className') {
          String(v).split(/\s+/).filter(Boolean).forEach(c => el.classList.add(c));
        } else if (k === 'style' && typeof v === 'object') {
          for (const s in v) el.style[s] = v[s];
        } else if (k === 'text') {
          el.textContent = String(v);
        } else if (k === 'html') {
          el.innerHTML = v;                    // 仅用于可信内容
        } else if (k === 'dataset') {
          for (const d in v) el.dataset[d] = v[d];
        } else if (k.startsWith('on') && typeof v === 'function') {
          el.addEventListener(k.slice(2).toLowerCase(), v);
        } else if (k === 'ref' && typeof v === 'function') {
          v(el);
        } else {
          el.setAttribute(k, v === true ? '' : v);
        }
      }
    }

    append(el, children);
    return el;
  }

  function append(el, children) {
    if (children === undefined || children === null || children === false) return;
    if (Array.isArray(children)) { children.forEach(c => append(el, c)); return; }
    if (children instanceof Node) { el.appendChild(children); return; }
    el.appendChild(document.createTextNode(String(children)));
  }

  /** 清空并填入子节点 */
  function mount(el, children) {
    el.textContent = '';
    append(el, children);
    return el;
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return [...(root || document).querySelectorAll(sel)]; }

  /* ---------- 通用小部件 ---------- */

  /** 徽标 */
  function chip(text, kind) {
    return h('span.chip' + (kind ? '.' + kind : ''), text);
  }

  /** 卡片：标题 + 内容 + 右上角附加 */
  function card(title, body, opts) {
    opts = opts || {};
    const head = h('div.ch', [
      h('span', title),
      opts.aside ? (typeof opts.aside === 'string' ? chip(opts.aside) : opts.aside) : null,
    ]);
    const cb = h('div.cb' + (opts.flush ? '.p0' : ''), body);
    return h('div.card', [head, cb]);
  }

  /** 列表行 */
  function row(opts) {
    return h('div.row' + (opts.onclick ? '.tap' : ''), {
      onclick: opts.onclick,
    }, [
      opts.icon ? h('div.ri', opts.icon) : null,
      h('div.rm', [
        h('div.rn', opts.title),
        opts.desc ? h('div.rd', opts.desc) : null,
      ]),
      opts.right ? h('div.rr', opts.right) : null,
      opts.onclick ? h('div.chev', '›') : null,
    ]);
  }

  /** 搜索框 */
  function search(placeholder, oninput) {
    const input = h('input', {
      type: 'search',
      placeholder: placeholder || '搜索',
      autocomplete: 'off',
      oninput: e => oninput && oninput(e.target.value.trim()),
    });
    return {
      el: h('div.search', [h('span.si', '🔍'), input]),
      get value() { return input.value; },
      set value(v) { input.value = v; },
      focus() { input.focus(); },
    };
  }

  /** 分段选择器（难度切换等） */
  function seg(items, current, onchange) {
    const el = h('div.seg', items.map(it =>
      h('div.s' + (it.id === current ? '.on' : ''), {
        onclick: () => {
          $$('.s', el).forEach(s => s.classList.remove('on'));
          const target = el.querySelector('[data-id="' + it.id + '"]');
          if (target) target.classList.add('on');
          onchange && onchange(it.id);
        },
        dataset: { id: it.id },
      }, [
        h('span', it.name),
        it.sub ? h('span.sl', it.sub) : null,
      ])
    ));
    return el;
  }

  /** 空状态 */
  function empty(text, icon) {
    return h('div.empty', [h('div.em', icon || '📭'), h('div', text)]);
  }

  /** 加载中 */
  function loading(text) {
    return h('div.empty', [h('div.em.spin', '⏳'), h('div', text || '加载中…')]);
  }

  /** 错误态 */
  function error(text, retry) {
    return h('div.empty', [
      h('div.em', '⚠️'),
      h('div', text),
      retry ? h('button.b.ghost.mt8', { onclick: retry }, '重试') : null,
    ]);
  }

  /** 键值行 */
  function kv(label, value, cls) {
    return h('div.kv', [
      h('span', label),
      h('b' + (cls ? '.' + cls : ''), value),
    ]);
  }

  /**
   * 物品图标
   * 有游戏原图时用原图，否则回退到 emoji。
   * @param {string} itemId  物品 id，如 "00:01"
   * @param {string} fallback 回退 emoji
   * @param {object} opts  {size: 'sm'|'md'|'lg', box: bool 是否带底板}
   */
  function itemIcon(itemId, fallback, opts) {
    opts = opts || {};
    const url = Data && Data.iconUrl ? Data.iconUrl(itemId) : null;
    const cls = 'iicon' + (opts.size ? '.' + opts.size : '') + (opts.box ? '.boxed' : '');

    if (url) {
      return h('span' + cls, h('img', { src: url, alt: '', draggable: 'false' }));
    }
    return h('span' + cls + '.emoji', fallback || '❔');
  }

  /** 统计小格 */
  function stat(label, value, cls) {
    return h('div.stat', [
      h('div.sk', label),
      h('div.sv' + (cls ? '.' + cls : ''), value),
    ]);
  }

  /**
   * 怪物精灵图
   * 有原图用原图，否则回退 emoji。
   * @param {number|string} monId 怪物编号
   * @param {string} fallback 回退 emoji
   * @param {object} opts {size:'md'|'lg'|'xl', scale:放大倍数}
   */
  function monSprite(monId, fallback, opts) {
    opts = opts || {};
    const url = Data && Data.spriteUrl ? Data.spriteUrl(monId) : null;
    const cls = '.msprite' + (opts.size ? '.' + opts.size : '');
    if (url) {
      return h('span' + cls, h('img', {
        src: url, alt: '', draggable: 'false',
        style: { imageRendering: 'pixelated' },
      }));
    }
    return h('span' + cls + '.emoji', fallback || '👹');
  }

  /* ---------- 格式化 ---------- */
  const fmt = {
    /** 百分比：自动选精度 */
    pct(v) {
      if (v === undefined || v === null || isNaN(v)) return '—';
      if (v >= 10) return v.toFixed(1) + '%';
      if (v >= 1) return v.toFixed(2) + '%';
      if (v >= 0.01) return v.toFixed(3) + '%';
      if (v <= 0) return '0%';
      return v.toFixed(4) + '%';
    },
    /** 约几分之一 */
    oneIn(v) {
      if (!v || v <= 0) return null;
      const n = Math.round(100 / v);
      return '约 1/' + n;
    },
    /** 区间 */
    range(a, b) {
      if (a === b) return String(a);
      return a + '~' + b;
    },
  };

  global.UI = {
    h, mount, $, $$, append,
    chip, card, row, search, seg, empty, loading, error, kv, stat, fmt, itemIcon, monSprite,
  };
})(window);
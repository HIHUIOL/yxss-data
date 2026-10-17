# 英雄史诗初章 · 资料库

2010 年 J2ME 游戏《英雄史诗初章》的数据解包站点：怪物、物品、地图、掉落概率、伤害计算。

纯静态站点，无后端，可直接部署到 GitHub Pages。

---

## 目录结构

```
web/
├── index.html              入口（只有骨架，内容全由 JS 渲染）
├── css/
│   └── style.css           全部样式（设计令牌集中在文件开头）
├── js/
│   ├── core/
│   │   ├── router.js       hash 路由 + 页面注册表
│   │   ├── loader.js       数据集按需加载 + 缓存 + 索引
│   │   ├── ui.js           DOM 构建器 + 通用组件
│   │   └── app.js          应用主壳（自动生成导航/页签）
│   ├── config.js           ★ 站点配置 + 页面注册（扩展入口）
│   └── pages/
│       ├── monster.js      怪物列表 / 详情
│       ├── map.js          地图列表 / 详情
│       └── calc.js         伤害计算器
└── data/                   ★ 构建产物，勿手改
    ├── index.json          数据集清单
    ├── items.json
    ├── monsters.json
    ├── maps.json
    ├── icons.json          物品图标（30 张 PNG + 591 条映射）
    └── sprites.json        怪物精灵（40 个精灵 + 132 条映射）
```

---

## 本地预览

`fetch` 需要 HTTP 环境，**不能直接双击 index.html**。

```bash
cd web
python3 -m http.server 8080
# 打开 http://localhost:8080
```

---

## 加一个新页面（核心用法）

### 1. 写页面模块

新建 `js/pages/quest.js`：

```js
(function (global) {
  const { h, card, row, empty } = UI;

  function renderQuestList(ctx) {
    const quests = Data.get('quests') || {};
    if (!Object.keys(quests).length) return empty('还没有任务数据');

    return h('div', Object.keys(quests).map(k => {
      const q = quests[k];
      return row({
        icon: '📜',
        title: q.name,
        desc: q.steps ? (q.steps.length + ' 步') : '',
        onclick: () => ctx.go('wiki', 'quest-detail', [q.id]),
      });
    }));
  }

  global.Pages = global.Pages || {};
  Pages.renderQuestList = renderQuestList;

  // 声明需要的数据集（框架自动加载）
  Pages.meta = Pages.meta || {};
  Pages.meta['quest'] = { needs: ['quests'] };
})(window);
```

### 2. 注册页面

在 `js/config.js` 里加：

```js
Router.registerPage({
  id: 'quest', group: 'wiki', title: '任务', order: 30,
  homeEntry: { icon: '📜', name: '任务攻略', desc: '主线 · 支线 · 奖励' },
  render: ctx => Pages.renderQuestList(ctx),
});
```

### 3. 引入脚本

`index.html` 里加 `<script src="js/pages/quest.js"></script>`。

**完成。** 底部导航、顶部页签、路由、数据加载全部自动。

---

## 路由

| URL | 页面 |
|---|---|
| `#/` | 首页 |
| `#/wiki/monster` | 怪物列表 |
| `#/wiki/monster-detail/59` | 怪物详情（id=59） |
| `#/wiki/map` | 地图列表 |
| `#/wiki/map-detail/m2/b6.m` | 地图详情（id 含斜杠也支持） |
| `#/tool/calc` | 伤害计算器 |

跳转：
```js
Router.navigate('wiki', 'monster-detail', [59]);
ctx.go('wiki', 'map');        // 页面内简写
Router.back();                // 返回
```

---

## 数据层

### 加载

```js
await Data.need('monsters');          // 加载一个
await Data.need(['items', 'maps']);   // 加载多个
Data.get('monsters');                 // 同步取（未加载返回 null）
Data.loaded;                          // 已加载的数据集名

Data.itemOf('00:01');                 // 按 id 取实体
Data.itemName('00:01');               // 取名字（未加载时返回 id，不报错）
Data.monsterOf(59);
Data.count('monsters');               // 条目数（不加载也能拿到）

// 图标
Data.iconUrl('00:01');                // → data:image/png;base64,... 或 null
Data.iconByCat(0);                    // 按类别取
Data.hasIcons();                      // 是否已加载

// 怪物精灵
Data.spriteUrl(59);                   // 怪物 59 的精灵 data URL
Data.spriteUrlB(59);                  // 动作 B（另一组图）
Data.spriteDirs(59);                  // 可用方向数
Data.hasSprites();
```

### 图标组件

```js
// 有游戏原图用原图，没有则回退 emoji
UI.itemIcon('00:01', '🪓', { size: 'sm', box: false })
```

尺寸：`sm`(18) / `md`(24) / `lg`(34) / `xl`(44)；`box: true` 加底板。
CSS 已设 `image-rendering: pixelated`，像素图放大不模糊。

### 怪物精灵组件

```js
UI.monSprite(59, '👹', { size: 'lg' })
```

尺寸：`sm`(22) / `md`(32) / `lg`(48) / `xl`(64)。无图时回退 emoji。

### 数据格式约定

**物品**（`items.json`）—— 以 `"cat:sub"` 为 key：

```json
{
  "00:01": {
    "id": "00:01", "name": "伐木斧", "cat": 0, "catName": "斧头",
    "icon": "🪓", "sub": 1,
    "level": 5, "price": 500, "quality": 0,
    "dmg": [13, 48], "crit": 12, "defense": null,
    "equip": true, "base7": "000d0030ffff0c"
  }
}
```

**怪物**（`monsters.json`）—— 掉落用物品 id 引用，不重复存名字：

```json
{
  "59": {
    "id": 59, "name": "远古魔像", "baseLv": 40, "boss": false,
    "base": { "atk": 80, "def": 56, "hp": 1330, "hit": 140 },
    "diff": {
      "地狱": {
        "lv": [84, 86], "atk": 168, "def": 117, "hp": 3906, "hit": 306,
        "gold": [131, 134],
        "exp": { "lo": 756, "hi": 2268, "mid": 1512 },
        "drops": [
          ["组0", "n< 655", 0.9995, 7, "00:14", 57, 0.1428]
        ]
      }
    },
    "maps": ["m2/b6.m"]
  }
}
```

`drops` 每项：`[组名, 触发条件, 组概率%, 候选件数, 物品id, 物品等级, 单件概率%]`

**地图**（`maps.json`）：

```json
{
  "m2/b6.m": {
    "id": "m2/b6.m", "name": "神殿 2区", "size": "40x30",
    "mons": [{ "id": 14, "cnt": 5 }, { "id": 59, "cnt": 3 }]
  }
}
```

**图标**（`icons.json`）—— 物品按类别共用图标，共 30 张：

```json
{
  "map": { "00:01": 0, "20:06": 26 },
  "img": ["data:image/png;base64,...", "..."],
  "cat": { "0": 0, "1": 1 }
}
```

来源 `jar_extract/img/it.mpm`（cnt=30），映射规则见源码 `ba.a(dd,...)`。
装备类每个类别 1 张图，消耗品细分 9 张。

**怪物精灵**（`sprites.json`）—— 从 `jar_extract/en/edf` 解出：

```json
{
  "mon": { "59": { "k": 1, "ids": [15,35,38,43,0,0] } },
  "img": { "1:15": ["data:image/png;base64,...", ...] }
}
```

映射规则（源码 `eq.a(byte,short,byte[],byte[],byte[])`）：

```
edf 记录：n = rec[0]; k = rec[n+1]; c = rec[n+4..n+7]; d = rec[n+8..n+13]

d 才是精灵编号（c 不是！）

k == 0 → /en/{方向 0~3}/{d[i]:02d}     只用 d[0..3]，四个转向方向
k != 0 → /en/{d[i]:02d}                根目录，多帧动画
```

> ⚠️ `en/4`、`en/5` **不是方向**，是另外两套图集（武器/特效）。
> 若按 `range(6)` 遍历会取错图（木乃伊领主曾因此显示成武器）。

共 56 组精灵覆盖 132 只怪物（重名怪共用）。

> ⚠️ **本映射尚未经人工逐只验收**，可能有错，见 `.ai-memory/` 待办。

---

## 构建数据

数据由 `工具/构建web数据.py` 从源数据生成：

```bash
python3 工具/构建web数据.py           # 全量（items + monsters + maps）
python3 工具/构建web数据.py monsters  # 只重建怪物
python3 工具/构建图标数据.py          # 物品图标
python3 工具/构建怪物精灵.py          # 怪物精灵
```

数据源：
- `数据翻译/怪物掉落表.csv` → monsters / maps
- `游戏清单/全部物品清单.md` → items
- `jar_extract/img/it.mpm` → icons
- `jar_extract/en/edf` + `en/{0..5}/*.mpm` → sprites

---

## 开发约定

1. **不用 innerHTML 拼字符串**，一律用 `UI.h()`。自动转义，防 XSS。
2. **样式不进 JS**，写进 `style.css` 的类。
3. **页面只负责渲染**，数据加载交给 `Pages.meta[页id].needs`。
4. **改主题只改 `style.css` 开头的设计令牌**，支持 `data-theme="light"`。

---

## 部署到 GitHub Pages

站点是纯静态的，整份 `web/` 目录推到仓库即可。

若部署在子路径（如 `user.github.io/repo/`），本项目所有引用都是**相对路径**，无需额外配置。

---

## 数据来源

游戏《英雄史诗初章》（2010，J2ME）。所有数据由反编译源码逐行解析得出，掉落概率经真机实测校验。

仅供学习交流。

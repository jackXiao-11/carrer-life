# Career Life 维护手册

> 本手册面向未来的自己。改代码前先看这里，能少走很多弯路。

## 一、项目是什么

静态网页 + Cloudflare 无服务器后端的个人成长应用：

```
浏览器（HTML/CSS/JS，无构建步骤）
    ↓ fetch
Cloudflare Pages Functions（functions/api/ 目录）
    ↓
D1 数据库（SQLite）—— 账号、修为、好友、文件
+ Workers AI —— 聊天、单词验收出题
+ localStorage —— 未登录用户的任务数据
```

## 二、文件地图

### 前端

| 文件 | 职责 | 改动频率 |
|---|---|---|
| `index.html` | 页面结构 + **内联样式**（新功能的 CSS 都在底部 `<style>`） | 高 |
| `script.js` | 全部交互逻辑，按 17 个分区横幅组织 | 高 |
| `styles.css` / `ui.css` | 早期基础样式 | 低 |
| `bento.css` | 紫蓝主题（最后加载，优先级最高） | 低 |
| `assets/vendor/` | 本地图标/Markdown 库，不走 CDN | 不动 |

### 后端（functions/api/）

| 文件 | 接口 | 说明 |
|---|---|---|
| `_lib.js` | — | 会话、Cookie、密码哈希、JSON 工具 |
| `_levels.js` | — | **等级表、经验值常量**（改数值看这里） |
| `_profile.js` | — | 修为档案、签到、发经验 |
| `auth/*` | `/api/auth/*` | 注册/登录/登出/会话 |
| `data.js` | `/api/data` | 任务记录云同步（GET/PUT） |
| `profile.js` | `/api/profile` | 道号、头像、修为查询 |
| `profile/checkin.js` | `/api/profile/checkin` | 每日签到 |
| `profile/task-xp.js` | `/api/profile/task-xp` | 任务经验（每日 5 次上限） |
| `friends.js` + `friends/respond.js` | `/api/friends*` | 好友申请/列表/处理 |
| `collab.js` + `collab/[id].js` | `/api/collab*` | 协作任务（完成时双方得经验） |
| `leaderboard.js` | `/api/leaderboard` | 广场前十 |
| `files.js` + `files/[id]*` | `/api/files*` | 云存储（上传/列表/下载/删除） |
| `chat.js` | `/api/chat` | AI 聊天（DeepSeek 免费层） |

### 数据库（migrations/）

| 表 | 用途 |
|---|---|
| `accounts` | 邮箱 + 密码哈希（PBKDF2，**上限 10 万次迭代**） |
| `sessions` | 登录令牌（只存哈希，30 天） |
| `user_data` | 每人一行 JSON：任务+记录+单词本 |
| `profiles` | 道号、头像、经验、签到、站长特权 |
| `friendships` | 好友关系（pending/accepted） |
| `collab_tasks` | 协作任务 |
| `files` + `file_chunks` | 云存储：元数据 + base64 分片（700KB/片） |

## 三、核心规则（改数值的位置）

| 规则 | 数值 | 在哪改 |
|---|---|---|
| 等级境界 | 10 级：凡人→渡劫飞升 | `_levels.js` 的 `LEVELS` + `script.js` 的 `CULTIVATION_LEVELS`（**两处保持一致**） |
| 签到经验 | +10 | `_levels.js` 的 `CHECKIN_XP` |
| 任务经验 | +10（协作 +15，每日前 5 次） | `_levels.js` 的 `TASK_XP`/`COLLAB_XP`/`DAILY_TASK_XP_LIMIT` |
| 云存储配额 | 站长 3GB；普通 = 等级×100MB | `files.js` 顶部常量 |
| 全站总闸 | 普通用户合计 2GB（D1 免费 5GB） | `files.js` 的 `NON_ADMIN_GLOBAL_CAP` |
| 存储资格 | Lv.3 + 14 天内有签到 | `files.js` 的 `storageEligibility()` |
| 站长邮箱 | 2435726542@qq.com | `files.js` + `leaderboard.js` 的 `ADMIN_EMAIL`（**两处**） |
| 单文件上限 | 5MB | `files.js` 的 `MAX_FILE_SIZE` |

## 四、常见维护任务

### 怎么部署上线？

```bash
cd 项目目录
CLOUDFLARE_API_TOKEN=你的令牌 npx wrangler pages deploy . \
  --project-name career-life --branch main --commit-dirty=true
```

- 数据库变更先跑：`npx wrangler d1 execute career-life-db --remote --file migrations/XXXX.sql -y`
- **改了 script.js 必须同时改 index.html 里的 `?v=` 版本号**，否则用户浏览器用旧缓存！

### 怎么加一个新页面（视图）？

1. `index.html` 加 `<section class="view" id="xxx-view">`；
2. `script.js` 的 `viewTitles` 加标题；`switchView` 里的面包屑/副标题映射加一项（次页会自动获得"右滑回主页"的导航行为）；
3. 需要入口的话：侧栏 `main-nav` 加按钮 `data-view="xxx"`，手机端 5 列布局已自适应。

### 怎么给任务加字段？

1. `openTaskDialog`/`saveTask` 读写新字段；
2. `taskTemplate`/`planTemplate` 展示；
3. 云同步无需改动——`/api/data` 存整个 state 对象，新字段自动带上。

### 怎么调 UI？

- **新功能样式**：加在 `index.html` 底部内联 `<style>`（加载最晚，优先级最高）；
- 手机端样式用 `@media(max-width:767px){}` 包裹，桌面样式不要动；
- 图标用 `<i data-lucide="名字"></i>`，动态插入后记得调 `refreshIcons()`。

## 五、踩过的坑（血泪经验）

1. **PBKDF2 迭代上限 10 万**：Cloudflare Workers 超过直接抛异常（错误 1101）。
2. **lucide 会把 `<i>` 替换成 `<svg>`**：JS 里保存的元素引用会失效，隐藏图标要用父级 class + CSS 选择器，不要 `元素.style.display`。
3. **import 路径**：`functions/api/xxx/yyy.js` 引 `_lib.js` 用 `../_lib.js`（一级目录一个 `../`），路径错了 esbuild 部署时报错但 `node --check` 查不出来。
4. **D1 免费层 5GB 是全站总量**：文件分片 + 所有业务表都算，普通用户总闸 2GB 就是为此留的余量。
5. **手机右滑 = 浏览器后退**：视图切换用 pushState/replaceState 控制历史栈（见 `switchView`），不要直接 `location.hash=xxx`。
6. **登录弹窗面板**：`#account-logged-in` 在 form 外，样式要单独写，不然没有内边距。
7. **AI 出题要 30 秒左右**：DeepSeek 免费层较慢，界面要有"正在出题"状态，解析 JSON 要容错（去 ``` 代码块、截取首尾大括号）。

## 六、测试清单（改完必跑）

```bash
node --check script.js                     # 语法
node --check functions/api/xxx/*.js        # 后端语法（每个文件）
```

部署后线上冒烟：
1. 打开网站能加载、登录正常；
2. 勾一个任务 → 弹验收 → 通过后经验 +10；
3. 广场排行榜有数据；
4. 我的文件库：上传 → 下载 → 删除。

## 七、Git 历史（重要节点）

| 提交 | 内容 |
|---|---|
| `b6c769d` | 账号系统存档点 |
| `0ccabd2` | 修复 PBKDF2 迭代上限 |
| `382079a` | 修仙等级 + 签到 + 好友 + 协作 + 排行榜 |
| `05c49a7` | 头像 + 领奖台 + 统计图表 |
| `ca26918` | 任务验收 + AI 抽查 + 单词本 |
| `cee711d` | D1 云存储 |
| `9a58366` | 站长 3GB 特权 |
| `54569f5` | Lv3 门槛 + 两周断签冻结 |

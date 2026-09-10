# Career Life：工作与学习计划

“Career Life”是一个适合前端初学者边使用、边学习的静态网页项目。它可以记录日常工作，并分别管理软件学习和英语学习计划。

## 目前能做什么

- 添加、编辑、完成和删除任务
- 按工作、软件、英语筛选任务
- 统计当天任务数、完成数和学习时间
- 分别查看软件与英语学习计划
- 保存工作主题、过程和结果
- 自动适配电脑和手机屏幕
- 自动把数据保存在当前浏览器中
- 使用 DeepSeek 或 Codex AI 助手回答学习与工作问题
- AI 回复采用流式传输，生成一段显示一段，并可以随时停止
- 右下角悬浮 AI 聊天窗，可收起、放大；手机打开后全屏显示
- 按模型分别保存最近 100 条聊天记录和未发送草稿，支持失败重试
- 安全显示 Markdown、列表、代码块和表格，并可复制完整回复
- 本周已完成学习时间统计，以及下一项任务的 AI 拆解入口

## 2026-09-09 紫蓝便当工作台

`index.html` 最后加载 `bento.css`，使用紫蓝主题、圆角卡片和轻毛玻璃导航。桌面侧栏宽 248px，768–1023px 为 80px 图标导航，小于 768px 使用底部导航与全屏 AI。任务和表单控件保留原生键盘操作，点击范围至少 44px，支持减少动态效果与高对比度模式。

进度环和进度条由当天真实任务完成数驱动。本周节奏中的七个日期按钮可查看当天任务，并从该日期列表编辑任务；今日任务列表始终展示今天。版权区采用品牌与权利人双栏，仍以庞潇署名。

本次更新使用原有数据存储；新访客默认空任务。`bento.css` 替代首页的 `editorial.css` 样式引用，旧文件留在项目中供历史版本参考。后续更新继续使用下方的固定生产发布脚本。

## 2026-09 基础界面更新

工作台采用浅色侧栏、蓝色操作按钮、按任务分类的辅助色和更清晰的分区。按钮具备悬停、按压和键盘焦点反馈，并尊重系统的减少动态效果设置。图标、Markdown 库与学习图片现已保存在 `assets/`，页面无需从外部 CDN 加载这些资源。

AI 助手在任意页面均可打开；收起时继续接收当前回复，完成后入口显示未读标记。Esc 收起悬窗；中文输入法确认候选字不会误发消息。点击“和 AI 拆解任务”只把任务标题和预计时间放进输入框，确认发送后才请求 AI。

任务和记录仍使用原来的 `career-life-v1` 存储，不改变已有数据；聊天单独使用 `career-life-chat-v1`。不同网址的浏览器数据相互独立，本地预览不会自动显示线上网址的数据。清理站点数据会一并清除本地聊天记录。

AI 仍使用现有 `/api/chat` 接口。DeepSeek 的可用性取决于 Cloudflare；Codex 需要原有服务端变量配置。界面更新本身不会配置或更换 AI 模型，也不会自动部署到线上。

## AI 助手

页面中的“AI 助手”有两个可选模型：

| 选项 | 服务来源 | 当前规则 |
|---|---|---|
| DeepSeek 免费层 | Cloudflare Workers AI | 使用 Cloudflare 账户的免费层额度，不代表永久或无限免费 |
| Codex | OpenAI Responses API | 需要站点管理员配置 OpenAI API Key 和具体模型，会按 OpenAI 账户规则计费 |

浏览器不会直接接触任何 API Key。聊天请求先发送到同一网站的 `/api/chat`，再由 Cloudflare Pages Function 调用 AI 服务：

```text
浏览器中的 AI 助手
        ↓
Cloudflare /api/chat
        ├── DeepSeek -> Workers AI
        └── Codex    -> OpenAI Responses API
```

接口限制每次最多携带 12 条消息、每条最多 4000 字符，并按访问地址做基础频率限制。这个限制只能防止普通误用；正式开放付费模型前，仍应增加用户登录、每用户额度和更可靠的持久化限流。

## 在线版的数据规则

网站公开后，任何人都可以访问和使用，但每个人的数据相互独立：

```text
访问者 A 的浏览器 -> A 的任务和工作记录
访问者 B 的浏览器 -> B 的任务和工作记录
你的浏览器       -> 你的任务和工作记录
```

这是因为当前项目使用浏览器的 `localStorage` 保存数据，没有数据库和用户账号。

- 优点：免费、简单，不需要登录，访问者的数据不会上传到服务器。
- 限制：换浏览器、清理网站数据或更换设备后，原数据不会自动同步。
- 网站代码只有仓库所有者能更新；访问者在页面里添加任务只会改变自己的浏览器数据。

现在已经提供可选账户和跨设备同步接口。未注册用户继续只使用浏览器 `localStorage`；注册并登录后，页面可以把任务和工作记录同步到自己的 D1 数据行，其他用户无法读取。账户接口位于 `/api/auth/register`、`/api/auth/login`、`/api/auth/logout` 和 `/api/auth/me`，同步接口位于 `/api/data`。

部署账户功能前，需要在 Cloudflare Pages 项目创建 D1 数据库，并在 `wrangler.toml` 中填写 `DB` 绑定（示例已注释），然后执行 `migrations/0001_accounts.sql`。没有配置 `DB` 时，匿名本地模式仍可用，账户接口会返回“账户服务尚未配置”。微信和 QQ 登录需要各自平台的应用资质、回调地址和服务端密钥，当前未伪造第三方授权流程。

Codex 需要在 Cloudflare 项目中安全配置两个服务端变量：

- `OPENAI_API_KEY`：OpenAI API Key，必须保存为 Secret，不要写入代码或发到聊天中。
- `OPENAI_MODEL`：你的 OpenAI 账户实际可用、并适合当前用途的 Codex 模型名称。

只有配置完整时 Codex 选项才会调用付费 API；没有配置时页面会明确显示“Codex 尚未启用”。

## 项目结构

```text
outputs/
├── index.html       页面内容和语义结构
├── styles.css       颜色、间距、布局和手机适配
├── ui.css           新版工作台、悬浮窗和交互状态样式
├── assets/          本地图标库、Markdown 库和学习图片
├── script.js        页面交互、数据计算和本地保存
├── functions/       Cloudflare 服务端接口，负责安全调用 AI
├── wrangler.toml    Cloudflare Pages 与 Workers AI 配置
├── README.md        项目说明与学习路线
├── .nojekyll        兼容将来可能使用的 GitHub Pages
├── .gitignore       排除不需要上传的本机文件
└── career-life.desktop  Ubuntu 本机的一键启动器，不上传
```

浏览器加载顺序：

```text
index.html
   ├── 加载 styles.css  -> 页面变得美观并适配屏幕
   └── 加载 script.js   -> 页面可以点击、计算和保存数据
```

一次“添加任务”的数据流程：

```text
用户点击“添加任务”
        ↓
JavaScript 打开表单
        ↓
用户填写并提交
        ↓
JavaScript 生成任务对象
        ↓
保存到 localStorage
        ↓
重新渲染任务列表和进度
```

## 三个文件分别学什么

### 1. `index.html`：网页的结构

先理解这些标签：

- `<header>`：页面或区域的头部
- `<nav>`：导航区域
- `<main>`：主要内容
- `<section>`：一组有关联的内容
- `<form>`：表单
- `<input>`、`<select>`、`<textarea>`：输入控件
- `<button>`：操作按钮
- `<dialog>`：添加和编辑任务的对话框
- `id`：一个元素的唯一名字
- `class`：一组元素共用的样式名字
- `data-*`：供 JavaScript 读取的自定义信息

学习目标：能指出页面中“今日”“学习计划”“工作记录”分别对应哪段 HTML。

### 2. `styles.css`：网页的外观

优先理解：

- CSS 选择器：`.task-item`、`#view-title`
- 盒模型：`margin`、`padding`、`border`
- 颜色变量：`:root` 中的 `--accent` 等变量
- Flexbox：横向排列导航、标题和按钮
- Grid：页面主体、统计区和学习计划布局
- 响应式设计：`@media` 根据屏幕宽度改变布局
- 状态样式：`:hover`、`:focus-visible`、`.is-active`

学习目标：能自己修改主色、间距、字号和手机布局。

### 3. `script.js`：网页的行为

优先理解：

- `const` 和 `let`：保存数据或状态
- 对象与数组：任务和工作记录的数据结构
- 函数：把一项功能组织起来
- DOM 查询：`document.querySelector()`
- 事件：`addEventListener()`
- 条件判断：`if`
- 数组处理：`find()`、`filter()`、`map()`、`sort()`
- 模板字符串：根据数据生成 HTML
- 表单数据：`FormData`
- JSON：把 JavaScript 数据变成可保存的文本
- `localStorage`：把数据保存在浏览器

学习目标：能解释从点击按钮到任务出现在列表中的完整过程。

## 重要数据结构

一个任务在 JavaScript 中大致是：

```js
{
  id: "唯一编号",
  title: "理解 ROS 2 Node 与 Topic",
  category: "software",
  date: "2026-09-03",
  minutes: 45,
  notes: "能够说清发布者和订阅者的关系",
  completed: false
}
```

一个工作记录大致是：

```js
{
  id: "唯一编号",
  date: "2026-09-03",
  title: "排查视觉服务 CPU 占用",
  details: "检查进程、日志并确认原因"
}
```

## 本地运行

最简单的方式是直接双击 `index.html`，或者在 Ubuntu 终端执行：

```bash
xdg-open index.html
```

更接近真实网站的方式是在当前目录启动本地服务器：

```bash
python3 -m http.server 8000
```

然后访问：

```text
http://localhost:8000
```

按 `Ctrl + C` 停止本地服务器。

## 先认识 Git 和 GitHub

Git 和 GitHub 不是同一个东西：

| 名称 | 它是什么 | 主要用途 |
|---|---|---|
| Git | 安装在电脑里的版本管理工具 | 记录代码每一次修改，并允许查看或恢复历史版本 |
| GitHub | 存放 Git 仓库的网站 | 备份代码、多人协作、公开作品和发布网页 |

可以这样理解：

```text
项目文件 = 正在写的作业
Git 提交 = 给当前作业拍一张可恢复的快照
GitHub   = 把这些快照保存到网上
Pages    = 把仓库里的网页发布成公开网址
```

### Git 的四个位置

```text
工作区          暂存区          本地仓库          GitHub 远程仓库
修改文件  ->  git add  ->  git commit  ->  git push
```

- 工作区：你正在修改的 `index.html`、`styles.css`、`script.js`。
- 暂存区：你选择要放进下一次提交的修改。
- 本地仓库：保存在当前电脑中的提交历史。
- 远程仓库：保存在 GitHub 上的提交历史。

### 这个项目会用到的概念

- 仓库（Repository）：一个由 Git 管理的项目目录。
- 提交（Commit）：一次有说明文字的代码快照。
- 分支（Branch）：一条独立的开发线。本项目先只使用 `main`。
- 远程仓库（Remote）：本地仓库对应的 GitHub 仓库，通常叫 `origin`。
- 推送（Push）：把本地提交上传到 GitHub。
- 拉取（Pull）：把 GitHub 上的新提交下载并合并到本地。
- 克隆（Clone）：第一次把一个 GitHub 仓库完整下载到电脑。
- `README.md`：GitHub 仓库首页展示的项目说明文档。
- GitHub Pages：把仓库中的静态网页发布为公开网站的服务。

### 常用 Git 命令

查看当前修改：

```bash
git status
```

查看具体改了什么：

```bash
git diff
```

选择本次要提交的全部修改：

```bash
git add .
```

创建一次提交：

```bash
git commit -m "增加任务筛选功能"
```

查看简洁的提交历史：

```bash
git log --oneline
```

把本地提交上传到 GitHub：

```bash
git push
```

从 GitHub 获取最新修改：

```bash
git pull
```

查看本地连接的远程仓库：

```bash
git remote -v
```

### 提交说明怎么写

提交说明要描述“这一次完成了什么”，例如：

```text
增加英语任务分类
修复手机端导航拥挤问题
补充项目学习文档
```

不要使用过于模糊的说明：

```text
修改
更新
test
```

### GitHub 权限怎么理解

创建仓库时可以选择：

- Public：任何人都能查看代码，适合作品和 GitHub Pages。
- Private：只有获得权限的人能查看代码。

公开仓库不代表任何人都能修改它。普通访问者只能浏览；只有仓库所有者和被授权的协作者才能直接推送代码。

注意不要提交密码、Token、API Key、公司内部地址或客户数据。提交到 Git 后，即使后来从文件中删除，敏感内容仍可能留在历史记录里。

### Git 的安全练习顺序

1. 每次修改前运行 `git status`。
2. 修改一个小功能并在浏览器中测试。
3. 用 `git diff` 检查修改内容。
4. 用 `git add .` 放入暂存区。
5. 用 `git status` 再确认一次暂存内容。
6. 用 `git commit -m "说明"` 创建本地快照。
7. 用 `git push` 更新 GitHub 和在线网站。

## 当前发布架构：公共 Cloudflare Pages

Career Life 已经发布到 Cloudflare Pages：

```text
https://career-life-1gj.pages.dev
```

这是 Career Life 的**固定正式网址**。Cloudflare Pages 每次发布可能会生成带随机 ID 的预览网址；预览地址只用于检查，不要作为日常入口分享。以后更新继续发布到 `career-life` 项目的 `main` 分支，正式网址会保持不变。

当前数据流：

```text
你的电脑 -> Wrangler 上传网页 -> Cloudflare Pages -> 用户通过 HTTPS 访问
```

- Cloudflare Pages 负责托管 HTML、CSS 和 JavaScript。
- 访客不需要 Cloudflare 或 GitHub 账号。
- 当前任务和记录仍保存在访客自己的浏览器中，不会在设备之间同步。
- 下一阶段接入 Supabase Auth 和数据库后，访客可以在 Career Life 内注册并同步数据。
- GitHub 私人仓库接通后，可以再配置为每次 `git push` 自动发布。

### 第一次发布到 Cloudflare Pages

项目已经通过 Wrangler 创建并发布，Pages 项目名为 `career-life`，正式域名为：

```text
https://career-life-1gj.pages.dev
```

### 以后怎样更新在线网站

修改并测试代码后，在项目目录运行固定发布脚本：

```bash
./deploy-career-life.sh "说明这次更新"
```

它固定使用项目名 `career-life` 和生产分支 `main`。也可以手动执行：

```bash
wrangler pages deploy . --project-name career-life --branch main --commit-message "描述这次修改" --commit-dirty=true
```

数据流如下：

```text
修改本地文件 -> 本地测试 -> 固定发布脚本 -> Cloudflare Pages 生产分支 -> 固定网址
```

访问者只能使用网站，无法执行你的 `git push`，也无法修改 GitHub 私人仓库。

### Cloudflare Pages 与 GitHub Pages 的区别

| 方案 | 源代码仓库 | 网站访问 | 适合当前需求 |
|---|---|---|---|
| 私人 GitHub + Cloudflare Pages | 私人 | 公开 | 是 |
| 公开 GitHub + GitHub Pages | 公开 | 公开 | 以后愿意公开源代码时使用 |

GitHub Free 的 GitHub Pages 通常用于公开仓库。如果希望仓库保持私人、网站仍能公开，Cloudflare Pages 更直接。

## 备选方案：仓库公开后使用 GitHub Pages

### 第一次发布

1. 登录 GitHub，创建一个新的公共仓库，例如 `career-life`。
2. 不要在创建页面勾选自动生成 README，因为本项目已经包含 README。
3. 在本项目目录执行 GitHub 给出的仓库连接命令。
4. 把代码提交并推送到 `main` 分支。
5. 打开仓库的 `Settings -> Pages`。
6. 在 `Build and deployment` 中选择 `Deploy from a branch`。
7. 分支选择 `main`，目录选择 `/ (root)`，点击保存。

首次发布通常需要等待几分钟。网址一般是：

```text
https://你的GitHub用户名.github.io/career-life/
```

### 以后更新 GitHub Pages 网站

修改并测试代码后，在项目目录执行：

```bash
git status
git add .
git commit -m "描述这次修改"
git push
```

推送成功后，GitHub Pages 会自动更新网站。访问者只能浏览和使用网页，不能执行你的 `git push`。

## 推荐学习顺序

不要先看完整的 `script.js`。每一阶段只修改一个很小的地方，并马上在浏览器中观察结果。

### 第 1 周：HTML 基础

1. 找到页面的标题、导航、按钮和表单。
2. 修改一段显示文字。
3. 给“今日”页面增加一句自己的说明。
4. 学习标签嵌套、`class` 和 `id`。

### 第 2 周：CSS 基础

1. 修改 `:root` 中的主色 `--accent`。
2. 修改任务列表的间距。
3. 理解 Flexbox 和 Grid 的区别。
4. 查看 `@media (max-width: 620px)` 如何适配手机。

### 第 3 周：JavaScript 基础

1. 学习变量、数组、对象、函数和判断。
2. 在浏览器控制台创建一个简单任务对象。
3. 读懂 `categoryLabels` 和 `viewTitles`。
4. 读懂 `getLocalDate()` 和 `formatDate()`。

### 第 4 周：页面交互

1. 读懂 `bindEvents()` 如何监听点击。
2. 读懂 `switchView()` 如何切换页面。
3. 读懂 `saveTask()` 如何获取表单内容。
4. 读懂 `renderTodayTasks()` 如何筛选任务。

### 第 5 周：数据保存

1. 学习 JSON 的用途。
2. 读懂 `persist()` 和 `loadState()`。
3. 在浏览器开发者工具中查看 Local Storage。
4. 给项目增加“导出数据”和“导入数据”功能。

### 第 6 周：Git 与上线

1. 理解工作区、暂存区和提交。
2. 学会 `status`、`add`、`commit`、`push`。
3. 把私人 GitHub 仓库连接到 Cloudflare Pages。
4. 修改一个小功能并观察网站自动更新。

### 第 7～8 周：下一阶段

先选择一个方向：

- 继续前端：学习模块化、请求 API、React。
- 结合 ROS 2：用 FastAPI 提供机器人状态接口，网页读取接口并展示。
- 做多人系统：学习后端、数据库、注册登录和权限控制。

推荐你的下一项目阶段是：

```text
静态任务网页
    ↓
FastAPI 后端
    ↓
读取 ROS 2 节点和机器人状态
    ↓
网页显示真实 CPU、内存、服务和 Topic 状态
```

## 每次开发的固定流程

```text
明确一个小需求
    ↓
只修改相关文件
    ↓
刷新浏览器测试
    ↓
检查电脑和手机布局
    ↓
提交 Git
    ↓
推送并检查在线网站
```

## 常见问题

### 为什么本地记录没有出现在在线网站？

本地文件和 Cloudflare Pages 网站是两个不同的网址，各自有独立的 `localStorage`。网站上线后，需要在在线网址中重新添加数据。

### 别人能修改我的网站代码吗？

不能。其他人可以在自己的浏览器里添加任务，但只有拥有 GitHub 仓库写入权限的人才能更新网站代码。

### 为什么清理浏览器后数据消失？

当前没有服务器数据库，数据只存在浏览器的本地存储中。重要内容应在后续加入导出功能，或者升级到数据库版本。

### 修改后为什么在线网站没有马上变化？

先确认代码已成功上传，再到 Cloudflare Pages 查看部署状态。浏览器缓存也可能导致旧页面仍然显示，可以强制刷新页面。

## 学习原则

- 不要背完整代码，先理解数据从哪里来、经过哪个函数、最后显示到哪里。
- 每次只改一个小功能，修改后立即测试。
- 遇到错误先读浏览器控制台中的第一条报错。
- 把每个问题和解决方法写进“工作记录”，它会逐渐成为你的研发经验库。

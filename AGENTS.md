# 项目说明

## 项目定位

这是一个 Chrome/Edge 浏览器扩展，使用 Manifest V3。扩展名称为 `关闭页面_定时`，主要用途是自动处理指定域名页面：

- 在目标站点页面上显示倒计时，并在随机秒数后关闭标签页。
- 发现指定保护 iframe 时停止关闭逻辑、播放提示音，并清理相关自动打开页面的定时器。
- 在页面右上角注入「停止插件」和「暂停打开」按钮，方便直接从网页中控制扩展行为。
- 弹窗页提供启动、停止、目标域名和关闭时间范围配置。

当前默认目标域名是 `h5.ele.me`，默认保护 iframe 选择器是 `#baxia-dialog-content`。

## 文件结构

| 文件 | 作用 |
| --- | --- |
| `manifest.json` | 扩展清单文件，声明 Manifest V3、权限、后台 service worker、弹窗和图标。 |
| `background.js` | 当前实际生效的后台脚本，是扩展的核心逻辑入口。 |
| `popup.html` | 扩展弹窗页面，包含状态栏、启动/停止按钮、目标域名和关闭时间输入框。 |
| `popup.js` | 弹窗交互逻辑，负责读取状态、保存配置、发送启动/停止消息。 |
| `background 0525.js` | 历史版本后台脚本，包含较早的暂停 Auto Open、停止按钮和 iframe 检测实现。 |
| `background_old.js` | 更早的后台脚本备份，实现基础倒计时关闭、iframe 告警和弹窗通信。 |
| `icon.png` | 默认扩展图标。 |
| `icon_on.png` | 运行状态图标。 |
| `icon_off.png` | 停止状态图标。 |
| `AGENTS.md` | 本文件，记录项目上下文和维护注意事项。 |

## 运行方式

项目没有 `package.json`、构建脚本或依赖管理文件，当前形态是原生浏览器扩展源码。

常见调试方式：

1. 打开 Chrome 或 Edge 的扩展管理页面。
2. 开启开发者模式。
3. 选择“加载已解压的扩展”。
4. 选择当前项目目录。
5. 修改代码后，在扩展管理页重新加载扩展。

## Manifest 配置

`manifest.json` 当前配置要点：

- `manifest_version`: `3`
- `background.service_worker`: `background.js`
- `action.default_popup`: `popup.html`
- 权限：
  - `tabs`
  - `storage`
  - `scripting`
  - `background`
- `host_permissions`: `<all_urls>`

扩展需要 `tabs` 和 `scripting` 来扫描标签页并向页面注入按钮、倒计时和检测代码；需要 `storage` 保存配置和运行状态。

## 核心流程

### 启动

弹窗点击「启动」后，`popup.js` 会先保存配置，再向后台发送 `{ type: "start" }`。

`background.js` 收到后会：

- 设置 `isRunning = true`。
- 写入 `chrome.storage.local`。
- 切换运行图标和徽标文字。
- 启动周期性 iframe 告警检测。
- 扫描所有已打开标签页。

### 停止

弹窗或页面注入按钮发送 `{ type: "stop" }` 后，后台会：

- 设置 `isRunning = false`。
- 更新图标和徽标文字。
- 停止全局告警检测定时器。
- 清理每个标签页的关闭定时器和检测定时器。
- 移除页面里的「停止插件」按钮。
- 保留「暂停打开」按钮。

### 标签页处理

`processTab(tabId, tab)` 是主要页面处理函数。

处理逻辑：

- 如果页面 host 匹配配置的目标域名，注入「停止插件」和「暂停打开」按钮。
- 如果页面标题以 `Auto Open` 开头，注入「暂停打开」按钮。
- 只有目标域名页面会检测 `protectedIframe`。
- 如果检测到保护 iframe：
  - 不关闭页面。
  - 进入 `alertOnly` 状态。
  - 播放提示音。
  - 清理所有标题以 `Auto Open` 开头页面里的定时器。
- 如果没有保护 iframe：
  - 按 `minTime` 到 `maxTime` 之间的随机秒数注入倒计时。
  - 到时关闭当前标签页。
  - 每秒重新检测保护 iframe，若中途出现则取消关闭并告警。

### Auto Open 页面处理

项目里把标题以 `Auto Open` 开头的标签页视为自动打开页面。

「暂停打开」按钮会发送 `{ type: "clearAutoOpenTimers" }`，后台会遍历所有标签页，对标题以 `Auto Open` 开头的页面注入脚本，循环清理大量 timeout 和 interval：

```js
for (let i = 0; i < 65536; i++) {
    clearTimeout(i);
    clearInterval(i);
}
```

这个逻辑用于停止相关页面继续自动打开新页面。

## 配置规则

当前默认配置在 `background.js` 的 `DEFAULT_CONFIG` 中：

```js
{
    targetDomains: ["h5.ele.me"],
    minTime: 8,
    maxTime: 12,
    protectedIframe: "#baxia-dialog-content"
}
```

配置会通过 `sanitizeConfig` 规整：

- 域名会转小写、去掉协议、路径、端口、通配前缀和多余点号。
- `minTime` 和 `maxTime` 必须是正整数。
- 如果最小值大于最大值，会自动交换。
- 目标域名会去重。
- 没有有效目标域名时回退到默认域名。

注意：`popup.js` 中保存配置时，`protectedIframe` 固定写为 `#baxia-dialog-content`，弹窗没有提供修改此选择器的输入项。

## 页面注入元素

`background.js` 会向页面注入以下元素：

- `#stop-btn`：红色「停止插件」按钮，固定在右上角，用于停止整个扩展。
- `#pause-auto-open-btn`：蓝色「暂停打开」按钮，用于清理 Auto Open 页面的定时器。
- `#cd-box`：紫色倒计时提示框，显示 `将关闭：N秒`。

这些元素使用很高的 `z-index`，位置固定在页面右上角。

## 状态与定时器

后台脚本维护以下运行时状态：

- `isRunning`：扩展当前是否运行。
- `config`：当前配置。
- `tabTimers`：按 tabId 保存每个页面的关闭定时器、iframe 检测定时器或 `alertOnly` 状态。
- `alertCheckTimer`：全局 iframe 告警轮询定时器。

当前 `background.js` 初始化时会读取已保存配置，但会强制 `isRunning = false`，不会沿用上次运行状态。

## 告警声音

`playBeep()` 优先尝试在后台脚本中使用 `AudioContext` 播放 920Hz、0.25 秒的提示音。

如果后台播放失败，会降级为寻找任意非 `chrome://`、非 `edge://` 的有效标签页，向该页面注入播放声音的脚本。

## 历史脚本差异

`background_old.js` 是较早的基础版本：

- 默认关闭时间是 8 到 11 秒。
- 目标域名匹配使用 `host.includes(d)`。
- iframe 告警只播放声音，不清理 Auto Open 页面定时器。
- 没有当前版本的配置清洗逻辑。

`background 0525.js` 是中间版本：

- 默认关闭时间是 10 到 15 秒。
- 增加了 Auto Open 页面「暂停打开」按钮。
- 增加了页面「停止」按钮。
- 增加了懒加载 iframe 的每秒检测。
- 还没有当前版本里更完整的域名标准化、统一按钮位置和全局清理 Auto Open 定时器逻辑。

当前实际被 `manifest.json` 加载的是 `background.js`。

## 维护注意事项

- 项目文件应按 UTF-8 读取和保存，否则中文注释和界面文案容易显示为乱码。
- 修改后台逻辑后，需要在浏览器扩展管理页重新加载扩展。
- `background.js` 是 service worker 环境，不要假设它能像普通页面一样长期常驻。
- 页面注入脚本可能因为特殊页面、浏览器内置页面或权限限制失败，当前代码多数地方使用 `.catch(() => {})` 静默忽略。
- 修改目标域名匹配逻辑时，优先保留 `normalizeDomain`、`sanitizeConfig` 和 `isTargetHost` 的组合，避免误匹配。
- 修改关闭逻辑时，要同时考虑 `closeTimer`、`checkInterval`、`alertOnly` 三类状态。
- 修改页面注入 UI 时，注意不要让「停止插件」「暂停打开」和倒计时框相互重叠。
- 如果要把 `protectedIframe` 做成可配置项，需要同步修改 `popup.html` 和 `popup.js`。
- 当前项目没有自动化测试；验证主要依赖在浏览器中手动加载扩展并观察目标页面行为。

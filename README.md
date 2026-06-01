# 关闭页面_定时 / Timed Page Closer

一个 Chrome / Edge 浏览器扩展，用于在指定网站页面上显示倒计时，并在随机时间后自动关闭标签页。遇到保护验证 iframe 时，扩展会停止关闭逻辑、播放提示音，并尝试暂停相关的自动打开页面。

A Chrome / Edge extension that shows a countdown on configured target websites and automatically closes matching tabs after a random delay. When a protected iframe is detected, it stops the closing flow, plays an alert sound, and attempts to pause related auto-open pages.

## 功能特点

- 支持 Chrome 和 Microsoft Edge，基于 Manifest V3。
- 可配置目标域名，例如默认的 `h5.ele.me`。
- 可配置随机关闭时间范围，默认 `8` 到 `12` 秒。
- 在目标页面右上角显示倒计时。
- 在目标页面注入「停止插件」按钮，可从网页中直接停止扩展。
- 在目标页面和 `Auto Open` 页面注入「暂停打开」按钮，用于清理自动打开页面中的定时器。
- 检测到默认保护 iframe `#baxia-dialog-content` 时，不再关闭页面，并播放提示音。

## Features

- Works with Chrome and Microsoft Edge, built on Manifest V3.
- Configurable target domains, with `h5.ele.me` as the default.
- Configurable random close delay, defaulting to `8` to `12` seconds.
- Shows a countdown box on matching target pages.
- Adds a "停止插件" button on target pages so the extension can be stopped from the webpage.
- Adds a "暂停打开" button on target pages and `Auto Open` pages to clear page timers.
- When the default protected iframe `#baxia-dialog-content` is detected, the extension stops closing that page and plays an alert sound.

## 文件说明

| 文件 | 说明 |
| --- | --- |
| `manifest.json` | 浏览器扩展清单文件。 |
| `background.js` | 当前实际生效的后台脚本，负责标签页扫描、倒计时、关闭和 iframe 检测。 |
| `popup.html` | 扩展弹窗界面。 |
| `popup.js` | 弹窗交互逻辑，负责读取状态、保存配置、启动和停止扩展。 |
| `icon.png` | 默认扩展图标。 |
| `icon_on.png` | 运行状态图标。 |
| `icon_off.png` | 停止状态图标。 |
| `background 0525.js` | 历史版本备份，不是当前入口。 |
| `background_old.js` | 更早的历史版本备份，不是当前入口。 |

## 快速安装：Chrome

1. 下载或复制本项目文件夹到电脑本地。
2. 打开 Chrome。
3. 在地址栏输入 `chrome://extensions/` 并回车。
4. 打开右上角的「开发者模式」。
5. 点击「加载已解压的扩展程序」。
6. 选择本项目文件夹，例如 `auto_close_ring`。
7. 安装完成后，浏览器工具栏会出现扩展图标。

## Quick Install: Chrome

1. Download or copy this project folder to your computer.
2. Open Chrome.
3. Go to `chrome://extensions/`.
4. Enable "Developer mode" in the top-right corner.
5. Click "Load unpacked".
6. Select this project folder, for example `auto_close_ring`.
7. After installation, the extension icon should appear in the browser toolbar.

## 快速安装：Microsoft Edge

1. 下载或复制本项目文件夹到电脑本地。
2. 打开 Microsoft Edge。
3. 在地址栏输入 `edge://extensions/` 并回车。
4. 打开左侧或右侧的「开发人员模式」。
5. 点击「加载解压缩的扩展」。
6. 选择本项目文件夹，例如 `auto_close_ring`。
7. 安装完成后，浏览器工具栏会出现扩展图标。

## Quick Install: Microsoft Edge

1. Download or copy this project folder to your computer.
2. Open Microsoft Edge.
3. Go to `edge://extensions/`.
4. Enable "Developer mode".
5. Click "Load unpacked".
6. Select this project folder, for example `auto_close_ring`.
7. After installation, the extension icon should appear in the browser toolbar.

## 使用方法

1. 点击浏览器工具栏里的扩展图标。
2. 在「目标域名」中填写需要自动处理的网站域名。
   - 示例：`h5.ele.me`
   - 多个域名可以用英文逗号分隔，例如：`h5.ele.me,example.com`
3. 在「关闭时间范围（秒）」中填写最小秒数和最大秒数。
   - 扩展会在这个范围内随机选择一个时间。
   - 例如 `8` 和 `12` 表示每个目标页面会在 8 到 12 秒之间随机关闭。
4. 点击「启动」。
5. 打开或刷新目标域名页面，页面右上角会出现倒计时。
6. 需要停止时，可以点击弹窗里的「停止」，也可以点击网页右上角的「停止插件」。

## How To Use

1. Click the extension icon in the browser toolbar.
2. Enter the domains you want to handle in the target domain field.
   - Example: `h5.ele.me`
   - Separate multiple domains with commas, for example: `h5.ele.me,example.com`
3. Enter the minimum and maximum close delay in seconds.
   - The extension randomly picks a delay within this range.
   - For example, `8` and `12` means each matching page will close randomly between 8 and 12 seconds.
4. Click "启动" to start.
5. Open or refresh a matching target page. A countdown will appear in the top-right corner.
6. To stop, click "停止" in the popup or click "停止插件" on the webpage.

## 页面按钮说明

- 「停止插件」：停止整个扩展的自动关闭逻辑。
- 「暂停打开」：清理标题以 `Auto Open` 开头的页面中的 timeout 和 interval，用于暂停相关页面继续自动打开新页面。
- 「将关闭：N秒」：当前页面的关闭倒计时。

## Page Buttons

- "停止插件": Stops the extension's auto-close logic.
- "暂停打开": Clears timeout and interval timers on pages whose title starts with `Auto Open`.
- "将关闭：N秒": Shows the countdown before the current page is closed.

## 默认配置

默认配置写在 `background.js` 中：

```js
{
    targetDomains: ["h5.ele.me"],
    minTime: 8,
    maxTime: 12,
    protectedIframe: "#baxia-dialog-content"
}
```

弹窗会保存你输入的目标域名和关闭时间范围。下次打开弹窗时，会读取已保存的配置。

## Default Configuration

The default configuration is defined in `background.js`:

```js
{
    targetDomains: ["h5.ele.me"],
    minTime: 8,
    maxTime: 12,
    protectedIframe: "#baxia-dialog-content"
}
```

The popup saves your target domains and close delay range. The saved configuration will be loaded the next time you open the popup.

## 修改代码后如何生效

这是一个原生浏览器扩展项目，没有构建步骤，也不需要安装 npm 依赖。

修改代码后：

1. 打开 `chrome://extensions/` 或 `edge://extensions/`。
2. 找到「关闭页面_定时」。
3. 点击刷新 / 重新加载按钮。
4. 重新打开或刷新目标网页。

## After Editing Code

This is a plain browser extension project. There is no build step and no npm dependency installation.

After editing code:

1. Open `chrome://extensions/` or `edge://extensions/`.
2. Find "关闭页面_定时".
3. Click the reload button.
4. Reopen or refresh the target webpage.

## 常见问题

### 为什么页面没有倒计时？

请检查：

- 扩展是否已经点击「启动」。
- 当前页面域名是否匹配「目标域名」。
- 修改代码后是否已经在扩展管理页重新加载扩展。
- 当前页面是否是浏览器内置页面，例如 `chrome://` 或 `edge://`。这类页面通常不能注入脚本。

### 为什么页面没有自动关闭？

可能原因：

- 页面中检测到了保护 iframe `#baxia-dialog-content`，扩展会停止关闭该页面。
- 当前页面不属于目标域名。
- 浏览器限制了脚本注入。

### 为什么需要这么多权限？

扩展需要：

- `tabs`：扫描和关闭标签页。
- `storage`：保存运行状态和配置。
- `scripting`：向目标页面注入倒计时和按钮。
- `<all_urls>`：允许在用户配置的不同网站上工作。

## FAQ

### Why is there no countdown on the page?

Please check:

- The extension has been started with "启动".
- The current page domain matches the configured target domain.
- The extension has been reloaded after code changes.
- The current page is not a browser internal page such as `chrome://` or `edge://`, because scripts usually cannot be injected there.

### Why did the page not close automatically?

Possible reasons:

- The protected iframe `#baxia-dialog-content` was detected, so the extension stopped closing that page.
- The current page does not match any target domain.
- The browser blocked script injection on the page.

### Why does the extension need these permissions?

The extension needs:

- `tabs`: to scan and close tabs.
- `storage`: to save status and configuration.
- `scripting`: to inject countdown UI and buttons into pages.
- `<all_urls>`: to work on different websites configured by the user.

## 维护提示

- 当前实际入口是 `background.js`，不是历史备份文件。
- 修改后台逻辑后，需要重新加载扩展。
- `protectedIframe` 当前没有在弹窗中开放配置，如需修改请编辑代码。
- 目标域名会自动清洗和标准化，例如去掉协议、路径、端口和通配符前缀。

## Maintenance Notes

- The active background entry is `background.js`, not the backup files.
- Reload the extension after changing background logic.
- `protectedIframe` is not configurable in the popup yet. Edit the code if you need to change it.
- Target domains are cleaned and normalized automatically, including removing protocol, path, port, and wildcard prefix.

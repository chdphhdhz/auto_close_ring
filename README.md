# Timed Page Closer

[中文说明](README.zh.md)

A Chrome / Microsoft Edge extension built with Manifest V3. It automatically handles pages on configured target domains by showing a countdown in the top-right corner and closing the tab after a random delay. If a configured protected iframe is detected, the extension cancels the close flow, plays an alert sound, and clears timers on related `Auto Open` pages.

The current default target domain is `h5.ele.me`, and the default protected iframe selector is `#baxia-dialog-content`.

## Features

- Works in Chrome and Microsoft Edge.
- Supports one or more configurable target domains.
- Supports a configurable random close delay range, defaulting to `8` to `12` seconds.
- Injects a countdown box into matching target pages.
- Injects a "停止插件" button into target pages so the extension can be stopped directly from the webpage.
- Injects a "暂停打开" button into target pages and pages whose title starts with `Auto Open`.
- Stops closing the current page and plays an alert sound when the protected iframe is detected.
- Clears timeout and interval timers on all `Auto Open` pages when the protected iframe is detected.
- The popup supports configuring target domains, close delay range, and the protected iframe CSS selector.

## File Structure

| File | Description |
| --- | --- |
| `manifest.json` | Extension manifest. Declares Manifest V3, permissions, background service worker, popup, and icons. |
| `background.js` | Active background service worker and the main logic entry point. |
| `popup.html` | Extension popup page with status, start/stop buttons, and configuration inputs. |
| `popup.js` | Popup interaction logic for reading status, saving configuration, and starting/stopping the extension. |
| `icon.png` | Default extension icon. |
| `icon_on.png` | Icon used while the extension is running. |
| `icon_off.png` | Icon used while the extension is stopped. |
| `background 0525.js` | Historical background script; not the active entry point. |
| `background_old.js` | Older backup background script; not the active entry point. |
| `AGENTS.md` | Project context and maintenance notes. |

## Installation

### Chrome

1. Open Chrome.
2. Go to `chrome://extensions/`.
3. Enable "Developer mode" in the top-right corner.
4. Click "Load unpacked".
5. Select this project directory.
6. After installation, the extension icon should appear in the browser toolbar.

### Microsoft Edge

1. Open Microsoft Edge.
2. Go to `edge://extensions/`.
3. Enable "Developer mode".
4. Click "Load unpacked".
5. Select this project directory.
6. After installation, the extension icon should appear in the browser toolbar.

## Usage

1. Click the extension icon in the browser toolbar.
2. Enter the domains you want to handle in the target domain field.
   - Example: `h5.ele.me`
   - Separate multiple domains with commas, for example: `h5.ele.me,example.com`
3. Enter the minimum and maximum close delay in seconds.
   - The extension chooses a random delay for each target page.
   - For example, `8` and `12` means a page will close randomly between 8 and 12 seconds.
4. Enter the protected iframe CSS selector.
   - Default: `#baxia-dialog-content`
   - When an element matching this selector is detected, the extension cancels closing for the current page and plays an alert sound.
5. Click "启动" to start.
6. Open or refresh a matching target page. A countdown will appear in the top-right corner.
7. To stop the extension, click "停止" in the popup or "停止插件" on the webpage.

## Injected Page UI

| Element | Description |
| --- | --- |
| "停止插件" | Stops the extension's auto-close logic and clears timers maintained by the extension. |
| "暂停打开" | Clears timeout and interval timers on pages whose title starts with `Auto Open`. |
| "将关闭：N秒" | Shows the countdown before the current target page is closed. |

## Default Configuration

The default configuration is defined in `DEFAULT_CONFIG` inside `background.js`:

```js
{
    targetDomains: ["h5.ele.me"],
    minTime: 8,
    maxTime: 12,
    protectedIframe: "#baxia-dialog-content"
}
```

The popup saves configuration to `chrome.storage.local`. The next time the popup opens, it loads the saved target domains, close delay range, and protected iframe selector.

## Configuration Sanitization

The background script normalizes configuration through `sanitizeConfig`:

- Domains are converted to lowercase.
- Protocol, path, port, wildcard prefix, and extra dots are removed from domains.
- Duplicate target domains are removed.
- `minTime` and `maxTime` must be positive integers.
- If the minimum delay is greater than the maximum delay, the two values are swapped automatically.
- If no valid target domain is provided, the default domain `h5.ele.me` is used.
- If `protectedIframe` is empty, the default selector `#baxia-dialog-content` is used.

## Core Flow

### Start

After clicking "启动" in the popup, `popup.js` saves the configuration and sends `{ type: "start" }` to the background script.

`background.js` then:

- Sets the running state to `true`.
- Saves the running state to `chrome.storage.local`.
- Updates the extension icon and badge text.
- Starts the global iframe alert checker.
- Scans all currently open tabs.

### Stop

After clicking "停止" in the popup or "停止插件" on the webpage, the background script:

- Sets the running state to `false`.
- Updates the stopped icon and badge text.
- Stops the global iframe alert checker.
- Clears close timers and iframe detection timers for tracked tabs.
- Removes the injected "停止插件" button from pages.
- Keeps the injected "暂停打开" button on pages.

### Target Page Handling

`processTab(tabId, tab)` is the main tab handler.

It works as follows:

- If the page host matches a configured target domain, inject "停止插件" and "暂停打开".
- If the page title starts with `Auto Open`, inject "暂停打开".
- Only target-domain pages are checked for the protected iframe.
- If the protected iframe is detected:
  - Cancel closing for the current page.
  - Play an alert sound.
  - Clear timers on all `Auto Open` pages.
- If the protected iframe is not detected:
  - Generate a random countdown between `minTime` and `maxTime`.
  - Show `将关闭：N秒` in the top-right corner.
  - Close the current tab when the countdown finishes.
  - Check for the protected iframe once per second during the countdown. If it appears, cancel the close flow and alert.

## Auto Open Pages

The project treats tabs whose title starts with `Auto Open` as auto-open pages.

When "暂停打开" is clicked, or when the protected iframe is detected on a target page, the background script scans all tabs and injects code into `Auto Open` pages to clear timeout and interval timers:

```js
for (let i = 0; i < 65536; i++) {
    clearTimeout(i);
    clearInterval(i);
}
```

This is used to stop related pages from continuing to open new pages automatically.

## Applying Code Changes

This project has no `package.json`, no build step, and no npm dependencies.

After editing code:

1. Open `chrome://extensions/` or `edge://extensions/`.
2. Find "关闭页面_定时".
3. Click the reload button.
4. Reopen or refresh the target webpage.

## FAQ

### Why is there no countdown on the page?

Check that:

- The extension has been started with "启动".
- The current page domain matches the configured target domain.
- The current page has finished loading.
- The current page is not a browser internal page such as `chrome://` or `edge://`, because scripts usually cannot be injected there.
- The extension has been reloaded after code changes.

### Why did the page not close automatically?

Possible reasons:

- The protected iframe was detected, so the extension cancelled closing for that page.
- The current page does not match any target domain.
- The browser blocked script injection.
- The extension was stopped manually.

### Why is the extension not running after reopening the browser?

During initialization, `background.js` loads the saved configuration but forces `isRunning` to `false`. In other words, the extension does not continue the previous running state automatically. Click "启动" again to start it.

### Why does the extension need these permissions?

The extension needs:

- `tabs`: to scan, identify, and close tabs.
- `storage`: to save configuration and running state.
- `scripting`: to inject countdown UI, buttons, iframe checks, and alert sound scripts.
- `background`: to support the background service worker.
- `<all_urls>`: to work on different websites configured by the user.

## Maintenance Notes

- The active background entry point is `background.js`, not the historical backup files.
- Reload the extension after changing background logic.
- `background.js` is a Manifest V3 service worker, so it should not be treated like a long-lived page script.
- Script injection can fail on special pages, browser internal pages, or pages with permission restrictions. Most current injection failures are ignored silently.
- When changing target-domain matching, prefer keeping the `normalizeDomain`, `sanitizeConfig`, and `isTargetHost` flow.
- When changing close behavior, account for all three tab states: `closeTimer`, `checkInterval`, and `alertOnly`.
- When changing injected UI, make sure "停止插件", "暂停打开", and the countdown box do not overlap.
- When changing the protected iframe configuration flow, check `background.js`, `popup.html`, and `popup.js` together.
- Read and save project files as UTF-8 to avoid breaking Chinese UI text and comments.

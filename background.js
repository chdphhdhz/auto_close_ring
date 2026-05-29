// 后台保活，防止被浏览器卸载休眠
// let keepAliveInterval = null;
// function startKeepAlive() {
//     if (keepAliveInterval) clearInterval(keepAliveInterval);
//     keepAliveInterval = setInterval(() => {
//         if (chrome.runtime.id) chrome.storage.local.get('keepAlive', () => { });
//     }, 20000);
// }
// startKeepAlive();
// chrome.runtime.onStartup.addListener(startKeepAlive);
// chrome.runtime.onInstalled.addListener(startKeepAlive);

const DEFAULT_CONFIG = {
    targetDomains: ["h5.ele.me"],
    minTime: 8,
    maxTime: 12,
    protectedIframe: "#baxia-dialog-content"
};
let isRunning = false;
let config = { ...DEFAULT_CONFIG };
const tabTimers = {};
let alertCheckTimer = null;
const ICON_ON = "icon_on.png";
const ICON_OFF = "icon_off.png";

chrome.storage.local.get(["config", "isRunning"], (res) => {
    if (res.config) config = sanitizeConfig(res.config);
    isRunning = false;
    setBadgeIcon();
});

function normalizeDomain(value) {
    if (typeof value !== "string") return "";

    const raw = value.trim().toLowerCase();
    if (!raw) return "";

    try {
        const url = raw.includes("://") ? new URL(raw) : new URL(`https://${raw}`);
        return url.hostname.replace(/^\*\./, "").replace(/^\.+|\.+$/g, "");
    } catch (e) {
        return raw
            .split(/[/?#]/)[0]
            .split(":")[0]
            .replace(/^\*\./, "")
            .replace(/^\.+|\.+$/g, "");
    }
}

function sanitizeConfig(data = {}) {
    let minTime = Number.parseInt(data.minTime, 10);
    let maxTime = Number.parseInt(data.maxTime, 10);

    if (!Number.isFinite(minTime) || minTime <= 0) minTime = DEFAULT_CONFIG.minTime;
    if (!Number.isFinite(maxTime) || maxTime <= 0) maxTime = DEFAULT_CONFIG.maxTime;
    if (minTime > maxTime) [minTime, maxTime] = [maxTime, minTime];

    const targetDomains = [...new Set(
        (Array.isArray(data.targetDomains) ? data.targetDomains : DEFAULT_CONFIG.targetDomains)
            .map(normalizeDomain)
            .filter(Boolean)
    )];

    return {
        targetDomains: targetDomains.length ? targetDomains : [...DEFAULT_CONFIG.targetDomains],
        minTime,
        maxTime,
        protectedIframe: typeof data.protectedIframe === "string" && data.protectedIframe.trim()
            ? data.protectedIframe.trim()
            : DEFAULT_CONFIG.protectedIframe
    };
}

function getTabHost(url) {
    try {
        return new URL(url).hostname.toLowerCase();
    } catch (e) {
        return "";
    }
}

function isTargetHost(host) {
    return config.targetDomains.some(domain => host === domain || host.endsWith(`.${domain}`));
}

function clearTabState(tabId, shouldRemoveCountdown = false) {
    if (!tabTimers[tabId]) return;

    clearTimeout(tabTimers[tabId].closeTimer);
    clearInterval(tabTimers[tabId].checkInterval);
    delete tabTimers[tabId];

    if (shouldRemoveCountdown) removeCountdown(tabId);
}

async function hasProtectedIframe(tabId) {
    try {
        const [res] = await chrome.scripting.executeScript({
            target: { tabId },
            func: s => !!document.querySelector(s),
            args: [config.protectedIframe]
        });
        return !!(res && res.result);
    } catch (e) {
        clearTabState(tabId, true);
        return null;
    }
}

function setBadgeIcon() {
    if (isRunning) {
        chrome.action.setIcon({ path: ICON_ON });
        chrome.action.setBadgeText({ text: "运行" });
        chrome.action.setBadgeBackgroundColor({ color: "#7b2cbf" });
    } else {
        chrome.action.setIcon({ path: ICON_OFF });
        chrome.action.setBadgeText({ text: "停止" });
        chrome.action.setBadgeBackgroundColor({ color: "#999999" });
    }
}

// ------------------------------
// 停止按钮（右上角第一个）
// ------------------------------
function injectStopButton(tabId) {
    chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
            if (document.getElementById("stop-btn")) return;
            const btn = document.createElement("div");
            btn.id = "stop-btn";
            btn.textContent = "停止插件";
            btn.style.cssText = `
                position: fixed;
                top: 15px;
                right: 250px;
                background: #ef4444;
                color: #fff;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 14px;
                font-weight: bold;
                cursor: pointer;
                z-index: 99999999;
                white-space: nowrap;
            `;
            btn.onclick = () => chrome.runtime.sendMessage({ type: "stop" });
            document.body.appendChild(btn);
        }
    }).catch(() => { });
}

// ------------------------------
// 暂停打开按钮（右上角第二个，不重叠）
// ------------------------------
function injectPauseButton(tabId) {
    chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
            if (document.getElementById("pause-auto-open-btn")) return;
            const btn = document.createElement("div");
            btn.id = "pause-auto-open-btn";
            btn.textContent = "暂停打开";
            btn.style.cssText = `
                position: fixed;
                top: 15px;
                right: 150px;
                background: #0ea5e9;
                color: #fff;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 14px;
                font-weight: bold;
                cursor: pointer;
                z-index: 99999999;
                white-space: nowrap;
            `;
            // 点击：永远清理 Auto Open 页面定时器
            btn.onclick = () => {
                const tip = document.createElement("div");
                tip.textContent = "✅ 已暂停所有 Auto Open";
                tip.style.cssText = `
                    position: fixed;
                    top: 50px;
                    right: 20px;
                    background: #7b2cbf;
                    color: #fff;
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-size: 13px;
                    z-index: 99999999;
                    white-space: nowrap;
                    animation: fadeOut 0.5s ease 2.5s forwards;
                `;
                // 关键：加 CSS 动画，不靠定时器删除
                const style = document.createElement('style');
                style.textContent = `
                    @keyframes fadeOut { to { opacity: 0; visibility: hidden; } }
                `;
                document.head.appendChild(style);
                document.body.appendChild(tip);

                // 直接清理，不用等！
                chrome.runtime.sendMessage({ type: "clearAutoOpenTimers" });
            };
            document.body.appendChild(btn);
        }
    }).catch(() => { });
}

// ------------------------------
// 只删除停止按钮，保留暂停打开按钮
// ------------------------------
function removeOnlyStopButton() {
    chrome.windows.getAll({ populate: true }, (ws) => {
        ws.forEach(w => w.tabs.forEach(t => {
            if (!t.id) return;
            chrome.scripting.executeScript({
                target: { tabId: t.id },
                func: () => {
                    const el = document.getElementById("stop-btn");
                    if (el) el.remove();
                }
            }).catch(() => { });
        }));
    });
}

// ------------------------------
// 核心：清理所有 Auto Open 页面的定时器
// ------------------------------
function clearAllAutoOpenPagesTimer() {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            if (tab.title && tab.title.startsWith("Auto Open") && tab.id) {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => {
                        for (let i = 0; i < 65536; i++) {
                            clearTimeout(i);
                            clearInterval(i);
                        }
                    }
                }).catch(() => { });
            }
        });
    });
}

function start() {
    isRunning = true;
    chrome.storage.local.set({ isRunning: true });
    setBadgeIcon();
    startAlertCheck();
    scanAllTabs();
}

function stop() {
    isRunning = false;
    chrome.storage.local.set({ isRunning: false });
    setBadgeIcon();

    if (alertCheckTimer) clearInterval(alertCheckTimer);

    for (let id in tabTimers) {
        clearTabState(id, true);
    }

    for (let k in tabTimers) delete tabTimers[k];
    removeOnlyStopButton(); // 只删停止，保留暂停
}

function scanAllTabs() {
    chrome.windows.getAll({ populate: true }, (windows) => {
        windows.forEach(win => {
            win.tabs.forEach(tab => {
                if (tab.id) processTab(tab.id, tab);
            });
        });
    });
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (!isRunning || info.status !== "complete") return;
    processTab(tabId, tab);
});

chrome.tabs.onRemoved.addListener((tabId) => {
    clearTabState(tabId);
});

// 接收点击暂停的消息
chrome.runtime.onMessage.addListener((msg, _, resp) => {
    switch (msg.type) {
        case "start": start(); resp(true); break;
        case "stop": stop(); resp(true); break;
        case "clearAutoOpenTimers": clearAllAutoOpenPagesTimer(); resp(true); break;
        case "updateConfig":
            config = sanitizeConfig(msg.data);
            chrome.storage.local.set({ config }, () => resp(true));
            break;
        case "getStatus": resp({ isRunning, config }); break;
    }
    return true;
});

// ------------------------------
// 页面处理逻辑
// ------------------------------
async function processTab(tabId, tab) {
    if (!tab.url) return;
    try {
        const host = getTabHost(tab.url);
        const domainMatch = isTargetHost(host);
        const isAutoOpen = tab.title && tab.title.startsWith("Auto Open");

        // 允许：匹配域名 或 Auto Open 页面
        if (!domainMatch && !isAutoOpen) return;

        // 1. 符合域名 → 显示停止按钮 + 暂停打开按钮
        if (domainMatch) {
            injectStopButton(tabId);
            injectPauseButton(tabId);
        }

        // 2. Auto Open 页面 → 只显示暂停打开按钮
        if (isAutoOpen) {
            injectPauseButton(tabId);
        }

        // 只对目标域名检测 iframe
        if (!domainMatch) return;
        const currentState = tabTimers[tabId];
        if (currentState && !currentState.alertOnly) return;

        const hasIframe = await hasProtectedIframe(tabId);
        if (hasIframe === null) return;

        if (hasIframe) {
            tabTimers[tabId] = { alertOnly: true };
            playBeep();
            clearAllAutoOpenPagesTimer();
            return;
        }

        if (currentState && currentState.alertOnly) {
            clearTabState(tabId, true);
        }

        // 正常倒计时关闭
        const sec = Math.floor(Math.random() * (config.maxTime - config.minTime + 1)) + config.minTime;
        await chrome.scripting.executeScript({
            target: { tabId },
            func: showCountdown,
            args: [sec]
        });

        const closeTimer = setTimeout(() => {
            clearInterval(checkInterval);
            chrome.tabs.remove(tabId).catch(() => { });
            delete tabTimers[tabId];
        }, sec * 1000);

        const checkInterval = setInterval(async () => {
            const iframeVisible = await hasProtectedIframe(tabId);
            if (iframeVisible === null) return;
            if (iframeVisible) {
                clearTimeout(closeTimer);
                clearInterval(checkInterval);
                removeCountdown(tabId);
                playBeep();
                tabTimers[tabId] = { alertOnly: true };
                clearAllAutoOpenPagesTimer();
            }
        }, 1000);

        tabTimers[tabId] = { closeTimer, checkInterval };
    } catch (e) {
        console.error('processTab error:', e);
    }
}

function startAlertCheck() {
    if (alertCheckTimer) clearInterval(alertCheckTimer);
    alertCheckTimer = setInterval(async () => {
        if (!isRunning) return;

        const tabs = await chrome.tabs.query({});
        let hasAlert = false;

        for (let t of tabs) {
            if (!t.url) continue;
            try {
                const host = getTabHost(t.url);
                const dm = isTargetHost(host);
                if (!dm || !t.id) continue;

                const iframeVisible = await hasProtectedIframe(t.id);
                if (iframeVisible === null) continue;

                if (iframeVisible) {
                    hasAlert = true;
                } else if (tabTimers[t.id] && tabTimers[t.id].alertOnly) {
                    clearTabState(t.id, true);
                    processTab(t.id, t);
                }
            } catch (e) {
                if (t.id) clearTabState(t.id, true);
            }
        }

        // 只要检测到任意 iframe → 持续响铃
        if (hasAlert) {
            playBeep();
            clearAllAutoOpenPagesTimer();
        }
    }, 2000);
}

function showCountdown(sec) {
    let el = document.getElementById('cd-box');
    if (el) el.remove();
    el = document.createElement('div');
    el.id = 'cd-box';
    el.style.cssText = `
        position: fixed;
        top: 15px;
        right: 10px;
        background: #7b2cbf;
        color: #fff;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: bold;
        z-index: 99999999;
        white-space: nowrap;
        min-width: 90px;
        text-align: center;
    `;
    document.body.appendChild(el);
    let s = sec;
    el.textContent = `将关闭：${s}秒`;
    const interval = setInterval(() => {
        s--;
        if (s <= 0) { el.remove(); clearInterval(interval); return; }
        el.textContent = `将关闭：${s}秒`;
    }, 1000);
}

function removeCountdown(tabId) {
    chrome.scripting.executeScript({
        target: { tabId: parseInt(tabId) },
        func: () => {
            const e = document.getElementById('cd-box');
            if (e) e.remove();
        }
    }).catch(() => { });
}

// 声音播放
function playBeep() {
    // 方案：直接在 background 自身播放声音，不注入、不依赖标签页、不触发 CSP
    // 电脑锁屏、闲置、后台都能响
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();

        o.connect(g);
        g.connect(ctx.destination);

        o.frequency.value = 920;
        g.gain.value = 0.3;
        o.start();
        o.stop(ctx.currentTime + 0.25);
    } catch (e) {
        // 降级备用：找任意有效标签页播放
        chrome.tabs.query({}, (tabs) => {
            for (const tab of tabs) {
                if (!tab.id || !tab.url) continue;
                if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) continue;

                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => {
                        try {
                            const ctx = new (window.AudioContext || window.webkitAudioContext)();
                            const o = ctx.createOscillator();
                            const g = ctx.createGain();
                            o.connect(g);
                            g.connect(ctx.destination);
                            o.frequency.value = 920;
                            g.gain.value = 0.3;
                            o.start();
                            o.stop(ctx.currentTime + 0.25);
                        } catch (e) { }
                    }
                });
                break;
            }
        });
    }
}

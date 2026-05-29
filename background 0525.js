
let isRunning = false;
let config = {
    targetDomains: ["h5.ele.me"],
    minTime: 10,
    maxTime: 15,
    protectedIframe: "#baxia-dialog-content"
};

const tabTimers = {};
let alertCheckTimer = null;

const ICON_ON = "icon_on.png";
const ICON_OFF = "icon_off.png";

chrome.storage.local.get(["config", "isRunning"], (res) => {
    if (res.config) config = res.config;
    // 强制默认停止，不读取历史状态
    isRunning = false;
    setBadgeIcon();
});

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

// ==========================
// ✅ 新增：给标题 Auto Open 开头页面注入【暂停打开】按钮
// 点击清理当前页面所有定时器
// ==========================
function injectPauseAutoOpenButton(tabId) {
    chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
            if (document.getElementById("pause-auto-open-btn")) return;

            const btn = document.createElement("div");
            btn.id = "pause-auto-open-btn";
            btn.textContent = "暂停打开";
            btn.style.cssText = `
                position: fixed;
                top: 60px;
                right: 15px;
                background: #0ea5e9;
                color: #fff;
                padding: 8px 14px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: bold;
                cursor: pointer;
                z-index: 99999999;
            `;

            btn.onclick = () => {
                // 清理当前页面所有定时器
                for (let i = 0; i < 65536; i++) {
                    clearTimeout(i);
                    clearInterval(i);
                }

                // ✅ 弹出浮动提示 5 秒，不改变按钮
                const tip = document.createElement("div");
                tip.style.cssText = `
                    position:fixed;
                    top:70px;
                    right:15px;
                    background:#7b2cbf;
                    color:#fff;
                    padding:6px 12px;
                    border-radius:6px;
                    font-size:13px;
                    z-index:99999999;
                    animation:fadeInOut 5s forwards;
                `;
                tip.textContent = "✅ 已暂停所有自动打开";
                document.body.appendChild(tip);

                // 3秒后自动消失
                setTimeout(() => tip.remove(), 3000);
            };

            document.body.appendChild(btn);
        }
    }).catch(() => { });
}

// ==========================
// 【新增】停止按钮（仅匹配域名显示）
// ==========================
function injectStopButton(tabId) {
    chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
            if (document.getElementById("stop-btn")) return;
            const btn = document.createElement("div");
            btn.id = "stop-btn";
            btn.textContent = "停止";
            btn.style.cssText = `
                position: fixed;
                top: 15px;
                right: 15px;
                background: #ef4444;
                color: #fff;
                padding: 8px 14px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: bold;
                cursor: pointer;
                z-index: 99999999;
            `;
            btn.onclick = () => chrome.runtime.sendMessage({ type: "stop" });
            document.body.appendChild(btn);
        }
    }).catch(() => { });
}

// ==========================
// 【新增】停止插件时移除所有按钮
// ==========================
function removeAllStopButtons() {
    chrome.windows.getAll({ populate: true }, (ws) => {
        ws.forEach(w => w.tabs.forEach(t => {
            if (!t.id) return;
            chrome.scripting.executeScript({
                target: { tabId: t.id },
                func: () => {
                    const b = document.getElementById("stop-btn");
                    if (b) b.remove();
                }
            }).catch(() => { });
        }));
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
        clearTimeout(tabTimers[id].closeTimer);
        removeCountdown(id);
    }
    for (let key in tabTimers) delete tabTimers[key];

    // 移除所有停止按钮
    removeAllStopButtons();
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
    if (tabTimers[tabId]) {
        clearTimeout(tabTimers[tabId].closeTimer);
        delete tabTimers[tabId];
    }
});

async function processTab(tabId, tab) {
    if (!tab.url || tabTimers[tabId]) return;

    try {

        // ==========================
        // ✅ 判断标题是否 Auto Open 开头
        // ==========================
        if (tab.title && tab.title.startsWith("Auto Open")) {
            injectPauseAutoOpenButton(tabId);
        }

        const host = new URL(tab.url).hostname;
        const domainMatch = config.targetDomains.some(d => host.includes(d));
        if (!domainMatch) return;

        // ==========================
        // 只在匹配域名显示按钮
        // ==========================
        injectStopButton(tabId);

        const [res] = await chrome.scripting.executeScript({
            target: { tabId },
            func: (s) => !!document.querySelector(s),
            args: [config.protectedIframe]
        });

        const hasIframe = res.result;
        if (hasIframe) {
            tabTimers[tabId] = { alertOnly: true };
            playBeep();
            return;
        }

        const sec = Math.floor(Math.random() * (config.maxTime - config.minTime + 1)) + config.minTime;

        chrome.scripting.executeScript({
            target: { tabId },
            func: showCountdown,
            args: [sec]
        });

        const closeTimer = setTimeout(() => {
            chrome.tabs.remove(tabId).catch(() => { });
            delete tabTimers[tabId];
        }, sec * 1000);

        // ==========================
        // 【新增】懒加载iframe实时检测
        // ==========================
        const checkInterval = setInterval(async () => {
            const [r] = await chrome.scripting.executeScript({
                target: { tabId },
                func: s => !!document.querySelector(s),
                args: [config.protectedIframe]
            });
            if (r.result) {
                clearTimeout(closeTimer);
                clearInterval(checkInterval);
                removeCountdown(tabId);
                playBeep();
                tabTimers[tabId] = { alertOnly: true };
            }
        }, 1000);

        tabTimers[tabId] = { closeTimer, checkInterval };
    } catch (e) { }
}

function startAlertCheck() {
    if (alertCheckTimer) clearInterval(alertCheckTimer);
    alertCheckTimer = setInterval(async () => {
        if (!isRunning) return;

        const tabs = await chrome.tabs.query({});
        let alert = false;

        for (let t of tabs) {
            if (!t.url) continue;
            try {
                const host = new URL(t.url).hostname;
                const dm = config.targetDomains.some(d => host.includes(d));
                if (!dm) continue;

                const [r] = await chrome.scripting.executeScript({
                    target: { tabId: t.id },
                    func: s => !!document.querySelector(s),
                    args: [config.protectedIframe]
                });
                if (r.result) { alert = true; break; }
            } catch (e) { }
        }

        if (alert) playBeep();
    }, 2000);
}

function showCountdown(sec) {
    let el = document.getElementById('cd-box');
    if (el) el.remove();

    el = document.createElement('div');
    el.id = 'cd-box';
    el.style.cssText = `
    position:fixed; top:15px; right:90px;
    background:#7b2cbF; color:#fff; padding:8px 14px;
    border-radius:8px; font-weight:bold; z-index:99999999;
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

chrome.runtime.onMessage.addListener((msg, _, resp) => {
    switch (msg.type) {
        case "start": start(); resp(true); break;
        case "stop": stop(); resp(true); break;
        case "updateConfig":
            config = msg.data;
            chrome.storage.local.set({ config });
            resp(true);
            break;
        case "getStatus": resp({ isRunning, config }); break;
    }
    return true;
});
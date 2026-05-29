let isRunning = false;
let config = {
    targetDomains: ["h5.ele.me"],
    minTime: 8,
    maxTime: 11,
    protectedIframe: "#baxia-dialog-content"
};

const tabTimers = {};
let alertCheckTimer = null;

// 图标路径
const ICON_ON = "icon_on.png";
const ICON_OFF = "icon_off.png";

chrome.storage.local.get(["config", "isRunning"], (res) => {
    if (res.config) config = res.config;
    if (res.isRunning !== undefined) isRunning = res.isRunning;

    setBadgeIcon();
    if (isRunning) start();
});

// 设置插件图标状态
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
        const host = new URL(tab.url).hostname;
        const domainMatch = config.targetDomains.some(d => host.includes(d));
        if (!domainMatch) return;

        const [res] = await chrome.scripting.executeScript({
            target: { tabId },
            func: (s) => !!document.querySelector(s),
            args: [config.protectedIframe]
        });

        const hasIframe = res.result;
        if (hasIframe) {
            tabTimers[tabId] = { alertOnly: true };
            return;
        }

        // 每个页面独立随机时间 8~11秒 逐个关闭
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

        tabTimers[tabId] = { closeTimer };
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
    position:fixed; top:15px; right:15px;
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
    chrome.tabs.query({}, ts => {
        if (ts.length) {
            chrome.scripting.executeScript({
                target: { tabId: ts[0].id },
                func: () => {
                    try {
                        const ctx = new (AudioContext || webkitAudioContext)();
                        const o = ctx.createOscillator();
                        const g = ctx.createGain();
                        o.connect(g); g.connect(ctx.destination);
                        o.frequency.value = 880;
                        o.type = "sine";
                        g.gain.value = 0.1;
                        o.start();
                        setTimeout(() => o.stop(), 200);
                    } catch (e) { }
                }
            }).catch(() => { });
        }
    });
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
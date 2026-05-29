const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const domains = document.getElementById('domains');
const min = document.getElementById('min');
const max = document.getElementById('max');
const statusBar = document.getElementById('statusBar');

// 初始化状态
chrome.runtime.sendMessage({ type: 'getStatus' }, res => {
    domains.value = res.config.targetDomains.join(',');
    min.value = res.config.minTime;
    max.value = res.config.maxTime;
    updateStatusUI(res.isRunning);
});

function updateStatusUI(running) {
    if (running) {
        statusBar.className = "status run";
        statusBar.innerText = "当前状态：运行中";
    } else {
        statusBar.className = "status stop";
        statusBar.innerText = "当前状态：已停止";
    }
}

startBtn.onclick = () => {
    save();
    chrome.runtime.sendMessage({ type: 'start' }, () => {
        updateStatusUI(true);
    });
};

stopBtn.onclick = () => {
    chrome.runtime.sendMessage({ type: 'stop' }, () => {
        updateStatusUI(false);
    });
};

function save() {
    const list = domains.value.split(',').map(i => i.trim()).filter(Boolean);
    chrome.runtime.sendMessage({
        type: 'updateConfig',
        data: {
            targetDomains: list,
            minTime: parseInt(min.value) || 8,
            maxTime: parseInt(max.value) || 11,
            protectedIframe: "#baxia-dialog-content"
        }
    });
}
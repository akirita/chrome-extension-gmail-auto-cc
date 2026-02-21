let ccAddresses = [];
let dbReady = false;

// --- IndexedDB ---

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("GmailAutoCC", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("settings");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadAddresses() {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction("settings", "readonly");
    const req = tx.objectStore("settings").get("ccAddresses");
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

async function saveAddresses(addresses) {
  const db = await openDB();
  const tx = db.transaction("settings", "readwrite");
  tx.objectStore("settings").put(addresses, "ccAddresses");
}

// --- Initialize ---

loadAddresses().then((addrs) => {
  ccAddresses = addrs;
  dbReady = true;
});

// --- Icon click → open options ---

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

// --- Message handling ---

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "getAddresses") {
    if (dbReady) {
      sendResponse({ ccAddresses });
    } else {
      loadAddresses().then((addrs) => {
        ccAddresses = addrs;
        dbReady = true;
        sendResponse({ ccAddresses });
      });
      return true;
    }
  }

  if (msg.type === "setAddresses") {
    ccAddresses = msg.ccAddresses;
    saveAddresses(ccAddresses);
    sendResponse({ success: true });
  }

  return true;
});

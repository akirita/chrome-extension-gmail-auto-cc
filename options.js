const emailInput = document.getElementById("emailInput");
const addBtn = document.getElementById("addBtn");
const errorMsg = document.getElementById("errorMsg");
const addressList = document.getElementById("addressList");
const emptyMsg = document.getElementById("emptyMsg");

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

let ccAddresses = [];

function render() {
  addressList.innerHTML = "";
  emptyMsg.hidden = ccAddresses.length > 0;

  for (const addr of ccAddresses) {
    const li = document.createElement("li");

    const span = document.createElement("span");
    span.textContent = addr;
    li.appendChild(span);

    const btn = document.createElement("button");
    btn.textContent = "削除";
    btn.addEventListener("click", () => removeAddress(addr));
    li.appendChild(btn);

    addressList.appendChild(li);
  }
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.hidden = false;
}

function clearError() {
  errorMsg.hidden = true;
}

function addAddress() {
  clearError();
  const email = emailInput.value.trim().toLowerCase();

  if (!email) return;

  if (!EMAIL_REGEX.test(email)) {
    showError("有効なメールアドレスを入力してください。");
    return;
  }

  if (ccAddresses.includes(email)) {
    showError("このアドレスは既に登録されています。");
    return;
  }

  ccAddresses.push(email);
  save();
  emailInput.value = "";
  emailInput.focus();
}

function removeAddress(email) {
  ccAddresses = ccAddresses.filter((a) => a !== email);
  save();
}

function save() {
  chrome.runtime.sendMessage(
    { type: "setAddresses", ccAddresses },
    () => {
      render();
    }
  );
}

addBtn.addEventListener("click", addAddress);

emailInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addAddress();
  }
});

chrome.runtime.sendMessage({ type: "getAddresses" }, (result) => {
  ccAddresses = (result && result.ccAddresses) || [];
  render();
});

(() => {
  "use strict";

  const DELAYS = {
    beforeProcess: 500,
    betweenAddresses: 300,
    afterToggle: 500,
    afterInsert: 150,
    retryInterval: 300,
    maxRetries: 10,
  };

  let ccAddresses = [];
  const processedForms = new WeakSet();

  function fetchAddresses() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "getAddresses" }, (result) => {
        ccAddresses = (result && result.ccAddresses) || [];
        resolve(ccAddresses);
      });
    });
  }

  function init() {
    fetchAddresses();
    observeComposeWindows();
  }

  function observeComposeWindows() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;

          const forms = [];
          if (node.matches && node.matches("form.bAs")) {
            forms.push(node);
          }
          if (node.querySelectorAll) {
            forms.push(...node.querySelectorAll("form.bAs"));
          }

          for (const form of forms) {
            if (!processedForms.has(form)) {
              processedForms.add(form);
              handleComposeForm(form);
            }
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    document.querySelectorAll("form.bAs").forEach((form) => {
      if (!processedForms.has(form)) {
        processedForms.add(form);
        handleComposeForm(form);
      }
    });
  }

  async function handleComposeForm(form) {
    await fetchAddresses();
    if (ccAddresses.length === 0) return;

    await sleep(DELAYS.beforeProcess);

    await expandCcField(form);

    const ccInput = await findCcInputWithRetry(form);
    if (!ccInput) return;

    const existingAddresses = getExistingAddresses(form);
    const addressesToAdd = ccAddresses.filter(
      (addr) => !existingAddresses.has(addr.toLowerCase())
    );

    for (const address of addressesToAdd) {
      await insertAddress(ccInput, address);
      await sleep(DELAYS.betweenAddresses);
    }
  }

  // --- CC Toggle ---

  function findCcToggle(form) {
    for (const selector of [".aB.gQ.pE", ".aB.gQ.pB"]) {
      const el = form.querySelector(selector);
      if (el && /cc/i.test(el.textContent.trim())) {
        return el;
      }
    }

    for (const el of form.querySelectorAll("span, div, a")) {
      if (el.children.length === 0 && /^cc$/i.test(el.textContent.trim())) {
        return (
          el.closest('[role="link"], [role="button"], [tabindex], .aB') || el
        );
      }
    }

    return null;
  }

  function simulateClick(element) {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const opts = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
    };
    element.dispatchEvent(new MouseEvent("mousedown", opts));
    element.dispatchEvent(new MouseEvent("mouseup", opts));
    element.dispatchEvent(new MouseEvent("click", opts));
  }

  async function expandCcField(form) {
    if (findCcInput(form)) return;

    const toggle = findCcToggle(form);
    if (!toggle) return;

    simulateClick(toggle);
    await sleep(DELAYS.afterToggle);

    if (findCcInput(form)) return;

    toggle.click();
    await sleep(DELAYS.afterToggle);

    if (findCcInput(form)) return;

    if (toggle.parentElement) {
      simulateClick(toggle.parentElement);
      await sleep(DELAYS.afterToggle);
    }
  }

  // --- CC Row & Input Detection ---

  function findCcRow(form) {
    for (const row of form.querySelectorAll("tr")) {
      if (row.querySelector('[name="to"]')) continue;

      const labelCell = row.querySelector("td:first-child");
      if (!labelCell) continue;

      for (const el of labelCell.querySelectorAll("span, div")) {
        if (el.children.length === 0 && /^cc$/i.test(el.textContent.trim())) {
          return row;
        }
      }
    }

    for (const row of form.querySelectorAll("tr")) {
      if (row.querySelector('[name="cc"]')) {
        return row;
      }
    }

    return null;
  }

  function findCcInputInRow(row) {
    const inputCell = row.querySelector("td:last-child") || row;

    for (const input of inputCell.querySelectorAll("input")) {
      const type = (input.getAttribute("type") || "text").toLowerCase();
      if (type !== "hidden" && type !== "checkbox" && type !== "radio") {
        return input;
      }
    }

    const editable = inputCell.querySelector(
      '[g_editable="true"], [contenteditable="true"], [role="textbox"], [role="combobox"]'
    );
    if (editable) return editable;

    return null;
  }

  function findCcInput(form) {
    const ccRow = findCcRow(form);
    if (ccRow) {
      const input = findCcInputInRow(ccRow);
      if (input) return input;
    }

    for (const el of form.querySelectorAll(
      'input[aria-label^="Cc"]:not([type="hidden"]), [role="textbox"][aria-label^="Cc"], [aria-label^="Cc"][role="combobox"]'
    )) {
      return el;
    }

    const hiddenCc = form.querySelector('[name="cc"]');
    if (hiddenCc) {
      const container = hiddenCc.closest("td") || hiddenCc.parentElement;
      if (container) {
        for (const input of container.querySelectorAll("input")) {
          const type = (input.getAttribute("type") || "text").toLowerCase();
          if (type !== "hidden" && input.name !== "cc") {
            return input;
          }
        }
        const editable = container.querySelector(
          '[g_editable="true"], [contenteditable="true"], [role="textbox"]'
        );
        if (editable) return editable;
      }
    }

    return null;
  }

  async function findCcInputWithRetry(form) {
    for (let i = 0; i < DELAYS.maxRetries; i++) {
      const input = findCcInput(form);
      if (input) return input;
      await sleep(DELAYS.retryInterval);
    }
    return null;
  }

  // --- Existing Address Detection ---

  function getExistingAddresses(form) {
    const addresses = new Set();

    const chips = form.querySelectorAll("[data-hovercard-id], [email]");
    for (const chip of chips) {
      const email =
        chip.getAttribute("data-hovercard-id") || chip.getAttribute("email");
      if (email && email.includes("@")) {
        addresses.add(email.toLowerCase());
      }
    }

    return addresses;
  }

  // --- Address Insertion ---

  async function insertAddress(element, email) {
    element.focus();
    await sleep(50);

    if (element.isContentEditable) {
      document.execCommand("insertText", false, email);
    } else {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      );
      if (nativeSetter && nativeSetter.set) {
        nativeSetter.set.call(element, email);
      } else {
        element.value = email;
      }
      element.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          inputType: "insertText",
          data: email,
        })
      );
    }

    await sleep(DELAYS.afterInsert);

    for (const type of ["keydown", "keypress", "keyup"]) {
      element.dispatchEvent(
        new KeyboardEvent(type, {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
        })
      );
    }

    await sleep(DELAYS.afterInsert);

    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        code: "Tab",
        keyCode: 9,
        which: 9,
        bubbles: true,
      })
    );

    await sleep(DELAYS.afterInsert);

    if (!element.isContentEditable && element.value) {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      );
      if (nativeSetter && nativeSetter.set) {
        nativeSetter.set.call(element, "");
      } else {
        element.value = "";
      }
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }

    element.focus();
  }

  // --- Util ---

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  if (document.readyState === "loading") {
    window.addEventListener("load", init);
  } else {
    init();
  }
})();

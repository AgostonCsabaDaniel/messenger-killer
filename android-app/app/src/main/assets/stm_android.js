(() => {
  if (window.STM_ANDROID) return;

  const SELECTORS = {
    row: '[role="row"].__fb-light-mode, [role="row"].__fb-dark-mode, [role="row"][style*="--chat-composer-button-color"]',
    more: '[aria-label="More"]',
    remove: '[aria-label="Remove message"], [aria-label="Remove Message"], [aria-label="Unsend Message"], [aria-label="Unsend message"]',
    confirm: '[aria-label="Unsend"], [aria-label="Remove"]',
  };

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  let running = false;

  async function clickInside(row, selector) {
    const target = row.querySelector(selector);
    if (!target) return false;
    target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    target.click();
    return true;
  }

  async function unsendRow(row, delayMs) {
    const opened = await clickInside(row, SELECTORS.more);
    if (!opened) return false;
    await wait(200);

    const removeBtn = document.querySelector(SELECTORS.remove);
    if (!removeBtn) return false;
    removeBtn.click();
    await wait(200);

    const confirmBtn = document.querySelector(SELECTORS.confirm);
    if (!confirmBtn) return false;
    confirmBtn.click();
    await wait(delayMs);
    return true;
  }

  async function start(delayMs = 5000) {
    running = true;

    while (running) {
      const rows = [...document.querySelectorAll(SELECTORS.row)].reverse();
      if (rows.length === 0) {
        await wait(1000);
        continue;
      }

      let changed = false;
      for (const row of rows) {
        if (!running) break;
        const ok = await unsendRow(row, delayMs);
        if (ok) changed = true;
      }

      const scroller = rows[0]?.parentElement?.parentElement;
      if (scroller && 'scrollTop' in scroller) {
        scroller.scrollTop = Math.max(0, scroller.scrollTop - 1200);
      }

      if (!changed) await wait(1200);
    }
  }

  function stop() {
    running = false;
  }

  window.STM_ANDROID = { start, stop };
})();

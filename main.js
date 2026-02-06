// The div at the very top of the message chain. This is the div holding the description
// of the person your chatting with. Example as follows
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=
// User Image
// User Name
// You're friends on facebook
// Lives in {city/state}
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=
// Try multiple selectors: the class-based one may break when FB updates.
// The image alt fallback looks for the profile header area at the top of chat.
TOP_OF_CHAIN_QUERY = '.xsag5q8.xn6708d.x1ye3gou.x1cnzs8, [role="main"] [role="img"][aria-label]';

// Remove Queries -------------------------------------------------------------
// Use stable role="row" selectors instead of fragile auto-generated class names.
// Message rows from actual people have __fb-light-mode or __fb-dark-mode class.
// System rows (joins, adds) don't have these classes.
MESSAGE_ROW_QUERY = '[role="row"].__fb-light-mode, [role="row"].__fb-dark-mode';

// Fallback: also try to find message rows by the presence of chat theming CSS vars
MESSAGE_ROW_FALLBACK_QUERY = '[role="row"][style*="--chat-composer-button-color"]';

// Legacy selectors kept as additional fallback for finding the scroller
MY_ROW_QUERY = '.x78zum5.xdt5ytf.x193iq5w.x1n2onr6.xuk3077:has(> span)';

// In case a user has none of their own messages on screen and only unsent messages, this serves to pick up the scroll parent
UNSENT_MESSAGE_INNER_TEXT = 'You unsent a message';

// The sideways ellipses used to open the 'remove' menu. Visible on hover.
// Removed [aria-hidden="false"] constraint - the buttons start hidden and
// become visible after hover. We find them within the specific row instead.
MORE_BUTTONS_QUERY = '[aria-label="More"]';

// The button used to open the remove confirmation dialog.
REMOVE_BUTTON_QUERY =
  '[aria-label="Remove message"],[aria-label="Remove Message"],[aria-label="Unsend Message"],[aria-label="Unsend message"]';

// The button used to close the 'message removed' post confirmation.
OKAY_BUTTON_QUERY = '[aria-label="Okay"]';

COULDNT_REMOVE_QUERY = '._3quh._30yy._2t_._5ixy.layerCancel';
REMOVE_CONFIRMATION_QUERY = '[aria-label="Unsend"],[aria-label="Remove"]';
CANCEL_CONFIRMATION_QUERY =
  '[aria-label="Who do you want to unsend this message for?"] :not([aria-disabled="true"])[aria-label="Cancel"]';

// The loading animation.
LOADING_QUERY = '[role="main"] svg[aria-valuetext="Loading..."]';

// Consts and Params.
const STATUS = {
  CONTINUE: 'continue',
  ERROR: 'error',
  COMPLETE: 'complete',
};

let DELAY = 0;
const RUNNER_COUNT = 10;
const DEBUG_MODE = false; // When set, does not actually remove messages.
const MAX_CLICK_ATTEMPTS = 3; // Skip elements that fail to unsend after this many tries.

const currentURL =
  location.protocol + '//' + location.host + location.pathname;
const continueKey = 'shoot-the-messenger-continue' + currentURL;
const lastClearedKey = 'shoot-the-messenger-last-cleared' + currentURL;
const delayKey = 'shoot-the-messenger-delay' + currentURL;

let scrollerCache = null;
const clickCountPerElement = new Map();

// Helper functions ----------------------------------------------------------
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function reload() {
  window.location = window.location.pathname;
}

function getUnsentMessages() {
  return Array.from(document.querySelectorAll('div')).filter(
    (el) => el.innerText === UNSENT_MESSAGE_INNER_TEXT,
  );
}

// Returns true if the element is a "You unsent a message" system notification.
// These cannot be unsent again and should be excluded from unsend targets.
// See: https://github.com/theahura/shoot-the-messenger/issues/136
function isUnsentPlaceholder(el) {
  const text = (el.textContent ?? '').trim();
  return text === UNSENT_MESSAGE_INNER_TEXT;
}

function getScroller() {
  if (scrollerCache) return scrollerCache;

  let el;
  try {
    // Try the new role-based selectors first, then legacy class-based ones.
    el =
      document.querySelector(MESSAGE_ROW_QUERY) ??
      document.querySelector(MESSAGE_ROW_FALLBACK_QUERY) ??
      document.querySelector(MY_ROW_QUERY) ??
      getUnsentMessages()[0];
    // Walk up the DOM tree to find the scrollable container.
    // Use scrollHeight > clientHeight instead of scrollTop === 0 because
    // scrollTop can be 0 when the user hasn't scrolled yet.
    while (
      !('scrollTop' in el) ||
      el.scrollHeight <= el.clientHeight
    ) {
      console.log('Traversing tree to find scroller...', el);
      el = el.parentElement;
    }
  } catch (e) {
    alert(
      'Could not find scroller. This normally happens because you do not ' +
        'have enough messages to scroll through. Failing.',
    );
    console.log('Could not find scroller; failing.');
    throw new Error('Could not find scroller.');
  }

  scrollerCache = el;
  return el;
}

// Removal functions ---------------------------------------------------------
async function prepareDOMForRemoval() {
  const elementsToRemove = [];

  // Add the elements from clickCountPerElement where the count is greater than
  // 3 to elementsToRemove.
  for (let [el, count] of clickCountPerElement) {
    if (count > 3) {
      console.log('Unable to unsend element: ', el);
      elementsToRemove.push(el);
    }
  }

  // Once we know what to remove, start the loading process for new messages
  // just in case we lose the scroller.
  getScroller().scrollTop = 0;
  await sleep(200);

  // We cant delete all of the elements because react will crash. Keep the
  // first one.
  elementsToRemove.shift();
  elementsToRemove.reverse();
  console.log('Removing bad rows from dom: ', elementsToRemove);
  for (let badEl of elementsToRemove) {
    await sleep(50);
    let el = badEl;
    try {
      while (el.getAttribute('role') !== 'row') el = el.parentElement;
      el.remove();
    } catch (err) {
      console.log('Skipping row: could not find the row attribute.');
    }
  }
}

async function scrollToTopOfChain() {
  const scroller = getScroller();
  let lastScrollHeight = scroller.scrollHeight;
  let stableHeights = 0;

  for (let i = 0; i < 40; i += 1) {
    scroller.scrollTop = 0;
    await sleep(300);

    const loader = document.querySelector(LOADING_QUERY);
    const atTop = scroller.scrollTop === 0;
    const topOfChain = document.querySelector(TOP_OF_CHAIN_QUERY);

    if (scroller.scrollHeight === lastScrollHeight) {
      stableHeights += 1;
    } else {
      stableHeights = 0;
      lastScrollHeight = scroller.scrollHeight;
    }

    if (atTop && topOfChain && !loader && stableHeights >= 2) {
      console.log('Reached top of chain before deleting.');
      return true;
    }
  }

  console.log('Unable to confirm top of chain after scrolling.');
  return false;
}

async function getAllMessages() {
  // Get all ... buttons that let you select 'more' for all messages you sent.
  // Note: getUnsentMessages() is intentionally excluded here — "You unsent a
  // message" placeholders are system notifications that cannot be unsent again
  // and would cause infinite retry loops (#136). They are still used in
  // getScroller() for scroll-parent detection.
  // Prefer role-based selectors; fall back to legacy class-based ones.
  let elementsToUnsend = [
    ...document.querySelectorAll(MESSAGE_ROW_QUERY),
    ...document.querySelectorAll(MESSAGE_ROW_FALLBACK_QUERY),
  ];
  if (elementsToUnsend.length === 0) {
    elementsToUnsend = [...document.querySelectorAll(MY_ROW_QUERY)];
  }
  elementsToUnsend = elementsToUnsend.filter((el) => !isUnsentPlaceholder(el));
  console.log('Got elements to unsend: ', elementsToUnsend);
  return elementsToUnsend;
}

async function unsendAllVisibleMessages() {
  // Prepare the DOM. Get the elements we can remove. Load the next set. Hide
  // the rest.
  prepareDOMForRemoval();
  const moreButtonsHolders = await getAllMessages();
  console.log('Found hidden menu holders: ', moreButtonsHolders);

  // Iterate in DOM order so we delete from oldest to newest.
  for (el of moreButtonsHolders.slice()) {
    // Skip elements that have already failed too many times to avoid getting
    // stuck in an infinite loop retrying the same message (#134).
    if ((clickCountPerElement.get(el) ?? 0) >= MAX_CLICK_ATTEMPTS) {
      console.log('Skipping element after', MAX_CLICK_ATTEMPTS, 'failed attempts:', el);
      continue;
    }

    // Keep current task in view, as to not confuse users, thinking it's not
    // working anymore.
    el.scrollIntoView();
    await sleep(50);

    // Trigger hover on the row. Also try the inner gridcell if present,
    // since FB attaches the hover listener at that level.
    console.log('Triggering hover on: ', el);
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    const gridcell = el.querySelector('[role="gridcell"]');
    if (gridcell) {
      gridcell.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    }
    await sleep(75);

    // Look for the More button scoped within this row first, then fall back
    // to the global query in case the DOM structure is different.
    let moreButton = el.querySelector(MORE_BUTTONS_QUERY);
    if (!moreButton) {
      moreButton = document.querySelectorAll(MORE_BUTTONS_QUERY)[0];
    }
    if (!moreButton) {
      console.log('No moreButton found! Skipping holder: ', el);
      // Still increment the click count so this element eventually gets
      // cleaned up by prepareDOMForRemoval instead of retrying forever (#134).
      clickCountPerElement.set(el, (clickCountPerElement.get(el) ?? 0) + 1);
      continue;
    }
    console.log('Clicking more button: ', moreButton);
    moreButton.click();

    // Update the click count for the button. This is used to skip elements
    // that refuse to be unsent (see: prepareDOMForRemoval -- we remove these
    // DOM elements there).
    clickCountPerElement.set(el, (clickCountPerElement.get(el) ?? 0) + 1);

    // Hit the remove button to get the popup.
    await sleep(150);
    const removeButton = document.querySelectorAll(REMOVE_BUTTON_QUERY)[0];
    if (!removeButton) {
      console.log('No removeButton found! Skipping holder: ', el);
      continue;
    }

    console.log('Clicking remove button: ', removeButton);
    removeButton.click();

    // Hit unsend on the popup. If we are in debug mode, just log the popup.
    await sleep(250);
    const unsendButton = document.querySelectorAll(
      REMOVE_CONFIRMATION_QUERY,
    )[0];
    const cancelButton = document.querySelectorAll(
      CANCEL_CONFIRMATION_QUERY,
    )[0];
    if (DEBUG_MODE) {
      console.log(
        'Skipping unsend because we are in debug mode.',
        unsendButton,
      );
      cancelButton.click();
    } else if (!unsendButton) {
      console.log('No unsendButton found! Skipping holder: ', el);
      if (cancelButton) {
        cancelButton.click();
      } else {
        // Dismiss any open menu/dialog with Escape as a safety fallback.
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      }
    } else {
      console.log('Clicking unsend button: ', unsendButton);
      unsendButton.click();
      await sleep(300);
    }
  }
  console.log('Removed all holders.');

  // If every remaining message has exceeded the retry threshold, there is
  // nothing more we can do on this screen — treat it as complete instead of
  // looping forever (#134).
  const remaining = await getAllMessages();
  const allStuck = remaining.length > 0 && remaining.every(
    (el) => (clickCountPerElement.get(el) ?? 0) >= MAX_CLICK_ATTEMPTS,
  );
  if (allStuck) {
    console.log('All remaining messages exceeded max unsend attempts. Finishing.');
    return { status: STATUS.COMPLETE };
  }

  // Invalidate scroller cache between rounds in case the DOM shifted.
  scrollerCache = null;

  // Now see if we need to scroll down for newer messages.
  const scroller_ = getScroller();
  await sleep(200);
  if (
    !scroller_ ||
    scroller_.scrollTop + scroller_.clientHeight >= scroller_.scrollHeight
  ) {
    console.log('Reached bottom of chain. Removal complete.');
    return { status: STATUS.COMPLETE };
  }

  // Scroll down. Wait for the loader.
  // Were done loading when the loading animation is gone, or when the loop
  // waits 5 times (10s).
  let loader = null;
  scroller_.scrollTop = Math.min(
    scroller_.scrollTop + scroller_.clientHeight,
    scroller_.scrollHeight,
  );

  for (let i = 0; i < 5; ++i) {
    console.log('Waiting for loading messages to populate...', loader);
    await sleep(400);
    loader = document.querySelector(LOADING_QUERY);
    if (!loader) break;
  }

  return { status: STATUS.CONTINUE, data: DELAY * 1000 };
}

async function deleteAllRunner(count) {
  console.log('Starting delete all runner removal for N iterations: ', count);
  for (let i = 0; i < count; ++i) {
    console.log('Running count:', i);
    const sleepTime = await unsendAllVisibleMessages(i === count - 1);
    if (sleepTime.status === STATUS.CONTINUE) {
      console.log('Sleeping to avoid rate limits: ', sleepTime.data / 1000);
      await sleep(sleepTime.data);
    } else if (sleepTime.status === STATUS.COMPLETE) {
      return STATUS.COMPLETE;
    } else {
      return STATUS.ERROR;
    }
  }
  console.log('Completed run.');
  return STATUS.CONTINUE;
}

function hijackLog() {
  // Add a log to the bottom left of the screen where users can see what the
  // system is thinking about.
  console.log('Adding log to screen');
  const log = document.createElement('div');
  log.id = 'log';
  log.style.position = 'fixed';
  log.style.bottom = '0';
  log.style.left = '0';
  log.style.backgroundColor = 'white';
  log.style.padding = '10px';
  log.style.zIndex = '10000';
  log.style.maxWidth = '200px';
  log.style.maxHeight = '500px';
  log.style.overflow = 'scroll';
  log.style.border = '1px solid black';
  log.style.fontSize = '12px';
  log.style.fontFamily = 'monospace';
  log.style.color = 'black';
  document.body.appendChild(log);

  // Hijack the console.log function to also append to our new log element.
  const oldLog = console.log;
  console.log = function () {
    oldLog.apply(console, arguments);
    log.innerText += '\n' + Array.from(arguments).join(' ');
    log.scrollTop = log.scrollHeight;
  };
  console.log('Successfully added log to screen');
  console.log(
    'To see more complete logs, hit f12 or open the developer console.',
  );
  return log;
}

async function removeHandler() {
  hijackLog();
  DELAY = localStorage.getItem(delayKey) ?? DELAY;
  console.log('Sleeping to allow the page to load fully...');
  await sleep(2000); // give the page a bit to fully load.
  await scrollToTopOfChain();

  const status = await deleteAllRunner(RUNNER_COUNT);

  if (status === STATUS.COMPLETE) {
    localStorage.removeItem(continueKey);
    localStorage.setItem(lastClearedKey, new Date().toString());
    console.log('Success!');
    alert('Successfully cleared all messages!');
    return null;
  } else if (status === STATUS.CONTINUE) {
    console.log('Completed runner iteration but did not finish removal.');
    localStorage.setItem(continueKey, true);
    return reload();
  }

  console.log('Failed to complete removal.');
  alert('ERROR: something went wrong. Failed to complete removal.');
}

// Main ----------------------------------------------------------------------

// Hacky fix to avoid issues with removing/manipulating the DOM from outside
// react control.
// See: https://github.com/facebook/react/issues/11538#issuecomment-417504600
if (typeof Node === 'function' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function (child) {
    if (child.parentNode !== this) {
      if (console) {
        console.error(
          'Cannot remove a child from a different parent',
          child,
          this,
        );
      }
      return child;
    }
    return originalRemoveChild.apply(this, arguments);
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (console) {
        console.error(
          'Cannot insert before a reference node from a different parent',
          referenceNode,
          this,
        );
      }
      return newNode;
    }
    return originalInsertBefore.apply(this, arguments);
  };
}

(async function () {
  chrome.runtime.onMessage.addListener(async function (msg, sender) {
    // Make sure we are using english language messenger.
    if (document.documentElement.lang !== 'en') {
      alert(
        'ERROR: detected non-English language. Shoot the Messenger only works when Facebook settings are set to English. Please change your profile settings and try again.',
      );
      return;
    }

    console.log('Got action: ', msg.action);
    if (msg.action === 'REMOVE') {
      const doRemove = confirm(
        'Removal will nuke your messages and will prevent you from seeing the messages of other people in this chat. We HIGHLY recommend backing up your messages first. Continue?',
      );
      if (doRemove) {
        removeHandler();
      }
    } else if (msg.action === 'STOP') {
      localStorage.removeItem(continueKey);
      reload();
    } else if (msg.action === 'UPDATE_DELAY') {
      console.log('Setting delay to', msg.data, 'seconds');
      localStorage.setItem(delayKey, msg.data);
    } else {
      console.log('Unknown action.');
    }
  });

  if (localStorage.getItem(continueKey)) {
    removeHandler();
  }
})();

(function () {
  var MIN = 2;
  var MAX = 7;
  var FIRST_DELAY_MIN = 1900;
  var FIRST_DELAY_MAX = 2400;
  var HOLD_MIN = 2200;
  var HOLD_MAX = 4800;
  var TRANSITION_MS = 640;

  var slot = document.querySelector(".agent-count");
  if (!slot) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var current = null;
  var outgoingTimer = null;
  var nextTimer = null;

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function clamp(value) {
    return Math.min(MAX, Math.max(MIN, value));
  }

  function nextCount() {
    if (current === null) {
      return MIN;
    }

    var roll = Math.random();
    var delta;
    if (roll < 0.12) {
      delta = 0;
    } else if (roll < 0.82) {
      delta = Math.random() < 0.5 ? -1 : 1;
    } else {
      delta = Math.random() < 0.5 ? -2 : 2;
    }

    if (delta === 0) return current;

    var next = clamp(current + delta);
    if (next === current) {
      next = clamp(current + (current === MIN ? 1 : -1));
    }
    return next;
  }

  function swapDigit(next, direction) {
    var incoming = document.createElement("span");
    incoming.className = "agent-count-digit is-enter-" + direction;
    incoming.textContent = String(next);

    var outgoing = slot.querySelector(".agent-count-digit:not([data-leaving])");
    slot.appendChild(incoming);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        incoming.classList.remove("is-enter-up", "is-enter-down");
        if (outgoing) {
          outgoing.setAttribute("data-leaving", "");
          outgoing.classList.add("is-exit-" + direction);
        }
      });
    });

    if (outgoingTimer) clearTimeout(outgoingTimer);
    outgoingTimer = setTimeout(function () {
      if (outgoing && outgoing.parentNode === slot) {
        slot.removeChild(outgoing);
      }
    }, TRANSITION_MS + 40);
  }

  function tick() {
    var next = nextCount();
    if (next !== current) {
      var direction = current === null || next > current ? "up" : "down";
      window.dispatchEvent(
        new CustomEvent("agent-count", { detail: { from: current, to: next } })
      );
      swapDigit(next, direction);
      current = next;
    }
    nextTimer = setTimeout(tick, randomBetween(HOLD_MIN, HOLD_MAX));
  }

  nextTimer = setTimeout(tick, randomBetween(FIRST_DELAY_MIN, FIRST_DELAY_MAX));
})();

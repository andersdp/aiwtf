(function () {
  var MAN_DELAY = 520;
  var EDGE_THEN_NODE = 320;
  var STAGGER = 180;
  var MAN_ID = "hero-man";

  var svg = document.querySelector(".hero-bg svg");
  if (!svg) return;

  var VIEW_W = 1320;
  var VIEW_H = 620;
  var PAD_X = 70;
  var PAD_Y = 60;
  var PAD_TOP = 88;
  var MIN_SEP = 88;
  var DIST_MIN = 130;
  var DIST_MAX = 480;

  var man = document.getElementById(MAN_ID);
  var nodes = Array.prototype.slice.call(svg.querySelectorAll(".hero-node"));
  var edges = Array.prototype.slice.call(svg.querySelectorAll(".hero-edge"));
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function dist(a, b) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function visibleBounds() {
    var rect = svg.getBoundingClientRect();
    var w = rect.width || svg.clientWidth || VIEW_W;
    var h = rect.height || svg.clientHeight || VIEW_H;
    var scale = Math.max(w / VIEW_W, h / VIEW_H);
    var visW = w / scale;
    var visH = h / scale;
    var x0 = (VIEW_W - visW) / 2;
    var y0 = (VIEW_H - visH) / 2;
    var padX = Math.max(28, Math.min(PAD_X, visW * 0.12));
    var padY = Math.max(24, Math.min(PAD_Y, visH * 0.1));
    var padTop = Math.max(36, Math.min(PAD_TOP, visH * 0.16));
    return {
      minX: x0 + padX,
      maxX: x0 + visW - padX,
      minY: y0 + padTop,
      maxY: y0 + visH - padY
    };
  }

  function radiusOf(id) {
    var el = document.getElementById(id);
    return el ? Number(el.getAttribute("r")) || 0 : 0;
  }

  function edgeEnds(from, to, fromR, toR) {
    var length = dist(from, to);
    var insetFrom = fromR;
    var insetTo = toR;
    if (length <= insetFrom + insetTo) {
      return { x1: from.x, y1: from.y, x2: to.x, y2: to.y };
    }
    var ux = (to.x - from.x) / length;
    var uy = (to.y - from.y) / length;
    return {
      x1: from.x + ux * insetFrom,
      y1: from.y + uy * insetFrom,
      x2: to.x - ux * insetTo,
      y2: to.y - uy * insetTo
    };
  }
  function randomChildPos(parent, placed, bounds) {
    var spanX = Math.max(parent.x - bounds.minX, bounds.maxX - parent.x);
    var spanY = Math.max(parent.y - bounds.minY, bounds.maxY - parent.y);
    var maxR = Math.min(DIST_MAX, Math.sqrt(spanX * spanX + spanY * spanY) * 0.92);
    var minR = Math.min(DIST_MIN, maxR * 0.45);
    if (minR > maxR) minR = maxR * 0.4;
    var best = null;
    var bestScore = -1;
    var attempt;
    for (attempt = 0; attempt < 32; attempt += 1) {
      var angle = Math.random() * Math.PI * 2;
      var radius = minR + Math.random() * (maxR - minR);
      var pos = {
        x: clamp(parent.x + Math.cos(angle) * radius, bounds.minX, bounds.maxX),
        y: clamp(parent.y + Math.sin(angle) * radius, bounds.minY, bounds.maxY)
      };
      var nearest = Infinity;
      var i;
      for (i = 0; i < placed.length; i += 1) {
        nearest = Math.min(nearest, dist(pos, placed[i]));
      }
      if (nearest > bestScore) {
        bestScore = nearest;
        best = pos;
      }
      if (nearest >= MIN_SEP) return pos;
    }
    return best;
  }

  function layoutRandom() {
    if (!man) return;
    var bounds = visibleBounds();
    var manX = Number(man.getAttribute("cx"));
    var manY = Number(man.getAttribute("cy"));
    var screenW = svg.getBoundingClientRect().width || svg.clientWidth;
    var inwardX = screenW > 0 && screenW < 700
      ? (bounds.maxX - bounds.minX) * 0.2
      : 0;
    var manPos = {
      x: clamp(manX, bounds.minX + inwardX, bounds.maxX),
      y: clamp(manY, bounds.minY, bounds.maxY)
    };
    man.setAttribute("cx", manPos.x.toFixed(1));
    man.setAttribute("cy", manPos.y.toFixed(1));
    var posById = {};
    var placed = [manPos];
    posById[MAN_ID] = manPos;

    var remaining = nodes.slice();
    var safety = 0;
    while (remaining.length && safety < 24) {
      safety += 1;
      var i;
      for (i = remaining.length - 1; i >= 0; i -= 1) {
        var node = remaining[i];
        var parentPos = posById[node.getAttribute("data-parent")];
        if (!parentPos) continue;
        var pos = randomChildPos(parentPos, placed, bounds);
        node.setAttribute("cx", pos.x.toFixed(1));
        node.setAttribute("cy", pos.y.toFixed(1));
        posById[node.id] = pos;
        placed.push(pos);
        remaining.splice(i, 1);
      }
    }

    edges.forEach(function (edge) {
      var from = posById[edge.getAttribute("data-from")];
      var to = posById[edge.getAttribute("data-to")];
      if (!from || !to) return;
      var ends = edgeEnds(
        from,
        to,
        radiusOf(edge.getAttribute("data-from")),
        radiusOf(edge.getAttribute("data-to"))
      );
      edge.setAttribute("x1", ends.x1.toFixed(1));
      edge.setAttribute("y1", ends.y1.toFixed(1));
      edge.setAttribute("x2", ends.x2.toFixed(1));
      edge.setAttribute("y2", ends.y2.toFixed(1));
    });
  }

  var active = {};
  var children = {};
  var edgeByTo = {};
  var queue = [];
  var draining = false;

  function applyDashLengths() {
    edges.forEach(function (edge) {
      var from = edge.getAttribute("data-from");
      var to = edge.getAttribute("data-to");
      var len = edge.getTotalLength();
      edge.style.setProperty("--hero-edge-len", len.toFixed(1));
      if (!children[from]) children[from] = [];
      children[from].push(to);
      edgeByTo[to] = edge;
    });
  }

  function whenSized(fn) {
    var tries = 0;
    function tick() {
      var ready = svg.clientWidth > 0 && svg.clientHeight > 0;
      tries += 1;
      if ((ready && tries > 1) || tries > 40) {
        fn();
        return;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  whenSized(function () {
    layoutRandom();
    if (!reduced) applyDashLengths();
  });

  if (reduced) return;

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function agentCount() {
    var n = 0;
    nodes.forEach(function (node) {
      if (active[node.id]) n += 1;
    });
    return n;
  }

  function spawnCandidates() {
    var available = edges.filter(function (edge) {
      var from = edge.getAttribute("data-from");
      var to = edge.getAttribute("data-to");
      return active[from] && !active[to];
    });
    if (agentCount() < 2) {
      var fromMan = available.filter(function (edge) {
        return edge.getAttribute("data-from") === MAN_ID;
      });
      if (fromMan.length) return fromMan;
    }
    return available;
  }

  function despawnCandidates() {
    return nodes.filter(function (node) {
      if (!active[node.id]) return false;
      var kids = children[node.id] || [];
      return kids.every(function (id) {
        return !active[id];
      });
    });
  }

  function enqueue(task) {
    queue.push(task);
    drain();
  }

  function drain() {
    if (draining || !queue.length) return;
    draining = true;
    queue.shift()(function () {
      draining = false;
      if (queue.length) {
        setTimeout(drain, STAGGER);
      }
    });
  }

  function spawnOne(done) {
    var candidates = spawnCandidates();
    if (!candidates.length) {
      done();
      return;
    }
    var edge = pick(candidates);
    var to = edge.getAttribute("data-to");
    var node = document.getElementById(to);
    edge.classList.add("is-on");
    setTimeout(function () {
      if (node) node.classList.add("is-on");
      active[to] = true;
      done();
    }, EDGE_THEN_NODE);
  }

  function despawnOne(done) {
    var candidates = despawnCandidates();
    if (!candidates.length) {
      done();
      return;
    }
    var node = pick(candidates);
    var edge = edgeByTo[node.id];
    node.classList.remove("is-on");
    active[node.id] = false;
    setTimeout(function () {
      if (edge) edge.classList.remove("is-on");
      done();
    }, EDGE_THEN_NODE);
  }

  function syncTo(target) {
    var diff = target - agentCount();
    var i;
    if (diff > 0) {
      for (i = 0; i < diff; i += 1) enqueue(spawnOne);
    } else if (diff < 0) {
      for (i = 0; i < -diff; i += 1) enqueue(despawnOne);
    }
  }

  function lightMan() {
    if (man) man.classList.add("is-on");
    active[MAN_ID] = true;
  }

  setTimeout(lightMan, MAN_DELAY);

  window.addEventListener("agent-count", function (event) {
    var to = event.detail && event.detail.to;
    if (typeof to !== "number") return;
    if (!active[MAN_ID]) lightMan();
    syncTo(to);
  });
})();

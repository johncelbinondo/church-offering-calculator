(function () {
  "use strict";

  var MAX_PESOS = 10000000; // ₱10,000,000 upper limit
  var peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0, maximumFractionDigits: 0 });

  var $ = function (id) { return document.getElementById(id); };
  var form = $("calc-form"), input = $("gross"), errorEl = $("error");
  var resultsEl = $("results"), statusEl = $("copy-status");
  var lastText = "";

  function fmt(n) { return peso.format(n); }
  // Every amount is a whole peso: each percentage is rounded to the nearest peso (halves round up).
  function pct(n, rate) { return Math.round(n * rate / 100); }

  function parse(raw) {
    var s = raw.replace(/[₱,\s]/g, "");
    if (s === "") return { error: "Enter the total offering amount." };
    if (s.charAt(0) === "-") return { error: "Amount cannot be negative." };
    if (!/^\d+(\.\d+)?$/.test(s)) return { error: "Enter numbers only, for example 12500." };
    if (/\.\d{3,}$/.test(s)) return { error: "Use at most two decimal places." };
    var value = parseFloat(s);
    if (value > MAX_PESOS) return { error: "Amount is too large. The maximum is " + fmt(MAX_PESOS) + "." };
    var pesos = Math.round(value);
    if (pesos < 1) return { error: "Amount must be at least ₱1." };
    return { pesos: pesos, entered: value };
  }

  function compute(g, entered) {
    var district = pct(g, 10);
    var bal1 = g - district;
    var savings = pct(bal1, 10);
    var bal2 = bal1 - savings;
    var pastor = pct(bal2, 60);
    var pastorTithes = pct(pastor, 10);
    var remaining = pastor - pastorTithes;
    var other = pct(remaining, 10);
    var finalPastor = remaining - other;
    var church = bal2 - pastor; // the unallocated balance goes to Church's Share

    return {
      gross: g,
      entered: entered,
      allocations: [
        { name: "District Tithes", rate: "10%", base: "of Gross Offering " + fmt(g), amt: district },
        { name: "Savings", rate: "10%", base: "of Balance 1 " + fmt(bal1), amt: savings },
        { name: "Pastor's Tithes", rate: "10%", base: "of Pastor's Share " + fmt(pastor), amt: pastorTithes },
        { name: "10% of Pastor's Share", rate: "10%", base: "of remaining Pastor's Share " + fmt(remaining), amt: other },
        { name: "Final Pastor's Share", rate: "Balance", base: "Pastor's Share " + fmt(pastor) + " − Pastor's Tithes − 10% of Pastor's Share", amt: finalPastor, final: true },
        { name: "Church's Share", rate: "Balance", base: "Balance 2 " + fmt(bal2) + " − Pastor's Share " + fmt(pastor) + " (unallocated balance)", amt: church, final: true }
      ],
      balances: [
        { name: "Balance 1", rate: "", base: "Gross Offering − District Tithes", amt: bal1 },
        { name: "Balance 2", rate: "", base: "Balance 1 − Savings", amt: bal2 },
        { name: "Pastor's Share", rate: "60%", base: "of Balance 2 " + fmt(bal2), amt: pastor },
        { name: "Remaining Pastor's Share", rate: "", base: "Pastor's Share − Pastor's Tithes", amt: remaining }
      ],
      total: district + savings + pastorTithes + other + finalPastor + church
    };
  }

  function rowEl(r, cls) {
    var d = document.createElement("div");
    d.className = "row " + (cls || "");
    var n = document.createElement("span"); n.className = "name";
    n.textContent = r.name + (r.rate ? " (" + r.rate + ")" : "");
    var a = document.createElement("span"); a.className = "amt"; a.textContent = fmt(r.amt);
    var b = document.createElement("span"); b.className = "base"; b.textContent = r.base;
    d.appendChild(n); d.appendChild(a); d.appendChild(b);
    return d;
  }

  function roundedNote(m) {
    return m.entered !== m.gross ? "Entered amount rounded to " + fmt(m.gross) + ". " : "";
  }

  function buildText(m) {
    var lines = ["BOOK OF LIFE ASSEMBLIES OF GOD LUTOPAN", "OFFERING BREAKDOWN (rounded to the nearest peso)", "Gross Offering: " + fmt(m.gross), "", "ALLOCATIONS"];
    m.allocations.forEach(function (r) {
      lines.push(r.name + " (" + r.rate + ") " + r.base + ": " + fmt(r.amt));
    });
    lines.push("Total of allocations: " + fmt(m.total), "", "WORKING BALANCES (not allocations)");
    m.balances.forEach(function (r) {
      lines.push(r.name + (r.rate ? " (" + r.rate + ")" : "") + " - " + r.base + ": " + fmt(r.amt));
    });
    return lines.join("\n");
  }

  function show(m) {
    var al = $("allocations"), bl = $("balances");
    al.textContent = ""; bl.textContent = "";
    m.allocations.forEach(function (r) { al.appendChild(rowEl(r, r.final ? "final" : "")); });
    m.balances.forEach(function (r) { bl.appendChild(rowEl(r, "working")); });

    $("check").textContent = roundedNote(m) + "Amounts are rounded to the nearest peso. Allocations add up to " + fmt(m.total) +
      (m.total === m.gross ? " (matches the gross offering)." : " — does not match the gross offering. Please recheck.");

    lastText = buildText(m);
    statusEl.textContent = "";
    resultsEl.hidden = false;
  }

  function setError(msg) {
    errorEl.textContent = msg || "";
    errorEl.hidden = !msg;
    input.setAttribute("aria-invalid", msg ? "true" : "false");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var p = parse(input.value);
    if (p.error) {
      setError(p.error);
      resultsEl.hidden = true;
      lastText = "";
      input.focus();
      return;
    }
    setError("");
    show(compute(p.pesos, p.entered));
  });

  $("clear").addEventListener("click", function () {
    input.value = "";
    setError("");
    resultsEl.hidden = true;
    $("allocations").textContent = "";
    $("balances").textContent = "";
    statusEl.textContent = "";
    lastText = "";
    input.focus();
  });

  function fallbackCopy(text) {
    var t = document.createElement("textarea");
    t.value = text; t.setAttribute("readonly", "");
    t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
    document.body.removeChild(t);
    return ok;
  }

  $("copy").addEventListener("click", function () {
    if (!lastText) { statusEl.textContent = "Nothing to copy. Tap Calculate first."; return; }
    function done(ok) { statusEl.textContent = ok ? "Copied to clipboard." : "Could not copy. Please copy the results manually."; }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(lastText).then(function () { done(true); }, function () { done(fallbackCopy(lastText)); });
    } else {
      done(fallbackCopy(lastText));
    }
  });

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
})();

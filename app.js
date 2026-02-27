const STORAGE_KEY = "shower-tickets-v1";

const refs = {
  form: document.getElementById("orderForm"),
  validation: document.getElementById("validation"),
  outageList: document.getElementById("outageList"),
  outageTemplate: document.getElementById("outageTemplate"),
  addOutageBtn: document.getElementById("addOutageBtn"),
  ticketList: document.getElementById("ticketList"),
  svg: document.getElementById("showerSvg"),
};

const colorMap = {
  chrome: "#64748b",
  black: "#111827",
  "brushed nickel": "#9ca3af",
};

let tickets = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

function parseMeasurement(raw) {
  const text = String(raw || "").trim();
  if (!text) return NaN;
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);

  const mixed = text.match(/^(-?\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const whole = Number(mixed[1]);
    const num = Number(mixed[2]);
    const den = Number(mixed[3]);
    if (den === 0) return NaN;
    return whole + Math.sign(whole || 1) * (num / den);
  }

  const frac = text.match(/^(-?\d+)\/(\d+)$/);
  if (frac) {
    const num = Number(frac[1]);
    const den = Number(frac[2]);
    if (den === 0) return NaN;
    return num / den;
  }

  return NaN;
}

function readOutages(parent = refs.outageList) {
  return [...parent.querySelectorAll(".outage-row")].map((row) => ({
    side: row.querySelector(".outage-side").value,
    direction: row.querySelector(".outage-direction").value,
    value: row.querySelector(".outage-value").value,
  }));
}

function netOutage(outages) {
  return outages.reduce((total, outage) => {
    const n = parseMeasurement(outage.value);
    if (Number.isNaN(n)) return total;
    return outage.direction === "out" ? total + n : total - n;
  }, 0);
}

function currentFormData() {
  return {
    ticketNumber: document.getElementById("ticketNumber").value.trim(),
    customerName: document.getElementById("customerName").value.trim(),
    showerType: document.getElementById("showerType").value,
    glassColor: document.getElementById("glassColor").value,
    doorSide: document.getElementById("doorSide").value,
    doorWidth: document.getElementById("doorWidth").value,
    panelWidth: document.getElementById("panelWidth").value,
    overallWidth: document.getElementById("overallWidth").value,
    outages: readOutages(),
  };
}

function validateTicket(data) {
  const door = parseMeasurement(data.doorWidth);
  const panel = parseMeasurement(data.panelWidth);
  const overall = parseMeasurement(data.overallWidth);
  const outagesNet = netOutage(data.outages);

  const badOutage = data.outages.some((o) => o.value.trim() && Number.isNaN(parseMeasurement(o.value)));
  if ([door, panel, overall].some(Number.isNaN) || badOutage) {
    return { valid: false, message: "Enter valid measurements (supports decimals, fractions, and mixed fractions)." };
  }

  const expected = door + panel + outagesNet;
  const diff = Math.abs(expected - overall);
  if (diff > 0.02) {
    return {
      valid: false,
      message: `Mismatch: Door + Panel ${outagesNet ? `+ Net Outage (${outagesNet.toFixed(3)} in)` : ""} = ${expected.toFixed(3)} in, not ${overall.toFixed(3)} in.`,
    };
  }

  return { valid: true, message: `Measurements check out. Total = ${overall.toFixed(3)} in.` };
}

function addOutageRow(outage = { side: "left", direction: "in", value: "" }, container = refs.outageList) {
  const node = refs.outageTemplate.content.firstElementChild.cloneNode(true);
  node.querySelector(".outage-side").value = outage.side;
  node.querySelector(".outage-direction").value = outage.direction;
  node.querySelector(".outage-value").value = outage.value;
  node.querySelector(".remove-outage").addEventListener("click", () => {
    node.remove();
    liveUpdate();
  });
  node.querySelectorAll("input,select").forEach((el) => el.addEventListener("input", liveUpdate));
  container.appendChild(node);
}

function draw(ticket) {
  const door = parseMeasurement(ticket.doorWidth) || 0;
  const panel = parseMeasurement(ticket.panelWidth) || 0;
  const total = Math.max(parseMeasurement(ticket.overallWidth) || door + panel, 1);
  const net = netOutage(ticket.outages || []);
  const color = colorMap[ticket.glassColor] || "#64748b";

  const w = 620;
  const h = 250;
  const startX = 20;
  const y = 30;
  const usable = w - 40;
  const doorW = (door / total) * usable;
  const panelW = (panel / total) * usable;

  const doorX = ticket.doorSide === "left" ? startX : startX + panelW;
  const panelX = ticket.doorSide === "left" ? startX + doorW : startX;

  const outages = (ticket.outages || []).map((o) => ({ ...o, n: parseMeasurement(o.value) || 0 }));

  refs.svg.innerHTML = `
    <rect x="${startX}" y="${y}" width="${usable}" height="${h}" fill="none" stroke="#334155" stroke-width="3" />
    <rect x="${panelX}" y="${y}" width="${panelW}" height="${h}" fill="${color}22" stroke="${color}" stroke-width="3" />
    <rect x="${doorX}" y="${y}" width="${doorW}" height="${h}" fill="${color}44" stroke="${color}" stroke-width="3" />
    <line x1="${doorX + doorW / 2}" y1="${y + 10}" x2="${doorX + doorW / 2}" y2="${y + h - 10}" stroke="${color}" stroke-dasharray="8,6" stroke-width="2" />
    <circle cx="${ticket.doorSide === "left" ? doorX + 12 : doorX + doorW - 12}" cy="${y + h / 2}" r="6" fill="${color}"/>
    <text x="${panelX + panelW / 2}" y="${y + h + 22}" text-anchor="middle" font-size="13">Panel: ${ticket.panelWidth || "-"} in</text>
    <text x="${doorX + doorW / 2}" y="${y + h + 42}" text-anchor="middle" font-size="13">Door (${ticket.doorSide}): ${ticket.doorWidth || "-"} in</text>
    <text x="${startX + usable / 2}" y="${y - 10}" text-anchor="middle" font-size="13">Overall: ${ticket.overallWidth || "-"} in | Color: ${ticket.glassColor || "-"}</text>
    <text x="${startX + usable / 2}" y="${y + h + 62}" text-anchor="middle" font-size="13">Net Outage Adjustment: ${net.toFixed(3)} in</text>
    ${outages
      .map((o, index) => {
        const sideX = o.side === "left" ? startX : startX + usable;
        const dir = o.direction === "out" ? 1 : -1;
        const markerX = sideX + dir * (16 + index * 12);
        return `<line x1="${sideX}" y1="${y + 30 + index * 20}" x2="${markerX}" y2="${y + 30 + index * 20}" stroke="#dc2626" stroke-width="2" />
          <text x="${markerX + dir * 4}" y="${y + 34 + index * 20}" text-anchor="${dir > 0 ? "start" : "end"}" fill="#dc2626" font-size="11">${o.side} ${o.direction} ${o.value || 0}\"</text>`;
      })
      .join("")}
  `;
}

function saveTickets() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
}

function buildFieldEditor(ticket) {
  return `
  <div class="ticket" data-id="${ticket.id}">
    <h3>${ticket.ticketNumber} - ${ticket.customerName}</h3>
    <div class="grid">
      <label>Glass Color
        <select data-field="glassColor">
          <option value="chrome" ${ticket.glassColor === "chrome" ? "selected" : ""}>Chrome</option>
          <option value="black" ${ticket.glassColor === "black" ? "selected" : ""}>Black</option>
          <option value="brushed nickel" ${ticket.glassColor === "brushed nickel" ? "selected" : ""}>Brushed Nickel</option>
        </select>
      </label>
      <label>Door Side
        <select data-field="doorSide">
          <option value="left" ${ticket.doorSide === "left" ? "selected" : ""}>Left</option>
          <option value="right" ${ticket.doorSide === "right" ? "selected" : ""}>Right</option>
        </select>
      </label>
      <label>Door Width <input data-field="doorWidth" value="${ticket.doorWidth}" /></label>
      <label>Panel Width <input data-field="panelWidth" value="${ticket.panelWidth}" /></label>
      <label>Overall Width <input data-field="overallWidth" value="${ticket.overallWidth}" /></label>
    </div>
    <small>Status: ${ticket.validMessage || "Awaiting validation"}</small>
  </div>`;
}

function renderTickets() {
  refs.ticketList.innerHTML = tickets.length ? tickets.map(buildFieldEditor).join("") : "<p>No tickets yet.</p>";

  refs.ticketList.querySelectorAll(".ticket").forEach((card) => {
    const id = Number(card.dataset.id);
    const ticket = tickets.find((t) => t.id === id);
    card.querySelectorAll("[data-field]").forEach((el) => {
      el.addEventListener("input", () => {
        ticket[el.dataset.field] = el.value;
        const check = validateTicket(ticket);
        ticket.valid = check.valid;
        ticket.validMessage = check.message;
        saveTickets();
        card.querySelector("small").textContent = `Status: ${check.message}`;
        draw(ticket);
      });
      el.addEventListener("focus", () => draw(ticket));
    });
    card.addEventListener("click", () => draw(ticket));
  });
}

function liveUpdate() {
  const data = currentFormData();
  const check = validateTicket(data);
  refs.validation.textContent = check.message;
  refs.validation.className = check.valid ? "valid" : "invalid";
  draw(data);
}

refs.form.addEventListener("input", liveUpdate);
refs.addOutageBtn.addEventListener("click", () => addOutageRow());

refs.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = currentFormData();
  const check = validateTicket(data);
  refs.validation.textContent = check.message;
  refs.validation.className = check.valid ? "valid" : "invalid";
  if (!check.valid) return;

  tickets.unshift({ ...data, id: Date.now(), valid: true, validMessage: check.message });
  saveTickets();
  refs.form.reset();
  refs.outageList.innerHTML = "";
  addOutageRow();
  renderTickets();
  liveUpdate();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

addOutageRow();
renderTickets();
liveUpdate();

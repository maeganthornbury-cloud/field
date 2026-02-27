const STORAGE_KEY = "shower-tickets-v2";

const refs = {
  orderForm: document.getElementById("orderForm"),
  orderValidation: document.getElementById("orderValidation"),
  techLogin: document.getElementById("techLogin"),
  loadAssignedBtn: document.getElementById("loadAssignedBtn"),
  assignedTickets: document.getElementById("assignedTickets"),
  svg: document.getElementById("showerSvg"),
  activeTicketTitle: document.getElementById("activeTicketTitle"),
  selectedEdge: document.getElementById("selectedEdge"),
  edgeValue: document.getElementById("edgeValue"),
  saveEdgeBtn: document.getElementById("saveEdgeBtn"),
  outageSide: document.getElementById("outageSide"),
  outageDirection: document.getElementById("outageDirection"),
  outageValue: document.getElementById("outageValue"),
  applyOutageBtn: document.getElementById("applyOutageBtn"),
  fieldValidation: document.getElementById("fieldValidation"),
};

const colorMap = { chrome: "#64748b", black: "#111827", "brushed nickel": "#9ca3af" };

let tickets = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let activeTicketId = null;
let selectedEdgeKey = null;

function parseMeasurement(raw) {
  const text = String(raw || "").trim();
  if (!text) return NaN;
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  const mixed = text.match(/^(-?\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const whole = Number(mixed[1]);
    const n = Number(mixed[2]);
    const d = Number(mixed[3]);
    if (!d) return NaN;
    return whole + Math.sign(whole || 1) * (n / d);
  }
  const frac = text.match(/^(-?\d+)\/(\d+)$/);
  if (frac) {
    const n = Number(frac[1]);
    const d = Number(frac[2]);
    if (!d) return NaN;
    return n / d;
  }
  return NaN;
}

function saveTickets() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
}

function showStatus(node, text, ok) {
  node.textContent = text;
  node.className = `status ${ok ? "ok" : "bad"}`;
}

function validateCore(ticket) {
  const door = parseMeasurement(ticket.doorWidth);
  const panel = parseMeasurement(ticket.panelWidth);
  const overall = parseMeasurement(ticket.overallWidth);
  const outage = parseMeasurement(ticket.outage?.value || "0") || 0;
  const net = ticket.outage?.direction === "out" ? outage : -outage;

  if ([door, panel, overall].some(Number.isNaN)) {
    return { valid: false, message: "Enter valid door/panel/overall measurements." };
  }

  const expected = door + panel + net;
  if (Math.abs(expected - overall) > 0.02) {
    return { valid: false, message: `Door + Panel ${net ? `+ outage (${net.toFixed(3)} in)` : ""} must equal overall.` };
  }
  return { valid: true, message: "Core measurements validated." };
}

function createTicket(payload) {
  return {
    id: Date.now(),
    ticketNumber: payload.ticketNumber,
    customerName: payload.customerName,
    assignedTo: payload.assignedTo,
    doorSide: payload.doorSide,
    glassColor: payload.glassColor,
    doorWidth: payload.doorWidth,
    panelWidth: payload.panelWidth,
    overallWidth: payload.overallWidth,
    outage: { side: "left", direction: "in", value: "0" },
    edgeMeasurements: { left: "", right: "", bottom: "", head: "" },
  };
}

function readOrderForm() {
  return {
    ticketNumber: document.getElementById("ticketNumber").value.trim(),
    customerName: document.getElementById("customerName").value.trim(),
    assignedTo: document.getElementById("assignedTo").value.trim(),
    doorSide: document.getElementById("doorSide").value,
    glassColor: document.getElementById("glassColor").value,
    doorWidth: document.getElementById("doorWidth").value.trim(),
    panelWidth: document.getElementById("panelWidth").value.trim(),
    overallWidth: document.getElementById("overallWidth").value.trim(),
  };
}

function ticketById(id) {
  return tickets.find((t) => t.id === id) || null;
}

function activeTicket() {
  return ticketById(activeTicketId);
}

function renderAssignedList() {
  const tech = refs.techLogin.value.trim().toLowerCase();
  if (!tech) {
    refs.assignedTickets.innerHTML = "<p>Enter a tech name to see assigned tickets.</p>";
    return;
  }
  const mine = tickets.filter((t) => t.assignedTo.toLowerCase() === tech);
  refs.assignedTickets.innerHTML = mine.length
    ? mine
        .map(
          (t) => `<div class="ticket"><b>${t.ticketNumber}</b> — ${t.customerName}<br/>Assigned: ${t.assignedTo}<br/>Color: ${t.glassColor}
             <button data-open="${t.id}" type="button">Open Measurement</button></div>`,
        )
        .join("")
    : "<p>No tickets assigned to this login.</p>";

  refs.assignedTickets.querySelectorAll("[data-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTicketId = Number(btn.dataset.open);
      selectedEdgeKey = null;
      refs.selectedEdge.value = "None";
      refs.edgeValue.value = "";
      const ticket = activeTicket();
      refs.activeTicketTitle.textContent = `${ticket.ticketNumber} • ${ticket.customerName}`;
      refs.outageSide.value = ticket.outage.side;
      refs.outageDirection.value = ticket.outage.direction;
      refs.outageValue.value = ticket.outage.value;
      drawTicket(ticket);
      showStatus(refs.fieldValidation, "Ticket loaded. Click an edge to enter side measurements.", true);
    });
  });
}

function addEdgeHotspot(label, key, x, y, width, height, textX, textY, displayValue, color = "#2563eb") {
  const id = `edge-${key}`;
  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="transparent" stroke="transparent" class="edge-hit" data-edge="${key}"/>
    <text x="${textX}" y="${textY}" fill="${color}" font-size="24" text-anchor="middle">${displayValue || label}</text>
    <text x="${textX}" y="${textY + 24}" fill="#6b7280" font-size="13" text-anchor="middle">${label}</text>
    <rect id="${id}" x="${x}" y="${y}" width="${width}" height="${height}" fill="transparent" stroke="${selectedEdgeKey === key ? "#2563eb" : "transparent"}" stroke-width="2" pointer-events="none"/>
  `;
}

function drawTicket(ticket) {
  if (!ticket) return;
  const color = colorMap[ticket.glassColor] || "#64748b";
  const outageValue = parseMeasurement(ticket.outage.value || "0") || 0;
  const slopeIn = ticket.outage.direction === "in";
  const slopeDelta = Math.max(Math.min(outageValue * 7, 36), 0);

  const boxX = 80;
  const boxY = 70;
  const boxW = 540;
  const boxH = 380;
  const splitX = ticket.doorSide === "left" ? boxX + boxW * 0.44 : boxX + boxW * 0.56;

  const leftTopY = ticket.outage.side === "left" ? boxY + (slopeIn ? slopeDelta : -slopeDelta) : boxY;
  const rightTopY = ticket.outage.side === "right" ? boxY + (slopeIn ? slopeDelta : -slopeDelta) : boxY;

  refs.svg.innerHTML = `
    <text x="90" y="32" font-size="34" fill="#4b5563">Measure</text>
    <text x="630" y="160" font-size="18" text-anchor="end" fill="#374151">Width: ${ticket.overallWidth || "-"}\"</text>
    <text x="630" y="194" font-size="18" text-anchor="end" fill="#374151">Outage: ${ticket.outage.value || 0}\"</text>
    <text x="630" y="228" font-size="18" text-anchor="end" fill="#374151">Slope: ${ticket.outage.direction.toUpperCase()}</text>

    <line x1="${boxX}" y1="${leftTopY}" x2="${boxX}" y2="${boxY + boxH}" stroke="#111827" stroke-width="3"/>
    <line x1="${boxX + boxW}" y1="${rightTopY}" x2="${boxX + boxW}" y2="${boxY + boxH}" stroke="#111827" stroke-width="3"/>
    <line x1="${boxX}" y1="${leftTopY}" x2="${boxX + boxW}" y2="${rightTopY}" stroke="#111827" stroke-width="3"/>
    <line x1="${boxX}" y1="${boxY + boxH}" x2="${boxX + boxW}" y2="${boxY + boxH}" stroke="#16a34a" stroke-width="5"/>

    <line x1="${splitX}" y1="${(leftTopY + rightTopY) / 2}" x2="${splitX}" y2="${boxY + boxH - 20}" stroke="${color}" stroke-width="4"/>
    <rect x="${splitX - 8}" y="${boxY + boxH / 2 - 55}" width="16" height="110" fill="none" stroke="#111827" stroke-width="3"/>

    <line x1="${ticket.outage.side === "left" ? boxX - 34 : boxX + boxW + 34}" y1="${boxY + 44}" x2="${ticket.outage.side === "left" ? boxX - 6 : boxX + boxW + 6}" y2="${boxY + 20 + (slopeIn ? 16 : -16)}" stroke="#dc2626" stroke-width="3" marker-end="url(#arrow)"/>
    <text x="${ticket.outage.side === "left" ? boxX - 45 : boxX + boxW + 45}" y="${boxY + 50}" fill="#dc2626" font-size="14" text-anchor="middle">${ticket.outage.side.toUpperCase()} ${ticket.outage.direction.toUpperCase()}</text>

    ${addEdgeHotspot("LEFT", "left", boxX - 28, boxY + 80, 40, 220, boxX - 18, boxY + 200, ticket.edgeMeasurements.left || "75\"")}
    ${addEdgeHotspot("RIGHT", "right", boxX + boxW - 12, boxY + 80, 40, 220, boxX + boxW + 18, boxY + 200, ticket.edgeMeasurements.right || "75\"", "#f59e0b")}
    ${addEdgeHotspot("BOTTOM", "bottom", boxX + 60, boxY + boxH - 16, boxW - 120, 34, boxX + boxW / 2, boxY + boxH + 12, ticket.edgeMeasurements.bottom || "25\"", "#16a34a")}
    ${addEdgeHotspot("HEAD", "head", boxX + 90, boxY - 26, boxW - 180, 30, boxX + boxW / 2, boxY - 38, ticket.edgeMeasurements.head || "Head Width")}

    <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#dc2626"/></marker></defs>
  `;

  refs.svg.querySelectorAll(".edge-hit").forEach((node) => {
    node.addEventListener("click", () => {
      selectedEdgeKey = node.dataset.edge;
      refs.selectedEdge.value = selectedEdgeKey.toUpperCase();
      refs.edgeValue.value = ticket.edgeMeasurements[selectedEdgeKey] || "";
      drawTicket(ticket);
    });
  });
}

refs.orderForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const payload = readOrderForm();
  const check = validateCore(payload);
  if (!check.valid) {
    showStatus(refs.orderValidation, check.message, false);
    return;
  }

  tickets.unshift(createTicket(payload));
  saveTickets();
  refs.orderForm.reset();
  showStatus(refs.orderValidation, "Ticket created and assigned. Field tech can now log in for Step 2.", true);
  renderAssignedList();
});

refs.loadAssignedBtn.addEventListener("click", renderAssignedList);

refs.saveEdgeBtn.addEventListener("click", () => {
  const ticket = activeTicket();
  if (!ticket || !selectedEdgeKey) {
    showStatus(refs.fieldValidation, "Select a ticket and click an edge first.", false);
    return;
  }
  const value = refs.edgeValue.value.trim();
  if (Number.isNaN(parseMeasurement(value))) {
    showStatus(refs.fieldValidation, "Edge measurement must be decimal/fraction/mixed fraction.", false);
    return;
  }
  ticket.edgeMeasurements[selectedEdgeKey] = value;
  saveTickets();
  drawTicket(ticket);
  showStatus(refs.fieldValidation, `Saved ${selectedEdgeKey} = ${value}\".`, true);
});

refs.applyOutageBtn.addEventListener("click", () => {
  const ticket = activeTicket();
  if (!ticket) {
    showStatus(refs.fieldValidation, "Open an assigned ticket first.", false);
    return;
  }
  if (Number.isNaN(parseMeasurement(refs.outageValue.value.trim() || "0"))) {
    showStatus(refs.fieldValidation, "Outage must be a valid measurement.", false);
    return;
  }

  ticket.outage = {
    side: refs.outageSide.value,
    direction: refs.outageDirection.value,
    value: refs.outageValue.value.trim() || "0",
  };
  const check = validateCore(ticket);
  saveTickets();
  drawTicket(ticket);
  showStatus(refs.fieldValidation, check.message, check.valid);
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

renderAssignedList();
refs.svg.innerHTML = '<text x="120" y="120" font-size="24" fill="#6b7280">Open an assigned ticket to begin measuring.</text>';

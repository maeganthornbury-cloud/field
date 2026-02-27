const STORAGE_KEY = "shower-tickets-v3";

function getTickets() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

function saveTickets(tickets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
}

function showStatus(node, message, ok) {
  node.textContent = message;
  node.className = `status ${ok ? "ok" : "bad"}`;
}

function initQuotePage() {
  const form = document.getElementById("quoteForm");
  if (!form) return;

  const status = document.getElementById("quoteStatus");
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const customerName = document.getElementById("customerName").value.trim();
    const address = document.getElementById("address").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const workDescription = document.getElementById("workDescription").value.trim();

    if (!customerName || !address || !phone || !workDescription) {
      showStatus(status, "Please fill in customer name, address, phone, and work description.", false);
      return;
    }

    const assignedTech = window.prompt("Quote saved. Enter the assigned tech name:", "");
    if (!assignedTech || !assignedTech.trim()) {
      showStatus(status, "Quote was not assigned. Please save again and assign a tech.", false);
      return;
    }

    const tickets = getTickets();
    tickets.unshift({
      id: Date.now(),
      customerName,
      address,
      phone,
      workDescription,
      assignedTech: assignedTech.trim(),
      createdAt: new Date().toISOString(),
      status: "assigned",
    });
    saveTickets(tickets);

    form.reset();
    showStatus(status, `Quote request saved and assigned to ${assignedTech.trim()}.`, true);
  });
}

function ticketCard(ticket) {
  return `
    <article class="ticket">
      <strong>${ticket.customerName}</strong><br/>
      <small>Assigned Tech: ${ticket.assignedTech}</small>
      <p><b>Address:</b> ${ticket.address}</p>
      <p><b>Phone:</b> ${ticket.phone}</p>
      <p><b>Description:</b> ${ticket.workDescription}</p>
    </article>
  `;
}

function initFieldPage() {
  const loadBtn = document.getElementById("loadTicketsBtn");
  if (!loadBtn) return;

  const login = document.getElementById("techLogin");
  const list = document.getElementById("ticketList");

  loadBtn.addEventListener("click", () => {
    const tech = login.value.trim().toLowerCase();
    if (!tech) {
      list.innerHTML = "<p>Please enter your tech name.</p>";
      return;
    }

    const assigned = getTickets().filter((t) => t.assignedTech.toLowerCase() === tech);
    if (!assigned.length) {
      list.innerHTML = "<p>No quote requests assigned to this tech.</p>";
      return;
    }

    list.innerHTML = assigned.map(ticketCard).join("");
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

initQuotePage();
initFieldPage();

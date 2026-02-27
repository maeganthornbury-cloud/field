const STORAGE_KEY = "shower-tickets-v4";
const KMPG_ENDPOINT = window.KMPG_CUSTOMER_ENDPOINT || "/api/kmpg/customers";

let cachedCustomers = [];

function fallbackCustomers() {
  return [
    { id: "kmpg-001", name: "KMPG Properties - Unit 101", address: "123 Ocean Ave", city: "Miami", state: "FL", zipCode: "33101", phone: "305-555-0101" },
    { id: "kmpg-002", name: "KMPG Properties - Unit 412", address: "88 Harbor Blvd", city: "Tampa", state: "FL", zipCode: "33602", phone: "813-555-0112" },
    { id: "kmpg-003", name: "KMPG Properties - Penthouse", address: "700 Bayfront Dr", city: "St Petersburg", state: "FL", zipCode: "33701", phone: "727-555-0199" },
  ];
}

async function loadKmpgCustomers(query = "") {
  try {
    const url = `${KMPG_ENDPOINT}?q=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`KMPG request failed (${response.status})`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("KMPG response was not an array");
    cachedCustomers = data;
  } catch {
    const fallback = fallbackCustomers();
    cachedCustomers = query
      ? fallback.filter((customer) => customer.name.toLowerCase().includes(query.toLowerCase()))
      : fallback;
  }
  return cachedCustomers;
}

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

function fillAddressFromCustomer(customer) {
  if (!customer) return;
  document.getElementById("address").value = customer.address || "";
  document.getElementById("city").value = customer.city || "";
  document.getElementById("state").value = customer.state || "";
  document.getElementById("zipCode").value = customer.zipCode || "";
  document.getElementById("phone").value = customer.phone || "";
}

function renderCustomerOptions(customers) {
  const datalist = document.getElementById("customerOptions");
  if (!datalist) return;
  datalist.innerHTML = customers.map((customer) => `<option value="${customer.name}"></option>`).join("");
}

function findCustomerByName(name) {
  return cachedCustomers.find((customer) => customer.name.toLowerCase() === name.trim().toLowerCase());
}

function initQuotePage() {
  const form = document.getElementById("quoteForm");
  if (!form) return;

  const status = document.getElementById("quoteStatus");
  const customerInput = document.getElementById("customerName");

  loadKmpgCustomers("").then(renderCustomerOptions);

  let fetchTimer;
  customerInput.addEventListener("input", () => {
    clearTimeout(fetchTimer);
    fetchTimer = setTimeout(async () => {
      const customers = await loadKmpgCustomers(customerInput.value.trim());
      renderCustomerOptions(customers);
      const exact = findCustomerByName(customerInput.value);
      if (exact) fillAddressFromCustomer(exact);
    }, 180);
  });

  customerInput.addEventListener("change", () => {
    const selected = findCustomerByName(customerInput.value);
    if (selected) fillAddressFromCustomer(selected);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const customerName = document.getElementById("customerName").value.trim();
    const address = document.getElementById("address").value.trim();
    const city = document.getElementById("city").value.trim();
    const state = document.getElementById("state").value.trim().toUpperCase();
    const zipCode = document.getElementById("zipCode").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const workDescription = document.getElementById("workDescription").value.trim();

    if (!customerName || !address || !city || !state || !zipCode || !phone || !workDescription) {
      showStatus(status, "Please fill in customer, address, city, state, zip, phone, and work description.", false);
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
      city,
      state,
      zipCode,
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
      <p><b>Address:</b> ${ticket.address}, ${ticket.city}, ${ticket.state} ${ticket.zipCode}</p>
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

    const assigned = getTickets().filter((ticket) => ticket.assignedTech.toLowerCase() === tech);
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

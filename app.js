const BOOKING_WINDOW_DAYS = 14;
const LOCAL_STORAGE_KEY = "barber-booking-demo-state";
const TIME_SLOTS = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"];

const today = startOfDay(new Date());
const bookingEndDate = addDays(today, BOOKING_WINDOW_DAYS - 1);
const bookingConfig = window.BOOKING_CONFIG || {};
const liveModeEnabled = Boolean(bookingConfig.supabaseUrl && bookingConfig.supabaseAnonKey);

const state = {
  currentMonth: new Date(today.getFullYear(), today.getMonth(), 1),
  selectedDateKey: formatDateKey(today),
  selectedTime: "",
  bookings: {},
  syncTimer: null,
};

const calendarTitle = document.getElementById("calendar-title");
const calendarGrid = document.getElementById("calendar-grid");
const syncStatus = document.getElementById("sync-status");
const selectedDateTitle = document.getElementById("selected-date-title");
const selectedDateCopy = document.getElementById("selected-date-copy");
const timeSlotsElement = document.getElementById("time-slots");
const selectedSlotSummary = document.getElementById("selected-slot-summary");
const bookingForm = document.getElementById("booking-form");
const customerNameInput = document.getElementById("customer-name");
const customerPhoneInput = document.getElementById("customer-phone");
const reserveButton = document.getElementById("reserve-button");
const bookingFeedback = document.getElementById("booking-feedback");
const previousMonthButton = document.getElementById("previous-month");
const nextMonthButton = document.getElementById("next-month");

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLongDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatMonthLabel(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function normalizeBookingRows(rows) {
  return rows.reduce((bookings, row) => {
    if (parseDateKey(row.booking_date) < today || parseDateKey(row.booking_date) > bookingEndDate) {
      return bookings;
    }

    bookings[row.booking_date] = bookings[row.booking_date] || {};
    bookings[row.booking_date][row.booking_time] = {
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      createdAt: row.created_at || "",
    };
    return bookings;
  }, {});
}

function loadLocalBookings() {
  const saved = window.localStorage.getItem(LOCAL_STORAGE_KEY);

  if (!saved) {
    return {};
  }

  try {
    return JSON.parse(saved);
  } catch {
    return {};
  }
}

function saveLocalBookings() {
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state.bookings));
}

function canBookDate(date) {
  const normalizedDate = startOfDay(date);
  return normalizedDate >= today && normalizedDate <= bookingEndDate;
}

function hasBookingOnDate(dateKey) {
  return Boolean(state.bookings[dateKey] && Object.keys(state.bookings[dateKey]).length > 0);
}

function getBooking(dateKey, time) {
  return state.bookings[dateKey]?.[time] || null;
}

function isSlotBooked(dateKey, time) {
  return Boolean(getBooking(dateKey, time));
}

function isSelectedSlot(dateKey, time) {
  return state.selectedDateKey === dateKey && state.selectedTime === time;
}

function getMonthMatrix(monthDate) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const startOffset = firstDay.getDay();
  const firstVisibleDay = addDays(firstDay, -startOffset);
  return Array.from({ length: 42 }, (_, index) => addDays(firstVisibleDay, index));
}

function updateMonthButtons() {
  const previousMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() - 1, 1);
  const nextMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() + 1, 1);
  previousMonthButton.disabled = previousMonth < new Date(today.getFullYear(), today.getMonth(), 1);
  nextMonthButton.disabled = nextMonth > new Date(bookingEndDate.getFullYear(), bookingEndDate.getMonth(), 1);
}

function updateSyncStatus(message, type = "muted") {
  syncStatus.textContent = message;
  syncStatus.className = `status-copy ${type}`;
}

function updateFeedback(message, type = "muted") {
  bookingFeedback.textContent = message;
  bookingFeedback.className = `feedback ${type}`;
}

function validatePhoneNumber(phone) {
  return /^[+()\d\s-]{7,20}$/.test(phone.trim());
}

function renderCalendar() {
  calendarTitle.textContent = formatMonthLabel(state.currentMonth);
  calendarGrid.innerHTML = "";
  updateMonthButtons();

  getMonthMatrix(state.currentMonth).forEach((date) => {
    const dateKey = formatDateKey(date);
    const isCurrentMonth = date.getMonth() === state.currentMonth.getMonth();
    const open = canBookDate(date);
    const selected = state.selectedDateKey === dateKey;
    const booked = hasBookingOnDate(dateKey);

    const button = document.createElement("button");
    button.type = "button";
    button.className = [
      "calendar-day",
      isCurrentMonth ? "" : "outside",
      open ? "open" : "closed",
      selected ? "selected" : "",
      booked ? "has-booking" : "",
    ]
      .filter(Boolean)
      .join(" ");

    button.disabled = !open;
    button.innerHTML = `
      <strong>${date.getDate()}</strong>
      <small>${open ? (booked ? "Reserved slot saved" : "Open for booking") : "Outside booking window"}</small>
      <span class="status-pill ${open ? (booked ? "booked" : "available") : "closed"}">
        ${open ? (booked ? "Booked" : "Available") : "Closed"}
      </span>
    `;

    if (open) {
      button.addEventListener("click", () => {
        state.selectedDateKey = dateKey;
        state.selectedTime = "";
        renderAll();
      });
    }

    calendarGrid.appendChild(button);
  });
}

function renderTimeSlots() {
  const selectedDate = parseDateKey(state.selectedDateKey);
  selectedDateTitle.textContent = formatLongDate(selectedDate);
  selectedDateCopy.textContent = `Pick an available time below. Booked slots update automatically ${liveModeEnabled ? "from Supabase" : "in demo mode on this browser"}.`;
  timeSlotsElement.innerHTML = "";

  TIME_SLOTS.forEach((time) => {
    const existingBooking = getBooking(state.selectedDateKey, time);
    const button = document.createElement("button");
    const buttonClasses = ["time-slot"];

    if (existingBooking) {
      buttonClasses.push("booked");
      button.disabled = true;
      button.textContent = `${time} — Reserved`;
    } else {
      button.disabled = false;
      button.textContent = `${time} — Select`;
      button.addEventListener("click", () => {
        state.selectedTime = time;
        renderBookingForm();
        renderTimeSlots();
      });
    }

    if (isSelectedSlot(state.selectedDateKey, time) && !existingBooking) {
      buttonClasses.push("selected-slot");
    }

    button.type = "button";
    button.className = buttonClasses.join(" ");
    timeSlotsElement.appendChild(button);
  });
}

function renderBookingForm() {
  if (!state.selectedTime) {
    selectedSlotSummary.textContent = `Selected date: ${formatLongDate(parseDateKey(state.selectedDateKey))}. Now choose a time.`;
    reserveButton.disabled = true;
    return;
  }

  selectedSlotSummary.textContent = `Booking ${formatLongDate(parseDateKey(state.selectedDateKey))} at ${state.selectedTime}.`;
  reserveButton.disabled = false;
}

function renderAll() {
  renderCalendar();
  renderTimeSlots();
  renderBookingForm();
}

function getApiHeaders(includeJson = false) {
  return {
    apikey: bookingConfig.supabaseAnonKey,
    Authorization: `Bearer ${bookingConfig.supabaseAnonKey}`,
    ...(includeJson ? { "Content-Type": "application/json", Prefer: "return=representation" } : {}),
  };
}

async function fetchRemoteBookings() {
  const url = new URL(`${bookingConfig.supabaseUrl}/rest/v1/${bookingConfig.bookingsTable || "bookings"}`);
  url.searchParams.set("select", "booking_date,booking_time,customer_name,customer_phone,created_at");
  url.searchParams.set("booking_date", `gte.${formatDateKey(today)}`);
  url.searchParams.set("order", "booking_date.asc,booking_time.asc");

  const response = await fetch(url, { headers: getApiHeaders() });

  if (!response.ok) {
    throw new Error("Unable to load live bookings.");
  }

  const rows = await response.json();
  state.bookings = normalizeBookingRows(rows);
  renderAll();
}

async function saveRemoteBooking(payload) {
  const url = `${bookingConfig.supabaseUrl}/rest/v1/${bookingConfig.bookingsTable || "bookings"}`;
  const response = await fetch(url, {
    method: "POST",
    headers: getApiHeaders(true),
    body: JSON.stringify([payload]),
  });

  if (!response.ok) {
    throw new Error("That slot was just booked by someone else. Please choose another time.");
  }

  await fetchRemoteBookings();
}

async function loadBookings() {
  if (!liveModeEnabled) {
    state.bookings = loadLocalBookings();
    updateSyncStatus("Demo mode: bookings are stored only in this browser.");
    renderAll();
    return;
  }

  updateSyncStatus("Live mode: loading reservations from Supabase…");

  try {
    await fetchRemoteBookings();
    updateSyncStatus(`Live mode: auto-refreshing every ${Math.round((bookingConfig.pollIntervalMs || 15000) / 1000)} seconds.`, "success");
  } catch (error) {
    state.bookings = {};
    renderAll();
    updateSyncStatus(error.message, "error");
  }
}

async function handleReservationSubmit(event) {
  event.preventDefault();

  const customerName = customerNameInput.value.trim();
  const customerPhone = customerPhoneInput.value.trim();

  if (!state.selectedTime) {
    updateFeedback("Please choose a time slot first.", "error");
    return;
  }

  if (!customerName) {
    updateFeedback("Please enter the customer name.", "error");
    return;
  }

  if (!validatePhoneNumber(customerPhone)) {
    updateFeedback("Please enter a valid mobile phone number.", "error");
    return;
  }

  if (isSlotBooked(state.selectedDateKey, state.selectedTime)) {
    updateFeedback("That slot is already booked. Please pick another time.", "error");
    return;
  }

  reserveButton.disabled = true;
  updateFeedback("Saving reservation…");

  const reservationPayload = {
    booking_date: state.selectedDateKey,
    booking_time: state.selectedTime,
    customer_name: customerName,
    customer_phone: customerPhone,
  };

  try {
    if (liveModeEnabled) {
      await saveRemoteBooking(reservationPayload);
    } else {
      state.bookings[state.selectedDateKey] = {
        ...(state.bookings[state.selectedDateKey] || {}),
        [state.selectedTime]: {
          customerName,
          customerPhone,
          createdAt: new Date().toISOString(),
        },
      };
      saveLocalBookings();
      renderAll();
    }

    updateFeedback(`Reservation saved for ${customerName} on ${state.selectedDateKey} at ${state.selectedTime}.`, "success");
    bookingForm.reset();
    state.selectedTime = "";
    renderAll();
  } catch (error) {
    updateFeedback(error.message, "error");
  } finally {
    renderBookingForm();
  }
}

function setupPolling() {
  if (!liveModeEnabled) {
    return;
  }

  if (state.syncTimer) {
    window.clearInterval(state.syncTimer);
  }

  state.syncTimer = window.setInterval(async () => {
    try {
      await fetchRemoteBookings();
    } catch (error) {
      updateSyncStatus(error.message, "error");
    }
  }, bookingConfig.pollIntervalMs || 15000);
}

previousMonthButton.addEventListener("click", () => {
  state.currentMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() - 1, 1);
  renderCalendar();
});

nextMonthButton.addEventListener("click", () => {
  state.currentMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() + 1, 1);
  renderCalendar();
});

bookingForm.addEventListener("submit", handleReservationSubmit);

renderAll();
loadBookings();
setupPolling();

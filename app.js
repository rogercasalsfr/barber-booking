const BOOKING_WINDOW_DAYS = 14;
const STORAGE_KEY = "barber-booking-calendar-state";
const TIME_SLOTS = [
  "09:00",
  "10:00",
  "11:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
];

const today = startOfDay(new Date());
const bookingEndDate = addDays(today, BOOKING_WINDOW_DAYS - 1);

const state = {
  currentMonth: new Date(today.getFullYear(), today.getMonth(), 1),
  selectedDateKey: formatDateKey(today),
  bookings: loadBookings(),
};

const calendarTitle = document.getElementById("calendar-title");
const calendarGrid = document.getElementById("calendar-grid");
const selectedDateTitle = document.getElementById("selected-date-title");
const selectedDateCopy = document.getElementById("selected-date-copy");
const timeSlotsElement = document.getElementById("time-slots");
const bookingSummary = document.getElementById("booking-summary");
const previousMonthButton = document.getElementById("previous-month");
const nextMonthButton = document.getElementById("next-month");
const clearBookingButton = document.getElementById("clear-booking");
const resetAllButton = document.getElementById("reset-all");

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

function loadBookings() {
  const saved = window.localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return {};
  }

  try {
    return JSON.parse(saved);
  } catch {
    return {};
  }
}

function saveBookings() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.bookings));
}

function canBookDate(date) {
  return startOfDay(date) >= today && startOfDay(date) <= bookingEndDate;
}

function hasBookingOnDate(dateKey) {
  return Boolean(state.bookings[dateKey] && Object.keys(state.bookings[dateKey]).length > 0);
}

function isSlotBooked(dateKey, time) {
  return Boolean(state.bookings[dateKey]?.[time]);
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
        renderAll();
      });
    }

    calendarGrid.appendChild(button);
  });
}

function renderTimeSlots() {
  const selectedDate = parseDateKey(state.selectedDateKey);
  const selectedLabel = formatLongDate(selectedDate);

  selectedDateTitle.textContent = selectedLabel;
  selectedDateCopy.textContent = `Appointments are open from ${TIME_SLOTS[0]} to ${TIME_SLOTS[TIME_SLOTS.length - 1]}. Click a time to reserve it.`;
  timeSlotsElement.innerHTML = "";

  TIME_SLOTS.forEach((time) => {
    const button = document.createElement("button");
    const booked = isSlotBooked(state.selectedDateKey, time);
    const active = state.bookings[state.selectedDateKey]?.[time] === true;

    button.type = "button";
    button.className = ["time-slot", booked ? "booked" : "", active ? "active" : ""]
      .filter(Boolean)
      .join(" ");
    button.disabled = booked;
    button.textContent = booked ? `${time} — Reserved` : `${time} — Reserve`;

    if (!booked) {
      button.addEventListener("click", () => reserveSlot(state.selectedDateKey, time));
    }

    timeSlotsElement.appendChild(button);
  });
}

function reserveSlot(dateKey, time) {
  state.bookings[dateKey] = {
    ...(state.bookings[dateKey] || {}),
    [time]: true,
  };

  saveBookings();
  renderAll();
}

function clearSelectedDateBookings() {
  delete state.bookings[state.selectedDateKey];
  saveBookings();
  renderAll();
}

function resetAllBookings() {
  state.bookings = {};
  saveBookings();
  renderAll();
}

function renderBookingSummary() {
  const bookedTimes = Object.entries(state.bookings)
    .flatMap(([dateKey, slots]) => Object.keys(slots).map((time) => ({ dateKey, time })))
    .sort((a, b) => `${a.dateKey}-${a.time}`.localeCompare(`${b.dateKey}-${b.time}`));

  if (!bookedTimes.length) {
    bookingSummary.textContent = "No reservation saved yet.";
    clearBookingButton.disabled = true;
    resetAllButton.disabled = true;
    return;
  }

  const firstBooking = bookedTimes[0];
  bookingSummary.textContent = `${formatLongDate(parseDateKey(firstBooking.dateKey))} at ${firstBooking.time}. ${bookedTimes.length > 1 ? `(${bookedTimes.length} total reserved slots)` : ""}`.trim();
  clearBookingButton.disabled = !hasBookingOnDate(state.selectedDateKey);
  resetAllButton.disabled = false;
}

function renderAll() {
  renderCalendar();
  renderTimeSlots();
  renderBookingSummary();
}

previousMonthButton.addEventListener("click", () => {
  state.currentMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() - 1, 1);
  renderCalendar();
});

nextMonthButton.addEventListener("click", () => {
  state.currentMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() + 1, 1);
  renderCalendar();
});

clearBookingButton.addEventListener("click", clearSelectedDateBookings);
resetAllButton.addEventListener("click", resetAllBookings);

renderAll();

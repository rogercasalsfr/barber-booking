const DAYS_TO_SHOW = 7;
const TIME_SLOTS = [
  "09:00 AM",
  "10:00 AM",
  "11:00 AM",
  "01:00 PM",
  "02:00 PM",
  "03:00 PM",
  "04:00 PM",
];

const state = {
  selectedBooking: null,
  bookings: {},
};

const calendarElement = document.getElementById("calendar");
const selectedBookingElement = document.getElementById("selected-booking");
const generateCalendarButton = document.getElementById("generate-calendar");
const resetBookingsButton = document.getElementById("reset-bookings");

function generateUpcomingDays(startDate = new Date(), numberOfDays = DAYS_TO_SHOW) {
  return Array.from({ length: numberOfDays }, (_, offset) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + offset);

    return {
      key: formatDateKey(date),
      dayLabel: new Intl.DateTimeFormat("en-US", {
        weekday: "long",
      }).format(date),
      dateLabel: new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }).format(date),
    };
  });
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isBooked(dateKey, slot) {
  return Boolean(state.bookings[dateKey]?.[slot]);
}

function setBooking(dateKey, slot) {
  state.bookings[dateKey] = {
    ...(state.bookings[dateKey] || {}),
    [slot]: true,
  };

  state.selectedBooking = { dateKey, slot };
  updateSelectedBooking();
}

function updateSelectedBooking() {
  if (!state.selectedBooking) {
    selectedBookingElement.textContent = "No appointment selected yet.";
    return;
  }

  selectedBookingElement.textContent = `Booked ${state.selectedBooking.dateKey} at ${state.selectedBooking.slot}.`;
}

function renderCalendar(days = generateUpcomingDays()) {
  calendarElement.innerHTML = "";

  if (!days.length) {
    calendarElement.innerHTML =
      '<div class="empty-state">No dates available for booking.</div>';
    return;
  }

  days.forEach((day) => {
    const card = document.createElement("article");
    card.className = "day-card";

    const slotsMarkup = TIME_SLOTS.map((slot) => {
      const booked = isBooked(day.key, slot);

      return `
        <div class="slot-row ${booked ? "booked" : ""}">
          <div>
            <div class="slot-label">${slot}</div>
            <div class="slot-meta">${booked ? "Already booked" : "Available now"}</div>
          </div>
          ${
            booked
              ? '<span class="booking-badge">Booked</span>'
              : `<button class="slot-button" type="button" data-date="${day.key}" data-slot="${slot}">Book</button>`
          }
        </div>
      `;
    }).join("");

    card.innerHTML = `
      <div class="day-card-header">
        <h3>${day.dayLabel}</h3>
        <p>${day.dateLabel}</p>
      </div>
      <div class="slots">${slotsMarkup}</div>
    `;

    calendarElement.appendChild(card);
  });

  calendarElement.querySelectorAll(".slot-button").forEach((button) => {
    button.addEventListener("click", () => {
      setBooking(button.dataset.date, button.dataset.slot);
      renderCalendar(days);
    });
  });
}

function resetBookings() {
  state.bookings = {};
  state.selectedBooking = null;
  updateSelectedBooking();
  renderCalendar();
}

generateCalendarButton.addEventListener("click", () => {
  renderCalendar(generateUpcomingDays());
});

resetBookingsButton.addEventListener("click", resetBookings);

renderCalendar();
updateSelectedBooking();

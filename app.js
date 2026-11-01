const DEFAULT_TRAINS = [
  { trainNumber: 101, trainName: 'Deccan Express', source: 'Pune', destination: 'Mumbai', totalSeats: 15, availableSeats: 15 },
  { trainNumber: 102, trainName: 'Sinhagad Express', source: 'Pune', destination: 'Mumbai', totalSeats: 15, availableSeats: 15 },
  { trainNumber: 103, trainName: 'Sahyadri Express', source: 'Pune', destination: 'Kolhapur', totalSeats: 15, availableSeats: 15 },
  { trainNumber: 104, trainName: 'Pragati Express', source: 'Pune', destination: 'Mumbai', totalSeats: 15, availableSeats: 15 },
  { trainNumber: 105, trainName: 'Intercity Express', source: 'Pune', destination: 'Nashik', totalSeats: 15, availableSeats: 15 },
  { trainNumber: 106, trainName: 'Maharashtra Express', source: 'Pune', destination: 'Nagpur', totalSeats: 15, availableSeats: 15 },
  { trainNumber: 107, trainName: 'Pune Goa Express', source: 'Pune', destination: 'Madgaon', totalSeats: 15, availableSeats: 15 },
  { trainNumber: 108, trainName: 'Pune Hyderabad Express', source: 'Pune', destination: 'Hyderabad', totalSeats: 15, availableSeats: 15 },
  { trainNumber: 109, trainName: 'Pune Bengaluru Express', source: 'Pune', destination: 'Bengaluru', totalSeats: 15, availableSeats: 15 },
  { trainNumber: 110, trainName: 'Pune Delhi Express', source: 'Pune', destination: 'New Delhi', totalSeats: 15, availableSeats: 15 },
  { trainNumber: 111, trainName: 'Pune Chennai Express', source: 'Pune', destination: 'Chennai', totalSeats: 15, availableSeats: 15 },
  { trainNumber: 112, trainName: 'Pune Ahmedabad Express', source: 'Pune', destination: 'Ahmedabad', totalSeats: 15, availableSeats: 15 },
  { trainNumber: 113, trainName: 'Pune Surat Express', source: 'Pune', destination: 'Surat', totalSeats: 15, availableSeats: 15 },
  { trainNumber: 114, trainName: 'Pune Indore Express', source: 'Pune', destination: 'Indore', totalSeats: 15, availableSeats: 15 },
  { trainNumber: 115, trainName: 'Pune Bhopal Express', source: 'Pune', destination: 'Bhopal', totalSeats: 15, availableSeats: 15 },
  { trainNumber: 116, trainName: 'Pune Jaipur Express', source: 'Pune', destination: 'Jaipur', totalSeats: 15, availableSeats: 15 },
  { trainNumber: 117, trainName: 'Pune Solapur Express', source: 'Pune', destination: 'Solapur', totalSeats: 15, availableSeats: 15 },
  { trainNumber: 118, trainName: 'Pune Belagavi Express', source: 'Pune', destination: 'Belagavi', totalSeats: 15, availableSeats: 15 },
  { trainNumber: 119, trainName: 'Pune Vijayawada Express', source: 'Pune', destination: 'Vijayawada', totalSeats: 15, availableSeats: 15 },
  { trainNumber: 120, trainName: 'Pune Thane Express', source: 'Pune', destination: 'Thane', totalSeats: 15, availableSeats: 15 },
  { trainNumber: 121, trainName: 'Pune Amravati Express', source: 'Pune', destination: 'Amravati', totalSeats: 15, availableSeats: 15 },
  { trainNumber: 122, trainName: 'Pune Visakhapatnam Express', source: 'Pune', destination: 'Visakhapatnam', totalSeats: 15, availableSeats: 15 }
];

const STORAGE_KEY = 'railwayDeskFrontendV1';

let selectedSeat = null;
let currentView = 'dashboard';
let trainsSorted = false;


// INITIALIZE APPLICATION STATE

function freshState() {
  return {
    trains: structuredClone(DEFAULT_TRAINS),
    passengers: [],
    waiting: [],
    cancellations: [],
    nextPNR: 1001,
    promotedCount: 0
  };
}


function readState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return freshState();
    }

    const parsed = JSON.parse(saved);

    if (
      !Array.isArray(parsed.passengers) ||
      !Array.isArray(parsed.waiting) ||
      !Array.isArray(parsed.cancellations)
    ) {
      return freshState();
    }

    // Rebuild the fleet using the updated 22-train array.
    // Preserve existing demo passengers and history.
    const updatedTrains = DEFAULT_TRAINS.map(train => {
      const confirmedCount = parsed.passengers.filter(
        passenger =>
          Number(passenger.trainNumber) === train.trainNumber
      ).length;

      return {
        ...train,
        availableSeats: Math.max(
          0,
          train.totalSeats - confirmedCount
        )
      };
    });

    // Keep PNR numbers from continuing below existing bookings.
    const allPassengers = [
      ...parsed.passengers,
      ...parsed.waiting,
      ...parsed.cancellations
    ];

    const highestPNR = allPassengers.reduce(
      (maximum, passenger) =>
        Math.max(maximum, Number(passenger.pnr) || 0),
      1000
    );

    return {
      ...parsed,
      trains: updatedTrains,
      nextPNR: Math.max(
        1001,
        Number(parsed.nextPNR) || 1001,
        highestPNR + 1
      ),
      promotedCount: Number(parsed.promotedCount) || 0
    };

  } catch (error) {
    console.error("Could not load saved data:", error);
    return freshState();
  }
}


let state = readState();


function persist() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(state)
  );
}


// HELPER FUNCTIONS

function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[ch])
  );
}


function trainFor(number) {
  return state.trains.find(
    t => t.trainNumber === Number(number)
  );
}


function getTrainIndex(number) {
  return state.trains.findIndex(
    t => t.trainNumber === Number(number)
  );
}


function waitingFor(number) {
  return state.waiting.filter(
    p => p.trainNumber === Number(number)
  );
}


function bookedSeats(number) {
  return state.passengers
    .filter(p => p.trainNumber === Number(number))
    .map(p => Number(p.seatNumber));
}


function usedSeats() {
  return state.trains.reduce(
    (sum, t) => sum + (t.totalSeats - t.availableSeats),
    0
  );
}


function allSeats() {
  return state.trains.reduce(
    (sum, t) => sum + t.totalSeats,
    0
  );
}


function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(s => s[0] || '')
    .join('')
    .toUpperCase();
}


function escapeName(name) {
  return esc(name);
}


// NOTIFICATION MESSAGES

function toast(message, isError = false) {
  const el = document.createElement('div');

  el.className = `toast${isError ? ' error' : ''}`;

  el.innerHTML = `
    <span class="toast-icon">
      ${isError ? '!' : '✓'}
    </span>
    <span>${esc(message)}</span>
  `;

  document.getElementById('toastRegion').appendChild(el);

  setTimeout(() => el.remove(), 3400);
}


// MODAL WINDOW

function openModal(
  title,
  message,
  details = [],
  icon = '✓'
) {
  document.getElementById('modalTitle').textContent =
    title;

  document.getElementById('modalMessage').textContent =
    message;

  document.getElementById('modalIcon').textContent =
    icon;

  document.getElementById('modalDetails').innerHTML =
    details.map(([label, value]) => `
      <div class="modal-detail-row">
        <span>${esc(label)}</span>
        <strong>${esc(value)}</strong>
      </div>
    `).join('');

  document.getElementById('modalBackdrop').hidden =
    false;
}


function closeModal() {
  document.getElementById('modalBackdrop').hidden =
    true;
}


// NAVIGATION

function viewName(view) {
  return ({
    dashboard: 'Dashboard',
    trains: 'Trains & seats',
    book: 'Book a ticket',
    passengers: 'Passengers',
    waiting: 'Waiting list',
    lookup: 'PNR lookup',
    cancellations: 'Cancellations'
  })[view] || 'Dashboard';
}


function goTo(view) {
  if (!document.getElementById(`view-${view}`)) {
    return;
  }

  currentView = view;

  document.querySelectorAll('.view').forEach(el => {
    el.classList.toggle(
      'active',
      el.id === `view-${view}`
    );
  });

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle(
      'active',
      el.dataset.view === view
    );
  });

  document.getElementById('currentSection').textContent =
    viewName(view);

  document.getElementById('sidebar').classList.remove(
    'open'
  );

  renderAll();

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}


// TRAIN STATUS AND AVAILABILITY

function statusFor(train) {
  if (train.availableSeats === 0) {
    return ['Full', 'status-full'];
  }

  if (train.availableSeats <= 3) {
    return ['Limited', 'status-limited'];
  }

  return ['Available', 'status-open'];
}


function availabilityMarkup(train) {
  const used = train.totalSeats - train.availableSeats;

  const percent = Math.max(
    0,
    Math.min(100, (used / train.totalSeats) * 100)
  );

  const color =
    percent >= 100 ? 'low' :
    percent >= 70 ? 'medium' : '';

  return `
    <div class="availability-cell">
      <div class="availability-text">
        <span>
          ${train.availableSeats} of ${train.totalSeats} left
        </span>
        <span>
          ${Math.round(
            (train.availableSeats / train.totalSeats) * 100
          )}%
        </span>
      </div>

      <div class="progress-track">
        <div
          class="progress-fill ${color}"
          style="width:${percent}%"
        ></div>
      </div>
    </div>
  `;
}


function trainBadge() {
  return '<span class="train-badge" aria-hidden="true">↗</span>';
}


// GENERATE TRAIN TABLE ROWS

function trainRows(dashboard = false, query = '') {
  let list = [...state.trains];

  if (trainsSorted) {
    list.sort((a, b) => a.trainNumber - b.trainNumber);
  }

  const q = query.trim().toLowerCase();

  if (q) {
    list = list.filter(t =>
      `${t.trainNumber} ${t.trainName} ${t.source} ${t.destination}`
        .toLowerCase()
        .includes(q)
    );
  }

  return list.map(t => {
    const [status, cls] = statusFor(t);

    const waitCount = waitingFor(t.trainNumber).length;

    if (dashboard) {
      return `
        <tr>
          <td>
            <div class="train-name-cell">
              ${trainBadge()}
              <div>
                <strong>${esc(t.trainName)}</strong>
                <small>Train ${t.trainNumber}</small>
              </div>
            </div>
          </td>

          <td>
            <div class="route-cell">
              <span>${esc(t.source)}</span>
              <span class="route-arrow">→</span>
              <span>${esc(t.destination)}</span>
            </div>
          </td>

          <td>${availabilityMarkup(t)}</td>

          <td>
            <span class="status-chip ${cls}">
              ${status}
            </span>
          </td>

          <td>
            <button
              class="small-action"
              data-book-train="${t.trainNumber}"
            >
              Book
            </button>
          </td>
        </tr>
      `;
    }

    return `
      <tr>
        <td>
          <div class="train-name-cell">
            ${trainBadge()}
            <div>
              <strong>${esc(t.trainName)}</strong>
              <small>
                ${esc(t.source)} → ${esc(t.destination)}
              </small>
            </div>
          </div>
        </td>

        <td>
          <span class="train-number">
            ${t.trainNumber}
          </span>
        </td>

        <td>
          <div class="route-cell">
            <span>${esc(t.source)}</span>
            <span class="route-arrow">→</span>
            <span>${esc(t.destination)}</span>
          </div>
        </td>

        <td>
          ${availabilityMarkup(t)}

          <div style="margin-top:7px">
            <span class="status-chip ${cls}">
              ${status}
            </span>
          </div>
        </td>

        <td>
          <span class="${
            waitCount
              ? 'status-chip status-limited'
              : 'status-chip status-open'
          }">
            ${waitCount} / 5
          </span>
        </td>

        <td>
          <button
            class="small-action"
            data-book-train="${t.trainNumber}"
          >
            ${t.availableSeats > 0 ? 'Book seat' : 'Join queue'}
          </button>
        </td>
      </tr>
    `;
  }).join('');
}


// DASHBOARD

function renderDashboard() {
  document.getElementById('statTrains').textContent =
    state.trains.length;

  document.getElementById('statPassengers').textContent =
    state.passengers.length;

  document.getElementById('statSeats').textContent =
    state.trains.reduce(
      (n, t) => n + t.availableSeats,
      0
    );

  document.getElementById('statWaiting').textContent =
    state.waiting.length;

  document.getElementById('seatFoot').textContent =
    `Out of ${allSeats()} total seats`;

  document.getElementById('dashboardTrainRows').innerHTML =
    trainRows(true);

  const recent = [...state.passengers]
    .reverse()
    .slice(0, 4);

  document.getElementById('recentBookings').innerHTML =
    recent.length
      ? recent.map(p => `
          <div class="recent-item">
            <div class="passenger-avatar">
              ${esc(initials(p.name))}
            </div>

            <div class="recent-meta">
              <strong>${escapeName(p.name)}</strong>
              <small>
                ${esc(
                  trainFor(p.trainNumber)?.trainName ||
                  `Train ${p.trainNumber}`
                )}
                · Seat ${p.seatNumber}
              </small>
            </div>

            <span class="recent-pnr">#${p.pnr}</span>
          </div>
        `).join('')
      : `
          <div class="recent-empty">
            No reservations yet. Your latest bookings will show here.
          </div>
        `;
}


// TRAIN PAGE

function renderTrainPage() {
  document.getElementById('allTrainRows').innerHTML =
    trainRows(
      false,
      document.getElementById('trainSearch').value
    );
}


// BOOKING FORM

function updateBookingOptions() {
  const select = document.getElementById('bookingTrain');

  const value = select.value;

  select.innerHTML =
    '<option value="">Choose a train…</option>' +
    state.trains.map(t => `
      <option value="${t.trainNumber}">
        ${t.trainNumber} — ${esc(t.trainName)}
        (${esc(t.source)} to ${esc(t.destination)})
      </option>
    `).join('');

  if (value && trainFor(value)) {
    select.value = value;
  }

  refreshBookingDetails();
}


function refreshBookingDetails() {
  const train = trainFor(
    document.getElementById('bookingTrain').value
  );

  const seatMap = document.getElementById('seatMap');

  document.getElementById('summarySource').textContent =
    train?.source || '—';

  document.getElementById('summaryDestination').textContent =
    train?.destination || '—';

  document.getElementById('summaryTrain').textContent =
    train
      ? `${train.trainNumber} · ${train.trainName}`
      : 'Not selected';

  document.getElementById('summaryAvailability').textContent =
    train
      ? `${train.availableSeats} seat${
          train.availableSeats === 1 ? '' : 's'
        } left`
      : '—';

  document.getElementById('routePreview').innerHTML = `
    <div class="route-end">
      <span class="route-point"></span>
      <div>
        <small>FROM</small>
        <strong>${esc(train?.source || 'Select a train')}</strong>
      </div>
    </div>

    <div class="route-line">
      <span>TRAIN JOURNEY</span>
    </div>

    <div class="route-end route-end-right">
      <span class="route-point"></span>
      <div>
        <small>TO</small>
        <strong>${esc(train?.destination || '—')}</strong>
      </div>
    </div>
  `;

  const name = document
    .getElementById('passengerName')
    .value
    .trim();

  document.getElementById('summaryPassenger').textContent =
    name || '—';

  if (!train) {
    selectedSeat = null;

    seatMap.className = 'seat-map empty-state';

    seatMap.innerHTML =
      '<span>Select a train to view seats.</span>';

    document.getElementById('selectedSeatLine').textContent =
      'No seat selected';

    document.getElementById('summarySeat').textContent =
      '—';

    return;
  }

  const reserved = new Set(
    bookedSeats(train.trainNumber)
  );

  if (selectedSeat && reserved.has(Number(selectedSeat))) {
    selectedSeat = null;
  }

  seatMap.className = 'seat-map';

  seatMap.innerHTML = Array.from(
    { length: train.totalSeats },
    (_, i) => {
      const num = i + 1;
      const taken = reserved.has(num);
      const selected = selectedSeat === num;

      return `
        <button
          type="button"
          class="seat${taken ? ' reserved' : ''}${selected ? ' selected' : ''}"
          data-seat="${num}"
          ${taken ? 'disabled' : ''}
          aria-label="Seat ${num}${
            taken
              ? ' reserved'
              : selected
                ? ' selected'
                : ' available'
          }"
        >
          ${String(num).padStart(2, '0')}
        </button>
      `;
    }
  ).join('');

  document.getElementById('selectedSeatLine').innerHTML =
    selectedSeat
      ? `Selected seat: <strong>${selectedSeat}</strong>`
      : 'Choose an available seat above';

  document.getElementById('summarySeat').textContent =
    selectedSeat ? `Seat ${selectedSeat}` : '—';

  document.getElementById('confirmBooking').textContent =
    train.availableSeats === 0
      ? 'Join waiting list →'
      : 'Confirm reservation →';
}


// CONFIRMED PASSENGERS

function renderPassengers() {
  const q = document
    .getElementById('passengerSearch')
    .value
    .toLowerCase()
    .trim();

  const list = state.passengers.filter(p =>
    `${p.name} ${p.pnr} ${p.trainNumber} ${
      trainFor(p.trainNumber)?.trainName || ''
    }`.toLowerCase().includes(q)
  );

  document.getElementById('passengerResultLabel').textContent =
    `${list.length} passenger${list.length === 1 ? '' : 's'}`;

  document.getElementById('passengerRows').innerHTML =
    list.map(p => `
      <tr>
        <td>
          <div class="train-name-cell">
            <span class="passenger-avatar">
              ${esc(initials(p.name))}
            </span>

            <div>
              <strong>${escapeName(p.name)}</strong>
              <small>Passenger record</small>
            </div>
          </div>
        </td>

        <td>
          <span class="train-number">${p.pnr}</span>
        </td>

        <td>
          ${esc(
            trainFor(p.trainNumber)?.trainName ||
            `Train ${p.trainNumber}`
          )}

          <small style="display:block;color:#98a5ae;margin-top:4px">
            ${p.trainNumber}
          </small>
        </td>

        <td><strong>Seat ${p.seatNumber}</strong></td>

        <td>${p.age} / ${esc(p.gender)}</td>

        <td>
          <span class="status-chip status-open">
            Confirmed
          </span>
        </td>

        <td>
          <button
            class="small-action"
            data-cancel-pnr="${p.pnr}"
          >
            Cancel
          </button>
        </td>
      </tr>
    `).join('');

  document.getElementById('passengerEmpty').hidden =
    list.length > 0;

  document.getElementById('passengerNavCount').textContent =
    state.passengers.length;
}


// WAITING LIST

function renderWaiting() {
  document.getElementById('waitingNavCount').textContent =
    state.waiting.length;

  document.getElementById('waitingCapacity').textContent =
    `${state.waiting.length} / ${state.trains.length * 5}`;

  const cards = state.trains
    .map(t => {
      const passengers = waitingFor(t.trainNumber);

      if (!passengers.length) {
        return '';
      }

      return `
        <section class="waiting-train-card">
          <div class="waiting-train-heading">
            <div>
              <strong>${esc(t.trainName)}</strong>
              <small>
                ${t.trainNumber} ·
                ${esc(t.source)} → ${esc(t.destination)}
              </small>
            </div>

            <span class="queue-count">
              ${passengers.length} / 5 waiting
            </span>
          </div>

          ${passengers.map((p, i) => `
            <div class="waiting-person">
              <span class="queue-position">${i + 1}</span>

              <div class="waiting-person-meta">
                <strong>${escapeName(p.name)}</strong>
                <small>PNR ${p.pnr} · Age ${p.age}</small>
              </div>

              <span class="waiting-label">
                Position ${i + 1}
              </span>
            </div>
          `).join('')}
        </section>
      `;
    })
    .filter(Boolean)
    .join('');

  document.getElementById('waitingCards').innerHTML =
    cards ||
    `
      <section class="panel empty-panel" style="grid-column:1/-1">
        <div class="empty-illustration">◷</div>
        <h3>No one on the waiting list</h3>
        <p>
          When a train is full, passengers can join its waiting queue.
        </p>
      </section>
    `;
}


// CANCELLATION HISTORY

function renderCancellations() {
  document.getElementById('cancelCount').textContent =
    state.cancellations.length;

  document.getElementById('promotedCount').textContent =
    state.promotedCount || 0;

  const list = [...state.cancellations].reverse();

  document.getElementById('cancellationRows').innerHTML =
    list.map(p => `
      <tr>
        <td>
          <div class="train-name-cell">
            <span class="passenger-avatar">
              ${esc(initials(p.name))}
            </span>

            <div>
              <strong>${escapeName(p.name)}</strong>
              <small>Cancelled reservation</small>
            </div>
          </div>
        </td>

        <td>
          <span class="train-number">${p.pnr}</span>
        </td>

        <td>
          ${esc(
            trainFor(p.trainNumber)?.trainName ||
            `Train ${p.trainNumber}`
          )}

          <small style="display:block;color:#98a5ae;margin-top:4px">
            ${p.trainNumber}
          </small>
        </td>

        <td>Seat ${p.seatNumber}</td>

        <td>${p.age} / ${esc(p.gender)}</td>

        <td>
          <span class="status-chip status-full">
            Cancelled
          </span>
        </td>
      </tr>
    `).join('');

  document.getElementById('cancellationEmpty').hidden =
    list.length > 0;
}


// REFRESH ALL SECTIONS

function renderAll() {
  renderDashboard();
  renderTrainPage();
  renderPassengers();
  renderWaiting();
  renderCancellations();
  updateBookingOptions();
}


function selectTrainForBooking(number) {
  goTo('book');

  document.getElementById('bookingTrain').value =
    String(number);

  selectedSeat = null;

  refreshBookingDetails();
}


// ADD PASSENGER TO WAITING LIST

function bookWaitingPassenger(
  train,
  name,
  age,
  gender
) {
  const queue = waitingFor(train.trainNumber);

  if (queue.length >= 5) {
    toast(
      'The waiting list for this train is full.',
      true
    );

    return false;
  }

  const pnr = state.nextPNR++;

  state.waiting.push({
    pnr,
    name,
    age,
    gender,
    trainNumber: train.trainNumber
  });

  persist();
  renderAll();

  openModal(
    'Added to waiting list',
    'The train is full, so the passenger has been added to the waiting queue.',
    [
      ['Waiting PNR', pnr],
      ['Passenger', name],
      ['Train', `${train.trainNumber} · ${train.trainName}`],
      ['Queue position', queue.length + 1]
    ],
    '◷'
  );

  return true;
}


// BOOK OR RESERVE TICKET

function submitBooking(event) {
  event.preventDefault();

  const train = trainFor(
    document.getElementById('bookingTrain').value
  );

  const name = document
    .getElementById('passengerName')
    .value
    .trim();

  const age = Number(
    document.getElementById('passengerAge').value
  );

  const gender = document
    .getElementById('passengerGender')
    .value;

  if (!train) {
    toast('Please select a train.', true);
    return;
  }

  if (
    !name ||
    !Number.isInteger(age) ||
    age < 1 ||
    age > 120 ||
    !gender
  ) {
    toast(
      'Please enter valid passenger details.',
      true
    );

    return;
  }

  // If the train is full, use the waiting list.
  if (train.availableSeats === 0) {
    const queue = waitingFor(train.trainNumber);

    if (queue.length >= 5) {
      toast(
        'The waiting list for this train is full.',
        true
      );

      return;
    }

    const added = bookWaitingPassenger(
      train,
      name,
      age,
      gender
    );

    if (added) {
      document.getElementById('bookingForm').reset();

      selectedSeat = null;

      refreshBookingDetails();
    }

    return;
  }

  // A seat must be selected for a confirmed booking.
  if (!selectedSeat) {
    toast(
      'Please select an available seat.',
      true
    );

    return;
  }

  if (
    bookedSeats(train.trainNumber).includes(
      Number(selectedSeat)
    )
  ) {
    selectedSeat = null;

    refreshBookingDetails();

    toast(
      'That seat is no longer available. Select another seat.',
      true
    );

    return;
  }

  const pnr = state.nextPNR++;

  state.passengers.push({
    pnr,
    name,
    age,
    gender,
    trainNumber: train.trainNumber,
    seatNumber: Number(selectedSeat)
  });

  train.availableSeats--;

  const seat = selectedSeat;

  persist();
  renderAll();

  openModal(
    'Ticket confirmed',
    'The reservation has been created successfully.',
    [
      ['PNR number', pnr],
      ['Passenger', name],
      ['Train', `${train.trainNumber} · ${train.trainName}`],
      ['Route', `${train.source} → ${train.destination}`],
      ['Seat number', seat],
      ['Status', 'CONFIRMED']
    ]
  );

  document.getElementById('bookingForm').reset();

  selectedSeat = null;

  refreshBookingDetails();
}


// PROMOTE FIRST WAITING PASSENGER

function promoteFirstWaiting(train) {
  const idx = state.waiting.findIndex(
    p => p.trainNumber === train.trainNumber
  );

  if (idx === -1) {
    return null;
  }

  const p = state.waiting.splice(idx, 1)[0];

  const seat = Array.from(
    { length: train.totalSeats },
    (_, i) => i + 1
  ).find(
    n => !bookedSeats(train.trainNumber).includes(n)
  );

  if (!seat) {
    state.waiting.splice(idx, 0, p);
    return null;
  }

  state.passengers.push({
    ...p,
    seatNumber: seat
  });

  train.availableSeats--;

  state.promotedCount =
    (state.promotedCount || 0) + 1;

  return {
    ...p,
    seatNumber: seat
  };
}


// CANCEL A CONFIRMED TICKET

function cancelPNR(pnr) {
  const index = state.passengers.findIndex(
    p => p.pnr === Number(pnr)
  );

  if (index === -1) {
    toast(
      'No confirmed passenger was found with that PNR.',
      true
    );

    return;
  }

  const passenger = state.passengers.splice(
    index,
    1
  )[0];

  const train = trainFor(passenger.trainNumber);

  // Add the passenger to cancellation history.
  state.cancellations.push({
    ...passenger,
    cancelledAt: new Date().toISOString()
  });

  // Release the confirmed seat.
  if (train) {
    train.availableSeats = Math.min(
      train.totalSeats,
      train.availableSeats + 1
    );
  }

  // Promote the first waiting passenger if possible.
  const promoted = train
    ? promoteFirstWaiting(train)
    : null;

  persist();
  renderAll();

  const details = [
    ['Cancelled PNR', passenger.pnr],
    ['Passenger', passenger.name],
    [
      'Train',
      train
        ? `${train.trainNumber} · ${train.trainName}`
        : passenger.trainNumber
    ],
    ['Released seat', passenger.seatNumber]
  ];

  if (promoted) {
    details.push(
      [
        'Promoted passenger',
        `${promoted.name} · PNR ${promoted.pnr}`
      ],
      ['New seat', promoted.seatNumber]
    );
  }

  openModal(
    'Ticket cancelled',
    promoted
      ? `${passenger.name}’s ticket was cancelled and the first waiting passenger was promoted.`
      : 'The ticket has been cancelled and its seat is available again.',
    details,
    '↶'
  );
}


// SEARCH BOOKING BY PNR

function lookupPNR(event) {
  event.preventDefault();

  const pnr = Number(
    document.getElementById('lookupPnr').value
  );

  const result = document.getElementById('lookupResult');

  const passenger = state.passengers.find(
    p => p.pnr === pnr
  );

  const waiting = state.waiting.find(
    p => p.pnr === pnr
  );

  const cancelled = state.cancellations.find(
    p => p.pnr === pnr
  );

  if (passenger) {
    const train = trainFor(passenger.trainNumber);

    result.innerHTML = `
      <div class="lookup-result-heading">
        <span>✓ CONFIRMED</span>
        <span>PNR ${passenger.pnr}</span>
      </div>

      ${
        [
          ['Passenger', passenger.name],
          [
            'Train',
            `${train?.trainNumber || passenger.trainNumber} · ${train?.trainName || ''}`
          ],
          [
            'Route',
            `${train?.source || '—'} → ${train?.destination || '—'}`
          ],
          ['Seat', passenger.seatNumber],
          ['Age / gender', `${passenger.age} / ${passenger.gender}`]
        ].map(([a, b]) => `
          <div class="lookup-result-row">
            <span>${esc(a)}</span>
            <strong>${esc(b)}</strong>
          </div>
        `).join('')
      }
    `;
  }

  else if (waiting) {
    const pos = waitingFor(waiting.trainNumber)
      .findIndex(p => p.pnr === waiting.pnr) + 1;

    const train = trainFor(waiting.trainNumber);

    result.innerHTML = `
      <div
        class="lookup-result-heading"
        style="background:#f5effb;color:#795bb0"
      >
        <span>◷ WAITING LIST</span>
        <span>PNR ${waiting.pnr}</span>
      </div>

      ${
        [
          ['Passenger', waiting.name],
          [
            'Train',
            `${train?.trainNumber || waiting.trainNumber} · ${train?.trainName || ''}`
          ],
          ['Waiting position', pos],
          ['Age / gender', `${waiting.age} / ${waiting.gender}`]
        ].map(([a, b]) => `
          <div class="lookup-result-row">
            <span>${esc(a)}</span>
            <strong>${esc(b)}</strong>
          </div>
        `).join('')
      }
    `;
  }

  else if (cancelled) {
    result.innerHTML = `
      <div
        class="lookup-result-heading"
        style="background:#fff1ed;color:#bd604f"
      >
        <span>↶ CANCELLED</span>
        <span>PNR ${cancelled.pnr}</span>
      </div>

      ${
        [
          ['Passenger', cancelled.name],
          [
            'Train',
            `${cancelled.trainNumber} · ${
              trainFor(cancelled.trainNumber)?.trainName || ''
            }`
          ],
          ['Seat', cancelled.seatNumber],
          ['Status', 'Cancelled']
        ].map(([a, b]) => `
          <div class="lookup-result-row">
            <span>${esc(a)}</span>
            <strong>${esc(b)}</strong>
          </div>
        `).join('')
      }
    `;
  }

  else {
    result.innerHTML = `
      <div
        class="lookup-result-heading"
        style="background:#fff4e9;color:#a56928"
      >
        <span>PNR NOT FOUND</span>
      </div>

      <div class="lookup-result-row">
        <span>Result</span>
        <strong>No matching booking was found.</strong>
      </div>
    `;
  }

  result.hidden = false;
}


// HANDLE BUTTON CLICKS

document.addEventListener('click', event => {
  const nav = event.target.closest('[data-view]');

  if (nav) {
    goTo(nav.dataset.view);
    return;
  }

  const go = event.target.closest('[data-go]');

  if (go) {
    goTo(go.dataset.go);
    return;
  }

  const book = event.target.closest('[data-book-train]');

  if (book) {
    selectTrainForBooking(book.dataset.bookTrain);
    return;
  }

  const seat = event.target.closest('[data-seat]');

  if (seat && !seat.disabled) {
    selectedSeat = Number(seat.dataset.seat);

    refreshBookingDetails();
    return;
  }

  const cancel = event.target.closest('[data-cancel-pnr]');

  if (cancel) {
    cancelPNR(cancel.dataset.cancelPnr);
    return;
  }
});


// FORM AND PAGE EVENTS

document
  .getElementById('bookingTrain')
  .addEventListener('change', () => {
    selectedSeat = null;
    refreshBookingDetails();
  });


document
  .getElementById('passengerName')
  .addEventListener('input', () => {
    document.getElementById('summaryPassenger').textContent =
      document.getElementById('passengerName').value.trim() ||
      '—';
  });


document
  .getElementById('bookingForm')
  .addEventListener('submit', submitBooking);


document
  .getElementById('lookupForm')
  .addEventListener('submit', lookupPNR);


document
  .getElementById('trainSearch')
  .addEventListener('input', renderTrainPage);


document
  .getElementById('passengerSearch')
  .addEventListener('input', renderPassengers);


document
  .getElementById('sortTrains')
  .addEventListener('click', () => {
    trainsSorted = !trainsSorted;

    document.getElementById('sortTrains').textContent =
      trainsSorted
        ? '↕ Original train order'
        : '↕ Sort by train no.';

    renderTrainPage();
  });


document
  .getElementById('mobileMenu')
  .addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });


document
  .getElementById('modalClose')
  .addEventListener('click', closeModal);


document
  .getElementById('modalDone')
  .addEventListener('click', closeModal);


document
  .getElementById('modalBackdrop')
  .addEventListener('click', event => {
    if (event.target.id === 'modalBackdrop') {
      closeModal();
    }
  });


document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closeModal();
  }
});


// INITIAL RENDER

renderAll();
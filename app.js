/*
 * RailwayDesk - shared Supabase-backed frontend
 * Public browser key only. Database writes happen through restricted RPC functions.
 */

const SUPABASE_URL = 'https://ojpecfrgxahifhcolprf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_rNgYvaa9C0VlLq66DyH6EQ_C2xCUhO-';
const SYNC_INTERVAL_MS = 5000;

if (!window.supabase || typeof window.supabase.createClient !== 'function') {
  throw new Error('Supabase client did not load. Check the Supabase CDN script in index.html.');
}

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

let state = {
  trains: [],
  passengers: [],
  waiting: [],
  cancellations: [],
  promotedCount: 0
};

let selectedSeat = null;
let currentView = 'dashboard';
let trainsSorted = false;
let snapshotLoaded = false;
let refreshInProgress = false;

// --------------------------------------------------
// COMMON HELPERS
// --------------------------------------------------

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]));
}

function toast(message, isError = false) {
  const region = document.getElementById('toastRegion');
  if (!region) return;
  const el = document.createElement('div');
  el.className = `toast${isError ? ' error' : ''}`;
  el.innerHTML = `<span class="toast-icon">${isError ? '!' : '✓'}</span><span>${esc(message)}</span>`;
  region.appendChild(el);
  window.setTimeout(() => el.remove(), 3800);
}

function openModal(title, message, details = [], icon = '✓') {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalMessage').textContent = message;
  document.getElementById('modalIcon').textContent = icon;
  document.getElementById('modalDetails').innerHTML = details.map(([label, value]) => `
    <div class="modal-detail-row"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>
  `).join('');
  document.getElementById('modalBackdrop').hidden = false;
}

function closeModal() {
  document.getElementById('modalBackdrop').hidden = true;
}

function setConnectionStatus(connected, message = '') {
  const title = document.getElementById('dbStatusTitle');
  const subtitle = document.getElementById('dbStatusSubtitle');
  const pill = document.getElementById('environmentLabel');
  const light = document.querySelector('.status-light');

  if (title) title.textContent = connected ? 'Shared database' : 'Connection issue';
  if (subtitle) subtitle.textContent = connected ? 'Synced across devices' : (message || 'Check Supabase connection');
  if (pill) pill.textContent = connected ? 'Shared database' : 'Offline';
  if (light) light.style.background = connected ? '#65d3a5' : '#e58a75';
}

function trainFor(number) {
  return state.trains.find(t => Number(t.trainNumber) === Number(number));
}

function waitingFor(number) {
  return state.waiting.filter(p => Number(p.trainNumber) === Number(number));
}

function bookedSeats(number) {
  return state.passengers
    .filter(p => Number(p.trainNumber) === Number(number))
    .map(p => Number(p.seatNumber));
}

function allSeats() {
  return state.trains.reduce((sum, train) => sum + Number(train.totalSeats), 0);
}

function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2)
    .map(part => part[0] || '').join('').toUpperCase();
}

function trainLabel(number) {
  const train = trainFor(number);
  return train ? `${train.trainNumber} · ${train.trainName}` : `Train ${number}`;
}

function formatGender(gender) {
  return String(gender || '').toUpperCase();
}

// --------------------------------------------------
// SUPABASE DATA SYNC
// --------------------------------------------------

async function refreshSnapshot({ silent = false } = {}) {
  if (refreshInProgress) return;
  refreshInProgress = true;

  try {
    const { data, error } = await db.rpc('get_system_snapshot');
    if (error) throw error;
    if (!data || !Array.isArray(data.trains)) {
      throw new Error('The database returned an unexpected response.');
    }

    state = {
      trains: data.trains,
      passengers: Array.isArray(data.passengers) ? data.passengers : [],
      waiting: Array.isArray(data.waiting) ? data.waiting : [],
      cancellations: Array.isArray(data.cancellations) ? data.cancellations : [],
      promotedCount: Number(data.promotedCount || 0)
    };

    // If another device booked the seat currently selected here, clear it.
    if (selectedSeat !== null) {
      const selectedTrain = Number(document.getElementById('bookingTrain').value);
      if (bookedSeats(selectedTrain).includes(Number(selectedSeat))) {
        selectedSeat = null;
      }
    }

    snapshotLoaded = true;
    setConnectionStatus(true);
    renderAll();
  } catch (error) {
    console.error('Supabase sync failed:', error);
    setConnectionStatus(false, error.message || 'Unable to load shared data');
    if (!silent) {
      toast(`Could not connect to shared database: ${error.message || 'Unknown error'}`, true);
    }
  } finally {
    refreshInProgress = false;
  }
}

// --------------------------------------------------
// NAVIGATION
// --------------------------------------------------

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
  if (!document.getElementById(`view-${view}`)) return;
  currentView = view;

  document.querySelectorAll('.view').forEach(el => {
    el.classList.toggle('active', el.id === `view-${view}`);
  });
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });

  document.getElementById('currentSection').textContent = viewName(view);
  document.getElementById('sidebar').classList.remove('open');
  renderAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --------------------------------------------------
// TRAIN DISPLAY
// --------------------------------------------------

function statusFor(train) {
  if (Number(train.availableSeats) === 0) return ['Full', 'status-full'];
  if (Number(train.availableSeats) <= 3) return ['Limited', 'status-limited'];
  return ['Available', 'status-open'];
}

function availabilityMarkup(train) {
  const total = Number(train.totalSeats);
  const available = Number(train.availableSeats);
  const used = total - available;
  const percent = Math.max(0, Math.min(100, (used / total) * 100));
  const color = percent >= 100 ? 'low' : percent >= 70 ? 'medium' : '';

  return `
    <div class="availability-cell">
      <div class="availability-text"><span>${available} of ${total} left</span><span>${Math.round((available / total) * 100)}%</span></div>
      <div class="progress-track"><div class="progress-fill ${color}" style="width:${percent}%"></div></div>
    </div>
  `;
}

function trainRows(dashboard = false, query = '') {
  let list = [...state.trains];
  if (trainsSorted) list.sort((a, b) => Number(a.trainNumber) - Number(b.trainNumber));

  const q = query.trim().toLowerCase();
  if (q) {
    list = list.filter(t =>
      `${t.trainNumber} ${t.trainName} ${t.source} ${t.destination}`.toLowerCase().includes(q)
    );
  }

  return list.map(train => {
    const [status, cls] = statusFor(train);
    const waitCount = waitingFor(train.trainNumber).length;
    const badge = '<span class="train-badge" aria-hidden="true">↗</span>';

    if (dashboard) {
      return `
        <tr>
          <td><div class="train-name-cell">${badge}<div><strong>${esc(train.trainName)}</strong><small>Train ${train.trainNumber}</small></div></div></td>
          <td><div class="route-cell"><span>${esc(train.source)}</span><span class="route-arrow">→</span><span>${esc(train.destination)}</span></div></td>
          <td>${availabilityMarkup(train)}</td>
          <td><span class="status-chip ${cls}">${status}</span></td>
          <td><button class="small-action" data-book-train="${train.trainNumber}">Book</button></td>
        </tr>
      `;
    }

    return `
      <tr>
        <td><div class="train-name-cell">${badge}<div><strong>${esc(train.trainName)}</strong><small>${esc(train.source)} → ${esc(train.destination)}</small></div></div></td>
        <td><span class="train-number">${train.trainNumber}</span></td>
        <td><div class="route-cell"><span>${esc(train.source)}</span><span class="route-arrow">→</span><span>${esc(train.destination)}</span></div></td>
        <td>${availabilityMarkup(train)}<div style="margin-top:7px"><span class="status-chip ${cls}">${status}</span></div></td>
        <td><span class="status-chip ${waitCount ? 'status-limited' : 'status-open'}">${waitCount} / 5</span></td>
        <td><button class="small-action" data-book-train="${train.trainNumber}">${Number(train.availableSeats) > 0 ? 'Book seat' : 'Join queue'}</button></td>
      </tr>
    `;
  }).join('');
}

function renderDashboard() {
  document.getElementById('statTrains').textContent = state.trains.length;
  document.getElementById('statPassengers').textContent = state.passengers.length;
  document.getElementById('statSeats').textContent = state.trains.reduce((sum, t) => sum + Number(t.availableSeats), 0);
  document.getElementById('statWaiting').textContent = state.waiting.length;
  document.getElementById('seatFoot').textContent = `Out of ${allSeats()} total seats`;
  document.getElementById('dashboardTrainRows').innerHTML = trainRows(true);

  const recent = [...state.passengers].sort((a, b) => Number(b.pnr) - Number(a.pnr)).slice(0, 4);
  document.getElementById('recentBookings').innerHTML = recent.length
    ? recent.map(p => `
        <div class="recent-item">
          <div class="passenger-avatar">${esc(initials(p.name))}</div>
          <div class="recent-meta"><strong>${esc(p.name)}</strong><small>${esc(trainLabel(p.trainNumber))} · Seat ${p.seatNumber}</small></div>
          <span class="recent-pnr">#${p.pnr}</span>
        </div>
      `).join('')
    : '<div class="recent-empty">No reservations yet. New shared bookings will appear here.</div>';
}

function renderTrainPage() {
  const search = document.getElementById('trainSearch');
  document.getElementById('allTrainRows').innerHTML = trainRows(false, search ? search.value : '');
}

// --------------------------------------------------
// BOOKING FORM AND SEATS
// --------------------------------------------------

function updateBookingOptions() {
  const select = document.getElementById('bookingTrain');
  const currentValue = select.value;
  const expected = state.trains.length + 1;
  if (select.options.length !== expected) {
    select.innerHTML = '<option value="">Choose a train…</option>' + state.trains.map(t => `
      <option value="${t.trainNumber}">${t.trainNumber} — ${esc(t.trainName)} (${esc(t.source)} to ${esc(t.destination)})</option>
    `).join('');
  }
  if (currentValue && trainFor(currentValue)) select.value = currentValue;
}

function refreshBookingDetails() {
  const train = trainFor(document.getElementById('bookingTrain').value);
  const seatMap = document.getElementById('seatMap');

  document.getElementById('summarySource').textContent = train?.source || '—';
  document.getElementById('summaryDestination').textContent = train?.destination || '—';
  document.getElementById('summaryTrain').textContent = train ? `${train.trainNumber} · ${train.trainName}` : 'Not selected';
  document.getElementById('summaryAvailability').textContent = train ? `${train.availableSeats} seat${Number(train.availableSeats) === 1 ? '' : 's'} left` : '—';
  document.getElementById('summaryPassenger').textContent = document.getElementById('passengerName').value.trim() || '—';

  document.getElementById('routePreview').innerHTML = `
    <div class="route-end"><span class="route-point"></span><div><small>FROM</small><strong>${esc(train?.source || 'Select a train')}</strong></div></div>
    <div class="route-line"><span>TRAIN JOURNEY</span></div>
    <div class="route-end route-end-right"><span class="route-point"></span><div><small>TO</small><strong>${esc(train?.destination || '—')}</strong></div></div>
  `;

  if (!train) {
    selectedSeat = null;
    seatMap.className = 'seat-map empty-state';
    seatMap.innerHTML = '<span>Select a train to view seats.</span>';
    document.getElementById('selectedSeatLine').textContent = 'No seat selected';
    document.getElementById('summarySeat').textContent = '—';
    document.getElementById('confirmBooking').textContent = 'Confirm reservation →';
    return;
  }

  const reserved = new Set(bookedSeats(train.trainNumber));
  if (selectedSeat && reserved.has(Number(selectedSeat))) selectedSeat = null;

  if (Number(train.availableSeats) === 0) {
    selectedSeat = null;
    seatMap.className = 'seat-map empty-state';
    seatMap.innerHTML = '<span>This train is full. Submit passenger details to join the waiting list (maximum 5).</span>';
  } else {
    seatMap.className = 'seat-map';
    seatMap.innerHTML = Array.from({ length: Number(train.totalSeats) }, (_, i) => {
      const seatNumber = i + 1;
      const taken = reserved.has(seatNumber);
      const selected = Number(selectedSeat) === seatNumber;
      return `
        <button type="button" class="seat${taken ? ' reserved' : ''}${selected ? ' selected' : ''}"
          data-seat="${seatNumber}" ${taken ? 'disabled' : ''}
          aria-label="Seat ${seatNumber}${taken ? ' reserved' : selected ? ' selected' : ' available'}">
          ${String(seatNumber).padStart(2, '0')}
        </button>
      `;
    }).join('');
  }

  document.getElementById('selectedSeatLine').innerHTML = selectedSeat
    ? `Selected seat: <strong>${selectedSeat}</strong>`
    : (Number(train.availableSeats) === 0 ? 'Waiting-list booking' : 'Choose an available seat above');
  document.getElementById('summarySeat').textContent = selectedSeat ? `Seat ${selectedSeat}` : (Number(train.availableSeats) === 0 ? 'Waiting list' : '—');
  document.getElementById('confirmBooking').textContent = Number(train.availableSeats) === 0 ? 'Join waiting list →' : 'Confirm reservation →';
}

async function submitBooking(event) {
  event.preventDefault();

  const trainNumber = Number(document.getElementById('bookingTrain').value);
  const train = trainFor(trainNumber);
  const name = document.getElementById('passengerName').value.trim();
  const age = Number(document.getElementById('passengerAge').value);
  const gender = document.getElementById('passengerGender').value;

  if (!train) return toast('Please select a train.', true);
  if (!name || !Number.isInteger(age) || age < 1 || age > 120 || !['M', 'F', 'O'].includes(gender)) {
    return toast('Please enter valid passenger details.', true);
  }
  if (Number(train.availableSeats) > 0 && !selectedSeat) {
    return toast('Please select an available seat.', true);
  }

  const submitButton = document.getElementById('confirmBooking');
  submitButton.disabled = true;
  submitButton.textContent = 'Processing…';

  try {
    const { data, error } = await db.rpc('book_ticket', {
      p_train_number: trainNumber,
      p_passenger_name: name,
      p_age: age,
      p_gender: gender,
      p_seat_number: selectedSeat === null ? null : Number(selectedSeat)
    });
    if (error) throw error;

    await refreshSnapshot({ silent: true });
    const status = data.status;
    const details = [
      ['PNR number', data.pnr],
      ['Passenger', name],
      ['Train', `${train.trainNumber} · ${train.trainName}`],
      ['Route', `${train.source} → ${train.destination}`],
      ['Status', status]
    ];
    if (status === 'CONFIRMED') details.push(['Seat number', data.seat_number]);
    if (status === 'WAITING') details.push(['Waiting position', data.waiting_position]);

    openModal(
      status === 'CONFIRMED' ? 'Ticket confirmed' : 'Added to waiting list',
      status === 'CONFIRMED'
        ? 'Your booking has been saved in the shared database.'
        : 'The train is full. Your passenger record has been added to its FIFO waiting list.',
      details,
      status === 'CONFIRMED' ? '✓' : '◷'
    );

    document.getElementById('bookingForm').reset();
    selectedSeat = null;
    updateBookingOptions();
    refreshBookingDetails();
  } catch (error) {
    console.error('Booking failed:', error);
    toast(error.message || 'Booking could not be completed.', true);
    await refreshSnapshot({ silent: true });
  } finally {
    submitButton.disabled = false;
    refreshBookingDetails();
  }
}

function selectTrainForBooking(number) {
  goTo('book');
  document.getElementById('bookingTrain').value = String(number);
  selectedSeat = null;
  refreshBookingDetails();
}

// --------------------------------------------------
// PASSENGER, WAITING AND CANCELLATION VIEWS
// --------------------------------------------------

function renderPassengers() {
  const search = document.getElementById('passengerSearch');
  const q = search.value.toLowerCase().trim();
  const list = state.passengers.filter(p =>
    `${p.name} ${p.pnr} ${p.trainNumber} ${trainFor(p.trainNumber)?.trainName || ''}`.toLowerCase().includes(q)
  );

  document.getElementById('passengerResultLabel').textContent = `${list.length} passenger${list.length === 1 ? '' : 's'}`;
  document.getElementById('passengerRows').innerHTML = list.map(p => `
    <tr>
      <td><div class="train-name-cell"><span class="passenger-avatar">${esc(initials(p.name))}</span><div><strong>${esc(p.name)}</strong><small>Passenger record</small></div></div></td>
      <td><span class="train-number">${p.pnr}</span></td>
      <td>${esc(trainLabel(p.trainNumber))}</td>
      <td><strong>Seat ${p.seatNumber}</strong></td>
      <td>${p.age} / ${esc(formatGender(p.gender))}</td>
      <td><span class="status-chip status-open">Confirmed</span></td>
      <td><button class="small-action" data-cancel-pnr="${p.pnr}">Cancel</button></td>
    </tr>
  `).join('');
  document.getElementById('passengerEmpty').hidden = list.length > 0;
  document.getElementById('passengerNavCount').textContent = state.passengers.length;
}

function renderWaiting() {
  document.getElementById('waitingNavCount').textContent = state.waiting.length;
  document.getElementById('waitingCapacity').textContent = `${state.waiting.length} / ${state.trains.length * 5}`;

  const cards = state.trains.map(train => {
    const queue = waitingFor(train.trainNumber);
    if (!queue.length) return '';
    return `
      <section class="waiting-train-card">
        <div class="waiting-train-heading">
          <div><strong>${esc(train.trainName)}</strong><small>${train.trainNumber} · ${esc(train.source)} → ${esc(train.destination)}</small></div>
          <span class="queue-count">${queue.length} / 5 waiting</span>
        </div>
        ${queue.map((p, i) => `
          <div class="waiting-person">
            <span class="queue-position">${i + 1}</span>
            <div class="waiting-person-meta"><strong>${esc(p.name)}</strong><small>PNR ${p.pnr} · Age ${p.age}</small></div>
            <span class="waiting-label">Position ${i + 1}</span>
          </div>
        `).join('')}
      </section>
    `;
  }).filter(Boolean).join('');

  document.getElementById('waitingCards').innerHTML = cards || `
    <section class="panel empty-panel" style="grid-column:1/-1">
      <div class="empty-illustration">◷</div><h3>No one on the waiting list</h3>
      <p>When a train is full, passengers can join its waiting queue.</p>
    </section>
  `;
}

function renderCancellations() {
  document.getElementById('cancelCount').textContent = state.cancellations.length;
  document.getElementById('promotedCount').textContent = state.promotedCount;
  const list = [...state.cancellations].sort((a, b) => {
    const timeA = new Date(a.cancelledAt || 0).getTime();
    const timeB = new Date(b.cancelledAt || 0).getTime();
    return timeB - timeA || Number(b.pnr) - Number(a.pnr);
  });

  document.getElementById('cancellationRows').innerHTML = list.map(p => `
    <tr>
      <td><div class="train-name-cell"><span class="passenger-avatar">${esc(initials(p.name))}</span><div><strong>${esc(p.name)}</strong><small>Cancelled reservation</small></div></div></td>
      <td><span class="train-number">${p.pnr}</span></td>
      <td>${esc(trainLabel(p.trainNumber))}</td>
      <td>Seat ${p.seatNumber}</td>
      <td>${p.age} / ${esc(formatGender(p.gender))}</td>
      <td><span class="status-chip status-full">Cancelled</span></td>
    </tr>
  `).join('');
  document.getElementById('cancellationEmpty').hidden = list.length > 0;
}

function renderAll() {
  if (!snapshotLoaded) return;
  renderDashboard();
  renderTrainPage();
  updateBookingOptions();
  refreshBookingDetails();
  renderPassengers();
  renderWaiting();
  renderCancellations();
}

// --------------------------------------------------
// PNR LOOKUP AND CANCELLATION
// --------------------------------------------------

function lookupPNR(event) {
  event.preventDefault();
  const pnr = Number(document.getElementById('lookupPnr').value);
  const result = document.getElementById('lookupResult');
  const passenger = state.passengers.find(p => Number(p.pnr) === pnr);
  const waiting = state.waiting.find(p => Number(p.pnr) === pnr);
  const cancelled = state.cancellations.find(p => Number(p.pnr) === pnr);

  let html = '';
  if (passenger) {
    const train = trainFor(passenger.trainNumber);
    html = `
      <div class="lookup-result-heading"><span>✓ CONFIRMED</span><span>PNR ${passenger.pnr}</span></div>
      ${[
        ['Passenger', passenger.name],
        ['Train', trainLabel(passenger.trainNumber)],
        ['Route', `${train?.source || '—'} → ${train?.destination || '—'}`],
        ['Seat', passenger.seatNumber],
        ['Age / gender', `${passenger.age} / ${passenger.gender}`]
      ].map(([label, value]) => `<div class="lookup-result-row"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}
    `;
  } else if (waiting) {
    const train = trainFor(waiting.trainNumber);
    const position = waitingFor(waiting.trainNumber).findIndex(p => Number(p.pnr) === pnr) + 1;
    html = `
      <div class="lookup-result-heading" style="background:#f5effb;color:#795bb0"><span>◷ WAITING LIST</span><span>PNR ${waiting.pnr}</span></div>
      ${[
        ['Passenger', waiting.name],
        ['Train', trainLabel(waiting.trainNumber)],
        ['Route', `${train?.source || '—'} → ${train?.destination || '—'}`],
        ['Waiting position', position],
        ['Age / gender', `${waiting.age} / ${waiting.gender}`]
      ].map(([label, value]) => `<div class="lookup-result-row"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}
    `;
  } else if (cancelled) {
    html = `
      <div class="lookup-result-heading" style="background:#fff1ed;color:#bd604f"><span>↶ CANCELLED</span><span>PNR ${cancelled.pnr}</span></div>
      ${[
        ['Passenger', cancelled.name],
        ['Train', trainLabel(cancelled.trainNumber)],
        ['Seat', cancelled.seatNumber],
        ['Status', 'Cancelled']
      ].map(([label, value]) => `<div class="lookup-result-row"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}
    `;
  } else {
    html = `
      <div class="lookup-result-heading" style="background:#fff4e9;color:#a56928"><span>PNR NOT FOUND</span></div>
      <div class="lookup-result-row"><span>Result</span><strong>No matching booking was found.</strong></div>
    `;
  }
  result.innerHTML = html;
  result.hidden = false;
}

async function cancelPNR(pnr) {
  const numericPNR = Number(pnr);
  if (!Number.isInteger(numericPNR) || numericPNR <= 0) {
    toast('Enter a valid PNR.', true);
    return;
  }

  try {
    const { data, error } = await db.rpc('cancel_ticket', {
      p_pnr: numericPNR
    });
    if (error) throw error;

    await refreshSnapshot({ silent: true });

    const details = [
      ['Cancelled PNR', data.cancelled.pnr],
      ['Passenger', data.cancelled.name],
      ['Train', trainLabel(data.cancelled.train_number)],
      ['Released seat', data.cancelled.seat_number]
    ];

    if (data.promoted) {
      details.push(
        ['Promoted passenger', `${data.promoted.name} · PNR ${data.promoted.pnr}`],
        ['Assigned seat', data.promoted.seat_number]
      );
    }

    openModal(
      'Ticket cancelled',
      data.promoted
        ? 'The ticket was cancelled and the first waiting passenger was promoted.'
        : 'The ticket was cancelled. Its seat is now available.',
      details,
      '↶'
    );
  } catch (error) {
    console.error('Cancellation failed:', error);
    toast(error.message || 'Cancellation could not be completed.', true);
    await refreshSnapshot({ silent: true });
  }
}

// --------------------------------------------------
// EVENT LISTENERS
// --------------------------------------------------

document.addEventListener('click', event => {
  const nav = event.target.closest('[data-view]');
  if (nav) return goTo(nav.dataset.view);

  const go = event.target.closest('[data-go]');
  if (go) return goTo(go.dataset.go);

  const bookButton = event.target.closest('[data-book-train]');
  if (bookButton) return selectTrainForBooking(bookButton.dataset.bookTrain);

  const seatButton = event.target.closest('[data-seat]');
  if (seatButton && !seatButton.disabled) {
    selectedSeat = Number(seatButton.dataset.seat);
    refreshBookingDetails();
    return;
  }

  const cancelButton = event.target.closest('[data-cancel-pnr]');
  if (cancelButton) return cancelPNR(cancelButton.dataset.cancelPnr);
});

document.getElementById('bookingTrain').addEventListener('change', () => {
  selectedSeat = null;
  refreshBookingDetails();
});

document.getElementById('passengerName').addEventListener('input', () => {
  document.getElementById('summaryPassenger').textContent =
    document.getElementById('passengerName').value.trim() || '—';
});

document.getElementById('bookingForm').addEventListener('submit', submitBooking);
document.getElementById('lookupForm').addEventListener('submit', lookupPNR);
document.getElementById('trainSearch').addEventListener('input', renderTrainPage);
document.getElementById('passengerSearch').addEventListener('input', renderPassengers);

document.getElementById('sortTrains').addEventListener('click', () => {
  trainsSorted = !trainsSorted;
  document.getElementById('sortTrains').textContent = trainsSorted
    ? '↕ Original train order'
    : '↕ Sort by train no.';
  renderTrainPage();
});

document.getElementById('mobileMenu').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalDone').addEventListener('click', closeModal);
document.getElementById('modalBackdrop').addEventListener('click', event => {
  if (event.target.id === 'modalBackdrop') closeModal();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeModal();
});

// --------------------------------------------------
// STARTUP + CROSS-DEVICE SYNC
// --------------------------------------------------

async function initializeApp() {
  setConnectionStatus(false, 'Connecting to Supabase…');
  await refreshSnapshot();

  // Poll the database so other devices' bookings appear here shortly after.
  window.setInterval(() => {
    if (!document.hidden) refreshSnapshot({ silent: true });
  }, SYNC_INTERVAL_MS);

  window.addEventListener('focus', () => refreshSnapshot({ silent: true }));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshSnapshot({ silent: true });
  });
}

initializeApp();

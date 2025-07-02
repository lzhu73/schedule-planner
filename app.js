// Firebase SDK imports (v11.10.0)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDocs, collection } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAEuAZC8Db_59x9omQ_mdkdGLNWAz1RN8A",
  authDomain: "schedule-planner-3dec0.firebaseapp.com",
  projectId: "schedule-planner-3dec0",
  storageBucket: "schedule-planner-3dec0.firebasestorage.app",
  messagingSenderId: "399524277447",
  appId: "1:399524277447:web:b31d22eb286ad37def62e2",
  measurementId: "G-75XS75N7S3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM elements
const calendarGrid = document.getElementById("calendar-grid");
const timezoneSelect = document.getElementById("timezone-select");
const submitButton = document.getElementById("submit-btn");
const nameInput = document.getElementById("name-input");
const toggleOverlapBtn = document.getElementById("toggle-overlap-btn");
let showOverlaps = false;

// Drag selection
let isDragging = false;
let dragMode = null; // 'select' or 'deselect'

// Availability tracking
let selectedSlots = new Set();

// Constants
const daysToShow = 7;
const totalSlotsPerDay = 36; // 9AM to 3AM, every 30 mins

// Get week ID based on Monday's date
function getCurrentWeekId() {
  const now = new Date();
  const monday = new Date(now);
  const daysFromMonday = (now.getDay() + 6) % 7;
  monday.setDate(now.getDate() - daysFromMonday);
  return `thisWeek-${monday.toISOString().slice(0, 10)}`;
}

// Format local time
function formatLocalTime(utcString, timeZone, withDay = false) {
  const options = {
    timeZone,
    hour12: false,
  };
  if (withDay) {
    options.weekday = "short";
    options.month = "numeric";
    options.day = "numeric";
  }
  return new Date(utcString).toLocaleString("en-US", options);
}

// Build the calendar grid
function buildCalendarTable() {
  calendarGrid.innerHTML = "";
  const timeZone = timezoneSelect.value;
  const now = new Date();
  const weekStart = new Date(now);
  const daysFromMonday = (now.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - daysFromMonday);

  const table = document.createElement("table");
  table.className = "table-fixed w-auto border border-collapse";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const emptyCorner = document.createElement("th");
  emptyCorner.className = "border p-2 bg-gray-100";
  headerRow.appendChild(emptyCorner);

  const dayDates = [];
  for (let d = 0; d < daysToShow; d++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + d);
    dayDates.push(day);

    const label = formatLocalTime(day.toISOString(), timeZone, true);
    const th = document.createElement("th");
    th.textContent = label;
    th.className = "border p-2 bg-gray-100 text-sm font-normal";
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (let i = 0; i < totalSlotsPerDay; i++) {
    const row = document.createElement("tr");

    const baseTime = new Date();
    baseTime.setHours(9, 0, 0, 0);
    baseTime.setMinutes(i * 30);
    const timeLabel = document.createElement("td");
    timeLabel.textContent = baseTime.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    timeLabel.className = "border px-2 py-1 text-xs bg-gray-50 w-[60px] font-mono text-right";
    row.appendChild(timeLabel);

    for (let d = 0; d < daysToShow; d++) {
      const localSlot = new Date(dayDates[d]);
      localSlot.setHours(9, 0, 0, 0);
      localSlot.setMinutes(i * 30);
      const utcKey = new Date(localSlot.getTime() - localSlot.getTimezoneOffset() * 60000).toISOString();

      const cell = document.createElement("td");
      cell.className = "border w-16 h-8 cursor-pointer hover:bg-sky-100";
      cell.dataset.utc = utcKey;

      const toggleCell = (mode) => {
        if (mode === "select") {
          selectedSlots.add(utcKey);
          cell.classList.add("bg-lime-200");
        } else if (mode === "deselect") {
          selectedSlots.delete(utcKey);
          cell.classList.remove("bg-lime-200");
        }
      };

      cell.addEventListener("mousedown", () => {
        isDragging = true;
        dragMode = selectedSlots.has(utcKey) ? "deselect" : "select";
        toggleCell(dragMode);
      });

      cell.addEventListener("mouseenter", () => {
        if (isDragging) toggleCell(dragMode);
      });

      cell.addEventListener("mouseup", () => {
        isDragging = false;
      });

      row.appendChild(cell);
    }
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  calendarGrid.appendChild(table);
}

// Stop drag mode outside grid
document.addEventListener("mouseup", () => {
  isDragging = false;
});

// Submit button action
submitButton.onclick = async () => {
  const name = nameInput.value.trim();
  if (!name) return alert("Please enter your name first.");
  const meetingId = getCurrentWeekId();
  const availability = Array.from(selectedSlots);
  const timezone = timezoneSelect.value;

  await setDoc(doc(db, "meetings", meetingId, "users", name), {
    availability,
    timezone,
  });

  alert("Availability saved!");
  loadOverlaps();
};
nameInput.addEventListener("change", async () => {
  const name = nameInput.value.trim();
  if (!name) return;

  const meetingId = getCurrentWeekId();
  const userDocRef = doc(db, "meetings", meetingId, "users", name);
  const userDocSnap = await getDoc(userDocRef);

  if (userDocSnap.exists()) {
    const data = userDocSnap.data();
    selectedSlots = new Set(data.availability || []);
    buildCalendarTable(); // redraw with selected slots
  }
});


// Load overlap highlights
async function loadOverlaps() {
  if (!showOverlaps) return;

  const meetingId = getCurrentWeekId();
  const usersRef = collection(db, "meetings", meetingId, "users");
  const snapshot = await getDocs(usersRef);
  const overlapMap = new Map();

  snapshot.forEach(doc => {
    const data = doc.data();
    (data.availability || []).forEach(slot => {
      overlapMap.set(slot, (overlapMap.get(slot) || 0) + 1);
    });
  });

  document.querySelectorAll("td[data-utc]").forEach(cell => {
    const utc = cell.dataset.utc;
    if (overlapMap.has(utc)) {
      const count = overlapMap.get(utc);
      cell.classList.add("bg-blue-100");
      cell.innerText = count;
    } else {
      // Clear previous overlap view
      cell.classList.remove("bg-blue-100");
      if (!selectedSlots.has(utc)) cell.innerText = "";
    }
  });
}

toggleOverlapBtn.onclick = async () => {
  showOverlaps = !showOverlaps;
  toggleOverlapBtn.textContent = showOverlaps ? "Hide Availabilities" : "Show Availabilities";

  // Clear previous highlights if turning off
  if (!showOverlaps) {
    document.querySelectorAll("td[data-utc]").forEach(cell => {
      cell.classList.remove("bg-blue-100");
      const utc = cell.dataset.utc;
      if (!selectedSlots.has(utc)) cell.innerText = "";
    });
  }

  await loadOverlaps();
};


// Initial table and overlap load
timezoneSelect.addEventListener("change", buildCalendarTable);
buildCalendarTable();
loadOverlaps();

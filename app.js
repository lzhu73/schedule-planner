import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore, doc, setDoc, deleteDoc, getDocs, collection, getDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAEuAZC8Db_59x9omQ_mdkdGLNWAz1RN8A",
  authDomain: "schedule-planner-3dec0.firebaseapp.com",
  projectId: "schedule-planner-3dec0",
  storageBucket: "schedule-planner-3dec0.appspot.com",
  messagingSenderId: "399524277447",
  appId: "1:399524277447:web:b31d22eb286ad37def62e2",
  measurementId: "G-75XS75N7S3"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export let selectedSlots = new Set();
let isDragging = false;
let dragMode = null;

function getCurrentWeekId() {
  const now = new Date();
  const monday = new Date(now);
  const daysFromMonday = (now.getDay() + 6) % 7;
  monday.setDate(now.getDate() - daysFromMonday);
  return `thisWeek-${monday.toISOString().slice(0, 10)}`;
}

function formatLocalTime(utcString, timeZone, withDay = false) {
  const options = { timeZone, hour12: false };
  if (withDay) {
    options.weekday = "short";
    options.month = "numeric";
    options.day = "numeric";
  }
  return new Date(utcString).toLocaleString("en-US", options);
}

export function convertUtcToLocalKey(utcString, timeZone) {
  return new Date(utcString).toLocaleString("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function buildCalendarTable(timeZone, name = null) {
  const calendarGrid = document.getElementById("calendar-grid");
  calendarGrid.innerHTML = "";

  const now = new Date();
  const weekStart = new Date(now);
  const daysFromMonday = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - daysFromMonday);

  const table = document.createElement("table");
  table.className = "table-fixed w-auto border border-collapse";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  const emptyCorner = document.createElement("th");
  emptyCorner.className = "border p-2 bg-gray-100";
  headerRow.appendChild(emptyCorner);

  for (let d = 0; d < 7; d++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + d);
    const label = formatLocalTime(day.toISOString(), timeZone, true);

    const th = document.createElement("th");
    th.textContent = label;
    th.className = "border p-2 bg-gray-100 text-sm font-normal";
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  const totalSlotsPerDay = 36;

  for (let halfHourIndex = 0; halfHourIndex < totalSlotsPerDay; halfHourIndex++) {
    const row = document.createElement("tr");

    const baseTime = new Date();
    baseTime.setHours(9, 0, 0, 0);
    baseTime.setMinutes(halfHourIndex * 30);
    const timeLabel = document.createElement("td");
    timeLabel.textContent = baseTime.toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
    timeLabel.className = "border px-2 py-1 text-xs bg-gray-50 w-[60px]";
    row.appendChild(timeLabel);

    for (let d = 0; d < 7; d++) {
      const localSlot = new Date();
      localSlot.setHours(9, 0, 0, 0);
      localSlot.setMinutes(halfHourIndex * 30);
      localSlot.setDate(weekStart.getDate() + d);
      const utcKey = new Date(localSlot.getTime() - localSlot.getTimezoneOffset() * 60000).toISOString();

      const cell = document.createElement("td");
      cell.className = "border w-16 h-8 cursor-pointer hover:bg-sky-100";
      cell.dataset.utc = utcKey;

      if (selectedSlots.has(utcKey)) {
        cell.classList.add("bg-lime-500");
      }

      if (name) {
        const toggleCell = (mode) => {
          if (mode === "select") {
            selectedSlots.add(utcKey);
            cell.classList.add("bg-lime-500");
          } else {
            selectedSlots.delete(utcKey);
            cell.classList.remove("bg-lime-500");
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
        cell.addEventListener("mouseup", () => { isDragging = false; });
      }
      row.appendChild(cell);
    }
    tbody.appendChild(row);
  }

  table.appendChild(tbody);
  calendarGrid.appendChild(table);
  document.addEventListener("mouseup", () => { isDragging = false; });
}

export async function saveAvailability(name, timezone, slots) {
  const meetingId = getCurrentWeekId();
  const ref = doc(db, "meetings", meetingId, "users", name);
  await setDoc(ref, {
    availability: Array.from(slots),
    timezone
  });
  alert("Availability saved!");
}

export async function loadOverlaps(showMembers = false, viewerTimezone = "UTC") {
  const meetingId = getCurrentWeekId();
  const usersRef = collection(db, "meetings", meetingId, "users");
  const snapshot = await getDocs(usersRef);

  const overlapMap = new Map(); // key
  const memberList = [];

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const name = docSnap.id;
    memberList.push(name);

    (data.availability || []).forEach(utc => {
      const localKey = convertUtcToLocalKey(utc, viewerTimezone);
      if (!overlapMap.has(localKey)) overlapMap.set(localKey, []);
      overlapMap.get(localKey).push(name);
    });
  });

  // Map UTC cell keys → local strings
  document.querySelectorAll("td[data-utc]").forEach(cell => {
    const utc = cell.dataset.utc;
    const localKey = convertUtcToLocalKey(utc, viewerTimezone);
    const people = overlapMap.get(localKey);

    if (people) {
      cell.classList.add("bg-blue-100");
      cell.innerText = people.length;
      cell.title = `Available: ${people.join(", ")}`;
    }
  });

  if (showMembers && document.getElementById("member-list")) {
    document.getElementById("member-list").innerText =
      `Submitted: ${memberList.join(", ")}`;
  }
}

export async function clearUserData(name) {
  const meetingId = getCurrentWeekId();
  await deleteDoc(doc(db, "meetings", meetingId, "users", name));
  alert(`Cleared schedule for ${name}`);
}

export async function clearAllData() {
  const meetingId = getCurrentWeekId();
  const usersRef = collection(db, "meetings", meetingId, "users");
  const snapshot = await getDocs(usersRef);
  const promises = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
  await Promise.all(promises);
  alert("Cleared all user schedules for this week.");
}

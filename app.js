// Firebase Setup (Replace with your config)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-id",
  appId: "your-app-id"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Build Grid UI
const calendarGrid = document.getElementById("calendar-grid");
const selected = new Set();
for (let i = 0; i < 35; i++) {
  const cell = document.createElement("div");
  cell.textContent = `Slot ${i + 1}`;
  cell.className = "bg-white border p-4 text-center cursor-pointer";
  cell.onclick = () => {
    if (selected.has(i)) {
      selected.delete(i);
      cell.classList.remove("bg-green-200");
    } else {
      selected.add(i);
      cell.classList.add("bg-green-200");
    }
  };
  calendarGrid.appendChild(cell);
}

// Submit to Firestore
document.getElementById("submit-btn").onclick = async () => {
  const userId = "user-" + Math.floor(Math.random() * 10000); // Replace with real auth if needed
  const data = {
    selected: Array.from(selected),
    timestamp: Date.now()
  };
  await setDoc(doc(db, "meetings", userId), data);
  alert("Submitted!");
};

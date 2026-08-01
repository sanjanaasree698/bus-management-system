const { initializeApp } = require("firebase/app");
const { getDatabase, ref, set } = require("firebase/database");

const firebaseConfig = {
  apiKey: "AIzaSyBvaCYdcDEe47NyWvJivPqltz0c8GP58dY",
  authDomain: "bus-management-system-b36c4.firebaseapp.com",
  databaseURL: "https://bus-management-system-b36c4-default-rtdb.firebaseio.com",
  projectId: "bus-management-system-b36c4",
  storageBucket: "bus-management-system-b36c4.appspot.com",
  messagingSenderId: "269904002371",
  appId: "1:269904002371:web:917980aaaa4ff0898c83f6",
  measurementId: "G-5PT5K8N75S"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Set the active route to T Nagar's correct Firebase key
set(ref(db, "system_status/active_route_id"), "-OywM9L7NH0enwNP3Aey").then(() => {
  console.log("Active route set to T Nagar route (-OywM9L7NH0enwNP3Aey)");
  process.exit(0);
}).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});

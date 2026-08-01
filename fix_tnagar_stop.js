const { initializeApp } = require("firebase/app");
const { getDatabase, ref, update } = require("firebase/database");

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

// Update T Nagar route's first stop from "Poonamalle" to "Poonamalle Bus stand"
// so it shows up under the same station as the Thandalam route
update(ref(db, "routes/-OywM9L7NH0enwNP3Aey/stops/0"), {
  name: "Poonamalle Bus stand"
}).then(() => {
  console.log("Successfully updated T Nagar route's first stop to 'Poonamalle Bus stand'!");
  process.exit(0);
}).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});

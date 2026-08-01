const { initializeApp } = require("firebase/app");
const { getDatabase, ref, get } = require("firebase/database");

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

Promise.all([
  get(ref(db, "system_status/active_route_id")),
  get(ref(db, "routes_activity"))
]).then(([activeSnap, activitySnap]) => {
  console.log("Active Route ID:", activeSnap.val());
  console.log("\nRoutes Activity:", JSON.stringify(activitySnap.val(), null, 2));
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});

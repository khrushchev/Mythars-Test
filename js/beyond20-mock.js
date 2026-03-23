// beyond20-mock.js
// Load this INSTEAD of the real Beyond20 extension to simulate roll dispatch during development.
// Usage: add <script type="module" src="js/beyond20-mock.js"></script> to sheet.html temporarily.

console.log("[B20 Mock] Initialised — simulating Beyond20 connection");

// Fire the connected event after a short delay
setTimeout(() => {
  window.dispatchEvent(new CustomEvent("Beyond20_Connected", {
    detail: { version: "2.9.0-mock" }
  }));
  console.log("[B20 Mock] Fired Beyond20_Connected");
}, 300);

// Listen for outbound roll messages and log them
window.addEventListener("Beyond20_SendMessage", e => {
  const d = e.detail;
  console.group(`[B20 Mock] Roll: ${d.title}`);
  console.log("Type:", d.type);
  if (d.d100 !== undefined) console.log("Target:", d.d100 + "%");
  if (d.roll)               console.log("Dice:",   d.roll);
  if (d.fields)             console.log("Fields:", Object.fromEntries(d.fields));
  console.groupEnd();
});

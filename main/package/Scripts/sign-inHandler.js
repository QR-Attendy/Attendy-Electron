/*
QR Attendy base on Website and WebApp lol
Develop by BELDAD-Ace on Github with the team group 1 for PR2
aka Jhon Benedict Belad

all rights reserved 2025

*/

// sign-inHandler.js
const signInForm = document.getElementById("signInForm");
const signinMessage = document.getElementById("signinMessage");

if (signInForm) {
  signInForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = signInForm.querySelector("input[name='email']").value;
    const password = signInForm.querySelector("input[name='password']").value;

 try {
      const res = await fetch("/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password })
      });

      // If server responded with redirect and fetch followed it:
      if (res.redirected) {
        window.location.href = res.url;
        return;
      }

      // Check content-type
      const ct = (res.headers.get("content-type") || "").toLowerCase();

      if (ct.includes("application/json")) {
        const data = await res.json();
        if (res.ok) {
          window.location.href = data.redirect || "/dashboard/index.html";
        } else {
          msg.textContent = data.error || "Invalid credentials";
          msg.style.color = "red";
        }
        return;
      }

      // If not JSON, try text (server might have returned HTML in case of error)
      const text = await res.text();
      // Try to parse JSON from text safely
      try {
        const parsed = JSON.parse(text);
        if (res.ok) {
          window.location.href = parsed.redirect || "/dashboard/index.html";
        } else {
          msg.textContent = parsed.error || "Invalid credentials";
          msg.style.color = "red";
        }
      } catch {
        // Not JSON; show a safe short message
        if (res.ok) {
          // if ok but not JSON — follow to dashboard
          window.location.href = "/dashboard/index.html";
        } else {
          msg.textContent = text ? text.slice(0, 200) : "Login failed";
          msg.style.color = "red";
        }
      }
    } catch (err) {
      msg.textContent = "Network error: " + err.message;
      msg.style.color = "red";
    }
  });
}

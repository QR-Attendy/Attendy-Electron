/*
QR Attendy base on Website and WebApp lol
Develop by BELDAD-Ace on Github with the team group 1 for PR2
aka Jhon Benedict Belad

all rights reserved 2025

*/


const signUpForm = document.getElementById("signUpForm");
const msg = document.getElementById("signupMessage");

if (signUpForm) {
  // helper: parse response (JSON first, then fallback to text)
  async function parseFetchResponse(res) {
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("application/json")) {
      try { return { ok: res.ok, status: res.status, data: await res.json(), text: null }; }
      catch (e) { /* fall through to text */ }
    }
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      return { ok: res.ok, status: res.status, data, text };
    } catch {
      return { ok: res.ok, status: res.status, data: null, text };
    }
  }

  function showMsg(textStr, color = "red") {
    if (!msg) return;
    msg.textContent = textStr;
    msg.style.color = color;
  }

  signUpForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // grab inputs (trim where appropriate)
    const fullNameEl = signUpForm.querySelector("input[name='fullname']");
    const emailEl = signUpForm.querySelector("input[name='email']");
    const passwordEl = signUpForm.querySelector("input[name='password']");
    const confirmPasswordEl = signUpForm.querySelector("input[name='confirmPassword']");
    // role could be radio, select, or input
    const roleRadio = signUpForm.querySelector("input[name='role']:checked");
    const roleSelect = signUpForm.querySelector("select[name='role']");
    const roleInput = signUpForm.querySelector("input[name='role']");

    const fullName = fullNameEl ? fullNameEl.value.trim() : "";
    const email = emailEl ? emailEl.value.trim() : "";
    const password = passwordEl ? passwordEl.value : "";
    const confirmPassword = confirmPasswordEl ? confirmPasswordEl.value : "";
    const role = roleRadio?.value || roleSelect?.value || roleInput?.value || "student";

    // validation
    if (password !== confirmPassword) { showMsg("Passwords do not match."); return; }

    const submitBtn = signUpForm.querySelector("button[type='submit'], input[type='submit']");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.setAttribute("aria-busy", "true");
    }

    try {
      const res = await fetch("/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        // only fullName (no username), email, password, role
        body: JSON.stringify({ fullName, email, password, role })
      });

      if (res.redirected) {
        window.location.href = res.url;
        return;
      }

      const parsed = await parseFetchResponse(res);

      if (parsed.ok) {
        const redirect = parsed.data?.redirect || parsed.data?.redirectUrl || "/dashboard/index.html";
        window.location.href = redirect;
        return;
      }

      const serverMsg = parsed.data?.error || parsed.data?.message || parsed.text;
      showMsg(serverMsg ? String(serverMsg).slice(0, 300) : `Signup failed (${parsed.status})`);
    } catch (err) {
      showMsg("Network error: " + (err && err.message ? err.message : err));
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.removeAttribute("aria-busy");
      }
    }
  });
}
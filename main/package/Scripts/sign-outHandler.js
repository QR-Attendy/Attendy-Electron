document.getElementById("logoutBtn").addEventListener("click", async () => {
  try {
    const response = await fetch("/auth/logout", { method: "POST" });

    if (response.ok) {
      // ✅ clear session and redirect
      window.location.href = "/started/index.html";
    } else {
      alert("Logout failed.");
    }
  } catch (err) {
    console.error("Logout error:", err);
  }
});

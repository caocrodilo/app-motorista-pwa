(function () {
  function injectCredit() {
    const cards = document.querySelectorAll(".auth-card");
    cards.forEach((card) => {
      if (card.querySelector("[data-app-credit]")) return;
      const credit = document.createElement("p");
      credit.dataset.appCredit = "true";
      credit.textContent = "App feita por Carlos Pontes 2026";
      credit.style.margin = "4px 0 0";
      credit.style.color = "#63746b";
      credit.style.fontSize = "0.78rem";
      credit.style.fontWeight = "700";
      credit.style.textAlign = "center";
      card.appendChild(credit);
    });
  }

  const observer = new MutationObserver(injectCredit);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectCredit);
  } else {
    injectCredit();
  }
})();

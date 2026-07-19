(function () {
  let dailyDirty = false;

  function setNativeValue(element, value) {
    const setter = Object.getOwnPropertyDescriptor(element.__proto__, "value")?.set;
    if (setter) setter.call(element, value);
    else element.value = value;
  }

  function fireChange(element) {
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function selectedTime(hourSelect, minuteSelect) {
    const hour = hourSelect.value || "";
    const minute = minuteSelect.value || "";
    if (!hour && !minute) return "";
    return `${hour || "00"}:${minute || "00"}`;
  }

  function enhanceTimeWheel(wheel) {
    if (wheel.dataset.nativeTimeReady === "true") return;
    const selects = wheel.querySelectorAll("select");
    const hourSelect = selects[0];
    const minuteSelect = selects[1];
    if (!hourSelect || !minuteSelect) return;

    wheel.dataset.nativeTimeReady = "true";
    const input = document.createElement("input");
    input.type = "time";
    input.step = "60";
    input.className = "native-time-input";
    input.value = selectedTime(hourSelect, minuteSelect);
    input.setAttribute("aria-label", wheel.getAttribute("aria-label") || "Selecionar hora");

    input.addEventListener("change", () => {
      const [hour = "", minute = ""] = input.value.split(":");
      setNativeValue(hourSelect, hour);
      fireChange(hourSelect);
      setTimeout(() => {
        setNativeValue(minuteSelect, minute);
        fireChange(minuteSelect);
      }, 0);
      dailyDirty = true;
    });

    const wrapper = document.createElement("div");
    wrapper.className = "native-time-wrapper";
    wrapper.appendChild(input);
    wheel.parentNode.insertBefore(wrapper, wheel);
    wheel.style.display = "none";
  }

  function dailyForm() {
    return Array.from(document.querySelectorAll("form.form-stack")).find((form) => {
      const text = form.textContent || "";
      return text.includes("Total di\u00e1rio") || text.includes("Total di\u00c3\u00a1rio") || text.includes("Total di\u00c3\u0192\u00c2\u00a1rio");
    });
  }

  function wireDailyForm(form) {
    if (form.dataset.dailySafetyReady === "true") return;
    form.dataset.dailySafetyReady = "true";
    dailyDirty = false;

    form.addEventListener("input", () => {
      dailyDirty = true;
    });
    form.addEventListener("change", () => {
      dailyDirty = true;
    });
    form.addEventListener("submit", () => {
      dailyDirty = false;
    });
  }

  function scan() {
    document.querySelectorAll(".time-wheel").forEach(enhanceTimeWheel);
    const form = dailyForm();
    if (form) wireDailyForm(form);
  }

  function guardLeave(target) {
    const form = dailyForm();
    if (!form || !dailyDirty) return false;

    const shouldSave = window.confirm("Deseja guardar este registo antes de sair?\n\nOK = guardar\nCancelar = sair sem guardar");
    dailyDirty = false;
    if (shouldSave) {
      if (typeof form.requestSubmit === "function") form.requestSubmit();
      else form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      return true;
    }

    setTimeout(() => target.click(), 0);
    return true;
  }

  document.addEventListener(
    "click",
    (event) => {
      const button = event.target.closest("button");
      if (!button) return;
      const text = (button.textContent || "").trim();

      if (text === "Apagar") {
        if (!window.confirm("Tem a certeza que deseja apagar este registo?")) {
          event.preventDefault();
          event.stopImmediatePropagation();
        } else {
          dailyDirty = false;
        }
        return;
      }

      const isCancel = text === "Cancelar";
      const isBottomNav = Boolean(button.closest(".bottom-nav"));
      const isLogout = text === "Sair";
      if (!isCancel && !isBottomNav && !isLogout) return;
      if (!guardLeave(button)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );

  window.addEventListener("beforeunload", (event) => {
    if (!dailyForm() || !dailyDirty) return;
    event.preventDefault();
    event.returnValue = "";
  });

  const style = document.createElement("style");
  style.textContent = `
    .native-time-wrapper {
      width: 100%;
    }

    .native-time-input {
      min-height: 48px;
      width: 100%;
      border: 1px solid #cbd8d0;
      border-radius: 8px;
      background: #fff;
      color: #17251f;
      padding: 10px 11px;
      font: inherit;
      font-size: 1.05rem;
      font-weight: 800;
      text-align: center;
    }
  `;
  document.head.appendChild(style);

  const observer = new MutationObserver(scan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scan);
  else scan();
})();

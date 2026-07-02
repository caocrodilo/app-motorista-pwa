(function () {
  const DB_NAME = "app-motorista-db";
  const DB_VERSION = 2;
  const USER_STORE = "userProfile";

  const requestToPromise = (request) =>
    new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

  const transactionDone = (transaction) =>
    new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });

  const hashPassword = async (password) => {
    const bytes = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  };

  const openDb = () =>
    new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

  const loadUserProfile = async () => {
    const db = await openDb();
    const transaction = db.transaction(USER_STORE, "readonly");
    const users = await requestToPromise(transaction.objectStore(USER_STORE).getAll());
    db.close();
    return users[0] || null;
  };

  const saveUserProfile = async (profile) => {
    const db = await openDb();
    const transaction = db.transaction(USER_STORE, "readwrite");
    transaction.objectStore(USER_STORE).put(profile);
    await transactionDone(transaction);
    db.close();
  };

  const setMessage = (node, text, type) => {
    node.textContent = text;
    node.style.display = text ? "block" : "none";
    node.style.margin = "0";
    node.style.borderRadius = "8px";
    node.style.padding = "10px 12px";
    node.style.fontSize = "0.9rem";
    node.style.fontWeight = "750";
    if (type === "success") {
      node.style.background = "#e1f1e6";
      node.style.color = "#245c38";
    } else {
      node.style.background = "#f5dddd";
      node.style.color = "#8c2a2a";
    }
  };

  const buildPanel = () => {
    const panel = document.createElement("section");
    panel.className = "panel form-section";
    panel.dataset.passwordChangePanel = "true";
    panel.innerHTML = [
      "<h2>Password de acesso</h2>",
      "<div class=\"settings-grid\">",
      "<label>Password atual<input data-password-current type=\"password\" autocomplete=\"current-password\"></label>",
      "<label>Nova password<input data-password-next type=\"password\" autocomplete=\"new-password\"></label>",
      "<label>Confirmar nova password<input data-password-confirm type=\"password\" autocomplete=\"new-password\"></label>",
      "</div>",
      "<p data-password-message style=\"display:none\"></p>",
      "<button type=\"button\" data-password-save>Alterar password</button>",
    ].join("");

    const currentInput = panel.querySelector("[data-password-current]");
    const nextInput = panel.querySelector("[data-password-next]");
    const confirmInput = panel.querySelector("[data-password-confirm]");
    const message = panel.querySelector("[data-password-message]");
    const button = panel.querySelector("[data-password-save]");

    button.addEventListener("click", async () => {
      setMessage(message, "", "error");
      const currentPassword = currentInput.value;
      const nextPassword = nextInput.value;
      const confirmPassword = confirmInput.value;

      if (!currentPassword || !nextPassword || !confirmPassword) {
        setMessage(message, "Preenche a password atual, a nova password e a confirmação.", "error");
        return;
      }
      if (nextPassword.length < 4) {
        setMessage(message, "A nova password deve ter pelo menos 4 caracteres.", "error");
        return;
      }
      if (nextPassword !== confirmPassword) {
        setMessage(message, "A confirmação não coincide com a nova password.", "error");
        return;
      }

      button.disabled = true;
      try {
        const profile = await loadUserProfile();
        if (!profile) {
          setMessage(message, "Não foi encontrado nenhum utilizador neste dispositivo.", "error");
          return;
        }
        const currentHash = await hashPassword(currentPassword);
        if (currentHash !== profile.passwordHash) {
          setMessage(message, "A password atual está incorreta.", "error");
          return;
        }
        await saveUserProfile({
          ...profile,
          passwordHash: await hashPassword(nextPassword),
          updatedAt: new Date().toISOString(),
        });
        currentInput.value = "";
        nextInput.value = "";
        confirmInput.value = "";
        setMessage(message, "Password alterada com sucesso.", "success");
      } catch (error) {
        setMessage(message, "Não foi possível alterar a password.", "error");
      } finally {
        button.disabled = false;
      }
    });

    return panel;
  };

  const injectPanel = () => {
    if (document.querySelector("[data-password-change-panel]")) return;
    const settingsForm = Array.from(document.querySelectorAll("form.screen.form-stack")).find((form) => {
      const text = form.textContent || "";
      return text.includes("Backup") && text.includes("Nova versão") && text.includes("Valores de referência");
    });
    if (!settingsForm || settingsForm.textContent.includes("Password de acesso")) return;

    const sections = Array.from(settingsForm.querySelectorAll("section"));
    const backupSection = sections.find((section) => (section.textContent || "").includes("Backup"));
    const nextSection = sections.find((section) => (section.textContent || "").includes("Nova versão"));
    const panel = buildPanel();

    if (backupSection && backupSection.nextSibling) {
      settingsForm.insertBefore(panel, backupSection.nextSibling);
    } else if (nextSection) {
      settingsForm.insertBefore(panel, nextSection);
    } else {
      settingsForm.appendChild(panel);
    }
  };

  const observer = new MutationObserver(injectPanel);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("load", injectPanel);
  setInterval(injectPanel, 1000);
})();

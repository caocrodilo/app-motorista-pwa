(function () {
  const originalOpen = window.open;

  function improveTransmaiaPrint(html) {
    if (typeof html !== "string" || !html.includes("Mapa de Ajudas de Custo")) return html;

    return html
      .replace(
        "body { color: #111; font-family: Arial, sans-serif; font-size: 8px; background: white; }",
        "body { color: #111; font-family: Arial, sans-serif; font-size: 10px; font-weight: 700; background: white; }",
      )
      .replace(
        "h1 { margin: 0 0 4mm; text-align: center; font-size: 16px; }",
        "h1 { margin: 0 0 4mm; text-align: center; font-size: 18px; font-weight: 900; }",
      )
      .replace(
        "th, td { border: 1.3px solid #111; padding: 1mm 1.2mm; vertical-align: middle; line-height: 1.05; }",
        "th, td { border: 1.4px solid #111; padding: 0.8mm 1mm; vertical-align: middle; line-height: 1.08; }",
      )
      .replace(
        "th { height: 8mm; text-align: center; font-size: 10px; font-weight: 800; }",
        "th { height: 8mm; text-align: center; font-size: 11px; font-weight: 900; }",
      )
      .replace(
        ".total-row td { border-top-width: 2px; font-weight: 800; }",
        ".total-row td { border-top-width: 2px; font-weight: 900; }",
      )
      .replace(
        ".footer { display: grid; grid-template-columns: 1.4fr 0.8fr 0.8fr 1.1fr; gap: 18px; margin-top: 5mm; font-size: 10px; }",
        ".footer { display: grid; grid-template-columns: 1.4fr 0.8fr 0.8fr 1.1fr; gap: 18px; margin-top: 5mm; font-size: 11px; font-weight: 800; }",
      );
  }

  window.open = function patchedWindowOpen() {
    const opened = originalOpen.apply(window, arguments);
    if (!opened || !opened.document || opened.document.dataset?.transmaiaReadableReady === "true") return opened;

    try {
      opened.document.dataset.transmaiaReadableReady = "true";
      const originalWrite = opened.document.write.bind(opened.document);
      opened.document.write = function patchedDocumentWrite(content) {
        return originalWrite(improveTransmaiaPrint(content));
      };
    } catch (error) {
      return opened;
    }

    return opened;
  };
})();

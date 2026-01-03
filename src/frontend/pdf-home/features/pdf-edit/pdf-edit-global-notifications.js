export function showPdfEditGlobalError({ message, showError, logger }) {
  const text = String(message ?? "");

  try {
    showError(text, 3000);
    return;
  } catch (e) {
    try { logger?.warn?.("[PDFEditFeature] showError toast failed, fallback to #global-error DOM", e); } catch (_) { void _; }
  }

  const errorDiv = document.getElementById("global-error");
  if (!errorDiv) {return;}

  errorDiv.textContent = text;
  errorDiv.classList.add("show");

  setTimeout(() => {
    try { errorDiv.classList.remove("show"); } catch (_) { logger?.warn?.("[PDFEditFeature] hide global-error toast failed", _); }
  }, 3000);
}

export function showPdfEditGlobalWarning({ message, showError, logger }) {
  const text = String(message ?? "");

  try {
    showError(text, 3000);
    return;
  } catch (e) {
    try { logger?.warn?.("[PDFEditFeature] showError toast failed (warning), fallback to #global-error DOM", e); } catch (_) { void _; }
  }

  const errorDiv = document.getElementById("global-error");
  if (!errorDiv) {return;}

  errorDiv.classList.remove("toast-error");
  errorDiv.classList.add("toast-warning");
  errorDiv.textContent = text;
  errorDiv.classList.add("show");

  setTimeout(() => {
    errorDiv.classList.remove("show");
    setTimeout(() => {
      errorDiv.classList.remove("toast-warning");
      errorDiv.classList.add("toast-error");
    }, 300);
  }, 3000);
}


import "@testing-library/jest-dom/vitest";

// jsdom has no modal dialog support; give <dialog> the subset the app uses.
// Components must decide the outcome from their own button handlers, not returnValue.
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}

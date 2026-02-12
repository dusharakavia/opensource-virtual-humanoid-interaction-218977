// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";

// jsdom does not implement scrollIntoView; components may call it for UX auto-scroll.
// Provide a harmless noop so unit tests don't crash.
// (Using defineProperty avoids "Cannot assign to read only property" in some environments.)
if (!window.HTMLElement.prototype.scrollIntoView) {
  Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
    value: () => {},
    writable: true,
  });
}

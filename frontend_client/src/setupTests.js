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

/**
 * JSDOM does not implement canvas/WebGL. The app uses @react-three/fiber which will try to
 * construct a WebGLRenderer during render, causing tests (and some preview checks) to crash.
 *
 * We provide a very small mock of getContext so three.js can initialize without throwing.
 * This is NOT a real renderer; it only exists to keep unit tests focused on UI logic.
 */
if (!HTMLCanvasElement.prototype.getContext) {
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    writable: true,
    value: function getContext(contextType) {
      // Only minimal stubs; enough for three.js/r3f init paths in tests.
      if (contextType === "webgl" || contextType === "webgl2" || contextType === "experimental-webgl") {
        return {
          canvas: this,
          getExtension: () => null,
          getParameter: () => null,
          createShader: () => ({}),
          shaderSource: () => {},
          compileShader: () => {},
          createProgram: () => ({}),
          attachShader: () => {},
          linkProgram: () => {},
          useProgram: () => {},
          getShaderParameter: () => true,
          getProgramParameter: () => true,
          getShaderInfoLog: () => "",
          getProgramInfoLog: () => "",
          getAttribLocation: () => 0,
          getUniformLocation: () => ({}),
          viewport: () => {},
          clearColor: () => {},
          clear: () => {},
          enable: () => {},
          disable: () => {},
          blendFunc: () => {},
          depthFunc: () => {},
          createBuffer: () => ({}),
          bindBuffer: () => {},
          bufferData: () => {},
          createTexture: () => ({}),
          bindTexture: () => {},
          texImage2D: () => {},
          texParameteri: () => {},
          activeTexture: () => {},
          drawArrays: () => {},
          drawElements: () => {},
        };
      }

      // 2D context isn't needed by the app, but returning null matches browser behavior.
      if (contextType === "2d") return null;

      return null;
    },
  });
}

import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders app header", () => {
  render(<App />);

  // App UI has evolved beyond the CRA starter template; assert on a stable header string.
  expect(screen.getByRole("heading", { name: /neon violet humanoid/i })).toBeInTheDocument();
});

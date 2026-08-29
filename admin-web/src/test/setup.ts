import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Gỡ DOM sau mỗi test để các test không rò rỉ trạng thái sang nhau.
afterEach(() => {
  cleanup();
});

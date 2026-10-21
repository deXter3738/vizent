import { describe, expect, it } from "vitest";
import { isLoopback } from "../src/plugin/bridge.js";

describe("bridge access control", () => {
  it.each(["127.0.0.1", "::1", "::ffff:127.0.0.1"])("accepts the loopback peer %s", (address) => {
    expect(isLoopback({ socket: { remoteAddress: address } as never })).toBe(true);
  });

  it.each(["192.168.1.20", "10.0.0.5", "203.0.113.7", "0.0.0.0", "127.0.0.2"])(
    "rejects the non-loopback peer %s",
    (address) => {
      expect(isLoopback({ socket: { remoteAddress: address } as never })).toBe(false);
    },
  );

  it("rejects a socket with no reported address", () => {
    expect(isLoopback({ socket: { remoteAddress: undefined } as never })).toBe(false);
  });
});

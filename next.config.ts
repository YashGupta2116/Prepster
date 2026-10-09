import type { NextConfig } from "next";

const memoryStorage = {
  getItem: (_key: string) => null,
  setItem: (_key: string, _value: string) => {},
  removeItem: (_key: string) => {},
  clear: () => {},
  key: (_index: number) => null,
  get length() {
    return 0;
  },
};

if (typeof globalThis.localStorage?.getItem !== "function") {
  globalThis.localStorage = memoryStorage as Storage;
}

const nextConfig: NextConfig = {
};

export default nextConfig;

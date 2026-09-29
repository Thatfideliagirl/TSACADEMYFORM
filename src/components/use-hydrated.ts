"use client";

import { useSyncExternalStore } from "react";

// False while the page is still loading in the browser, true once it is ready to handle clicks.
// A form sent before that would fall back to the browser's plain submit, which puts the typed
// values (even a password) into the address bar. Buttons stay switched off until this is true.
const subscribe = () => () => {};
export const useHydrated = () => useSyncExternalStore(subscribe, () => true, () => false);

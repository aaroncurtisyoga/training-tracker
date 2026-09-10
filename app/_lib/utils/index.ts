import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Always throws — annotated `never` so callers don't need an unreachable
// return after it, and so the "server actions surface errors by throwing"
// contract is explicit in the type.
export const handleError = (error: unknown, _message?: unknown): never => {
  console.error(error);
  throw new Error(typeof error === "string" ? error : JSON.stringify(error));
};

export const hashPassword = async (password: string) => {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const verifyPassword = async (password: string, expectedHash: string) => {
  const actualHash = await hashPassword(password);
  return actualHash === expectedHash;
};

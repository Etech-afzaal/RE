// Simple readable temp password, e.g. "sunset-4821"
const words = [
  "sunset",
  "harbor",
  "meadow",
  "canyon",
  "summit",
  "willow",
  "cedar",
  "amber",
];
export function generateTempPassword() {
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${word}-${num}`;
}

export function generateUsername(fullName) {
  const base = fullName
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  const suffix = Math.floor(100 + Math.random() * 900);
  return `${base.slice(0, 12)}${suffix}`;
}

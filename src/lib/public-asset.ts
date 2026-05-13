/** URL for a file in `public/` (honors Vite `base` / `import.meta.env.BASE_URL`, e.g. GitHub project pages). */
export function publicUrl(filename: string): string {
  const file = filename.replace(/^\/+/, "");
  return `${import.meta.env.BASE_URL}${file}`;
}

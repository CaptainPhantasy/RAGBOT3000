/// <reference types="vite/client" />

// Allow importing markdown files as raw strings
declare module '*.md?raw' {
  const content: string;
  export default content;
}

// Allow importing markdown files (without ?raw, Vite transforms)
declare module '*.md' {
  const content: string;
  export default content;
}

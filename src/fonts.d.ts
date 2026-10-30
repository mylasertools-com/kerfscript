declare module '*.md' {
  const text: string;
  export default text;
}

declare module '*.txt' {
  const text: string;
  export default text;
}

declare module '*/LICENSE' {
  const text: string;
  export default text;
}

declare module '*.ttf' {
  const data: Uint8Array;
  export default data;
}

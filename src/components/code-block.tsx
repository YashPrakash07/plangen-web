// src/components/code-block.tsx
"use client"; // This component needs to run on the client-side

import { useTheme } from "next-themes"; // To get the current theme
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
// Import the styles you want to use for light and dark modes
import { vscDarkPlus, vs } from "react-syntax-highlighter/dist/esm/styles/prism";

interface CodeBlockProps {
  code: string;
  language?: string; // Optional: specify the language, defaults to 'typescript'
}

export const CodeBlock = ({ code, language = 'typescript' }: CodeBlockProps) => {
  const { theme } = useTheme();

  // Choose the style based on the current theme
  const style = theme === "dark" ? vscDarkPlus : vs;

  return (
    <SyntaxHighlighter 
      language={language} // Use the provided language or default to 'typescript'
      style={style} 
      showLineNumbers // Optional: show line numbers
      customStyle={{
        margin: 0,
        padding: '1rem',
        paddingRight: '3rem', // Add space for copy button if it overlaps
        borderRadius: '0.375rem', // Tailwind 'rounded-md'
        backgroundColor: 'var(--code-bg, #f6f8fa)', // Fallback for light theme
        color: 'var(--code-text, #24292e)' // Fallback for light theme
      }}
      codeTagProps={{
        style: { fontFamily: 'var(--font-mono)' }, // Ensure monospace font
      }}
      wrapLongLines // Wraps long lines of code
    >
      {code}
    </SyntaxHighlighter>
  );
};
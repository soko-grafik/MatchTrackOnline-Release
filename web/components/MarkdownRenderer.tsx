"use client";

import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  if (!content) return null;

  const parseInline = (text: string): React.ReactNode[] => {
    // Regex matching bold, links, code, and italic
    const regex = /(\*\*.*?\*\*|\[.*?\]\(.*?\)|\`.*?\`|\*.*?\*)/g;
    const parts = text.split(regex);

    return parts.map((part, index) => {
      if (!part) return null;

      // Bold: **text**
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return <strong key={index} className="font-bold text-white">{part.slice(2, -2)}</strong>;
      }
      // Inline Code: `code`
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        return (
          <code key={index} className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-emerald-400">
            {part.slice(1, -1)}
          </code>
        );
      }
      // Link: [label](url)
      const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
      if (linkMatch) {
        const isExternal = linkMatch[2].startsWith('http');
        return (
          <a
            key={index}
            href={linkMatch[2]}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noopener noreferrer' : undefined}
            className="text-primary hover:underline font-medium"
          >
            {linkMatch[1]}
          </a>
        );
      }
      // Italic: *text*
      if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
        return <em key={index} className="italic text-zinc-300">{part.slice(1, -1)}</em>;
      }

      return part;
    });
  };

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let inList = false;
  let listItems: React.ReactNode[] = [];
  let inNumberedList = false;
  let numberedItems: React.ReactNode[] = [];

  const flushList = () => {
    if (inList && listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="my-3 list-disc pl-5 space-y-1 text-zinc-300 text-sm leading-relaxed">
          {listItems}
        </ul>
      );
      listItems = [];
      inList = false;
    }
    if (inNumberedList && numberedItems.length > 0) {
      elements.push(
        <ol key={`ol-${elements.length}`} className="my-3 list-decimal pl-5 space-y-1 text-zinc-300 text-sm leading-relaxed">
          {numberedItems}
        </ol>
      );
      numberedItems = [];
      inNumberedList = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trimEnd();

    // Horizontal Rule
    if (line.trim() === '---' || line.trim() === '***') {
      flushList();
      elements.push(<hr key={`hr-${i}`} className="my-6 border-zinc-800" />);
      continue;
    }

    // Heading 1 (# Heading)
    if (line.startsWith('# ')) {
      flushList();
      elements.push(
        <h1 key={`h1-${i}`} className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-6 mb-3">
          {parseInline(line.slice(2))}
        </h1>
      );
      continue;
    }

    // Heading 2 (## Heading)
    if (line.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={`h2-${i}`} className="text-lg sm:text-xl font-bold text-white tracking-tight mt-6 mb-2.5 pb-1 border-b border-zinc-800/80">
          {parseInline(line.slice(3))}
        </h2>
      );
      continue;
    }

    // Heading 3 (### Heading)
    if (line.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={`h3-${i}`} className="text-base font-bold text-zinc-100 mt-4 mb-2">
          {parseInline(line.slice(4))}
        </h3>
      );
      continue;
    }

    // Unordered List (- item or * item)
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      if (inNumberedList) flushList();
      inList = true;
      const text = line.trim().replace(/^[-*]\s+/, '');
      listItems.push(
        <li key={`li-${i}`}>
          {parseInline(text)}
        </li>
      );
      continue;
    }

    // Numbered List (1. item)
    const numberedMatch = line.trim().match(/^(\d+)\.\s+(.*)$/);
    if (numberedMatch) {
      if (inList) flushList();
      inNumberedList = true;
      numberedItems.push(
        <li key={`nli-${i}`}>
          {parseInline(numberedMatch[2])}
        </li>
      );
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      flushList();
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p key={`p-${i}`} className="my-2.5 text-sm text-zinc-300 leading-relaxed">
        {parseInline(line)}
      </p>
    );
  }

  flushList();

  return <div className={`prose-zinc max-w-none ${className}`}>{elements}</div>;
}

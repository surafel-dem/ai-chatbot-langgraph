import React, { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { ButtonCopy } from '@/components/common/button-copy';
import {
  CodeBlock,
  CodeBlockCode,
  CodeBlockGroup,
} from '@/components/prompt-kit/code-block';
import { LinkMarkdown } from '@/components/chat/link-markdown';

function extractLanguage(className?: string): string {
  if (!className) return 'plaintext';
  const match = className.match(/language-(\w+)/);
  return match ? match[1] : 'plaintext';
}

const components: Partial<Components> = {
  code: function CodeComponent({ className, children, ...props }) {
    const isInline =
      !props.node?.position?.start.line ||
      props.node?.position?.start.line === props.node?.position?.end.line;

    if (isInline) {
      return (
        <span
          className={cn('bg-card rounded-sm px-1 font-mono text-sm', className)}
          {...props}
        >
          {children}
        </span>
      );
    }

    const language = extractLanguage(className);

    return (
      <CodeBlock className={className}>
        <CodeBlockGroup className="flex h-9 items-center justify-between px-4">
          <div className="text-muted-foreground py-1 pr-2 font-mono text-xs">
            {language}
          </div>
        </CodeBlockGroup>
        <div className="sticky top-16 lg:top-0">
          <div className="absolute right-0 bottom-0 flex h-9 items-center pr-1.5">
            <ButtonCopy code={children as string} />
          </div>
        </div>
        <CodeBlockCode code={children as string} language={language} />
      </CodeBlock>
    );
  },
  pre: ({ children }) => <>{children}</>,
  ol: ({ node, children, ...props }) => {
    return (
      <ol className="list-decimal list-outside ml-4" {...props}>
        {children}
      </ol>
    );
  },
  li: ({ node, children, ...props }) => {
    return (
      <li className="py-1" {...props}>
        {children}
      </li>
    );
  },
  ul: ({ node, children, ...props }) => {
    return (
      <ul className="list-decimal list-outside ml-4" {...props}>
        {children}
      </ul>
    );
  },
  strong: ({ node, children, ...props }) => {
    return (
      <span className="font-semibold" {...props}>
        {children}
      </span>
    );
  },
  a: ({ node, children, ...props }) => {
    return (
      <LinkMarkdown href={props.href || '#'} {...props}>
        {children}
      </LinkMarkdown>
    );
  },
  h1: ({ node, children, ...props }) => {
    return (
      <h1 className="text-3xl font-semibold mt-6 mb-2" {...props}>
        {children}
      </h1>
    );
  },
  h2: ({ node, children, ...props }) => {
    return (
      <h2 className="text-2xl font-semibold mt-6 mb-2" {...props}>
        {children}
      </h2>
    );
  },
  h3: ({ node, children, ...props }) => {
    return (
      <h3 className="text-xl font-semibold mt-6 mb-2" {...props}>
        {children}
      </h3>
    );
  },
  h4: ({ node, children, ...props }) => {
    return (
      <h4 className="text-lg font-semibold mt-6 mb-2" {...props}>
        {children}
      </h4>
    );
  },
  h5: ({ node, children, ...props }) => {
    return (
      <h5 className="text-base font-semibold mt-6 mb-2" {...props}>
        {children}
      </h5>
    );
  },
  h6: ({ node, children, ...props }) => {
    return (
      <h6 className="text-sm font-semibold mt-6 mb-2" {...props}>
        {children}
      </h6>
    );
  },
  table({ children }: { children?: React.ReactNode }) {
    return (
      <div className="overflow-x-auto my-6 rounded border border-border">
        <table className="w-full border-collapse m-0">{children}</table>
      </div>
    );
  },
  tr({ children }: { children?: React.ReactNode }) {
    return (
      <tr
        className={cn(
          'border-b border-border last:border-b-0',
          'hover:bg-muted/50 transition-colors duration-200',
        )}
      >
        {children}
      </tr>
    );
  },

  thead({ children }: { children?: React.ReactNode }) {
    return <thead>{children}</thead>;
  },

  th({ children, align }: { children?: React.ReactNode; align?: string }) {
    const alignClass = align ? `text-${align}` : 'text-left';

    return (
      <th
        className={cn(
          'px-4 py-3 text-sm font-semibold text-foreground',
          'bg-muted',
          'border-b border-border',
          'break-words',
          alignClass,
        )}
      >
        <div className="font-medium">{children}</div>
      </th>
    );
  },

  td({ children, align }: { children?: React.ReactNode; align?: string }) {
    const alignClass = align ? `text-${align}` : 'text-left';

    return (
      <td
        className={cn(
          'px-4 py-3 text-sm text-muted-foreground',
          'border-r border-border last:border-r-0',
          'break-words',
          alignClass,
        )}
      >
        <div className="leading-relaxed">{children}</div>
      </td>
    );
  },

  tbody({ children }: { children?: React.ReactNode }) {
    return <tbody>{children}</tbody>;
  },
};

const remarkPlugins = [remarkGfm];

const NonMemoizedMarkdown = ({ children }: { children: string }) => {
  return (
    <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
      {children}
    </ReactMarkdown>
  );
};

export const Markdown = memo(
  NonMemoizedMarkdown,
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);

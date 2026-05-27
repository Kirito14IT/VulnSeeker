import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Components } from 'react-markdown';


type Props = {
  content: string;
  compact?: boolean;
};


function dedent(text: string): string {
  const lines = text.split('\n');

  let minIndent = Infinity;
  for (const line of lines) {
    if (line.trim().length === 0) continue;
    const match = line.match(/^(\s+)/);
    if (match) {
      minIndent = Math.min(minIndent, match[1].length);
    }
  }

  if (minIndent === Infinity || minIndent === 0) return text;

  return lines.map((line) => {
    if (line.length >= minIndent && line.slice(0, minIndent).trim() === '') {
      return line.slice(minIndent);
    }
    return line;
  }).join('\n');
}


export default function MarkdownSummary({ content, compact = false }: Props) {
  const { t } = useTranslation();

  const components: Components = {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const codeString = String(children).replace(/\n$/, '');

      if (match) {
        return (
          <SyntaxHighlighter
            style={oneDark}
            language={match[1]}
            PreTag="div"
            customStyle={{
              margin: '14px 0',
              borderRadius: '8px',
              fontSize: '13px',
              lineHeight: '1.6',
            }}
          >
            {codeString}
          </SyntaxHighlighter>
        );
      }

      const isBlock = codeString.includes('\n');
      if (isBlock) {
        return (
          <SyntaxHighlighter
            style={oneDark}
            language="text"
            PreTag="div"
            customStyle={{
              margin: '14px 0',
              borderRadius: '8px',
              fontSize: '13px',
              lineHeight: '1.6',
            }}
          >
            {codeString}
          </SyntaxHighlighter>
        );
      }

      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
  };

  const processed = dedent((content || t('markdownSummary.noSummary')).trim());

  return (
    <div className={compact ? 'markdown-summary markdown-summary-compact' : 'markdown-summary'}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {processed}
      </ReactMarkdown>
    </div>
  );
}

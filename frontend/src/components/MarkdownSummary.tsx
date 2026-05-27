import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';


type Props = {
  content: string;
  compact?: boolean;
};


export default function MarkdownSummary({ content, compact = false }: Props) {
  const { t } = useTranslation();

  return (
    <div className={compact ? 'markdown-summary markdown-summary-compact' : 'markdown-summary'}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content || t('markdownSummary.noSummary')}
      </ReactMarkdown>
    </div>
  );
}

import { useTranslation } from 'react-i18next';
import { Segmented } from 'antd';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language.startsWith('zh') ? 'zh' : 'en';

  return (
    <Segmented
      value={current}
      onChange={(val) => i18n.changeLanguage(val as string)}
      options={[
        { value: 'en', label: 'EN' },
        { value: 'zh', label: '中文' },
      ]}
      size="small"
      style={{ border: '1px solid #d9d9d9' }}
    />
  );
}

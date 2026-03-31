import { Button, Card, Space, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';


const { Title, Paragraph } = Typography;


export default function SecureCodingEvalPage() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: 24 }}>
      <Card
        style={{
          marginBottom: 16,
          borderRadius: 28,
          border: '1px solid #dbe7f4',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.08)',
        }}
      >
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
            Back
          </Button>
          <Title level={3} style={{ margin: 0, fontFamily: 'Georgia, serif' }}>
            Secure Coding LLM Evaluation
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Evaluating large language models for secure coding.
          </Paragraph>
        </Space>
      </Card>

      <Card
        style={{
          minHeight: 480,
          borderRadius: 24,
          border: '1px dashed #cbd5e1',
          background: 'rgba(255,255,255,0.72)',
        }}
      />
    </div>
  );
}

/**
 * Q&A Panel Component
 * 
 * Handles general questions about customs declarations, trade regulations, and procedures.
 * This is separate from the document-specific chat functionality.
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { qaService } from '../../services/api';
import theme from '../../styles/theme';

const PanelContainer = styled.div`
  padding: ${theme.spacing.lg}px;
  height: 100%;
  overflow-y: auto;
  background: ${theme.colors.ui.heroBackground}; /* Using consistent dark background */
`;

const Header = styled.div`
  margin-bottom: ${theme.spacing.lg}px;
`;

const Title = styled.h2`
  color: ${theme.colors.text.primary};
  margin-bottom: ${theme.spacing.sm}px;
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm}px;
`;

const Description = styled.p`
  color: ${theme.colors.text.secondary};
  line-height: 1.6;
`;

const ContentGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${theme.spacing.lg}px;
  height: calc(100% - 120px);
`;

const QASection = styled.div`
  display: flex;
  flex-direction: column;
  background: ${theme.colors.ui.card};
  border-radius: ${theme.radius.lg};
  padding: ${theme.spacing.lg}px;
  box-shadow: ${theme.shadows.sm};
`;

const SectionTitle = styled.h3`
  color: ${theme.colors.text.primary};
  margin-bottom: ${theme.spacing.md}px;
  font-size: ${theme.typography.fontSize.subheading};
`;

const QuestionInput = styled.textarea`
  width: 100%;
  min-height: 100px;
  padding: ${theme.spacing.md}px;
  border: 1px solid ${theme.colors.ui.border};
  border-radius: ${theme.radius.md};
  background: ${theme.colors.ui.background};
  color: ${theme.colors.text.primary};
  font-family: ${theme.typography.fontFamily.main};
  resize: vertical;
  margin-bottom: ${theme.spacing.md}px;
  
  &:focus {
    outline: none;
    border-color: ${theme.colors.primary.main};
    box-shadow: 0 0 0 2px ${theme.colors.primary.light}20;
  }
`;

const AskButton = styled.button`
  background: ${theme.colors.primary.main};
  color: white;
  border: none;
  padding: ${theme.spacing.md}px ${theme.spacing.lg}px;
  border-radius: ${theme.radius.md};
  font-weight: ${theme.typography.fontWeight.medium};
  cursor: pointer;
  transition: all ${theme.transitions.fast};
  align-self: flex-start;
  
  &:hover {
    background: ${theme.colors.primary.dark};
    transform: translateY(-1px);
  }
  
  &:disabled {
    background: ${theme.colors.text.disabled};
    cursor: not-allowed;
    transform: none;
  }
`;

const AnswerSection = styled.div`
  flex: 1;
  overflow-y: auto;
  margin-top: ${theme.spacing.md}px;
`;

const Answer = styled.div`
  background: ${theme.colors.ui.background};
  border: 1px solid ${theme.colors.ui.border};
  border-radius: ${theme.radius.md};
  padding: ${theme.spacing.md}px;
  margin-bottom: ${theme.spacing.md}px;
  line-height: 1.6;
  color: ${theme.colors.text.primary};
`;

const LoadingSpinner = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${theme.spacing.lg}px;
  color: ${theme.colors.text.secondary};
`;

const SampleQuestionsSection = styled.div`
  display: flex;
  flex-direction: column;
`;

const SampleQuestionsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm}px;
`;

const SampleQuestion = styled.button`
  background: ${theme.colors.ui.background};
  border: 1px solid ${theme.colors.ui.border};
  border-radius: ${theme.radius.md};
  padding: ${theme.spacing.md}px;
  text-align: left;
  cursor: pointer;
  transition: all ${theme.transitions.fast};
  color: ${theme.colors.text.primary};
  
  &:hover {
    background: ${theme.colors.ui.hover};
    border-color: ${theme.colors.primary.main};
  }
`;

const FeaturesList = styled.ul`
  list-style: none;
  padding: 0;
  margin: ${theme.spacing.md}px 0;
`;

const FeatureItem = styled.li`
  padding: ${theme.spacing.xs}px 0;
  color: ${theme.colors.text.secondary};
  display: flex;
  align-items: center;
  gap: ${theme.spacing.xs}px;
  
  &:before {
    content: "✓";
    color: ${theme.colors.status.success};
    font-weight: bold;
  }
`;

const TipsSection = styled.div`
  background: ${theme.colors.status.infoLight}20;
  border: 1px solid ${theme.colors.status.info}40;
  border-radius: ${theme.radius.md};
  padding: ${theme.spacing.md}px;
  margin-top: ${theme.spacing.md}px;
`;

const TipsTitle = styled.h4`
  color: ${theme.colors.status.info};
  margin-bottom: ${theme.spacing.sm}px;
  font-size: ${theme.typography.fontSize.sm};
`;

const QAPanel = () => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const sampleQuestions = [
    "What documents are required for customs clearance?",
    "How do I calculate import duties and taxes?",
    "What is the difference between CIF and FOB?",
    "How long does customs clearance typically take?",
    "What are the common reasons for customs delays?",
    "How do I handle customs valuation for my goods?",
    "What are the requirements for customs bonds?",
    "How do I appeal a customs decision?",
    "What are the penalties for customs violations?",
    "How do I get an EORI number?"
  ];

  const handleAskQuestion = async () => {
    if (!question.trim()) return;
    
    setIsLoading(true);
    setAnswer('');
    
    try {
      const response = await qaService.askGeneralQuestion(question);
      setAnswer(response.answer || 'No answer received');
    } catch (error) {
      console.error('Error asking question:', error);
      setAnswer('Sorry, I encountered an error while processing your question. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSampleQuestion = (sampleQ) => {
    setQuestion(sampleQ);
  };

  return (
    <PanelContainer>
      <Header>
        <Title>💬 Customs Q&A System</Title>
        <Description>
          Ask general questions about customs declarations, trade regulations, import/export procedures, 
          and international trade compliance. This system provides guidance on customs-related topics.
        </Description>
      </Header>

      <ContentGrid>
        <QASection>
          <SectionTitle>Ask a Question</SectionTitle>
          <QuestionInput
            placeholder="Enter your customs-related question here..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleAskQuestion()}
          />
          <AskButton 
            onClick={handleAskQuestion}
            disabled={isLoading || !question.trim()}
          >
            {isLoading ? 'Asking...' : 'Ask Question'}
          </AskButton>
          
          <AnswerSection>
            {isLoading && (
              <LoadingSpinner>
                <div>🤔 Thinking...</div>
              </LoadingSpinner>
            )}
            {answer && !isLoading && (
              <Answer>
                <strong>Answer:</strong><br />
                {answer}
              </Answer>
            )}
          </AnswerSection>
        </QASection>

        <SampleQuestionsSection>
          <SectionTitle>Sample Questions</SectionTitle>
          <SampleQuestionsList>
            {sampleQuestions.map((sampleQ, index) => (
              <SampleQuestion
                key={index}
                onClick={() => handleSampleQuestion(sampleQ)}
              >
                {sampleQ}
              </SampleQuestion>
            ))}
          </SampleQuestionsList>

          <TipsSection>
            <TipsTitle>💡 Tips for Better Answers</TipsTitle>
            <FeaturesList>
              <FeatureItem>Be specific about your question</FeatureItem>
              <FeatureItem>Include relevant details (country, goods type, etc.)</FeatureItem>
              <FeatureItem>Ask about specific procedures or requirements</FeatureItem>
              <FeatureItem>Mention if you're an importer or exporter</FeatureItem>
            </FeaturesList>
          </TipsSection>

          <TipsSection>
            <TipsTitle>📋 What I Can Help With</TipsTitle>
            <FeaturesList>
              <FeatureItem>Customs documentation requirements</FeatureItem>
              <FeatureItem>Import/export procedures</FeatureItem>
              <FeatureItem>Duty and tax calculations</FeatureItem>
              <FeatureItem>Trade compliance regulations</FeatureItem>
              <FeatureItem>Customs valuation methods</FeatureItem>
              <FeatureItem>Border clearance processes</FeatureItem>
            </FeaturesList>
          </TipsSection>
        </SampleQuestionsSection>
      </ContentGrid>
    </PanelContainer>
  );
};

export default QAPanel;

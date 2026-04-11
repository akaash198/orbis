import React, { useState } from 'react';
import styled from 'styled-components';
import { theme } from '../styles/theme';

const LandingContainer = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, ${theme.colors.ui.background} 0%, ${theme.colors.ui.backgroundDark} 50%, ${theme.colors.ui.navbar} 100%);
  color: ${theme.colors.text.primary};
  font-family: ${theme.typography.fontFamily.main};
`;

const Header = styled.header`
  background: ${theme.colors.ui.glass};
  backdrop-filter: blur(12px);
  position: sticky;
  top: 0;
  z-index: 40;
  box-shadow: ${theme.shadows.sm};
  border-bottom: 1px solid ${theme.colors.ui.border};
`;

const HeaderContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 ${theme.spacing.lg}px;
`;

const NavBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 80px;
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md}px;
`;

const LogoIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: ${theme.radius.xl};
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 20px;
  box-shadow: ${theme.shadows.md};
`;

const LogoText = styled.div`
  h1 {
    font-size: 18px;
    font-weight: bold;
    background: ${theme.colors.primary.gradient};
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin: 0;
  }
  p {
    font-size: 12px;
    color: ${theme.colors.text.secondary};
    font-weight: 500;
    margin: 0;
  }
`;

const Navigation = styled.nav`
  display: none;
  align-items: center;
  gap: ${theme.spacing.xl}px;
  
  @media (min-width: 768px) {
    display: flex;
  }
  
  a {
    color: ${theme.colors.text.secondary};
    text-decoration: none;
    font-weight: 500;
    transition: color ${theme.transitions.fast};
    cursor: pointer;
    
    &:hover {
      color: ${theme.colors.primary.main};
    }
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md}px;
`;

const LoginButton = styled.button`
  display: none;
  align-items: center;
  gap: ${theme.spacing.sm}px;
  padding: ${theme.spacing.md}px ${theme.spacing.lg}px;
  border-radius: ${theme.radius.xl};
  border: 2px solid ${theme.colors.ui.border};
  background: ${theme.colors.ui.card};
  color: ${theme.colors.text.primary};
  font-weight: 600;
  transition: all ${theme.transitions.fast};
  cursor: pointer;
  
  @media (min-width: 768px) {
    display: inline-flex;
  }
  
  &:hover {
    background: ${theme.colors.ui.hover};
    border-color: ${theme.colors.primary.main};
  }
`;

const SignUpButton = styled.button`
  display: none;
  align-items: center;
  gap: ${theme.spacing.sm}px;
  padding: ${theme.spacing.md}px ${theme.spacing.lg}px;
  border-radius: ${theme.radius.xl};
  background: ${theme.colors.primary.gradient};
  color: white;
  border: none;
  font-weight: 600;
  box-shadow: ${theme.shadows.lg};
  transition: all ${theme.transitions.fast};
  cursor: pointer;
  
  @media (min-width: 768px) {
    display: inline-flex;
  }
  
  &:hover {
    transform: scale(1.05);
    box-shadow: ${theme.shadows.xl};
  }
`;

const HeroSection = styled.main`
  padding: ${theme.spacing.xl * 2}px ${theme.spacing.lg}px;
  max-width: 1200px;
  margin: 0 auto;
`;

const HeroGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${theme.spacing.xl * 2}px;
  align-items: center;
  
  @media (min-width: 1024px) {
    grid-template-columns: 1fr 1fr;
  }
`;

const HeroContent = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xl}px;
`;

const HeroTitle = styled.h1`
  font-size: 3rem;
  font-weight: 900;
  line-height: 1.1;
  margin: 0;
  
  .gradient-text {
    background: ${theme.colors.primary.gradient};
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  @media (min-width: 640px) {
    font-size: 4rem;
  }
  
  @media (min-width: 1024px) {
    font-size: 4.5rem;
  }
`;

const HeroDescription = styled.p`
  font-size: 1.25rem;
  color: ${theme.colors.text.secondary};
  line-height: 1.6;
  margin: 0;
  max-width: 600px;
`;

const CTAButtons = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.md}px;
  
  @media (min-width: 640px) {
    flex-direction: row;
  }
`;

const PrimaryButton = styled.button`
  padding: ${theme.spacing.md}px ${theme.spacing.xl}px;
  border-radius: ${theme.radius.xl};
  background: ${theme.colors.primary.gradient};
  color: white;
  border: none;
  font-weight: 600;
  font-size: 1.125rem;
  box-shadow: ${theme.shadows.xl};
  transition: all ${theme.transitions.fast};
  cursor: pointer;
  
  &:hover {
    transform: scale(1.05);
    box-shadow: ${theme.shadows.xxl};
  }
`;

const SecondaryButton = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: ${theme.spacing.md}px ${theme.spacing.xl}px;
  border-radius: ${theme.radius.xl};
  border: 2px solid ${theme.colors.ui.border};
  background: ${theme.colors.ui.card};
  color: ${theme.colors.text.primary};
  font-weight: 600;
  font-size: 1.125rem;
  text-decoration: none;
  transition: all ${theme.transitions.fast};
  cursor: pointer;
  
  &:hover {
    background: ${theme.colors.ui.hover};
    border-color: ${theme.colors.primary.main};
  }
`;

// Hero demo section
const DemoSection = styled.aside`
  position: relative;
`;

const DemoContainer = styled.div`
  width: 100%;
  height: 420px;
  background: ${theme.colors.ui.card};
  border-radius: ${theme.radius.xl};
  box-shadow: ${theme.shadows.xl};
  display: flex;
  flex-direction: column;
  padding: ${theme.spacing.lg}px;
  border: 1px solid ${theme.colors.ui.border};
`;

const DemoHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${theme.spacing.lg}px;
`;

const DemoTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: ${theme.colors.text.primary};
`;

const DemoStatus = styled.div`
  font-size: 12px;
  color: ${theme.colors.text.tertiary};
`;

const DemoItems = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.md}px;
  flex: 1;
`;

const DemoItem = styled.div`
  background: ${theme.colors.ui.cardElevated};
  border-radius: ${theme.radius.lg};
  padding: ${theme.spacing.md}px;
  border: 1px solid ${theme.colors.ui.border};
  display: flex;
  align-items: flex-start;
  gap: ${theme.spacing.md}px;
`;

const DemoIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: ${theme.radius.md};
  background: ${props => props.bg || theme.colors.primary.main};
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 12px;
  flex-shrink: 0;
`;

const DemoContent = styled.div`
  flex: 1;
`;

const DemoItemTitle = styled.div`
  font-weight: 600;
  font-size: 14px;
  color: ${theme.colors.text.primary};
  margin-bottom: 4px;
`;

const DemoItemDesc = styled.div`
  font-size: 12px;
  color: ${theme.colors.text.secondary};
`;

const DemoFooter = styled.div`
  margin-top: auto;
  padding-top: ${theme.spacing.md}px;
  font-size: 12px;
  color: ${theme.colors.text.tertiary};
`;

// Benefits list
const BenefitsList = styled.ul`
  margin-top: ${theme.spacing.xl}px;
  display: grid;
  grid-template-columns: 1fr;
  gap: ${theme.spacing.md}px;
  list-style: none;
  padding: 0;
  
  @media (min-width: 640px) {
    grid-template-columns: 1fr 1fr;
  }
`;

const BenefitItem = styled.li`
  display: flex;
  align-items: flex-start;
  gap: ${theme.spacing.md}px;
`;

const BenefitIcon = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: ${props => props.color || theme.colors.primary.main};
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 12px;
  margin-top: 4px;
  flex-shrink: 0;
`;

const BenefitContent = styled.div`
  flex: 1;
`;

const BenefitTitle = styled.div`
  font-weight: 600;
  color: ${theme.colors.text.primary};
  margin-bottom: 4px;
  font-size: 14px;
`;

const BenefitDesc = styled.div`
  font-size: 12px;
  color: ${theme.colors.text.secondary};
  line-height: 1.4;
`;

// Section styling
const Section = styled(({ bordered, ...rest }) => <section {...rest} />)`
  padding: ${theme.spacing.xl * 2}px ${theme.spacing.lg}px;
  max-width: 1200px;
  margin: 0 auto;
  border-top: ${props => props.bordered ? `1px solid ${theme.colors.ui.border}` : 'none'};
`;

const SectionTitle = styled.h2`
  font-size: 2rem;
  font-weight: bold;
  color: ${theme.colors.text.primary};
  margin-bottom: ${theme.spacing.sm}px;
`;

const SectionDesc = styled.p`
  color: ${theme.colors.text.secondary};
  font-size: 1.1rem;
  margin-bottom: ${theme.spacing.xl}px;
`;

const FeatureGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${theme.spacing.lg}px;
  
  @media (min-width: 768px) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

const FeatureCard = styled.div`
  background: ${theme.colors.ui.card};
  border-radius: ${theme.radius.lg};
  padding: ${theme.spacing.lg}px;
  border: 1px solid ${theme.colors.ui.border};
  box-shadow: ${theme.shadows.sm};
`;

const FeatureTitle = styled.div`
  font-weight: 600;
  color: ${theme.colors.text.primary};
  margin-bottom: ${theme.spacing.sm}px;
`;

const FeatureDesc = styled.div`
  font-size: 14px;
  color: ${theme.colors.text.secondary};
  line-height: 1.5;
  margin: 0;
`;

// Contact section
const ContactSection = styled.section`
  padding: ${theme.spacing.xl * 2}px ${theme.spacing.lg}px;
  background: linear-gradient(to bottom, ${theme.colors.ui.background}, ${theme.colors.ui.backgroundDark});
  max-width: 1000px;
  margin: 0 auto;
`;

const ContactCard = styled.div`
  background: ${theme.colors.ui.card};
  border-radius: ${theme.radius.xl};
  padding: ${theme.spacing.xl}px;
  border: 1px solid ${theme.colors.ui.border};
  box-shadow: ${theme.shadows.sm};
`;

const ContactGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${theme.spacing.xl}px;
  
  @media (min-width: 768px) {
    grid-template-columns: 1fr 1fr;
  }
`;

const ContactInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.lg}px;
`;

const ContactTitle = styled.h3`
  font-size: 1.5rem;
  font-weight: bold;
  color: ${theme.colors.text.primary};
  margin: 0;
`;

const ContactDesc = styled.p`
  color: ${theme.colors.text.secondary};
  line-height: 1.6;
  margin: 0;
`;

const ContactDetails = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm}px;
`;

const ContactDetail = styled.li`
  font-size: 14px;
  color: ${theme.colors.text.secondary};
  
  strong {
    color: ${theme.colors.text.primary};
  }
`;

const ContactForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.md}px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
`;

const FormLabel = styled.label`
  font-size: 12px;
  color: ${theme.colors.text.secondary};
  margin-bottom: 4px;
  font-weight: 500;
`;

const FormInput = styled.input`
  width: 100%;
  padding: ${theme.spacing.sm}px ${theme.spacing.md}px;
  border: 1px solid ${theme.colors.ui.border};
  border-radius: ${theme.radius.md};
  font-size: 14px;
  background: ${theme.colors.ui.cardElevated};
  color: ${theme.colors.text.primary};
  transition: border-color ${theme.transitions.fast};
  
  &:focus {
    outline: none;
    border-color: ${theme.colors.primary.main};
    box-shadow: 0 0 0 2px rgba(32, 197, 180, 0.1);
  }
`;

const FormTextarea = styled.textarea`
  width: 100%;
  padding: ${theme.spacing.sm}px ${theme.spacing.md}px;
  border: 1px solid ${theme.colors.ui.border};
  border-radius: ${theme.radius.md};
  font-size: 14px;
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
  background: ${theme.colors.ui.cardElevated};
  color: ${theme.colors.text.primary};
  transition: border-color ${theme.transitions.fast};
  
  &:focus {
    outline: none;
    border-color: ${theme.colors.primary.main};
    box-shadow: 0 0 0 2px rgba(32, 197, 180, 0.1);
  }
`;

const SubmitButton = styled.button`
  align-self: flex-start;
  padding: ${theme.spacing.sm}px ${theme.spacing.md}px;
  border-radius: ${theme.radius.md};
  background: ${theme.colors.primary.gradient};
  color: white;
  border: none;
  font-weight: 600;
  cursor: pointer;
  transition: background-color ${theme.transitions.fast};
  
  &:hover {
    background: ${theme.colors.primary.dark};
  }
`;

// Footer
const Footer = styled.footer`
  padding: ${theme.spacing.lg}px ${theme.spacing.lg}px;
  max-width: 1200px;
  margin: 0 auto;
`;

const FooterContent = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  color: ${theme.colors.text.secondary};
  flex-wrap: wrap;
  gap: ${theme.spacing.md}px;
`;

const FooterLinks = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md}px;
  
  a {
    color: ${theme.colors.text.secondary};
    text-decoration: none;
    transition: color ${theme.transitions.fast};
    
    &:hover {
      color: ${theme.colors.primary.main};
    }
  }
`;

export default function NEXORALanding({ onLogin, onSignup }) {
  const [formData, setFormData] = useState({
    company: '',
    email: '',
    message: ''
  });

  const handleFormChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Thanks — we will contact you.');
    setFormData({ company: '', email: '', message: '' });
  };

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <LandingContainer>
      <Header>
        <HeaderContainer>
          <NavBar>
            <Logo>
              <LogoIcon>
                <img src="/images/logo.png" alt="NEXORA Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
              </LogoIcon>
              <LogoText>
                <h1>NEXORA</h1>
                <p>AI-Powered Trade & Customs Automation</p>
              </LogoText>
            </Logo>
            
            <Navigation>
              <a onClick={() => scrollToSection('features')}>Product</a>
              <a onClick={() => scrollToSection('tech')}>Technology</a>
              <a onClick={() => scrollToSection('pricing')}>Pricing</a>
              <a onClick={() => scrollToSection('contact')}>Contact</a>
            </Navigation>
            
            <ButtonGroup>
              {onLogin && onSignup ? (
                <>
                  <LoginButton onClick={onLogin}>Login</LoginButton>
                  <SignUpButton onClick={onSignup}>Sign Up</SignUpButton>
                </>
              ) : (
                <SignUpButton onClick={() => scrollToSection('contact')}>Book a Pilot</SignUpButton>
              )}
            </ButtonGroup>
          </NavBar>
        </HeaderContainer>
      </Header>

      <HeroSection>
        <HeroGrid>
          <HeroContent>
            <HeroTitle>
              <span className="gradient-text">NEXORA</span>
              <br />
              AI-Powered Global
              <br />
              Supply Chain
            </HeroTitle>
            
            <HeroDescription>
              Turn shipping paperwork into compliant declarations — instantly. NEXORA combines 
              enterprise-grade IDP, Agentic AI orchestration, RAG-grounded LLMs and 
              jurisdiction-aware HS classification to automate customs clearance and 
              accelerate cross-border trade.
            </HeroDescription>
            
            <CTAButtons>
              <PrimaryButton onClick={onSignup || (() => scrollToSection('contact'))}>
                Start a Pilot
              </PrimaryButton>
              <SecondaryButton onClick={() => scrollToSection('features')}>
                See Features
              </SecondaryButton>
            </CTAButtons>

            <BenefitsList>
              <BenefitItem>
                <BenefitIcon color="#e11d48">✓</BenefitIcon>
                <BenefitContent>
                  <BenefitTitle>≥99% OCR Accuracy</BenefitTitle>
                  <BenefitDesc>Enterprise-grade extraction for invoices, B/L, COO, MSDS and more</BenefitDesc>
                </BenefitContent>
              </BenefitItem>
              <BenefitItem>
                <BenefitIcon color="#3730a3">+</BenefitIcon>
                <BenefitContent>
                  <BenefitTitle>Agentic AI & RAG</BenefitTitle>
                  <BenefitDesc>Grounded LLM answers with tariff & rule citations to prevent hallucinations</BenefitDesc>
                </BenefitContent>
              </BenefitItem>
              <BenefitItem>
                <BenefitIcon color="#059669">○</BenefitIcon>
                <BenefitContent>
                  <BenefitTitle>Global Compliance Fabric</BenefitTitle>
                  <BenefitDesc>Jurisdiction-aware HS classification, RoO checks, and e-filing adapters</BenefitDesc>
                </BenefitContent>
              </BenefitItem>
              <BenefitItem>
                <BenefitIcon color="#0284c7">✓</BenefitIcon>
                <BenefitContent>
                  <BenefitTitle>Hybrid Deployment</BenefitTitle>
                  <BenefitDesc>Cloud, hybrid VPC, and on-prem GPU options for sensitive lanes</BenefitDesc>
                </BenefitContent>
              </BenefitItem>
            </BenefitsList>
          </HeroContent>
          
          <DemoSection>
            <DemoContainer>
              <DemoHeader>
                <DemoTitle>Live Demo — Lane: CN → SG • Air</DemoTitle>
                <DemoStatus>STP Target: 95%+</DemoStatus>
              </DemoHeader>

              <DemoItems>
                <DemoItem>
                  <DemoIcon bg="linear-gradient(135deg, #e11d48, #3730a3)">AI</DemoIcon>
                  <DemoContent>
                    <DemoItemTitle>HS Classification</DemoItemTitle>
                    <DemoItemDesc>Top candidates: 85076000 (0.92), 85078000 (0.06)</DemoItemDesc>
                  </DemoContent>
                </DemoItem>

                <DemoItem>
                  <DemoIcon bg="#1e293b">OCR</DemoIcon>
                  <DemoContent>
                    <DemoItemTitle>Invoice Extraction</DemoItemTitle>
                    <DemoItemDesc>Invoice #INV-2217 — total: USD 12,400 — confidence 99.2%</DemoItemDesc>
                  </DemoContent>
                </DemoItem>

                <DemoItem>
                  <DemoContent style={{ flex: 1 }}>
                    <DemoItemDesc style={{ color: theme.colors.text.secondary }}>E-Declaration</DemoItemDesc>
                    <DemoItemTitle>Generated TradeNet XML • 2 warnings</DemoItemTitle>
                  </DemoContent>
                  <SecondaryButton as="button" style={{ padding: '8px 16px', fontSize: '14px' }}>
                    Review
                  </SecondaryButton>
                </DemoItem>
              </DemoItems>

              <DemoFooter>Powered by: Agentic AI • RAG • Hybrid OCR • Jurisdiction Rules</DemoFooter>
            </DemoContainer>
          </DemoSection>
        </HeroGrid>
      </HeroSection>

      {/* Platform Capabilities */}
      <Section id="features" bordered>
        <SectionTitle>Platform Capabilities</SectionTitle>
        <SectionDesc>End-to-end automation with explainability, auditability and enterprise controls.</SectionDesc>

        <FeatureGrid>
          <FeatureCard>
            <FeatureTitle>Document Intelligence</FeatureTitle>
            <FeatureDesc>
              Multi-format ingestion, layout-aware extraction, table & line-item parsing, and image 
              feature recognition (labels, stamps, signatures).
            </FeatureDesc>
          </FeatureCard>
          <FeatureCard>
            <FeatureTitle>Trade Reasoning</FeatureTitle>
            <FeatureDesc>
              HS/HTS classification, RoO eligibility, FTA calculations, duty estimators and license 
              checks — jurisdiction aware.
            </FeatureDesc>
          </FeatureCard>
          <FeatureCard>
            <FeatureTitle>Compliance & Filing</FeatureTitle>
            <FeatureDesc>
              Pre-built adapters for TradeNet, ACE, ICS2, Single Window and broker APIs with 
              e-filing packet generation.
            </FeatureDesc>
          </FeatureCard>
        </FeatureGrid>
      </Section>

      {/* Technology Stack */}
      <Section id="tech">
        <SectionTitle>Technology Stack</SectionTitle>
        <SectionDesc>Modular, cloud-native, and vendor-flexible — designed for performance and privacy.</SectionDesc>

        <FeatureGrid>
          <FeatureCard>
            <FeatureTitle>Core AI</FeatureTitle>
            <FeatureDesc>
              <ul style={{ margin: '12px 0', paddingLeft: '16px', color: theme.colors.text.secondary }}>
                <li>LLMs (OpenAI / Anthropic / Gemini / Private Llama)</li>
                <li>RAG (Vector DB + LangChain)</li>
                <li>Agentic AI orchestration & workflows</li>
              </ul>
            </FeatureDesc>
          </FeatureCard>
          <FeatureCard>
            <FeatureTitle>Data & Infra</FeatureTitle>
            <FeatureDesc>
              <ul style={{ margin: '12px 0', paddingLeft: '16px', color: theme.colors.text.secondary }}>
                <li>AWS (S3, Lambda, RDS), VPC/hybrid options</li>
                <li>ElasticSearch / Pinecone for embeddings</li>
                <li>Containerized microservices + K8s</li>
              </ul>
            </FeatureDesc>
          </FeatureCard>
          <FeatureCard>
            <FeatureTitle>IDP & Integration</FeatureTitle>
            <FeatureDesc>
              <ul style={{ margin: '12px 0', paddingLeft: '16px', color: theme.colors.text.secondary }}>
                <li>ABBYY / AWS Textract / Tesseract stack</li>
                <li>ERP adapters (SAP/Oracle), Broker APIs, EDI/EDIFACT</li>
                <li>Security: AES-256, KMS, RBAC, SOC2-ready practices</li>
              </ul>
            </FeatureDesc>
          </FeatureCard>
        </FeatureGrid>
      </Section>

      {/* Pricing */}
      <Section id="pricing" bordered>
        <SectionTitle>Pricing & Engagement</SectionTitle>
        <SectionDesc>Flexible pricing: pilots, subscription tiers and enterprise licensing. Contact us for a tailored quote.</SectionDesc>

        <FeatureGrid>
          <FeatureCard>
            <FeatureTitle>Pilot</FeatureTitle>
            <FeatureDesc>
              3–8 week lane MVP: ingest, extract, HS suggestions, e-declaration assembly
            </FeatureDesc>
          </FeatureCard>
          <FeatureCard>
            <FeatureTitle>Subscription</FeatureTitle>
            <FeatureDesc>
              Tiered per-document pricing + enterprise seats. Volume discounts available.
            </FeatureDesc>
          </FeatureCard>
          <FeatureCard>
            <FeatureTitle>Enterprise</FeatureTitle>
            <FeatureDesc>
              On-prem licenses, private model hosting, managed services and SLAs.
            </FeatureDesc>
          </FeatureCard>
        </FeatureGrid>
      </Section>

      {/* Contact */}
      <ContactSection id="contact">
        <ContactCard>
          <ContactGrid>
            <ContactInfo>
              <ContactTitle>Book a Pilot / Contact Sales</ContactTitle>
              <ContactDesc>
                Validate STP, HS accuracy and integration in a lane-specific pilot. We'll help you 
                choose lanes that unlock fastest ROI.
              </ContactDesc>

              <ContactDetails>
                <ContactDetail><strong>Email:</strong> info@spectrai.sg</ContactDetail>
                <ContactDetail><strong>Phone:</strong> +65 9382-0672</ContactDetail>
                <ContactDetail><strong>Location:</strong> Singapore — Global support</ContactDetail>
              </ContactDetails>

              <div>
                <PrimaryButton onClick={() => scrollToSection('contact')}>
                  Request Pilot
                </PrimaryButton>
              </div>
            </ContactInfo>

            <ContactForm>
              <FormGroup>
                <FormLabel>Company</FormLabel>
                <FormInput
                  name="company"
                  value={formData.company}
                  onChange={handleFormChange}
                  placeholder="Your company"
                />
              </FormGroup>
              <FormGroup>
                <FormLabel>Email</FormLabel>
                <FormInput
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleFormChange}
                  placeholder="you@company.com"
                />
              </FormGroup>
              <FormGroup>
                <FormLabel>Message / Lanes of interest</FormLabel>
                <FormTextarea
                  name="message"
                  value={formData.message}
                  onChange={handleFormChange}
                  placeholder="CN → SG, Air, Invoices + B/L"
                />
              </FormGroup>
              <div>
                <SubmitButton onClick={handleSubmit}>
                  Send Request
                </SubmitButton>
              </div>
            </ContactForm>
          </ContactGrid>
        </ContactCard>
      </ContactSection>

      <Footer>
        <FooterContent>
          <div>© {new Date().getFullYear()} NEXORA — Spectrai. All rights reserved.</div>
          <FooterLinks>
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
          </FooterLinks>
        </FooterContent>
      </Footer>
    </LandingContainer>
  );
}
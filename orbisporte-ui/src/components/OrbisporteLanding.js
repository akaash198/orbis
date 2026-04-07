/**
 * Orbisporté Landing Page
 * Ultra Interactive & Modern Version
 * VERSION 3.0 - With Animated Globe & Enhanced UI
 */

import React, { useState, useEffect, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import LoginForm from './auth/LoginForm';
import SignupForm from './auth/SignupForm';

const OrbisporteLanding = ({ onLogin, onSignup }) => {
  const [showLogin, setShowLogin] = useState(true);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);

  // Track mouse movement for parallax effect
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth - 0.5) * 20,
        y: (e.clientY / window.innerHeight - 0.5) * 20
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Animated particles background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const particleCount = 80;

    class Particle {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 1;
        this.speedX = Math.random() * 0.5 - 0.25;
        this.speedY = Math.random() * 0.5 - 0.25;
        this.opacity = Math.random() * 0.5 + 0.2;
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.x > canvas.width) this.x = 0;
        if (this.x < 0) this.x = canvas.width;
        if (this.y > canvas.height) this.y = 0;
        if (this.y < 0) this.y = canvas.height;
      }

      draw() {
        ctx.fillStyle = `rgba(201, 165, 32, ${this.opacity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(particle => {
        particle.update();
        particle.draw();
      });

      // Draw connections
      particles.forEach((a, i) => {
        particles.slice(i + 1).forEach(b => {
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 100) {
            ctx.strokeStyle = `rgba(201, 165, 32, ${0.2 * (1 - distance / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        });
      });

      requestAnimationFrame(animate);
    }

    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const allFeatures = [
    {
      icon: '📊',
      title: 'Control Tower Dashboard',
      description: 'Real-time visibility into all trade operations with AI-powered analytics',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: '#667eea'
    },
    {
      icon: '📄',
      title: 'Document Management',
      description: 'Smart classification and extraction from Bills of Entry, invoices, and shipping documents',
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      color: '#f093fb'
    },
    {
      icon: '🔍',
      title: 'HSN/ECCN Engine',
      description: 'AI-powered HS Code classification with ECCN cross-referencing for export control',
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      color: '#4facfe'
    },
    {
      icon: '💰',
      title: 'Duty Calculator Engine',
      description: 'Precise BCD, IGST, SWS, CVD, and ADD calculations with real-time tariff updates',
      gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      color: '#43e97b'
    },
    {
      icon: '📋',
      title: 'BoE Auto-Filing',
      description: 'Automated Bill of Entry generation with XSD validation and ICEGATE compatibility',
      gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      color: '#fa709a'
    },
    {
      icon: '🔗',
      title: 'Integration & Filing',
      description: 'Seamless integration with ICEGATE, eSANCHIT, DGFT, SWIFT, ERPs, and shipping lines',
      gradient: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
      color: '#30cfd0'
    },
    {
      icon: '⚖️',
      title: 'Clearance Decision',
      description: 'AI-based risk assessment and clearance recommendations with audit trails',
      gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
      color: '#a8edea'
    },
    {
      icon: '🛡️',
      title: 'Trade Fraud Engine',
      description: 'ML-powered fraud detection with pattern recognition and anomaly alerts',
      gradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
      color: '#ff9a9e'
    },
    {
      icon: '⚠️',
      title: 'Risk Scoring Engine',
      description: 'Multi-factor risk analysis for shipments, vendors, and trade lanes',
      gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
      color: '#ffecd2'
    },
    {
      icon: '✅',
      title: 'Compliance Engine',
      description: 'Automated sanctions screening, license validation, and regulatory compliance',
      gradient: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
      color: '#a1c4fd'
    },
    {
      icon: '📚',
      title: 'Regulatory & Tariff',
      description: 'Live tariff database with FTA rules, notifications, and policy updates',
      gradient: 'linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)',
      color: '#d299c2'
    },
    {
      icon: '📦',
      title: 'Shipment Tracking',
      description: 'Real-time tracking across air, sea, and land with carrier integration',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: '#667eea'
    },
    {
      icon: '🔔',
      title: 'Instant Alerts',
      description: 'SMS/Email notifications for regulatory changes, duty updates, and clearances',
      gradient: 'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
      color: '#fccb90'
    },
    {
      icon: '📈',
      title: 'History & Reports',
      description: 'Comprehensive analytics, audit logs, and customizable reporting dashboards',
      gradient: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
      color: '#e0c3fc'
    },
    {
      icon: '🤖',
      title: 'AI Governance',
      description: 'Model monitoring, explainability, bias detection, and human-in-the-loop controls',
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      color: '#f093fb'
    },
    {
      icon: '💬',
      title: 'Document Q&A',
      description: 'Ask questions about your documents and get instant AI-powered answers',
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      color: '#4facfe'
    }
  ];

  const stats = [
    { number: '98%', label: 'Accuracy Rate', icon: '🎯' },
    { number: '10x', label: 'Faster Processing', icon: '⚡' },
    { number: '24/7', label: 'Always Available', icon: '🌐' },
    { number: '100+', label: 'Countries Supported', icon: '🌍' }
  ];

  return (
    <LandingContainer>
      <ParticlesCanvas ref={canvasRef} />

      <LandingHeader>
        <Logo>
          <AnimatedGlobe $mouseX={mousePosition.x} $mouseY={mousePosition.y}>
            <LogoImage src="/images/logo.png" alt="Orbisporté Logo" />
          </AnimatedGlobe>
          <LogoTextWrapper>
            <LogoText>ORBISPORTÉ</LogoText>
            <LogoSubtext>Trade Intelligence Platform</LogoSubtext>
          </LogoTextWrapper>
        </Logo>
        <Tagline>The AI-Driven Global Trade Automation & Customs Platform</Tagline>
        <CompanyTag>
          <CompanyBadge>SPECTRA AI PTE. LTD., SINGAPORE</CompanyBadge>
        </CompanyTag>
      </LandingHeader>

      <ContentWrapper>
        <HeroSection>
          <HeroContent $mouseX={mousePosition.x} $mouseY={mousePosition.y}>
            <HeroTitle>
              Transform Global Trade with{' '}
              <GradientText>AI Intelligence</GradientText>
              <TitleAccent />
            </HeroTitle>
            <HeroSubtitle>
              End-to-end customs automation powered by cutting-edge AI. From document processing
              to ICEGATE filing, fraud detection to compliance—all in one unified platform.
            </HeroSubtitle>

            <StatsGrid>
              {stats.map((stat, index) => (
                <StatItem key={index}>
                  <StatIconWrapper>
                    <StatIcon>{stat.icon}</StatIcon>
                    <StatGlow />
                  </StatIconWrapper>
                  <StatNumber>{stat.number}</StatNumber>
                  <StatLabel>{stat.label}</StatLabel>
                  <StatRipple />
                </StatItem>
              ))}
            </StatsGrid>
          </HeroContent>

          <AuthSection>
            {showLogin ? (
              <LoginForm
                onSwitchToSignup={() => setShowLogin(false)}
                onLogin={onLogin}
              />
            ) : (
              <SignupForm
                onSwitchToLogin={() => setShowLogin(true)}
                onSignup={onSignup}
              />
            )}
          </AuthSection>
        </HeroSection>

        <FeaturesSection>
          <SectionHeader>
            <SectionTitle>
              16 AI-Powered Modules
              <TitleUnderline />
            </SectionTitle>
            <SectionSubtitle>End-to-End Customs Automation & Trade Intelligence</SectionSubtitle>
          </SectionHeader>

          <FeatureGrid>
            {allFeatures.map((feature, index) => (
              <FeatureCard key={index} $gradient={feature.gradient} $color={feature.color}>
                <FeatureGlow $color={feature.color} />
                <FeatureIconWrapper>
                  <FeatureIconBg $gradient={feature.gradient} />
                  <FeatureIcon>{feature.icon}</FeatureIcon>
                </FeatureIconWrapper>
                <FeatureContent>
                  <FeatureTitle>{feature.title}</FeatureTitle>
                  <FeatureDescription>{feature.description}</FeatureDescription>
                </FeatureContent>
                <FeatureAccent />
                <FeatureShine />
              </FeatureCard>
            ))}
          </FeatureGrid>
        </FeaturesSection>

        <IntegrationsSection>
          <SectionHeader>
            <SectionTitle>
              Seamless Connectivity
              <TitleUnderline />
            </SectionTitle>
            <SectionSubtitle>Connect with all major customs portals and enterprise systems</SectionSubtitle>
          </SectionHeader>

          <IntegrationsGrid>
            <IntegrationCard>
              <IntegrationGlow />
              <IntegrationIcon>🏛️</IntegrationIcon>
              <IntegrationName>ICEGATE</IntegrationName>
            </IntegrationCard>
            <IntegrationCard>
              <IntegrationGlow />
              <IntegrationIcon>📜</IntegrationIcon>
              <IntegrationName>eSANCHIT</IntegrationName>
            </IntegrationCard>
            <IntegrationCard>
              <IntegrationGlow />
              <IntegrationIcon>🏢</IntegrationIcon>
              <IntegrationName>DGFT</IntegrationName>
            </IntegrationCard>
            <IntegrationCard>
              <IntegrationGlow />
              <IntegrationIcon>💼</IntegrationIcon>
              <IntegrationName>SWIFT Portal</IntegrationName>
            </IntegrationCard>
            <IntegrationCard>
              <IntegrationGlow />
              <IntegrationIcon>🏦</IntegrationIcon>
              <IntegrationName>Banks / CHAs</IntegrationName>
            </IntegrationCard>
            <IntegrationCard>
              <IntegrationGlow />
              <IntegrationIcon>⚙️</IntegrationIcon>
              <IntegrationName>SAP / Oracle</IntegrationName>
            </IntegrationCard>
            <IntegrationCard>
              <IntegrationGlow />
              <IntegrationIcon>📊</IntegrationIcon>
              <IntegrationName>Workday</IntegrationName>
            </IntegrationCard>
            <IntegrationCard>
              <IntegrationGlow />
              <IntegrationIcon>🚢</IntegrationIcon>
              <IntegrationName>CargoWise</IntegrationName>
            </IntegrationCard>
          </IntegrationsGrid>
        </IntegrationsSection>

        <TrustSection>
          <TrustBadges>
            <Badge>
              <BadgeIconWrapper>
                <BadgeIcon>🔒</BadgeIcon>
                <BadgeGlow />
              </BadgeIconWrapper>
              <BadgeText>Bank-Grade Security</BadgeText>
            </Badge>
            <Badge>
              <BadgeIconWrapper>
                <BadgeIcon>🇮🇳</BadgeIcon>
                <BadgeGlow />
              </BadgeIconWrapper>
              <BadgeText>India Customs Compliant</BadgeText>
            </Badge>
            <Badge>
              <BadgeIconWrapper>
                <BadgeIcon>⚡</BadgeIcon>
                <BadgeGlow />
              </BadgeIconWrapper>
              <BadgeText>Lightning Fast</BadgeText>
            </Badge>
            <Badge>
              <BadgeIconWrapper>
                <BadgeIcon>🌍</BadgeIcon>
                <BadgeGlow />
              </BadgeIconWrapper>
              <BadgeText>Global Coverage</BadgeText>
            </Badge>
            <Badge>
              <BadgeIconWrapper>
                <BadgeIcon>✅</BadgeIcon>
                <BadgeGlow />
              </BadgeIconWrapper>
              <BadgeText>ISO 27001</BadgeText>
            </Badge>
            <Badge>
              <BadgeIconWrapper>
                <BadgeIcon>🤖</BadgeIcon>
                <BadgeGlow />
              </BadgeIconWrapper>
              <BadgeText>AI-Powered</BadgeText>
            </Badge>
          </TrustBadges>
        </TrustSection>
      </ContentWrapper>

      <Footer>
        <FooterContent>
          <FooterText>© 2025 Orbisporté. All Rights Reserved.</FooterText>
          <FooterDivider />
          <FooterText>Powered by AI. A product of SPECTRA AI PTE. LTD., Singapore.</FooterText>
        </FooterContent>
      </Footer>
    </LandingContainer>
  );
};

// ==================== ANIMATIONS ====================

const rotate = keyframes`
  from { transform: rotateY(0deg); }
  to { transform: rotateY(360deg); }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-20px); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.1); }
`;

const shimmer = keyframes`
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
`;

const glow = keyframes`
  0%, 100% { box-shadow: 0 0 20px rgba(201, 165, 32, 0.5); }
  50% { box-shadow: 0 0 40px rgba(201, 165, 32, 0.8), 0 0 60px rgba(139, 92, 246, 0.4); }
`;

const fadeInUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const ripple = keyframes`
  0% {
    transform: scale(0);
    opacity: 1;
  }
  100% {
    transform: scale(4);
    opacity: 0;
  }
`;

const shine = keyframes`
  0% { left: -100%; }
  100% { left: 200%; }
`;

const glowPulse = keyframes`
  0%, 100% {
    box-shadow: 0 0 30px rgba(201, 165, 32, 0.6),
                0 0 60px rgba(139, 92, 246, 0.4),
                inset 0 0 30px rgba(201, 165, 32, 0.3);
  }
  50% {
    box-shadow: 0 0 50px rgba(201, 165, 32, 0.9),
                0 0 100px rgba(139, 92, 246, 0.6),
                inset 0 0 50px rgba(201, 165, 32, 0.5);
  }
`;

// ==================== STYLED COMPONENTS ====================

const ParticlesCanvas = styled.canvas`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
`;

const LandingContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(ellipse at top, #1a1f3a 0%, #0a0e27 50%),
    linear-gradient(135deg, #0a0e27 0%, #1a1f3a 25%, #0f172a 50%, #1e293b 75%, #0a0e27 100%);
  position: relative;
  overflow-x: hidden;
`;

const LandingHeader = styled.header`
  padding: ${props => props.theme.spacing.xl}px ${props => props.theme.spacing.xxl}px;
  text-align: center;
  background: rgba(10, 14, 39, 0.95);
  backdrop-filter: blur(30px);
  box-shadow:
    0 10px 40px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(201, 165, 32, 0.1);
  border-bottom: 2px solid rgba(201, 165, 32, 0.2);
  position: relative;
  z-index: 10;

  &::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 50%;
    transform: translateX(-50%);
    width: 50%;
    height: 3px;
    background: linear-gradient(90deg,
      transparent 0%,
      rgba(201, 165, 32, 1) 50%,
      transparent 100%);
    filter: blur(2px);
  }
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${props => props.theme.spacing.xl}px;
  margin-bottom: ${props => props.theme.spacing.lg}px;
  animation: ${fadeInUp} 0.8s ease-out;
`;

const AnimatedGlobe = styled.div`
  width: 100px;
  height: 100px;
  position: relative;
  animation: ${float} 4s ease-in-out infinite;
  transform: translateX(${props => props.$mouseX * 0.3}px) translateY(${props => props.$mouseY * 0.3}px);
  transition: transform 0.1s ease-out;
  filter: drop-shadow(0 0 30px rgba(201, 165, 32, 0.8));

  &::before {
    content: '';
    position: absolute;
    top: -20px;
    left: -20px;
    right: -20px;
    bottom: -20px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(201, 165, 32, 0.4) 0%, rgba(139, 92, 246, 0.2) 50%, transparent 70%);
    animation: ${glowPulse} 3s ease-in-out infinite;
    z-index: -1;
  }
`;

const LogoImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

const GlobeSphere = styled.div`
  width: 100%;
  height: 100%;
  border-radius: 50%;
  position: relative;
  background: radial-gradient(circle at 35% 35%,
    rgba(100, 200, 255, 1) 0%,
    rgba(201, 165, 32, 1) 40%,
    rgba(135, 110, 18, 1) 70%,
    rgba(201, 165, 32, 1) 100%);
  border: 3px solid rgba(201, 165, 32, 1);
  box-shadow:
    0 0 40px rgba(201, 165, 32, 1),
    0 0 80px rgba(201, 165, 32, 0.6),
    0 0 120px rgba(139, 92, 246, 0.4),
    inset 0 0 30px rgba(201, 165, 32, 0.4),
    inset 15px 15px 30px rgba(255, 255, 255, 0.4),
    inset -15px -15px 30px rgba(0, 0, 0, 0.6);
  overflow: visible;
  animation: ${glowPulse} 3s ease-in-out infinite;
  display: flex;
  align-items: center;
  justify-content: center;

  &::before {
    content: '';
    position: absolute;
    top: 15%;
    left: 20%;
    width: 35%;
    height: 35%;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.7) 0%, transparent 70%);
    border-radius: 50%;
    filter: blur(12px);
    z-index: 0;
  }
`;

const GlobeMeridian = styled.div`
  position: absolute;
  top: 0;
  left: 50%;
  width: 100%;
  height: 100%;
  border: 2px solid rgba(201, 165, 32, 0.4);
  border-radius: 50%;
  transform: translateX(-50%) rotateY(${props => props.$rotation}deg);
  animation: ${rotate} ${props => props.$speed}s linear infinite;
  box-shadow: 0 0 10px rgba(201, 165, 32, 0.3);
`;

const GlobeLatitude = styled.div`
  position: absolute;
  left: 50%;
  width: 90%;
  height: 2px;
  background: linear-gradient(to right,
    transparent 0%,
    rgba(201, 165, 32, 0.4) 10%,
    rgba(201, 165, 32, 0.8) 50%,
    rgba(201, 165, 32, 0.4) 90%,
    transparent 100%);
  transform: translateX(-50%);
  top: ${props => props.$position}%;
  opacity: ${props => props.$opacity || 0.7};
  z-index: 1;
  box-shadow: 0 0 8px rgba(201, 165, 32, 0.4);
`;

const GlobeRotating = styled.div`
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  animation: ${rotate} 25s linear infinite;
`;

const GlobeIcon = styled.div`
  font-size: 52px;
  filter: drop-shadow(0 0 20px rgba(255, 255, 255, 1));
  z-index: 1;
  opacity: 0.95;
  text-shadow: 0 0 25px rgba(255, 255, 255, 0.9);
`;

const LogoTextWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`;

const LogoText = styled.h1`
  font-size: 56px;
  background: linear-gradient(135deg, #C9A520 0%, #6BBCD4 50%, #8B5CF6 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 900;
  letter-spacing: 0.08em;
  filter: drop-shadow(0 4px 20px rgba(201, 165, 32, 0.6));
  margin: 0;
  animation: ${shimmer} 3s linear infinite;
  text-shadow: 0 0 30px rgba(201, 165, 32, 0.5);

  @media (max-width: 768px) {
    font-size: 36px;
  }
`;

const LogoSubtext = styled.div`
  font-size: ${props => props.theme.typography.fontSize.sm};
  color: rgba(255, 255, 255, 0.7);
  letter-spacing: 0.15em;
  font-weight: 600;
  text-transform: uppercase;
  margin-top: ${props => props.theme.spacing.xs}px;
`;

const Tagline = styled.p`
  color: rgba(255, 255, 255, 0.95);
  font-size: ${props => props.theme.typography.fontSize.lg};
  margin: ${props => props.theme.spacing.sm}px 0;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
`;

const CompanyTag = styled.div`
  margin-top: ${props => props.theme.spacing.sm}px;
`;

const CompanyBadge = styled.span`
  display: inline-block;
  color: rgba(255, 255, 255, 0.8);
  font-size: ${props => props.theme.typography.fontSize.xs};
  font-weight: 600;
  padding: ${props => props.theme.spacing.xs}px ${props => props.theme.spacing.lg}px;
  background: rgba(201, 165, 32, 0.1);
  border: 1px solid rgba(201, 165, 32, 0.3);
  border-radius: ${props => props.theme.radius.full}px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  box-shadow: 0 4px 15px rgba(201, 165, 32, 0.2);
`;

const ContentWrapper = styled.main`
  flex: 1;
  padding: ${props => props.theme.spacing.xxl * 2}px ${props => props.theme.spacing.xl}px;
  position: relative;
  z-index: 1;
`;

const HeroSection = styled.div`
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: ${props => props.theme.spacing.xxl * 2}px;
  max-width: 1600px;
  margin: 0 auto ${props => props.theme.spacing.xxl * 3}px;
  align-items: start;

  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
    gap: ${props => props.theme.spacing.xxl}px;
  }
`;

const HeroContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.xxl}px;
  animation: ${fadeInUp} 1s ease-out;
  transform: translateX(${props => props.$mouseX * 0.3}px) translateY(${props => props.$mouseY * 0.3}px);
  transition: transform 0.1s ease-out;
`;

const HeroTitle = styled.h2`
  font-size: 68px;
  font-weight: 900;
  color: #ffffff;
  line-height: 1.1;
  margin: 0;
  letter-spacing: -0.03em;
  position: relative;
  text-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);

  @media (max-width: 768px) {
    font-size: 42px;
  }
`;

const TitleAccent = styled.div`
  position: absolute;
  bottom: -10px;
  left: 0;
  width: 200px;
  height: 4px;
  background: linear-gradient(90deg, #C9A520 0%, #6BBCD4 50%, transparent 100%);
  border-radius: 2px;
  box-shadow: 0 0 20px rgba(201, 165, 32, 0.6);
`;

const GradientText = styled.span`
  background: linear-gradient(135deg, #C9A520 0%, #6BBCD4 50%, #8B5CF6 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: ${shimmer} 3s linear infinite;
  filter: drop-shadow(0 0 20px rgba(201, 165, 32, 0.5));
`;

const HeroSubtitle = styled.p`
  font-size: ${props => props.theme.typography.fontSize.xl};
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.8;
  margin: 0;
  font-weight: 400;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${props => props.theme.spacing.xl}px;
  margin-top: ${props => props.theme.spacing.xl}px;

  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const StatItem = styled.div`
  text-align: center;
  padding: ${props => props.theme.spacing.xl}px;
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(20px);
  border: 2px solid rgba(201, 165, 32, 0.2);
  border-radius: ${props => props.theme.radius.xl}px;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, #C9A520, transparent);
    opacity: 0;
    transition: opacity 0.4s ease;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(201, 165, 32, 0.6);
    transform: translateY(-10px) scale(1.05);
    box-shadow:
      0 20px 60px rgba(201, 165, 32, 0.4),
      0 0 60px rgba(139, 92, 246, 0.3);

    &::before {
      opacity: 1;
    }
  }
`;

const StatIconWrapper = styled.div`
  position: relative;
  display: inline-block;
  margin-bottom: ${props => props.theme.spacing.md}px;
`;

const StatIcon = styled.div`
  font-size: 40px;
  filter: drop-shadow(0 4px 15px rgba(201, 165, 32, 0.5));
  position: relative;
  z-index: 1;
`;

const StatGlow = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 60px;
  height: 60px;
  background: radial-gradient(circle, rgba(201, 165, 32, 0.4) 0%, transparent 70%);
  border-radius: 50%;
  animation: ${pulse} 2s ease-in-out infinite;
`;

const StatNumber = styled.div`
  font-size: 36px;
  font-weight: 900;
  background: linear-gradient(135deg, #ffffff 0%, #C9A520 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: ${props => props.theme.spacing.xs}px;
`;

const StatLabel = styled.div`
  font-size: ${props => props.theme.typography.fontSize.sm};
  color: rgba(255, 255, 255, 0.75);
  font-weight: 600;
  letter-spacing: 0.05em;
`;

const StatRipple = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 20px;
  border: 2px solid rgba(201, 165, 32, 0.6);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  animation: ${ripple} 2s ease-out infinite;
`;

const AuthSection = styled.div`
  position: sticky;
  top: ${props => props.theme.spacing.xl}px;
  height: fit-content;
  z-index: 10;
  animation: ${fadeInUp} 1.2s ease-out;
`;

const FeaturesSection = styled.section`
  max-width: 1600px;
  margin: 0 auto ${props => props.theme.spacing.xxl * 3}px;
`;

const SectionHeader = styled.div`
  text-align: center;
  margin-bottom: ${props => props.theme.spacing.xxl * 2}px;
`;

const SectionBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${props => props.theme.spacing.sm}px;
  padding: ${props => props.theme.spacing.sm}px ${props => props.theme.spacing.lg}px;
  background: rgba(201, 165, 32, 0.1);
  border: 1px solid rgba(201, 165, 32, 0.3);
  border-radius: ${props => props.theme.radius.full}px;
  color: rgba(255, 255, 255, 0.9);
  font-size: ${props => props.theme.typography.fontSize.xs};
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin-bottom: ${props => props.theme.spacing.lg}px;
  box-shadow: 0 4px 20px rgba(201, 165, 32, 0.3);
`;

const BadgeDot = styled.div`
  width: 6px;
  height: 6px;
  background: #C9A520;
  border-radius: 50%;
  box-shadow: 0 0 10px rgba(201, 165, 32, 0.8);
  animation: ${pulse} 2s ease-in-out infinite;
`;

const SectionTitle = styled.h2`
  font-size: 52px;
  font-weight: 900;
  background: linear-gradient(135deg, #ffffff 0%, #C9A520 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0 0 ${props => props.theme.spacing.md}px 0;
  letter-spacing: -0.02em;
  position: relative;
  display: inline-block;
  text-shadow: 0 4px 20px rgba(201, 165, 32, 0.3);

  @media (max-width: 768px) {
    font-size: 32px;
  }
`;

const TitleUnderline = styled.div`
  position: absolute;
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 60%;
  height: 3px;
  background: linear-gradient(90deg, transparent 0%, #C9A520 50%, transparent 100%);
  border-radius: 2px;
  box-shadow: 0 0 20px rgba(201, 165, 32, 0.6);
`;

const SectionSubtitle = styled.p`
  font-size: ${props => props.theme.typography.fontSize.xl};
  color: rgba(255, 255, 255, 0.75);
  margin: ${props => props.theme.spacing.xl}px 0 0 0;
  font-weight: 500;
`;

const FeatureGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${props => props.theme.spacing.xl}px;

  @media (max-width: 1400px) {
    grid-template-columns: repeat(3, 1fr);
  }

  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const FeatureCard = styled.div`
  padding: ${props => props.theme.spacing.xl}px;
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(30px);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: ${props => props.theme.radius.xl}px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  cursor: pointer;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: ${props => props.$gradient};
    opacity: 0;
    transition: opacity 0.4s ease;
  }

  &:hover {
    transform: translateY(-15px) scale(1.02);
    background: rgba(255, 255, 255, 0.08);
    border-color: ${props => props.$color};
    box-shadow:
      0 25px 80px rgba(0, 0, 0, 0.5),
      0 0 60px ${props => props.$color}40;

    &::before {
      opacity: 1;
    }
  }
`;

const FeatureGlow = styled.div`
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, ${props => props.$color}20 0%, transparent 60%);
  opacity: 0;
  transition: opacity 0.5s ease;
  pointer-events: none;

  ${FeatureCard}:hover & {
    opacity: 1;
  }
`;

const FeatureIconWrapper = styled.div`
  margin-bottom: ${props => props.theme.spacing.lg}px;
  position: relative;
  display: inline-block;
`;

const FeatureIconBg = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 70px;
  height: 70px;
  background: ${props => props.$gradient};
  border-radius: 50%;
  opacity: 0.2;
  filter: blur(15px);
  transition: all 0.4s ease;

  ${FeatureCard}:hover & {
    opacity: 0.4;
    width: 90px;
    height: 90px;
  }
`;

const FeatureIcon = styled.div`
  font-size: 52px;
  filter: drop-shadow(0 4px 15px rgba(0, 0, 0, 0.4));
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  z-index: 1;

  ${FeatureCard}:hover & {
    transform: scale(1.2) rotate(10deg);
  }
`;

const FeatureContent = styled.div`
  position: relative;
  z-index: 1;
`;

const FeatureTitle = styled.h3`
  font-size: ${props => props.theme.typography.fontSize.lg};
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 ${props => props.theme.spacing.sm}px 0;
  letter-spacing: -0.01em;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
`;

const FeatureDescription = styled.p`
  font-size: ${props => props.theme.typography.fontSize.sm};
  color: rgba(255, 255, 255, 0.75);
  line-height: 1.7;
  margin: 0;
`;

const FeatureAccent = styled.div`
  position: absolute;
  bottom: -20px;
  right: -20px;
  width: 100px;
  height: 100px;
  background: radial-gradient(circle, rgba(201, 165, 32, 0.15) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
`;

const FeatureShine = styled.div`
  position: absolute;
  top: 0;
  left: -100%;
  width: 50%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  transition: left 0.6s ease;

  ${FeatureCard}:hover & {
    animation: ${shine} 1s ease-in-out;
  }
`;

const IntegrationsSection = styled.section`
  max-width: 1600px;
  margin: 0 auto ${props => props.theme.spacing.xxl * 3}px;
`;

const IntegrationsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: ${props => props.theme.spacing.xl}px;

  @media (max-width: 1400px) {
    grid-template-columns: repeat(4, 1fr);
  }

  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const IntegrationCard = styled.div`
  padding: ${props => props.theme.spacing.xl}px;
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(20px);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: ${props => props.theme.radius.lg}px;
  text-align: center;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(201, 165, 32, 0.6);
    transform: translateY(-8px) scale(1.05);
    box-shadow: 0 15px 40px rgba(201, 165, 32, 0.4);
  }
`;

const IntegrationGlow = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80px;
  height: 80px;
  background: radial-gradient(circle, rgba(201, 165, 32, 0.3) 0%, transparent 70%);
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.4s ease;

  ${IntegrationCard}:hover & {
    opacity: 1;
    animation: ${pulse} 1.5s ease-in-out infinite;
  }
`;

const IntegrationIcon = styled.div`
  font-size: 40px;
  margin-bottom: ${props => props.theme.spacing.sm}px;
  filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.3));
  position: relative;
  z-index: 1;
  transition: transform 0.4s ease;

  ${IntegrationCard}:hover & {
    transform: scale(1.2);
  }
`;

const IntegrationName = styled.div`
  font-size: ${props => props.theme.typography.fontSize.xs};
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  letter-spacing: 0.05em;
  position: relative;
  z-index: 1;
`;

const TrustSection = styled.section`
  max-width: 1600px;
  margin: 0 auto ${props => props.theme.spacing.xxl * 2}px;
`;

const TrustBadges = styled.div`
  display: flex;
  justify-content: center;
  gap: ${props => props.theme.spacing.lg}px;
  flex-wrap: wrap;
`;

const Badge = styled.div`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.md}px;
  padding: ${props => props.theme.spacing.md}px ${props => props.theme.spacing.xl}px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border: 2px solid rgba(201, 165, 32, 0.3);
  border-radius: ${props => props.theme.radius.full}px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  cursor: pointer;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, rgba(201, 165, 32, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
    opacity: 0;
    transition: opacity 0.4s ease;
  }

  &:hover {
    transform: translateY(-5px) scale(1.05);
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(201, 165, 32, 0.6);
    box-shadow: 0 10px 40px rgba(201, 165, 32, 0.4);

    &::before {
      opacity: 1;
    }
  }
`;

const BadgeIconWrapper = styled.div`
  position: relative;
  display: inline-block;
`;

const BadgeIcon = styled.span`
  font-size: ${props => props.theme.typography.fontSize.xl};
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.3));
  position: relative;
  z-index: 1;
`;

const BadgeGlow = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 30px;
  height: 30px;
  background: radial-gradient(circle, rgba(201, 165, 32, 0.4) 0%, transparent 70%);
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.4s ease;

  ${Badge}:hover & {
    opacity: 1;
    animation: ${pulse} 1.5s ease-in-out infinite;
  }
`;

const BadgeText = styled.span`
  font-size: ${props => props.theme.typography.fontSize.sm};
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  letter-spacing: 0.03em;
  position: relative;
  z-index: 1;
`;

const Footer = styled.footer`
  padding: ${props => props.theme.spacing.xxl}px;
  text-align: center;
  background: rgba(10, 14, 39, 0.95);
  backdrop-filter: blur(30px);
  border-top: 2px solid rgba(201, 165, 32, 0.2);
  position: relative;
  z-index: 1;
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.5);

  &::before {
    content: '';
    position: absolute;
    top: -2px;
    left: 50%;
    transform: translateX(-50%);
    width: 50%;
    height: 3px;
    background: linear-gradient(90deg,
      transparent 0%,
      rgba(201, 165, 32, 1) 50%,
      transparent 100%);
    filter: blur(2px);
  }
`;

const FooterContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.md}px;
  align-items: center;
`;

const FooterText = styled.p`
  color: rgba(255, 255, 255, 0.7);
  font-size: ${props => props.theme.typography.fontSize.sm};
  margin: 0;
  font-weight: 500;
  letter-spacing: 0.02em;
`;

const FooterDivider = styled.div`
  width: 100px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(201, 165, 32, 0.5), transparent);
`;

export default OrbisporteLanding;

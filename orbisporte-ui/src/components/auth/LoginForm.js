/**
 * Login Form Component
 * 
 * User login form with email and password authentication.
 */

import React, { useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { authService } from '../../services/api';
import theme from '../../styles/theme';

const LoginContainer = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, ${theme.colors.primary.main} 0%, ${theme.colors.primary.dark} 100%);
  padding: ${theme.spacing.lg}px;
`;

// Keyframe Animations
const rotate = keyframes`
  from { transform: rotateY(0deg); }
  to { transform: rotateY(360deg); }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.05); }
`;

const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
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

const LoginCard = styled.div`
  background: rgba(10, 14, 39, 0.95);
  backdrop-filter: blur(30px);
  border: 1px solid rgba(201, 165, 32, 0.3);
  border-radius: ${theme.radius.xxl}px;
  padding: ${theme.spacing.xxl * 1.5}px;
  box-shadow:
    0 20px 80px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(201, 165, 32, 0.1),
    0 0 60px rgba(201, 165, 32, 0.2);
  width: 100%;
  max-width: 450px;
  position: relative;
  overflow: hidden;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  transform-style: preserve-3d;
  perspective: 1000px;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, #C9A520, #6BBCD4, #8B5CF6, #C9A520);
    background-size: 200% auto;
    animation: ${shimmer} 3s linear infinite;
  }

  &::after {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, rgba(201, 165, 32, 0.1) 0%, transparent 60%);
    opacity: 0;
    transition: opacity 0.5s ease;
    pointer-events: none;
  }

  &:hover {
    box-shadow:
      0 30px 120px rgba(0, 0, 0, 0.6),
      0 0 0 1px rgba(201, 165, 32, 0.3),
      0 0 100px rgba(201, 165, 32, 0.4),
      inset 0 0 60px rgba(201, 165, 32, 0.05);
    transform: translateY(-8px) rotateX(2deg);
    border-color: rgba(201, 165, 32, 0.5);

    &::after {
      opacity: 1;
    }
  }
`;

const LoginHeader = styled.div`
  text-align: center;
  margin-bottom: ${theme.spacing.xl * 1.5}px;

  .logo {
    font-size: 3rem;
    margin-bottom: ${theme.spacing.md}px;
  }

  h1 {
    font-size: ${theme.typography.fontSize['2xl']};
    font-weight: ${theme.typography.fontWeight.bold};
    background: linear-gradient(135deg, #C9A520 0%, #6BBCD4 50%, #8B5CF6 100%);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin: 0 0 ${theme.spacing.sm}px 0;
    animation: ${shimmer} 3s linear infinite;
    filter: drop-shadow(0 0 20px rgba(201, 165, 32, 0.5));
  }

  p {
    color: var(--t-text);
    font-size: ${theme.typography.fontSize.sm};
    margin: 0;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  }
`;

const GlobeContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: ${theme.spacing.lg}px;
  perspective: 1000px;
`;

const Globe3D = styled.div`
  width: 100px;
  height: 100px;
  position: relative;
  animation: ${float} 3s ease-in-out infinite;
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

const GlobeInner = styled.div`
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
  font-size: 50px;
  filter: drop-shadow(0 0 20px rgba(255, 255, 255, 1));
  z-index: 1;
  opacity: 0.95;
  text-shadow: 0 0 25px rgba(255, 255, 255, 0.9);
`;

const GlobeRing = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotateX(75deg);
  width: 85%;
  height: 85%;
  border: 2px solid rgba(201, 165, 32, 0.5);
  border-radius: 50%;
  opacity: 0.7;
  animation: ${pulse} 3s ease-in-out infinite;
  z-index: 0;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.lg}px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm}px;

  label {
    font-size: ${theme.typography.fontSize.sm};
    font-weight: ${theme.typography.fontWeight.semibold};
    color: var(--t-text);
    letter-spacing: 0.02em;
  }

  input {
    padding: ${theme.spacing.md + 2}px ${theme.spacing.md}px;
    border: 2px solid rgba(201, 165, 32, 0.3);
    border-radius: ${theme.radius.lg}px;
    font-size: ${theme.typography.fontSize.md};
    background: var(--t-input-bg);
    backdrop-filter: blur(10px);
    color: ${theme.colors.text.primary};
    transition: all ${theme.transitions.normal};
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);

    &:focus {
      outline: none;
      border-color: ${theme.colors.primary.main};
      background: var(--t-input-bg-focus);
      box-shadow:
        0 0 0 4px rgba(201, 165, 32, 0.15),
        0 8px 25px rgba(201, 165, 32, 0.3);
      transform: translateY(-2px);
    }

    &::placeholder {
      color: var(--t-text-ter);
    }
  }
`;

const Button = styled.button`
  background: linear-gradient(135deg, #C9A520 0%, #6BBCD4 50%, #8B5CF6 100%);
  background-size: 200% auto;
  color: #ffffff;
  border: none;
  border-radius: ${theme.radius.lg}px;
  padding: ${theme.spacing.md + 4}px ${theme.spacing.xl}px;
  font-size: ${theme.typography.fontSize.md};
  font-weight: ${theme.typography.fontWeight.bold};
  cursor: pointer;
  transition: all ${theme.transitions.normal};
  box-shadow:
    0 8px 25px rgba(201, 165, 32, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
  letter-spacing: 0.05em;
  text-transform: uppercase;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.2), transparent);
    opacity: 0;
    transition: opacity ${theme.transitions.normal};
  }

  &:hover {
    transform: translateY(-3px);
    box-shadow:
      0 15px 40px rgba(201, 165, 32, 0.5),
      0 0 0 1px rgba(255, 255, 255, 0.2);
    animation: ${shimmer} 1.5s linear infinite;

    &::before {
      opacity: 1;
    }
  }

  &:active {
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    animation: none;
  }
`;

const ErrorMessage = styled.div`
  background: rgba(239, 68, 68, 0.15);
  border: 2px solid rgba(239, 68, 68, 0.5);
  border-radius: ${theme.radius.lg}px;
  padding: ${theme.spacing.md}px ${theme.spacing.lg}px;
  font-size: ${theme.typography.fontSize.sm};
  color: ${theme.colors.status.error};
  text-align: center;
  backdrop-filter: blur(10px);
  box-shadow:
    0 4px 15px rgba(239, 68, 68, 0.2),
    inset 0 0 20px rgba(239, 68, 68, 0.1);
  animation: ${pulse} 2s ease-in-out infinite;
`;

const TitleSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: ${theme.spacing.md}px;
`;

const Title = styled.h1`
  font-size: ${theme.typography.fontSize.xxl};
  font-weight: ${theme.typography.fontWeight.bold};
  color: ${theme.colors.text.primary};
  margin: 0;
`;

const SwitchForm = styled.div`
  text-align: center;
  margin-top: ${theme.spacing.xl}px;

  p {
    color: var(--t-text-sub);
    font-size: ${theme.typography.fontSize.sm};
    margin: 0;
  }

  button {
    background: none;
    border: none;
    color: #C9A520;
    font-size: ${theme.typography.fontSize.sm};
    font-weight: ${theme.typography.fontWeight.bold};
    cursor: pointer;
    text-decoration: none;
    transition: all ${theme.transitions.fast};
    position: relative;
    padding: 0 4px;

    &::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, #C9A520, #6BBCD4);
      transform: scaleX(0);
      transition: transform ${theme.transitions.fast};
    }

    &:hover {
      color: #6BBCD4;

      &::after {
        transform: scaleX(1);
      }
    }
  }
`;

const BackButton = styled.button`
  background: var(--t-glass);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(201, 165, 32, 0.3);
  color: var(--t-text);
  border-radius: ${theme.radius.lg}px;
  padding: ${theme.spacing.sm + 2}px ${theme.spacing.lg}px;
  font-size: ${theme.typography.fontSize.sm};
  font-weight: ${theme.typography.fontWeight.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.normal};
  margin-bottom: ${theme.spacing.xl}px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);

  &:hover {
    background: var(--t-glass-light);
    border-color: #C9A520;
    color: #ffffff;
    transform: translateX(-4px);
    box-shadow:
      0 6px 20px rgba(201, 165, 32, 0.3),
      -4px 0 15px rgba(201, 165, 32, 0.2);
  }

  &:active {
    transform: translateX(-2px);
  }
`;

const LoginForm = ({ onSwitchToSignup, onLogin, onBackToLanding }) => {
  const [formData, setFormData] = useState({
    user_name: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(''); // Clear error when user types
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('[LoginForm] Form submitted with:', { user_name: formData.user_name });
    setIsLoading(true);
    setError('');

    try {
      console.log('[LoginForm] Calling onLogin...');
      // Delegate to AuthContext via onLogin, passing credentials
      await onLogin({ user_name: formData.user_name, password: formData.password });
      console.log('[LoginForm] Login successful!');
    } catch (err) {
      console.error('[LoginForm] Login error:', err);
      console.error('[LoginForm] Error details:', {
        code: err.code,
        response: err.response,
        request: err.request,
        message: err.message
      });

      // Handle different error formats
      let errorMessage = 'Invalid username or password. Please try again.';
      // Plain string from Redux rejectWithValue (wrapped in App.handleLogin)
      if (err.message && !err.response && !err.request && !err.code) {
        errorMessage = err.message;
      } else if (err.code === 'ERR_NETWORK' || (!err.response && err.request)) {
        errorMessage = 'Cannot reach server. Please ensure the backend is running.';
      } else if (err.code === 'ECONNABORTED') {
        errorMessage = 'Login timed out. Please try again.';
      }

      if (err.response?.data) {
        const errorData = err.response.data;

        // Handle FastAPI validation errors
        if (Array.isArray(errorData.detail)) {
          errorMessage = errorData.detail.map(error => error.msg || error.message || String(error)).join(', ');
        }
        // Handle single error message
        else if (typeof errorData.detail === 'string') {
          errorMessage = errorData.detail;
        }
        // Handle other error formats
        else if (errorData.message) {
          errorMessage = errorData.message;
        }
        else if (typeof errorData === 'string') {
          errorMessage = errorData;
        }
      }

      console.error('[LoginForm] Final error message:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LoginContainer>
      <LoginCard>
        {onBackToLanding && (
          <BackButton onClick={onBackToLanding}>
            ← Back to Home
          </BackButton>
        )}
        <LoginHeader>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '24px' }}>
            <img src="/images/logo.png" alt="Orbisporté Logo" style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
            <h1 style={{ margin: 0 }}>ORBISPORTÉ</h1>
          </div>
          <p>The AI-Driven Global Trade Automation & Customs Platform</p>
          <p style={{ fontSize: '11px', marginTop: '6px', opacity: 0.7 }}>
            A product of SPECTRA AI PTE. LTD., Singapore
          </p>
        </LoginHeader>

        <Form onSubmit={handleSubmit}>
          {error && <ErrorMessage>{String(error)}</ErrorMessage>}

          <FormGroup>
            <label htmlFor="user_name">Username</label>
            <input
              type="text"
              id="user_name"
              name="user_name"
              value={formData.user_name}
              onChange={handleChange}
              placeholder="Enter your username"
              required
            />
          </FormGroup>

          <FormGroup>
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              required
            />
          </FormGroup>

          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Signing In...' : 'Sign In'}
          </Button>
        </Form>

        <SwitchForm>
          <p>
            Don't have an account?{' '}
            <button type="button" onClick={onSwitchToSignup}>
              Sign up
            </button>
          </p>
        </SwitchForm>
      </LoginCard>
    </LoginContainer>
  );
};

export default LoginForm;

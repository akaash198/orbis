/**
 * Signup Form Component
 * 
 * User registration form with validation.
 */

import React, { useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { useDispatch, useSelector } from 'react-redux';
import { signupUser } from '../../store/authSlice';
import theme from '../../styles/theme';

const SignupContainer = styled.div`
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, ${theme.colors.primary.main} 0%, ${theme.colors.primary.dark} 100%);
  padding: ${theme.spacing.sm}px;
  overflow: hidden;
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

const SignupCard = styled.div`
  background: rgba(10, 14, 39, 0.95);
  backdrop-filter: blur(30px);
  border: 1px solid rgba(201, 165, 32, 0.3);
  border-radius: ${theme.radius.xxl}px;
  padding: ${theme.spacing.md}px;
  max-height: 100vh;
  overflow-y: auto;
  box-shadow:
    0 20px 80px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(201, 165, 32, 0.1),
    0 0 60px rgba(201, 165, 32, 0.2);
  width: 100%;
  max-width: 520px;
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

const SignupHeader = styled.div`
  text-align: center;
  margin-bottom: ${theme.spacing.xs}px;

  .logo {
    font-size: 1.5rem;
    margin-bottom: 2px;
  }

  h1 {
    font-size: ${theme.typography.fontSize.lg};
    font-weight: ${theme.typography.fontWeight.bold};
    background: linear-gradient(135deg, #C9A520 0%, #6BBCD4 50%, #8B5CF6 100%);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin: 0 0 2px 0;
    animation: ${shimmer} 3s linear infinite;
    filter: drop-shadow(0 0 20px rgba(201, 165, 32, 0.5));
  }

  p {
    color: var(--t-text);
    font-size: 11px;
    margin: 2px 0;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    line-height: 1.2;
  }
`;

const GlobeContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 4px;
  perspective: 1000px;
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

const Globe3D = styled.div`
  width: 45px;
  height: 45px;
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
  font-size: 24px;
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
  gap: ${theme.spacing.xs}px;
`;

const FormRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${theme.spacing.sm}px;
  
  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xs}px;

  label {
    font-size: 12px;
    font-weight: ${theme.typography.fontWeight.semibold};
    color: var(--t-text);
    letter-spacing: 0.02em;
  }

  input, select {
    padding: 6px ${theme.spacing.sm}px;
    border: 2px solid rgba(201, 165, 32, 0.3);
    border-radius: ${theme.radius.lg}px;
    font-size: 13px;
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

const Logo = styled.img`
  height: 80px;
  object-fit: contain;
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


const Button = styled.button`
  background: linear-gradient(135deg, #C9A520 0%, #6BBCD4 50%, #8B5CF6 100%);
  background-size: 200% auto;
  color: #ffffff;
  border: none;
  border-radius: ${theme.radius.lg}px;
  padding: 8px ${theme.spacing.md}px;
  font-size: 13px;
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
  padding: ${theme.spacing.sm}px;
  font-size: 12px;
  color: ${theme.colors.status.error};
  text-align: center;
  backdrop-filter: blur(10px);
  box-shadow:
    0 4px 15px rgba(239, 68, 68, 0.2),
    inset 0 0 20px rgba(239, 68, 68, 0.1);
  animation: ${pulse} 2s ease-in-out infinite;
`;

const SuccessMessage = styled.div`
  background: rgba(16, 185, 129, 0.15);
  border: 2px solid rgba(16, 185, 129, 0.5);
  border-radius: ${theme.radius.lg}px;
  padding: ${theme.spacing.sm}px;
  font-size: 12px;
  color: ${theme.colors.status.success};
  text-align: center;
  backdrop-filter: blur(10px);
  box-shadow:
    0 4px 15px rgba(16, 185, 129, 0.2),
    inset 0 0 20px rgba(16, 185, 129, 0.1);
  animation: ${pulse} 2s ease-in-out infinite;
`;

const SwitchForm = styled.div`
  text-align: center;
  margin-top: ${theme.spacing.xs}px;

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
  padding: 4px ${theme.spacing.sm}px;
  font-size: 12px;
  font-weight: ${theme.typography.fontWeight.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.normal};
  margin-bottom: ${theme.spacing.xs}px;
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

const SignupForm = ({ onSwitchToLogin, onSignup, onBackToLanding }) => {
  const dispatch = useDispatch();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    businessEmail: '',
    password: '',
    confirmPassword: '',
    businessContactNumber: '',
    role: 'user',
    company: '',
    location: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    setError(''); // Clear error when user types
    setSuccess(''); // Clear success message
    
    // Real-time validation for specific fields
    const newFieldErrors = { ...fieldErrors };
    
    if (name === 'businessEmail' && value) {
      const emailValidation = validateBusinessEmail(value);
      if (!emailValidation.valid) {
        newFieldErrors.businessEmail = emailValidation.message;
      } else {
        delete newFieldErrors.businessEmail;
      }
    }
    
    if (name === 'businessContactNumber' && value) {
      const phoneValidation = validateBusinessPhone(value);
      if (!phoneValidation.valid) {
        newFieldErrors.businessContactNumber = phoneValidation.message;
      } else {
        delete newFieldErrors.businessContactNumber;
      }
    }
    
    setFieldErrors(newFieldErrors);
  };

  // Business email validation - exclude common personal email providers
  const validateBusinessEmail = (email) => {
    const businessEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const personalEmailDomains = [
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com',
      'icloud.com', 'aol.com', 'msn.com', 'protonmail.com', 'tutanota.com',
      'yandex.com', 'mail.com', 'gmx.com', 'zoho.com'
    ];
    
    if (!businessEmailRegex.test(email)) {
      return { valid: false, message: 'Please enter a valid email address' };
    }
    
    const domain = email.split('@')[1].toLowerCase();
    if (personalEmailDomains.includes(domain)) {
      return { 
        valid: false, 
        message: 'Please use a business email address (personal email providers like Gmail, Yahoo are not allowed)' 
      };
    }
    
    return { valid: true };
  };

  // Phone number validation - must include country code
  const validateBusinessPhone = (phone) => {
    // International phone number regex - must start with + and country code
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    
    if (!phoneRegex.test(phone)) {
      return { 
        valid: false, 
        message: 'Please enter a valid international phone number with country code (e.g., +1234567890)' 
      };
    }
    
    return { valid: true };
  };

  const validateForm = () => {
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }

    // Validate business email
    const emailValidation = validateBusinessEmail(formData.businessEmail);
    if (!emailValidation.valid) {
      setError(emailValidation.message);
      return false;
    }

    // Validate business phone
    const phoneValidation = validateBusinessPhone(formData.businessContactNumber);
    if (!phoneValidation.valid) {
      setError(phoneValidation.message);
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Map frontend field names to backend field names (backend uses snake_case)
      const signupData = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        user_name: formData.username,
        email_id: formData.businessEmail,  // Map businessEmail to email
        password: formData.password,
        mobile_number: formData.businessContactNumber,  // Map businessContactNumber to mobileNumber
        role: formData.role,
        location: formData.location
      };

      console.log('Sending signup data:', signupData);

      // Use Redux thunk for signup
      await dispatch(signupUser(signupData)).unwrap();

      setSuccess('Account created successfully! You can now sign in.');

      // Auto switch to login after successful signup
      setTimeout(() => {
        onSwitchToLogin();
      }, 2000);

    } catch (err) {
      console.error('Signup error:', err);
      console.error('Error type:', typeof err);
      console.error('Error details:', JSON.stringify(err, null, 2));

      // Redux thunk unwrap() throws the rejectWithValue payload directly
      const errorMessage = typeof err === 'string' ? err : 'Failed to create account. Please try again.';
      console.log('Setting error message:', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SignupContainer>
      <SignupCard>
        {onBackToLanding && (
          <BackButton onClick={onBackToLanding}>
            ← Back to Home
          </BackButton>
        )}
        <SignupHeader>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '16px' }}>
            <img src="/images/logo.png" alt="Orbisporté Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
            <h1 style={{ margin: 0, fontSize: '24px' }}>ORBISPORTÉ</h1>
          </div>
          <p>Join the AI-Driven Global Trade Automation & Customs Platform</p>
          <p style={{ fontSize: '11px', marginTop: '6px', opacity: 0.7, display: 'none' }}>
            A product of SPECTRA AI PTE. LTD., Singapore
          </p>
        </SignupHeader>

        <Form onSubmit={handleSubmit}>
          {error && <ErrorMessage>{String(error)}</ErrorMessage>}
          {success && <SuccessMessage>{success}</SuccessMessage>}

          <FormRow>
            <FormGroup>
              <label htmlFor="firstName">First Name</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="Enter your first name"
                required
              />
            </FormGroup>

            <FormGroup>
              <label htmlFor="lastName">Last Name</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Enter your last name"
                required
              />
            </FormGroup>
          </FormRow>

          <FormRow>
            <FormGroup>
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Choose a username"
                required
              />
            </FormGroup>

            <FormGroup>
              <label htmlFor="businessEmail">Business Email *</label>
              <input
                type="email"
                id="businessEmail"
                name="businessEmail"
                value={formData.businessEmail}
                onChange={handleChange}
                placeholder="your.name@company.com (no Gmail, Yahoo, etc.)"
                required
              />
              <small style={{ color: theme.colors.text.tertiary, fontSize: '12px', display: 'none' }}>
                Business email only - personal email providers not allowed
              </small>
              {fieldErrors.businessEmail && (
                <small style={{ color: theme.colors.status.error, fontSize: '12px', display: 'block', marginTop: '4px' }}>
                  {fieldErrors.businessEmail}
                </small>
              )}
            </FormGroup>
          </FormRow>

          <FormRow>
            <FormGroup>
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Create a password"
                required
              />
            </FormGroup>

            <FormGroup>
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm your password"
                required
              />
            </FormGroup>
          </FormRow>

          <FormRow>
            <FormGroup>
              <label htmlFor="businessContactNumber">Business Contact Number *</label>
              <input
                type="tel"
                id="businessContactNumber"
                name="businessContactNumber"
                value={formData.businessContactNumber}
                onChange={handleChange}
                placeholder="+1234567890 (include country code)"
                required
              />
              <small style={{ color: theme.colors.text.tertiary, fontSize: '12px', display: 'none' }}>
                International format with country code (e.g., +1 for US, +65 for Singapore)
              </small>
              {fieldErrors.businessContactNumber && (
                <small style={{ color: theme.colors.status.error, fontSize: '12px', display: 'block', marginTop: '4px' }}>
                  {fieldErrors.businessContactNumber}
                </small>
              )}
            </FormGroup>

            <FormGroup>
              <label htmlFor="role">Role</label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                required
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </FormGroup>
          </FormRow>

          <FormRow>
            <FormGroup>
              <label htmlFor="company">Company</label>
              <input
                type="text"
                id="company"
                name="company"
                value={formData.company}
                onChange={handleChange}
                placeholder="Enter your company name"
                required
              />
            </FormGroup>

            <FormGroup>
              <label htmlFor="location">Location</label>
              <input
                type="text"
                id="location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="City, Country"
                required
              />
            </FormGroup>
          </FormRow>

          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </Button>
        </Form>

        <SwitchForm>
          <p>
            Already have an account?{' '}
            <button type="button" onClick={onSwitchToLogin}>
              Sign in
            </button>
          </p>
        </SwitchForm>
      </SignupCard>
    </SignupContainer>
  );
};

export default SignupForm;

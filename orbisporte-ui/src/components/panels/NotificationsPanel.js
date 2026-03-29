/**
 * NotificationsPanel Component - Module 7
 * OrbisPorté - The AI-Driven Global Trade Automation & Customs Platform
 * A product of SPECTRA AI PTE. LTD., Singapore
 *
 * Track CBIC customs notifications and auto-update duty rates
 * Location: Standalone menu item in sidebar
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import theme from '../../styles/theme';
import { notificationService } from '../../services/api';

const PanelContainer = styled.div`
  padding: ${theme.spacing.xxl}px;
  min-height: 100vh;
  display: flex;
  overflow-y: auto;
  flex-direction: column;
  gap: ${theme.spacing.xxl}px;
  background: ${theme.colors.ui.background};
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${theme.spacing.lg}px;
`;

const Title = styled.h1`
  font-weight: ${theme.typography.fontWeight.extrabold};
  font-size: ${theme.typography.fontSize['4xl']};
  color: ${theme.colors.text.primary};
  margin: 0;
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md}px;
  text-shadow: ${theme.typography.textShadow.sm};
  letter-spacing: -0.02em;

  &:before {
    content: '📢';
    font-size: ${theme.typography.fontSize['5xl']};
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
  }
`;

const Subtitle = styled.p`
  color: ${theme.colors.text.secondary};
  font-size: ${theme.typography.fontSize.lg};
  font-weight: ${theme.typography.fontWeight.medium};
  margin: ${theme.spacing.sm}px 0 0 0;
  line-height: 1.6;
`;

const TabContainer = styled.div`
  display: flex;
  gap: ${theme.spacing.md}px;
  margin-bottom: ${theme.spacing.lg}px;
  border-bottom: 2px solid ${theme.colors.ui.borderLight};
`;

const Tab = styled.button`
  padding: ${theme.spacing.md}px ${theme.spacing.xl}px;
  background: ${props => props.$active ? theme.colors.primary.main : 'transparent'};
  color: ${props => props.$active ? 'white' : theme.colors.text.secondary};
  border: none;
  border-bottom: 3px solid ${props => props.$active ? theme.colors.primary.main : 'transparent'};
  font-size: ${theme.typography.fontSize.md};
  font-weight: ${theme.typography.fontWeight.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.normal};
  border-radius: ${theme.radius.md}px ${theme.radius.md}px 0 0;

  &:hover {
    background: ${props => props.$active ? theme.colors.primary.main : theme.colors.ui.hover};
  }
`;

const Card = styled.div`
  background: ${theme.colors.ui.cardElevated};
  border-radius: ${theme.radius.xxl}px;
  padding: ${theme.spacing.xxl}px;
  box-shadow: ${theme.shadows.card};
  border: 1px solid ${theme.colors.ui.borderLight};
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-top: ${theme.spacing.lg}px;
`;

const Th = styled.th`
  text-align: left;
  padding: ${theme.spacing.md}px;
  border-bottom: 2px solid ${theme.colors.ui.borderLight};
  color: ${theme.colors.text.secondary};
  font-weight: ${theme.typography.fontWeight.semibold};
  font-size: ${theme.typography.fontSize.sm};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const Td = styled.td`
  padding: ${theme.spacing.md}px;
  border-bottom: 1px solid ${theme.colors.ui.borderLight};
  color: ${theme.colors.text.primary};
`;

const Button = styled.button`
  padding: ${theme.spacing.md}px ${theme.spacing.lg}px;
  background: ${props => props.$secondary ? theme.colors.ui.card : theme.colors.primary.main};
  color: ${props => props.$secondary ? theme.colors.text.primary : 'white'};
  border: 1px solid ${props => props.$secondary ? theme.colors.ui.borderLight : 'transparent'};
  border-radius: ${theme.radius.lg}px;
  font-size: ${theme.typography.fontSize.md};
  font-weight: ${theme.typography.fontWeight.semibold};
  cursor: pointer;
  transition: all ${theme.transitions.normal};
  display: inline-flex;
  align-items: center;
  gap: ${theme.spacing.sm}px;

  &:hover {
    transform: translateY(-1px);
    box-shadow: ${theme.shadows.button};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const Badge = styled.span`
  display: inline-block;
  padding: ${theme.spacing.xs}px ${theme.spacing.sm}px;
  border-radius: ${theme.radius.md}px;
  font-size: ${theme.typography.fontSize.xs};
  font-weight: ${theme.typography.fontWeight.semibold};
  background: ${props => {
    switch (props.$status) {
      case 'parsed': return theme.colors.status.successLight;
      case 'pending': return theme.colors.status.warningLight;
      case 'failed': return theme.colors.status.errorLight;
      default: return theme.colors.ui.border;
    }
  }};
  color: ${props => {
    switch (props.$status) {
      case 'parsed': return theme.colors.status.successDark;
      case 'pending': return theme.colors.status.warningDark;
      case 'failed': return theme.colors.status.errorDark;
      default: return theme.colors.text.secondary;
    }
  }};
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
`;

const Label = styled.label`
  font-size: ${theme.typography.fontSize.sm};
  font-weight: ${theme.typography.fontWeight.semibold};
  color: ${theme.colors.text.secondary};
`;

const Input = styled.input`
  padding: ${theme.spacing.md}px;
  border: 1px solid ${theme.colors.ui.borderLight};
  border-radius: ${theme.radius.lg}px;
  font-size: ${theme.typography.fontSize.md};
  transition: all ${theme.transitions.normal};

  &:focus {
    outline: none;
    border-color: ${theme.colors.primary.main};
    box-shadow: 0 0 0 3px ${theme.colors.primary.main}20;
  }
`;

const TextArea = styled.textarea`
  padding: ${theme.spacing.md}px;
  border: 1px solid ${theme.colors.ui.borderLight};
  border-radius: ${theme.radius.lg}px;
  font-size: ${theme.typography.fontSize.md};
  min-height: 150px;
  font-family: inherit;
  transition: all ${theme.transitions.normal};

  &:focus {
    outline: none;
    border-color: ${theme.colors.primary.main};
    box-shadow: 0 0 0 3px ${theme.colors.primary.main}20;
  }
`;

const Select = styled.select`
  padding: ${theme.spacing.md}px;
  border: 1px solid ${theme.colors.ui.borderLight};
  border-radius: ${theme.radius.lg}px;
  font-size: ${theme.typography.fontSize.md};
  background: ${theme.colors.ui.card};
  color: ${theme.colors.text.primary};
  cursor: pointer;
  transition: all ${theme.transitions.normal};

  &:focus {
    outline: none;
    border-color: ${theme.colors.primary.main};
    box-shadow: 0 0 0 3px ${theme.colors.primary.main}20;
  }
`;

const LoadingSpinner = styled.div`
  text-align: center;
  padding: ${theme.spacing.xxl}px;
  color: ${theme.colors.text.secondary};
`;

const ErrorMessage = styled.div`
  background: ${theme.colors.status.errorLight};
  color: ${theme.colors.status.errorDark};
  padding: ${theme.spacing.md}px;
  border-radius: ${theme.radius.lg}px;
  margin-bottom: ${theme.spacing.md}px;
`;

const SuccessMessage = styled.div`
  background: ${theme.colors.status.successLight};
  color: ${theme.colors.status.successDark};
  padding: ${theme.spacing.md}px;
  border-radius: ${theme.radius.lg}px;
  margin-bottom: ${theme.spacing.md}px;
`;

const NotificationsPanel = () => {
  const [activeTab, setActiveTab] = useState('list'); // 'list', 'ingest', 'rate-changes'
  const [notifications, setNotifications] = useState([]);
  const [rateChanges, setRateChanges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [formData, setFormData] = useState({
    notification_number: '',
    notification_type: 'Customs',
    title: '',
    issue_date: '',
    effective_from: '',
    effective_to: '',
    raw_text: '',
    source_url: ''
  });

  // Load notifications on mount
  useEffect(() => {
    if (activeTab === 'list') {
      loadNotifications();
    } else if (activeTab === 'rate-changes') {
      loadRateChanges();
    }
  }, [activeTab]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await notificationService.listNotifications({ limit: 50 });
      setNotifications(result.notifications || []);
    } catch (err) {
      const errorMsg = typeof err.response?.data?.detail === 'string'
        ? err.response.data.detail
        : err.message || 'Failed to load notifications';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const loadRateChanges = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await notificationService.getRateChanges(90);
      setRateChanges(result.rate_changes || []);
    } catch (err) {
      const errorMsg = typeof err.response?.data?.detail === 'string'
        ? err.response.data.detail
        : err.message || 'Failed to load rate changes';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleIngestSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const result = await notificationService.ingestNotification(formData);
      setSuccess(`Notification ${result.notification_number} ingested successfully!`);

      // Reset form
      setFormData({
        notification_number: '',
        notification_type: 'Customs',
        title: '',
        issue_date: '',
        effective_from: '',
        effective_to: '',
        raw_text: '',
        source_url: ''
      });

      // Reload notifications
      setActiveTab('list');
    } catch (err) {
      const errorMsg = typeof err.response?.data?.detail === 'string'
        ? err.response.data.detail
        : err.message || 'Failed to ingest notification';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleParse = async (notificationId) => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      const result = await notificationService.parseNotification(notificationId, false);

      if (result.success) {
        setSuccess(`Notification parsed successfully! Found ${result.count} items.`);
        loadNotifications();
      } else {
        setError(result.error || 'Failed to parse notification');
      }
    } catch (err) {
      const errorMsg = typeof err.response?.data?.detail === 'string'
        ? err.response.data.detail
        : err.message || 'Failed to parse notification';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PanelContainer>
      <Header>
        <div>
          <Title>Notification Tracking</Title>
          <Subtitle>Track CBIC customs notifications and auto-update duty rates</Subtitle>
        </div>
      </Header>

      <TabContainer>
        <Tab $active={activeTab === 'list'} onClick={() => setActiveTab('list')}>
          Notifications List
        </Tab>
        <Tab $active={activeTab === 'ingest'} onClick={() => setActiveTab('ingest')}>
          Ingest New
        </Tab>
        <Tab $active={activeTab === 'rate-changes'} onClick={() => setActiveTab('rate-changes')}>
          Rate Changes
        </Tab>
      </TabContainer>

      {error && <ErrorMessage>{error}</ErrorMessage>}
      {success && <SuccessMessage>{success}</SuccessMessage>}

      {activeTab === 'list' && (
        <Card>
          <h2>All Notifications</h2>
          {loading ? (
            <LoadingSpinner>Loading notifications...</LoadingSpinner>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Notification #</Th>
                  <Th>Type</Th>
                  <Th>Title</Th>
                  <Th>Issue Date</Th>
                  <Th>Effective From</Th>
                  <Th>Status</Th>
                  <Th>Items</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {notifications.map(n => (
                  <tr key={n.id}>
                    <Td>{n.notification_number}</Td>
                    <Td>{n.notification_type}</Td>
                    <Td>{n.title}</Td>
                    <Td>{n.issue_date}</Td>
                    <Td>{n.effective_from}</Td>
                    <Td><Badge $status={n.parsed_status}>{n.parsed_status}</Badge></Td>
                    <Td>{n.items_count || 0}</Td>
                    <Td>
                      {n.parsed_status === 'pending' ? (
                        <Button $secondary onClick={() => handleParse(n.id)} disabled={loading}>
                          Parse
                        </Button>
                      ) : (
                        <span style={{ color: theme.colors.text.tertiary, fontSize: '0.875rem' }}>
                          ✓ Parsed
                        </span>
                      )}
                    </Td>
                  </tr>
                ))}
                {notifications.length === 0 && (
                  <tr>
                    <Td colSpan="8" style={{ textAlign: 'center', color: theme.colors.text.secondary }}>
                      No notifications found. Ingest your first notification!
                    </Td>
                  </tr>
                )}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {activeTab === 'ingest' && (
        <Card>
          <h2>Ingest New Notification</h2>
          <Form onSubmit={handleIngestSubmit}>
            <FormGroup>
              <Label>Notification Number *</Label>
              <Input
                name="notification_number"
                value={formData.notification_number}
                onChange={handleInputChange}
                placeholder="e.g., 50/2024-Customs"
                required
              />
            </FormGroup>

            <FormGroup>
              <Label>Notification Type *</Label>
              <Select
                name="notification_type"
                value={formData.notification_type}
                onChange={handleInputChange}
                required
              >
                <option value="Customs">Customs</option>
                <option value="IGST">IGST</option>
                <option value="ADD">ADD (Anti-Dumping)</option>
                <option value="FTA">FTA (Free Trade Agreement)</option>
                <option value="Exemption">Exemption</option>
              </Select>
            </FormGroup>

            <FormGroup>
              <Label>Title *</Label>
              <Input
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="e.g., Amendment to Customs Tariff - Electronic Goods"
                required
              />
            </FormGroup>

            <FormGroup>
              <Label>Issue Date *</Label>
              <Input
                name="issue_date"
                type="date"
                value={formData.issue_date}
                onChange={handleInputChange}
                required
              />
            </FormGroup>

            <FormGroup>
              <Label>Effective From *</Label>
              <Input
                name="effective_from"
                type="date"
                value={formData.effective_from}
                onChange={handleInputChange}
                required
              />
            </FormGroup>

            <FormGroup>
              <Label>Effective To (Optional)</Label>
              <Input
                name="effective_to"
                type="date"
                value={formData.effective_to}
                onChange={handleInputChange}
              />
            </FormGroup>

            <FormGroup>
              <Label>Source URL (Optional)</Label>
              <Input
                name="source_url"
                value={formData.source_url}
                onChange={handleInputChange}
                placeholder="https://www.cbic.gov.in/..."
              />
            </FormGroup>

            <FormGroup>
              <Label>Notification Text *</Label>
              <TextArea
                name="raw_text"
                value={formData.raw_text}
                onChange={handleInputChange}
                placeholder="Paste the full notification text here..."
                required
              />
            </FormGroup>

            <Button type="submit" disabled={loading}>
              {loading ? 'Ingesting...' : 'Ingest Notification'}
            </Button>
          </Form>
        </Card>
      )}

      {activeTab === 'rate-changes' && (
        <Card>
          <h2>Recent Rate Changes (Last 90 Days)</h2>
          {loading ? (
            <LoadingSpinner>Loading rate changes...</LoadingSpinner>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Notification #</Th>
                  <Th>HSN Code</Th>
                  <Th>Product</Th>
                  <Th>Duty Type</Th>
                  <Th>Old Rate</Th>
                  <Th>New Rate</Th>
                  <Th>Change</Th>
                  <Th>Effective From</Th>
                </tr>
              </thead>
              <tbody>
                {rateChanges.map((change, idx) => (
                  <tr key={idx}>
                    <Td>{change.notification_number}</Td>
                    <Td>{change.hsn_code_from}</Td>
                    <Td>{change.product_description}</Td>
                    <Td>{change.duty_type}</Td>
                    <Td>{change.old_rate}%</Td>
                    <Td>{change.new_rate}%</Td>
                    <Td style={{ color: change.change_direction === 'increased' ? theme.colors.status.error : theme.colors.status.success }}>
                      {change.rate_change > 0 ? '+' : ''}{change.rate_change}%
                    </Td>
                    <Td>{change.effective_from}</Td>
                  </tr>
                ))}
                {rateChanges.length === 0 && (
                  <tr>
                    <Td colSpan="8" style={{ textAlign: 'center', color: theme.colors.text.secondary }}>
                      No rate changes in the last 90 days
                    </Td>
                  </tr>
                )}
              </tbody>
            </Table>
          )}
        </Card>
      )}
    </PanelContainer>
  );
};

export default NotificationsPanel;

/**
 * Settings Panel Component
 * 
 * Settings page with user management, profile settings, and system configuration.
 */

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useSelector, useDispatch } from 'react-redux';
import { logoutUser, updateUser as updateUserAction } from '../../store/authSlice';
import { authService } from '../../services/api';
import theme from '../../styles/theme';

const SettingsContainer = styled.div`
  padding: ${theme.spacing.xl}px;
  max-width: 1000px;
  margin: 0 auto;
  height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
`;

const SettingsHeader = styled.div`
  margin-bottom: ${theme.spacing.xl}px;
  
  h1 {
    font-size: ${theme.typography.fontSize.xxl};
    font-weight: ${theme.typography.fontWeight.bold};
    color: ${theme.colors.text.primary};
    margin: 0 0 ${theme.spacing.sm}px 0;
  }
  
  p {
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.fontSize.lg};
    margin: 0;
  }
`;

const SettingsTabs = styled.div`
  display: flex;
  gap: ${theme.spacing.sm}px;
  margin-bottom: ${theme.spacing.xl}px;
  border-bottom: 1px solid ${theme.colors.ui.border};
`;

const Tab = styled.button`
  background: none;
  border: none;
  padding: ${theme.spacing.md}px ${theme.spacing.lg}px;
  font-size: ${theme.typography.fontSize.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  color: ${props => props.active ? theme.colors.primary.main : theme.colors.text.secondary};
  cursor: pointer;
  border-bottom: 2px solid ${props => props.active ? theme.colors.primary.main : 'transparent'};
  transition: all ${theme.transitions.fast};
  
  &:hover {
    color: ${theme.colors.primary.main};
  }
`;

const TabContent = styled.div`
  background: ${theme.colors.ui.card};
  border: 1px solid ${theme.colors.ui.border};
  border-radius: ${theme.radius.lg}px;
  padding: ${theme.spacing.xl}px;
  box-shadow: ${theme.shadows.sm};
`;

const FormGroup = styled.div`
  margin-bottom: ${theme.spacing.lg}px;
  
  label {
    display: block;
    font-size: ${theme.typography.fontSize.sm};
    font-weight: ${theme.typography.fontWeight.medium};
    color: ${theme.colors.text.primary};
    margin-bottom: ${theme.spacing.sm}px;
  }
  
  input, select, textarea {
    width: 100%;
    padding: ${theme.spacing.md}px;
    border: 1px solid ${theme.colors.ui.border};
    border-radius: ${theme.radius.md}px;
    font-size: ${theme.typography.fontSize.sm};
    background: ${theme.colors.ui.background};
    color: ${theme.colors.text.primary};
    transition: border-color ${theme.transitions.fast};
    
    &:focus {
      outline: none;
      border-color: ${theme.colors.primary.main};
      box-shadow: 0 0 0 3px ${theme.colors.primary.light}20;
    }
  }
`;

const Button = styled.button`
  background: ${props => props.variant === 'danger' ? theme.colors.status.error : theme.colors.primary.gradient};
  color: ${props => props.variant === 'danger' ? theme.colors.text.primary : theme.colors.primary.contrast};
  border: none;
  border-radius: ${theme.radius.md}px;
  padding: ${theme.spacing.md}px ${theme.spacing.lg}px;
  font-size: ${theme.typography.fontSize.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  cursor: pointer;
  transition: all ${theme.transitions.normal};
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: ${theme.shadows.md};
  }
  
  &:active {
    transform: translateY(0);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const Message = styled.div`
  padding: ${theme.spacing.md}px;
  border-radius: ${theme.radius.md}px;
  margin-bottom: ${theme.spacing.lg}px;
  font-size: ${theme.typography.fontSize.sm};
  text-align: center;
  
  &.error {
    background: ${theme.colors.status.errorLight};
    color: ${theme.colors.status.error};
    border: 1px solid ${theme.colors.status.error};
  }
  
  &.success {
    background: ${theme.colors.status.successLight};
    color: ${theme.colors.status.success};
    border: 1px solid ${theme.colors.status.success};
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: ${theme.spacing.md}px;
  margin-top: ${theme.spacing.lg}px;
`;

const UserList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.md}px;
`;

const UserCard = styled.div`
  background: ${theme.colors.ui.background};
  border: 1px solid ${theme.colors.ui.border};
  border-radius: ${theme.radius.md}px;
  padding: ${theme.spacing.lg}px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  
  .user-info {
    display: flex;
    align-items: center;
    gap: ${theme.spacing.md}px;
    
    .avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: ${theme.colors.primary.gradient};
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${theme.colors.primary.contrast};
      font-weight: ${theme.typography.fontWeight.bold};
    }
    
    .details {
      .name {
        font-size: ${theme.typography.fontSize.sm};
        font-weight: ${theme.typography.fontWeight.medium};
        color: ${theme.colors.text.primary};
        margin: 0 0 ${theme.spacing.xs}px 0;
      }
      
      .email {
        font-size: ${theme.typography.fontSize.xs};
        color: ${theme.colors.text.secondary};
        margin: 0;
      }
    }
  }
  
  .actions {
    display: flex;
    gap: ${theme.spacing.sm}px;
  }
`;

const SettingsPanel = () => {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  
  const [activeTab, setActiveTab] = useState('profile');
  const [currentUser, setCurrentUser] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    company: user?.company || '',
    role: user?.role || 'user',
    businessEmail: user?.businessEmail || '',
    businessContactNumber: user?.businessContactNumber || '',
    location: user?.location || '',
    username: user?.username || ''
  });
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // Update current user when user context changes
    if (user) {
      setCurrentUser({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        company: user.company || '',
        role: user.role || 'user',
        businessEmail: user.businessEmail || '',
        businessContactNumber: user.businessContactNumber || '',
        location: user.location || '',
        username: user.username || ''
      });
    }
    
    // Fetch users from API
    fetchUsers();
  }, [user]);

  const fetchUsers = async () => {
    try {
      const response = await authService.getUsers();
      setUsers(response.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to fetch users');
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // Update profile via API
      const response = await authService.updateProfile(user.id, {
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        username: currentUser.username,
        businessEmail: currentUser.businessEmail,
        businessContactNumber: currentUser.businessContactNumber,
        location: currentUser.location,
        company: currentUser.company,
        role: currentUser.role
      });
      
      // Update the Redux store
      dispatch(updateUserAction(response.user));
      
      // Refresh users list
      fetchUsers();
      
      setSuccess('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      setError(error.response?.data?.detail || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');
    
    const formData = new FormData(e.target);
    const userData = {
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      username: formData.get('username'),
      businessEmail: formData.get('businessEmail'),
      password: formData.get('password'),
      businessContactNumber: formData.get('businessContactNumber'),
      role: formData.get('role'),
      company: formData.get('company'),
      location: formData.get('location')
    };
    
    try {
      // Create user via API
      const response = await authService.createUser(userData);
      setSuccess('User created successfully!');
      e.target.reset(); // Reset form
      
      // Refresh users list
      fetchUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      setError(error.response?.data?.detail || 'Failed to create user');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        // Delete user via API
        await authService.deleteUser(userId);
        setSuccess('User deleted successfully!');
        
        // Refresh users list
        fetchUsers();
      } catch (error) {
        console.error('Error deleting user:', error);
        setError(error.response?.data?.detail || 'Failed to delete user');
      }
    }
  };

  const handleSignOut = () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      dispatch(logoutUser());
    }
  };

  const renderProfileTab = () => (
    <form onSubmit={handleProfileUpdate}>
      {error && <Message className="error">{error}</Message>}
      {success && <Message className="success">{success}</Message>}
      
      <FormGroup>
        <label>First Name</label>
        <input
          type="text"
          value={currentUser.firstName}
          onChange={(e) => setCurrentUser({...currentUser, firstName: e.target.value})}
        />
      </FormGroup>
      
      <FormGroup>
        <label>Last Name</label>
        <input
          type="text"
          value={currentUser.lastName}
          onChange={(e) => setCurrentUser({...currentUser, lastName: e.target.value})}
        />
      </FormGroup>
      
      <FormGroup>
        <label>Company</label>
        <input
          type="text"
          value={currentUser.company}
          onChange={(e) => setCurrentUser({...currentUser, company: e.target.value})}
        />
      </FormGroup>
      
      <FormGroup>
        <label>Role</label>
        <select
          value={currentUser.role}
          onChange={(e) => setCurrentUser({...currentUser, role: e.target.value})}
        >
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </FormGroup>

      <FormGroup>
        <label>Business Email</label>
        <input
          type="email"
          value={currentUser.businessEmail}
          onChange={(e) => setCurrentUser({...currentUser, businessEmail: e.target.value})}
        />
      </FormGroup>

      <FormGroup>
        <label>Business Contact number</label>
        <input
          type="tel"
          value={currentUser.businessContactNumber}
          onChange={(e) => setCurrentUser({...currentUser, businessContactNumber: e.target.value})}
        />
      </FormGroup>

      <FormGroup>
        <label>Location</label>
        <input
          type="text"
          value={currentUser.location}
          onChange={(e) => setCurrentUser({...currentUser, location: e.target.value})}
        />
      </FormGroup>

      <FormGroup>
        <label>Username</label>
        <input
          type="text"
          value={currentUser.username}
          onChange={(e) => setCurrentUser({...currentUser, username: e.target.value})}
        />
      </FormGroup>
      
      <ButtonGroup>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Updating...' : 'Update Profile'}
        </Button>
        <Button type="button" variant="danger" onClick={handleSignOut}>
          Sign Out
        </Button>
      </ButtonGroup>
    </form>
  );

  const renderUsersTab = () => (
    <div>
      {error && <Message className="error">{error}</Message>}
      {success && <Message className="success">{success}</Message>}
      
      <h3 style={{ marginBottom: theme.spacing.lg + 'px', color: theme.colors.text.primary }}>
        Create New User
      </h3>
      
      <form onSubmit={handleCreateUser} style={{ marginBottom: theme.spacing.xl + 'px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md + 'px' }}>
          <FormGroup>
            <label>First Name</label>
            <input type="text" name="firstName" required />
          </FormGroup>
          
          <FormGroup>
            <label>Last Name</label>
            <input type="text" name="lastName" required />
          </FormGroup>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md + 'px' }}>
          <FormGroup>
            <label>Business Email</label>
            <input type="email" name="businessEmail" required />
          </FormGroup>
          
          <FormGroup>
            <label>Username</label>
            <input type="text" name="username" required />
          </FormGroup>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md + 'px' }}>
          <FormGroup>
            <label>Password</label>
            <input type="password" name="password" required />
          </FormGroup>
          
          <FormGroup>
            <label>Business Contact Number</label>
            <input type="tel" name="businessContactNumber" required />
          </FormGroup>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md + 'px' }}>
          <FormGroup>
            <label>Role</label>
            <select name="role" required>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </FormGroup>
          
          <FormGroup>
            <label>Company</label>
            <input type="text" name="company" required />
          </FormGroup>
        </div>
        
        <FormGroup>
          <label>Location</label>
          <input type="text" name="location" required />
        </FormGroup>
        
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create User'}
        </Button>
      </form>
      
      <h3 style={{ marginBottom: theme.spacing.lg + 'px', color: theme.colors.text.primary }}>
        Existing Users
      </h3>
      
      <UserList>
        {users.map((user) => (
          <UserCard key={user.id}>
            <div className="user-info">
              <div className="avatar">
                {user.firstName[0]}{user.lastName[0]}
              </div>
              <div className="details">
                <div className="name">{user.firstName} {user.lastName}</div>
                <div className="email">{user.businessEmail}</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                  {user.role} • {user.company}
                </div>
              </div>
            </div>
            <div className="actions">
              <Button variant="danger" onClick={() => handleDeleteUser(user.id)}>
                Delete
              </Button>
            </div>
          </UserCard>
        ))}
      </UserList>
    </div>
  );

  const renderSystemTab = () => (
    <div>
      <h3 style={{ marginBottom: theme.spacing.lg + 'px', color: theme.colors.text.primary }}>
        System Settings
      </h3>
      
      <FormGroup>
        <label>API Endpoint</label>
        <input type="text" defaultValue="http://localhost:8000" />
      </FormGroup>
      
      <FormGroup>
        <label>Max File Size (MB)</label>
        <input type="number" defaultValue="10" />
      </FormGroup>
      
      <FormGroup>
        <label>Auto-process Documents</label>
        <select defaultValue="true">
          <option value="true">Enabled</option>
          <option value="false">Disabled</option>
        </select>
      </FormGroup>
      
      <ButtonGroup>
        <Button>Save Settings</Button>
      </ButtonGroup>
    </div>
  );

  return (
    <SettingsContainer>
      <SettingsHeader>
        <h1>Settings</h1>
        <p>Manage your profile, users, and system configuration.</p>
      </SettingsHeader>

      <SettingsTabs>
        <Tab active={activeTab === 'profile'} onClick={() => setActiveTab('profile')}>
          Profile
        </Tab>
        <Tab active={activeTab === 'users'} onClick={() => setActiveTab('users')}>
          User Management
        </Tab>
        <Tab active={activeTab === 'system'} onClick={() => setActiveTab('system')}>
          System
        </Tab>
      </SettingsTabs>

      <TabContent>
        {activeTab === 'profile' && renderProfileTab()}
        {activeTab === 'users' && renderUsersTab()}
        {activeTab === 'system' && renderSystemTab()}
      </TabContent>
    </SettingsContainer>
  );
};

export default SettingsPanel;
